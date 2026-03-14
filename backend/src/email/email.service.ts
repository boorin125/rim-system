// backend/src/email/email.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

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
   * Send incident closure notification email
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
    publicIncidentLink?: string | null;
    ratingLink?: string | null;
    serviceReportLink?: string | null;
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
        resolutionNote,
        usedSpareParts,
        spareParts,
        checkInAt,
        resolvedAt,
        confirmedAt,
        publicIncidentLink,
        ratingLink,
        serviceReportLink,
      } = data;

      // Store display: "storeCode storeName" (no brackets)
      const storeDisplay = storeCode ? `${storeCode} ${storeName}` : storeName;

      // Build spare parts HTML
      let sparePartsHtml = '';
      if (usedSpareParts && spareParts && spareParts.length > 0) {
        const spareRows = (spareParts as any[])
          .map((part, index) => {
            // Equipment Name: from Equipment table (name already includes position e.g. "POS#1 Printer")
            const equipName = part.oldEquipment?.name || '-';

            // Old Equipment Brand + Model from Equipment table
            const oldBrandModel =
              [part.oldEquipment?.brand, part.oldEquipment?.model].filter(Boolean).join(' ') || '-';

            // New Equipment Brand + Model: prefer SparePart fields, fallback to Equipment table
            const newBrandModel =
              [part.newBrand, part.newModel].filter(Boolean).join(' ') ||
              [part.newEquipment?.brand, part.newEquipment?.model].filter(Boolean).join(' ') ||
              '-';

            const oldSerial = part.oldSerialNo || '-';
            const newSerial = part.newSerialNo || '-';
            const rowBg = index % 2 === 0 ? '#1e293b' : '#162032';

            return `
              <tr style="background-color: ${rowBg};">
                <td style="padding: 9px 12px; border: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">${index + 1}</td>
                <td style="padding: 9px 12px; border: 1px solid #334155; color: #e2e8f0; font-weight: 600;">${equipName}</td>
                <td style="padding: 9px 12px; border: 1px solid #334155; color: #94a3b8;">${oldBrandModel}</td>
                <td style="padding: 9px 12px; border: 1px solid #334155; font-family: monospace; font-size: 12px; color: #94a3b8;">${oldSerial}</td>
                <td style="padding: 9px 12px; border: 1px solid #334155; color: #10b981;">${newBrandModel}</td>
                <td style="padding: 9px 12px; border: 1px solid #334155; font-family: monospace; font-size: 12px; color: #10b981; font-weight: 600;">${newSerial}</td>
              </tr>
            `;
          })
          .join('');

        sparePartsHtml = `
          <div style="margin-top: 24px;">
            <h3 style="color: #10b981; margin: 0 0 12px 0; font-size: 15px;">🔧 Spare Parts Used</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background-color: #0f172a;">
                  <th style="padding: 10px 12px; text-align: center; border: 1px solid #334155; color: #64748b; width: 32px;">#</th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; color: #94a3b8;">Equipment Name</th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; color: #94a3b8;">Old Equipment<br><span style="font-weight: normal; font-size: 11px; color: #64748b;">(Brand / Model)</span></th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; color: #94a3b8;">Old Serial No.</th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; color: #10b981;">New Equipment<br><span style="font-weight: normal; font-size: 11px; color: #34d399;">(Brand / Model)</span></th>
                  <th style="padding: 10px 12px; text-align: left; border: 1px solid #334155; color: #10b981;">New Serial No.</th>
                </tr>
              </thead>
              <tbody>
                ${spareRows}
              </tbody>
            </table>
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #10b981;">
              <h1 style="color: #10b981; margin: 0;">✅ Incident Closed</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0;">${headerName}</p>
            </div>

            <!-- Incident Info -->
            <div style="margin-top: 25px;">
              <h2 style="color: #10b981; margin-bottom: 10px; font-size: 16px;">Incident Details</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; width: 20%; font-size: 13px;">Ticket No.:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${ticketNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Title:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Store:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${storeDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Technician:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${technicianName}</td>
                </tr>
                ${checkInAt ? `<tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Check in At:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${new Date(checkInAt).toLocaleString('th-TH')}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Resolved At:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${new Date(resolvedAt).toLocaleString('th-TH')}</td>
                </tr>
              </table>
            </div>

            <!-- Resolution Note -->
            <div style="margin-top: 20px;">
              <h3 style="color: #10b981; margin-bottom: 10px;">Resolution:</h3>
              <div style="background-color: #0f172a; padding: 15px; border-radius: 5px; border: 1px solid #334155; white-space: pre-wrap;">
                ${resolutionNote}
              </div>
            </div>

            <!-- Spare Parts (if any) -->
            ${sparePartsHtml}

            <!-- Public Links -->
            <div style="margin-top: 25px; text-align: center;">
              ${publicIncidentLink ? `
              <div style="margin-bottom: 15px;">
                <a href="${publicIncidentLink}" style="color: #3b82f6; text-decoration: underline; font-weight: bold; font-size: 14px;">
                  📋 View Incident Details
                </a>
              </div>
              ` : ''}
              ${ratingLink ? `
              <div style="margin-bottom: 15px;">
                <a href="${ratingLink}" style="color: #f59e0b; text-decoration: underline; font-weight: bold; font-size: 14px;">
                  ⭐ Rate This Service
                </a>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 8px;">Please take a moment to rate our service. Your feedback helps us improve.</p>
              </div>
              ` : ''}
              ${serviceReportLink ? `
              <div style="margin-bottom: 15px;">
                <a href="${serviceReportLink}" style="color: #10b981; text-decoration: underline; font-weight: bold; font-size: 14px;">
                  📝 Service Report / เอกสารปิดงาน
                </a>
              </div>
              ` : ''}
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
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
      console.log('Email sent successfully:', info.messageId);
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
        technicianPhone,
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

            <!-- Header -->
            <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #8b5cf6;">
              <h1 style="color: #8b5cf6; margin: 0;">📋 Technician Response</h1>
              <p style="color: #94a3b8; margin: 5px 0 0 0;">${headerName}</p>
            </div>

            <!-- Response Info -->
            <div style="margin-top: 25px;">
              <h2 style="color: #8b5cf6; margin-bottom: 10px; font-size: 16px;">Response Details</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; width: 20%; font-size: 13px;">Ticket No.:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${ticketNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Title:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${title}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Store:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${storeDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px;">Technician:</td>
                  <td style="padding: 6px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${technicianName}${technicianPhone ? ` (${technicianPhone})` : ''}</td>
                </tr>
              </table>
            </div>

            <!-- Message Section -->
            <div style="margin-top: 20px;">
              <h3 style="color: #a78bfa; margin-bottom: 10px; font-size: 14px;">Message from Technician:</h3>
              <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 15px;">
                <p style="margin: 0; white-space: pre-wrap;">${responseMessage}</p>
              </div>
            </div>

            <!-- ETA Section (below message) -->
            <div style="margin-top: 20px; background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 20px; text-align: center;">
              <p style="color: #e2e8f0; font-size: 16px; font-weight: bold; margin: 0;">เวลาที่จะเดินทางไปถึงสาขา ${etaFormatted}</p>
            </div>

            <!-- Footer -->
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
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
