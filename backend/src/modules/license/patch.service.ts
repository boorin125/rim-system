// src/modules/license/patch.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';

@Injectable()
export class PatchService {
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'patches');

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    // Ensure upload directory exists
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Create a patch record after file has been saved to disk
   */
  async createPatch(data: {
    version: string;
    patchType: string;
    title: string;
    changelog: string;
    fileName: string;
    filePath: string;
    fileSize: number;
  }) {
    return this.prisma.patch.create({ data });
  }

  /**
   * List all patches (newest first)
   */
  async listPatches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.patch.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.patch.count(),
    ]);
    return { items, total, page, limit };
  }

  /**
   * Get patch by id
   */
  async getPatch(id: number) {
    const patch = await this.prisma.patch.findUnique({ where: { id } });
    if (!patch) throw new NotFoundException(`Patch #${id} not found`);
    return patch;
  }

  /**
   * Publish patch + send email notification to all active license contacts
   */
  async publishPatch(id: number, frontendUrl: string) {
    const patch = await this.getPatch(id);
    if (patch.isPublished) {
      throw new BadRequestException('Patch is already published');
    }

    const now = new Date();

    // Mark as published
    const updated = await this.prisma.patch.update({
      where: { id },
      data: { isPublished: true, publishedAt: now },
    });

    // Get all active license contact emails
    const licenses = await this.prisma.license.findMany({
      where: { status: 'ACTIVE' },
      select: { contactEmail: true, organizationName: true },
    });

    const uniqueEmails = [...new Set(licenses.map((l) => l.contactEmail))];

    if (uniqueEmails.length > 0) {
      try {
        await this.sendPatchNotificationEmails(updated, uniqueEmails, frontendUrl);
        await this.prisma.patch.update({
          where: { id },
          data: { emailSentAt: new Date() },
        });
      } catch (err) {
        console.error('Failed to send patch notification emails:', err);
      }
    }

    return updated;
  }

  /**
   * Unpublish patch
   */
  async unpublishPatch(id: number) {
    await this.getPatch(id);
    return this.prisma.patch.update({
      where: { id },
      data: { isPublished: false, publishedAt: null },
    });
  }

  /**
   * Delete patch (file + record)
   */
  async deletePatch(id: number) {
    const patch = await this.getPatch(id);
    // Delete file from disk
    const fullPath = path.join(process.cwd(), patch.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    await this.prisma.patch.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Download patch — returns file path and increments counter
   */
  async downloadPatch(id: number) {
    const patch = await this.getPatch(id);
    if (!patch.isPublished) {
      throw new BadRequestException('Patch is not published');
    }
    // Increment download counter (fire-and-forget)
    this.prisma.patch
      .update({ where: { id }, data: { downloadCount: { increment: 1 } } })
      .catch(() => {});
    return patch;
  }

  /**
   * Get public patch list (published only)
   */
  async listPublicPatches() {
    return this.prisma.patch.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        version: true,
        patchType: true,
        title: true,
        changelog: true,
        fileName: true,
        fileSize: true,
        publishedAt: true,
        downloadCount: true,
      },
    });
  }

  /**
   * Resolve full path for serving file download
   */
  getFilePath(patch: { filePath: string }) {
    return path.join(process.cwd(), patch.filePath);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async sendPatchNotificationEmails(
    patch: { id: number; version: string; patchType: string; title: string; changelog: string; fileName: string; fileSize: number },
    emails: string[],
    frontendUrl: string,
  ) {
    const downloadUrl = `${frontendUrl}/patches/${patch.id}/download`;
    const typeLabel: Record<string, string> = {
      HOTFIX: '🔴 Hotfix',
      FEATURE: '🟢 Feature Update',
      SECURITY: '🔒 Security Patch',
      MAINTENANCE: '🔧 Maintenance',
    };
    const typeDisplay = typeLabel[patch.patchType] || patch.patchType;
    const fileSizeDisplay = patch.fileSize > 1024 * 1024
      ? `${(patch.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(patch.fileSize / 1024)} KB`;

    const changelogHtml = patch.changelog
      .split('\n')
      .filter(Boolean)
      .map((line) => `<li style="margin: 4px 0; color: #94a3b8;">${line.replace(/^[-*]\s*/, '')}</li>`)
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>New Patch Available - RIM System</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #e2e8f0; background-color: #0f172a; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 10px; padding: 30px; border: 1px solid #334155;">

          <!-- Header -->
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
            <h1 style="color: #3b82f6; margin: 0;">📦 New Patch Available</h1>
            <p style="color: #94a3b8; margin: 5px 0 0 0;">RIM - Rubjobb Incident Management</p>
          </div>

          <!-- Patch Info -->
          <div style="margin-top: 25px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; width: 30%; font-size: 13px; color: #94a3b8;">Version</td>
                <td style="padding: 8px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 14px; font-weight: bold; color: #60a5fa;">${patch.version}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px; color: #94a3b8;">Type</td>
                <td style="padding: 8px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px;">${typeDisplay}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px; color: #94a3b8;">Title</td>
                <td style="padding: 8px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px; font-weight: 600; color: #e2e8f0;">${patch.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 10px; background-color: #0f172a; border: 1px solid #334155; font-weight: bold; font-size: 13px; color: #94a3b8;">File</td>
                <td style="padding: 8px 10px; background-color: #1e293b; border: 1px solid #334155; font-size: 13px; color: #94a3b8;">${patch.fileName} (${fileSizeDisplay})</td>
              </tr>
            </table>
          </div>

          <!-- Changelog -->
          <div style="margin-top: 20px;">
            <h3 style="color: #3b82f6; margin: 0 0 10px 0; font-size: 14px;">📋 Changelog</h3>
            <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 15px;">
              <ul style="margin: 0; padding-left: 20px;">
                ${changelogHtml || `<li style="color: #94a3b8;">${patch.changelog}</li>`}
              </ul>
            </div>
          </div>

          <!-- Download Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${downloadUrl}"
               style="display: inline-block; background-color: #3b82f6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 15px;">
              ⬇️ Download Patch
            </a>
            <p style="color: #64748b; font-size: 12px; margin-top: 10px;">
              หรือเข้าสู่ระบบเพื่อดาวน์โหลด: <a href="${downloadUrl}" style="color: #60a5fa;">${downloadUrl}</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #334155; text-align: center; color: #64748b; font-size: 12px;">
            <p>ส่งโดยอัตโนมัติจากระบบ RIM — Rubjobb Development Team</p>
            <p>หากมีข้อสงสัย กรุณาติดต่อ <a href="mailto:support@rub-jobb.com" style="color: #60a5fa;">support@rub-jobb.com</a></p>
          </div>

        </div>
      </body>
      </html>
    `;

    // Send to each email
    for (const email of emails) {
      await this.emailService
        .sendEmail({
          to: email,
          subject: `[RIM Update] ${patch.version} — ${patch.title}`,
          html: htmlContent,
        })
        .catch((err: any) => console.error(`Failed to email ${email}:`, err));
    }
  }
}
