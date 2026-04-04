// backend/src/email/email.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import sharp from 'sharp';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
  fromEmail: string;
  fromName: string;
}

@Injectable()
export class EmailService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get SMTP configuration from database or fallback to env vars
   */
  private async getSmtpConfig(): Promise<SmtpConfig> {
    const keys = [
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_password',
      'smtp_secure',
      'from_email',
      'from_name',
    ];

    const configs = await this.prisma.systemConfig.findMany({
      where: { key: { in: keys } },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return {
      host: configMap['smtp_host'] || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(configMap['smtp_port'] || process.env.SMTP_PORT || '587'),
      user: configMap['smtp_user'] || process.env.SMTP_USER || '',
      password: configMap['smtp_password'] || process.env.SMTP_PASSWORD || '',
      secure: (configMap['smtp_secure'] || process.env.SMTP_SECURE || 'false') === 'true',
      fromEmail: configMap['from_email'] || process.env.SMTP_USER || '',
      fromName: configMap['from_name'] || 'RIM System',
    };
  }

  /**
   * Create transporter with current config
   */
  private async createTransporter(): Promise<nodemailer.Transporter> {
    const config = await this.getSmtpConfig();

    console.log('Creating SMTP transporter with config:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.user,
      fromEmail: config.fromEmail,
    });

    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 15000,
      // For self-signed certificates
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Send incident closure notification email (with theme color + photo thumbnails)
   */
  async sendIncidentClosureEmail(data: {
    to: string;
    cc?: string[];
    incidentId: string;
    ticketNumber: string;
    title: string;
    storeName: string;
    storeCode?: string;
    technicianName: string;
    resolutionNote: string;
    usedSpareParts: boolean;
    spareParts?: any[];
    checkInAt?: Date | null;
    resolvedAt: Date;
    confirmedAt: Date;
    beforePhotos?: string[];
    afterPhotos?: string[];
    signedReportPhotos?: string[];
    publicIncidentLink?: string | null;
    ratingLink?: string | null;
    serviceReportLink?: string | null;
  }): Promise<void> {
    try {
      const config = await this.getSmtpConfig();
      const transporter = await this.createTransporter();

      // Fetch organization name + theme color
      const orgConfigs = await this.prisma.systemConfig.findMany({
        where: { key: { in: ['organization_name', 'theme_bg_start', 'theme_bg_end'] } },
      });
      const cfgMap: Record<string, string> = {};
      for (const c of orgConfigs) cfgMap[c.key] = c.value;
      const orgName = cfgMap['organization_name'] || 'Incident Management';
      const headerName = orgName ? `${orgName} Incident Management` : 'Incident Management';
      // themeColor reserved for future use in closure email template

      const {
        to,
        cc,
        ticketNumber,
        title,
        storeName,
        storeCode,
        technicianName,
        resolutionNote,
        spareParts,
        checkInAt,
        resolvedAt,
        beforePhotos,
        afterPhotos,
        signedReportPhotos,
        publicIncidentLink,
      } = data;

      // Base URL for serving uploaded photos (same host as API, without /api suffix)
      const apiBase = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/api$/, '');

      // Store display: "storeCode storeName" (no brackets)
      const storeDisplay = storeCode ? `${storeCode} ${storeName}` : storeName;

      // Build spare parts HTML — always shown
      let sparePartsHtml = '';
      const equipParts = (spareParts || []).filter((p: any) => p.repairType !== 'COMPONENT_REPLACEMENT');
      const compParts = (spareParts || []).filter((p: any) => p.repairType === 'COMPONENT_REPLACEMENT');
      const hasEquip = equipParts.length > 0;
      const hasComp = compParts.length > 0;

      // Build equipHtml: Device Used section
      let equipHtml = '';
      if (hasEquip || !hasComp) {
        const equipRows = hasEquip
          ? (equipParts as any[]).map((part, index) => {
              const deviceName = part.equipmentName || part.oldEquipment?.name || part.deviceName || '-';
              const oldBrandModel = part.oldBrandModel ||
                [part.oldEquipment?.brand, part.oldEquipment?.model].filter(Boolean).join(' ') || '-';
              const newBrandModel = part.newBrandModel ||
                [part.newBrand, part.newModel].filter(Boolean).join(' ') ||
                [part.newEquipment?.brand, part.newEquipment?.model].filter(Boolean).join(' ') || '-';
              const oldSerial = part.oldSerialNo || '-';
              const newSerial = part.newSerialNo || '-';
              return `
                <tr style="background-color: #ffffff;">
                  <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${index + 1}</td>
                  <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
                    <div style="font-weight:600;color:#1e293b;">${deviceName}</div>
                  </td>
                  <td style="padding: 9px 12px; border: 1px solid #cbd5e1; color: #475569; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${oldBrandModel}</td>
                  <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #475569;">${oldSerial}</td>
                  <td style="padding: 9px 12px; border: 1px solid #cbd5e1; color: #475569; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${newBrandModel}</td>
                  <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #475569; font-weight: 600;">${newSerial}</td>
                </tr>
              `;
            }).join('')
          : `<tr><td colspan="6" style="padding: 14px 16px; border: 1px solid #e2e8f0; color: #64748b; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">ไม่มีการใช้ Spare Part</td></tr>`;

        equipHtml = `
          <div style="margin-top: 24px;">
            <h3 style="color: #059669; margin: 0 0 12px 0; font-size: 15px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Device Used</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
              <thead>
                <tr style="background-color: #dcfce7;">
                  <th style="padding: 8px 10px; text-align: center; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; width: 32px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">#</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Equipment</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Old Brand/Model</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Old Serial No.</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">New Brand/Model</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">New Serial No.</th>
                </tr>
              </thead>
              <tbody>
                ${equipRows}
              </tbody>
            </table>
          </div>
        `;
      }

      // Build compHtml: Spare Part Used section (only if hasComp)
      let compHtml = '';
      if (hasComp) {
        const compRows = (compParts as any[]).map((part, index) => {
          const deviceName = part.parentEquipmentName || part.parentEquipment?.name || part.deviceName || '-';
          const componentLabel = part.componentName || '-';
          const oldSerial = part.oldComponentSerial || '-';
          const newSerial = part.newComponentSerial || '-';
          return `
            <tr style="background-color: #ffffff;">
              <td style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${index + 1}</td>
              <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
                <div style="font-weight:600;color:#1e293b;">${deviceName}</div>
              </td>
              <td style="padding: 9px 12px; border: 1px solid #cbd5e1; color: #475569; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${componentLabel}</td>
              <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #475569;">${oldSerial}</td>
              <td style="padding: 9px 12px; border: 1px solid #cbd5e1; color: #475569; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${componentLabel}</td>
              <td style="padding: 9px 12px; border: 1px solid #cbd5e1; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #475569; font-weight: 600;">${newSerial}</td>
            </tr>
          `;
        }).join('');

        compHtml = `
          <div style="margin-top: 24px;">
            <h3 style="color: #059669; margin: 0 0 12px 0; font-size: 15px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Spare Part Used</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
              <thead>
                <tr style="background-color: #dcfce7;">
                  <th style="padding: 8px 10px; text-align: center; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; width: 32px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">#</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Equipment</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Old Part</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Old Serial No.</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">New Part</th>
                  <th style="padding: 8px 10px; text-align: left; border: 1px solid #bbf7d0; color: #15803d; font-weight: bold; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">New Serial No.</th>
                </tr>
              </thead>
              <tbody>
                ${compRows}
              </tbody>
            </table>
          </div>
        `;
      }

      sparePartsHtml = equipHtml + compHtml;

      // Build photos HTML — 3 sections: Before / After / Signed Report, 5/row uniform grid
      // Resize each photo to 160×160px thumbnail via sharp before embedding (~10KB each vs ~400KB original)
      // This keeps total email size ~300KB even for 30 photos
      const resizePhotoForEmail = async (photo: string): Promise<string> => {
        if (!photo.startsWith('data:')) return photo; // URL-based: pass through as-is
        try {
          const base64Data = photo.split(',')[1];
          if (!base64Data) return photo;
          const resized = await sharp(Buffer.from(base64Data, 'base64'))
            .resize(160, 160, { fit: 'cover', position: 'centre' })
            .jpeg({ quality: 65 })
            .toBuffer();
          return `data:image/jpeg;base64,${resized.toString('base64')}`;
        } catch {
          return photo; // fallback to original if resize fails
        }
      };

      let photosHtml = '';
      const allBeforePhotos = (beforePhotos || []).filter(Boolean);
      const allAfterPhotos = (afterPhotos || []).filter(Boolean);
      const allSignedPhotos = (signedReportPhotos || []).filter(Boolean);
      if (allBeforePhotos.length > 0 || allAfterPhotos.length > 0 || allSignedPhotos.length > 0) {
        // Resize all photos to thumbnails in parallel
        const [thumbsBefore, thumbsAfter, thumbsSigned] = await Promise.all([
          Promise.all(allBeforePhotos.map(resizePhotoForEmail)),
          Promise.all(allAfterPhotos.map(resizePhotoForEmail)),
          Promise.all(allSignedPhotos.map(resizePhotoForEmail)),
        ]);

        const resolvePhotoSrc = (p: string): string => {
          if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://')) return p;
          return `${apiBase}/uploads/${p}`;
        };

        // Render photos in a uniform grid: max 5/row, each photo equal square size
        const renderPhotoGrid = (photos: string[]) => {
          const cols = 5;
          const tableWidth = 540; // fits within 600px body (30px padding each side)
          const gap = 4;          // 2px padding per side
          const imgSize = Math.floor(tableWidth / cols) - gap; // 104px
          const cellSize = imgSize + gap; // 108px

          const makeCell = (src: string) =>
            `<td width="${cellSize}" style="padding:2px;width:${cellSize}px;height:${cellSize}px;">` +
              `<a href="${src}" target="_blank" style="display:block;text-decoration:none;">` +
                `<img src="${src}" alt="photo" width="${imgSize}" height="${imgSize}" ` +
                  `style="display:block;width:${imgSize}px;height:${imgSize}px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;" />` +
              `</a>` +
            `</td>`;
          const emptyCell = `<td width="${cellSize}" style="width:${cellSize}px;height:${cellSize}px;"></td>`;

          const cells = photos.map((p) => makeCell(resolvePhotoSrc(p)));
          const rows: string[] = [];
          for (let i = 0; i < cells.length; i += cols) {
            const slice = cells.slice(i, i + cols);
            while (slice.length < cols) slice.push(emptyCell);
            rows.push(`<tr>${slice.join('')}</tr>`);
          }
          return (
            `<table width="${tableWidth}" cellpadding="0" cellspacing="0" ` +
              `style="border-collapse:collapse;width:${tableWidth}px;max-width:100%;">` +
              rows.join('') +
            `</table>`
          );
        };

        // Section header style (label above each grid)
        const sectionLabel = (label: string) =>
          `<p style="margin:0 0 6px 0;font-size:13px;font-weight:600;color:#475569;font-family:Tahoma,'Segoe UI',Arial,sans-serif;">${label}</p>`;

        const sections: string[] = [];
        if (thumbsBefore.length > 0) {
          sections.push(
            `<div style="margin-bottom:16px;">${sectionLabel(`Before (${thumbsBefore.length} รูป)`)}${renderPhotoGrid(thumbsBefore)}</div>`
          );
        }
        if (thumbsAfter.length > 0) {
          sections.push(
            `<div style="margin-bottom:16px;">${sectionLabel(`After (${thumbsAfter.length} รูป)`)}${renderPhotoGrid(thumbsAfter)}</div>`
          );
        }
        if (thumbsSigned.length > 0) {
          sections.push(
            `<div style="margin-bottom:16px;">${sectionLabel(`Work Order (${thumbsSigned.length} รูป)`)}${renderPhotoGrid(thumbsSigned)}</div>`
          );
        }

        photosHtml = `
          <div style="margin-top:20px;">
            <h3 style="color:#059669;margin:0 0 14px 0;font-size:15px;font-family:Tahoma,'Segoe UI',Arial,sans-serif;">📷 Photos</h3>
            ${sections.join('')}
          </div>
        `;
      }

      // Email HTML template
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Incident Closed - ${ticketNumber}</title>
        </head>
        <body style="font-family: Tahoma, 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #1e293b; background-color: #ffffff; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #059669;">
              <h1 style="color: #059669; margin: 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">✅ Incident Closed</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${headerName}</p>
            </div>

            <!-- Incident Info -->
            <div style="margin-top: 25px;">
              <h2 style="color: #059669; margin-bottom: 10px; font-size: 16px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Incident Details</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #dcfce7;">
                    <th style="padding: 8px 10px; border: 1px solid #bbf7d0; text-align: left; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #15803d; font-weight: bold; width: 30%;">Field</th>
                    <th style="padding: 8px 10px; border: 1px solid #bbf7d0; text-align: left; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #15803d; font-weight: bold;">Detail</th>
                  </tr>
                </thead>
                <tbody>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Ticket No.:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${ticketNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Title:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Store:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${storeDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Technician:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${technicianName}</td>
                </tr>
                ${checkInAt ? `<tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Check in At:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${new Date(checkInAt).toLocaleString('th-TH')}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Resolved At:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${new Date(resolvedAt).toLocaleString('th-TH')}</td>
                </tr>
                </tbody>
              </table>
            </div>

            <!-- Resolution Note -->
            <div style="margin-top: 20px;">
              <h3 style="color: #059669; margin-bottom: 10px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Resolution:</h3>
              <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; white-space: pre-wrap; color: #1e293b; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; line-height: 1.8;">
                ${resolutionNote}
              </div>
            </div>

            <!-- Spare Parts (if any) -->
            ${sparePartsHtml}

            <!-- Photos (if any) -->
            ${photosHtml}

            <!-- Public Links -->
            ${publicIncidentLink ? `
            <div style="margin-top: 25px; text-align: center;">
              <a href="${publicIncidentLink}" style="color: #2563eb; text-decoration: underline; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
                📋 View Incident Details
              </a>
            </div>
            ` : ''}

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
              <p>This is an automated notification from ${config.fromName}.</p>
            </div>

          </div>
        </body>
        </html>
      `;

      // Send email
      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: to,
        cc: cc && cc.length > 0 ? cc.join(', ') : undefined,
        subject: `[Incident Closed] ${storeDisplay} - ${ticketNumber} : ${title}`,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`Closure email sent to ${mailOptions.to} (${ticketNumber}):`, info.messageId);
    } catch (error) {
      console.error('Error sending email:', error);
    }
  }

  /**
   * Send technician response notification email
   * Called when a technician submits response before going onsite
   */
  async sendTechnicianResponseEmail(data: {
    to: string;
    cc?: string[];
    ticketNumber: string;
    title: string;
    storeName: string;
    storeCode?: string;
    technicianName: string;
    technicianPhone?: string;
    estimatedArrivalTime: Date;
    responseMessage: string;
  }): Promise<void> {
    try {
      const config = await this.getSmtpConfig();
      const transporter = await this.createTransporter();

      // Fetch organization name for header
      const orgConfig = await this.prisma.systemConfig.findUnique({
        where: { key: 'organization_name' },
      });
      const orgName = orgConfig?.value || 'Incident Management';
      const headerName = orgName ? `${orgName} Incident Management` : 'Incident Management';

      const {
        to,
        cc,
        ticketNumber,
        title,
        storeName,
        storeCode,
        technicianName,
        estimatedArrivalTime,
        responseMessage,
      } = data;

      // Store display: "storeCode storeName" (no brackets)
      const storeDisplay = storeCode ? `${storeCode} ${storeName}` : storeName;

      // Format ETA in Thai timezone: "วันอังคารที่ 10 กุมภาพันธ์ 2569 เวลา 09:00"
      const etaDate = estimatedArrivalTime.toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const etaTime = estimatedArrivalTime.toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const etaFormatted = `${etaDate} เวลา ${etaTime}`;

      // Email HTML template
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Technician Response - ${ticketNumber}</title>
        </head>
        <body style="font-family: Tahoma, 'Segoe UI', Arial, sans-serif; line-height: 1.8; color: #1e293b; background-color: #ffffff; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; padding: 30px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #7c3aed;">
              <h1 style="color: #7c3aed; margin: 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">📋 Technician Response</h1>
              <p style="color: #64748b; margin: 5px 0 0 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">${headerName}</p>
            </div>

            <!-- Response Info -->
            <div style="margin-top: 25px;">
              <h2 style="color: #7c3aed; margin-bottom: 10px; font-size: 16px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Response Details</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #ede9fe;">
                    <th style="padding: 8px 10px; border: 1px solid #ddd6fe; text-align: left; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #6d28d9; font-weight: bold; width: 30%;">Field</th>
                    <th style="padding: 8px 10px; border: 1px solid #ddd6fe; text-align: left; font-size: 13px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #6d28d9; font-weight: bold;">Detail</th>
                  </tr>
                </thead>
                <tbody>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Ticket No.:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${ticketNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Title:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Store:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${storeDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-weight: bold; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #475569;">Technician:</td>
                  <td style="padding: 8px 10px; background-color: #ffffff; border: 1px solid #e2e8f0; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #1e293b;">${technicianName}</td>
                </tr>
                </tbody>
              </table>
            </div>

            <!-- Message Section -->
            <div style="margin-top: 20px;">
              <h3 style="color: #7c3aed; margin-bottom: 10px; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">Message from Technician:</h3>
              <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
                <p style="margin: 0; white-space: pre-wrap; color: #1e293b; font-size: 14px; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; line-height: 1.8;">${responseMessage}</p>
              </div>
            </div>

            <!-- ETA Section (below message) -->
            <div style="margin-top: 20px; background-color: #ffffff; border: 2px solid #c4b5fd; border-radius: 10px; padding: 20px; text-align: center;">
              <p style="color: #5b21b6; font-size: 16px; font-weight: bold; margin: 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">เวลาที่จะเดินทางไปถึงสาขา ${etaFormatted}</p>
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif;">
                This is an automated notification from ${config.fromName}.
              </p>
            </div>

          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to,
        cc: cc?.join(', '),
        subject: `[Response] ${storeDisplay} - ${ticketNumber} : ${title}`,
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Technician response email sent:', info.messageId);
    } catch (error) {
      console.error('Error sending technician response email:', error);
      throw error;
    }
  }

  /**
   * Send account approval notification email
   */
  async sendAccountApprovedEmail(data: {
    to: string;
    userName: string;
    loginUrl?: string;
  }): Promise<void> {
    try {
      const config = await this.getSmtpConfig();
      const transporter = await this.createTransporter();

      const { to, userName, loginUrl } = data;
      const appUrl = loginUrl || process.env.FRONTEND_URL || 'http://localhost:3000';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Account Approved - RIM System</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #10b981;">
              <h1 style="color: #10b981; margin: 0;">🎉 Account Approved!</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0;">RIM - Rubjobb Incident Management</p>
            </div>

            <!-- Content -->
            <div style="margin-top: 30px;">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>Great news! Your account has been approved by the IT Manager.</p>
              <p>You can now log in to the RIM System and start using all the features available to your role.</p>

              <!-- Login Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}/login" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                  Log In Now
                </a>
              </div>

              <p style="color: #94a3b8; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #60a5fa; font-size: 14px; word-break: break-all;">${appUrl}/login</p>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
              <p>This is an automated email from RIM System.</p>
              <p>© ${new Date().getFullYear()} Rubjobb Incident Management. All rights reserved.</p>
            </div>

          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: to,
        subject: '🎉 Your RIM Account Has Been Approved!',
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Account approval email sent:', info.messageId);
    } catch (error) {
      console.error('Error sending account approval email:', error);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data: {
    to: string;
    userName: string;
    resetToken: string;
    resetUrl?: string;
  }): Promise<void> {
    try {
      const config = await this.getSmtpConfig();
      const transporter = await this.createTransporter();

      const { to, userName, resetToken, resetUrl } = data;
      const appUrl = resetUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset - RIM System</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
              <h1 style="color: #3b82f6; margin: 0;">🔐 Password Reset</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0;">RIM - Rubjobb Incident Management</p>
            </div>

            <!-- Content -->
            <div style="margin-top: 30px;">
              <p>Hello <strong>${userName}</strong>,</p>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>

              <!-- Reset Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                  Reset Password
                </a>
              </div>

              <p style="color: #94a3b8; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
              <p style="color: #60a5fa; font-size: 14px; word-break: break-all;">${appUrl}</p>

              <div style="background-color: #0f172a; padding: 15px; border-radius: 5px; margin-top: 20px; border: 1px solid #334155;">
                <p style="margin: 0; color: #fbbf24;">⚠️ Important:</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #94a3b8;">
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Your password won't change until you create a new one</li>
                </ul>
              </div>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
              <p>This is an automated email from RIM System.</p>
              <p>© ${new Date().getFullYear()} Rubjobb Incident Management. All rights reserved.</p>
            </div>

          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: to,
        subject: '🔐 Reset Your RIM Account Password',
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', info.messageId);
    } catch (error) {
      console.error('Error sending password reset email:', error);
    }
  }

  /**
   * Send new user registration notification to IT Managers
   */
  async sendNewUserNotificationEmail(data: {
    to: string;
    newUserName: string;
    newUserEmail: string;
    approvalUrl?: string;
  }): Promise<void> {
    try {
      const config = await this.getSmtpConfig();
      const transporter = await this.createTransporter();

      const { to, newUserName, newUserEmail, approvalUrl } = data;
      const appUrl = approvalUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/users?status=PENDING`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New User Registration - RIM System</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #f59e0b;">
              <h1 style="color: #f59e0b; margin: 0;">👤 New User Registration</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0;">RIM - Rubjobb Incident Management</p>
            </div>

            <!-- Content -->
            <div style="margin-top: 30px;">
              <p>A new user has registered and is waiting for approval:</p>

              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr>
                  <td style="padding: 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold;">Name:</td>
                  <td style="padding: 10px; background-color: #1e293b; border: 1px solid #334155;">${newUserName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold;">Email:</td>
                  <td style="padding: 10px; background-color: #1e293b; border: 1px solid #334155;">${newUserEmail}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold;">Status:</td>
                  <td style="padding: 10px; background-color: #1e293b; border: 1px solid #334155;">
                    <span style="background-color: #f59e0b; color: #0f172a; padding: 3px 10px; border-radius: 4px; font-weight: bold;">Pending Approval</span>
                  </td>
                </tr>
              </table>

              <!-- Approve Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${appUrl}" style="display: inline-block; background-color: #10b981; color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold;">
                  Review & Approve
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
              <p>This is an automated email from RIM System.</p>
              <p>© ${new Date().getFullYear()} Rubjobb Incident Management. All rights reserved.</p>
            </div>

          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.fromName}" <${config.fromEmail}>`,
        to: to,
        subject: '👤 New User Registration Pending Approval',
        html: htmlContent,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('New user notification email sent:', info.messageId);
    } catch (error) {
      console.error('Error sending new user notification email:', error);
    }
  }

  /**
   * Generic send — used internally by other services (e.g. PatchService)
   */
  async sendEmail(data: { to: string; subject: string; html: string }): Promise<void> {
    const config = await this.getSmtpConfig();
    const transporter = await this.createTransporter();
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
      to: data.to,
      subject: data.subject,
      html: data.html,
    });
  }

  /**
   * Test email configuration - sends a test email
   */
  async sendTestEmail(to: string, cc?: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const config = await this.getSmtpConfig();

      // Validate config
      if (!config.host || !config.user || !config.password) {
        return {
          success: false,
          message: 'SMTP configuration is incomplete',
          error: 'Missing SMTP host, user, or password. Please configure email settings first.',
        };
      }

      const transporter = await this.createTransporter();

      // Verify connection first
      await transporter.verify();

      const mailOptions: any = {
        from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
        to: to,
        ...(cc && { cc: cc }),
        subject: '✅ Test Email from RIM System',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Test Email - RIM System</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

              <!-- Header -->
              <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #10b981;">
                <h1 style="color: #10b981; margin: 0;">✅ Test Email Success</h1>
                <p style="color: #94a3b8; margin: 5px 0 0 0;">RIM - Rubjobb Incident Management</p>
              </div>

              <!-- Content -->
              <div style="margin-top: 30px; text-align: center;">
                <p style="font-size: 18px;">This is a test email from RIM System.</p>
                <p style="color: #94a3b8;">If you received this email, your SMTP configuration is working correctly!</p>

                <div style="background-color: #0f172a; padding: 20px; border-radius: 8px; margin-top: 20px; border: 1px solid #334155;">
                  <h3 style="color: #10b981; margin: 0 0 10px 0;">Configuration Details:</h3>
                  <p style="margin: 5px 0; color: #94a3b8;">SMTP Host: <span style="color: #fff;">${config.host}</span></p>
                  <p style="margin: 5px 0; color: #94a3b8;">SMTP Port: <span style="color: #fff;">${config.port}</span></p>
                  <p style="margin: 5px 0; color: #94a3b8;">From: <span style="color: #fff;">${config.fromName} &lt;${config.fromEmail || config.user}&gt;</span></p>
                  <p style="margin: 5px 0; color: #94a3b8;">Sent At: <span style="color: #fff;">${new Date().toLocaleString('th-TH')}</span></p>
                </div>
              </div>

              <!-- Footer -->
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
                <p>This is an automated test email from RIM System.</p>
                <p>© ${new Date().getFullYear()} Rubjobb Incident Management. All rights reserved.</p>
              </div>

            </div>
          </body>
          </html>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Test email sent successfully:', info.messageId);

      const recipients = cc ? `${to} (CC: ${cc})` : to;
      return {
        success: true,
        message: `Test email sent successfully to ${recipients}`,
      };
    } catch (error: any) {
      console.error('Error sending test email:', error);

      let errorMessage = error.message || 'Unknown error';

      // Provide more helpful error messages
      if (error.code === 'EAUTH') {
        errorMessage = 'Authentication failed. Please check your SMTP username and password.';
      } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
        errorMessage = 'Connection failed. Please check your SMTP host and port settings.';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection timed out. Please check your SMTP host and firewall settings.';
      }

      return {
        success: false,
        message: 'Failed to send test email',
        error: errorMessage,
      };
    }
  }

  /**
   * Send Service Report PDF as email attachment to store
   */
  async sendServiceReportPdfEmail(data: {
    to: string;
    ticketNumber: string;
    storeName: string;
    storeCode?: string;
    pdfBase64: string;
  }): Promise<void> {
    try {
      const config = await this.getSmtpConfig();
      if (!config.host || !config.user || !config.password) {
        throw new Error('SMTP configuration is incomplete');
      }

      const transporter = await this.createTransporter();

      const storeDisplay = data.storeCode
        ? `${data.storeCode} ${data.storeName}`
        : data.storeName;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 8px; padding: 30px; border: 1px solid #ddd;">
            <h2 style="color: #1e40af; margin: 0 0 20px 0;">Service Report / ใบรายงานบริการ</h2>
            <p>Service Report สำหรับ <strong>${storeDisplay}</strong></p>
            <p>Ticket: <strong>${data.ticketNumber}</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666;">กรุณาพิมพ์เอกสารแนบและเซ็นลายเซ็น</p>
            <p style="color: #999; font-size: 12px;">ส่งจากระบบ RIM - Rubjobb Incident Management</p>
          </div>
        </body>
        </html>
      `;

      const mailOptions: any = {
        from: `"${config.fromName}" <${config.fromEmail || config.user}>`,
        to: data.to,
        subject: `[Service Report] ${storeDisplay} - ${data.ticketNumber}`,
        html: htmlContent,
        attachments: [{
          filename: `service-report-${data.ticketNumber}.pdf`,
          content: data.pdfBase64,
          encoding: 'base64',
        }],
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Service report email sent:', info.messageId);
    } catch (error: any) {
      console.error('Error sending service report email:', error);
      throw new Error(`ส่งเมลไม่สำเร็จ: ${error.message}`);
    }
  }
}
