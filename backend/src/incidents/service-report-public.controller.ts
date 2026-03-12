// src/incidents/service-report-public.controller.ts
// Public Service Report View & Signature (No Authentication)

import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public/service-report')
export class ServiceReportPublicController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Service Report by Token (Public)
   * Returns incident data + organization settings + signature state
   */
  @Get(':token')
  async getServiceReport(@Param('token') token: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { serviceReportToken: token },
      include: {
        store: {
          select: {
            storeCode: true,
            name: true,
            company: true,
            address: true,
            province: true,
            phone: true,
            email: true,
          },
        },
        assignee: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: { assignedAt: 'asc' as const },
        },
        resolvedBy: {
          select: {
            firstName: true,
            lastName: true,
            signaturePath: true,
          },
        },
        confirmedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        spareParts: {
          select: {
            deviceName: true,
            oldSerialNo: true,
            newSerialNo: true,
            newBrand: true,
            newModel: true,
            repairType: true,
            componentName: true,
            oldComponentSerial: true,
            newComponentSerial: true,
            oldEquipment: { select: { name: true, brand: true, model: true } },
            newEquipment: { select: { name: true, brand: true, model: true } },
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('ไม่พบ Service Report หรือลิงก์ไม่ถูกต้อง');
    }

    // Check token expiry
    if (incident.serviceReportTokenExpiresAt && new Date() > incident.serviceReportTokenExpiresAt) {
      // Still allow viewing but not signing
    }

    // Fetch organization + service report provider settings
    const orgConfigs = await this.prisma.systemConfig.findMany({
      where: {
        key: {
          in: [
            'organization_name', 'organization_logo', 'organization_address',
            'sr_provider_name', 'sr_provider_address', 'sr_provider_phone',
            'sr_provider_email', 'sr_provider_tax_id', 'sr_provider_logo',
            'sr_template_style',
            'sr_theme_bg_start', 'sr_theme_bg_end',
            'theme_bg_start', 'theme_bg_end',
          ],
        },
      },
    });

    const configMap: Record<string, string> = {};
    for (const c of orgConfigs) {
      configMap[c.key] = c.value;
    }

    return {
      organizationName: configMap['organization_name'] || '',
      organizationLogo: configMap['organization_logo'] || '',
      organizationAddress: configMap['organization_address'] || '',
      // Service Report Provider Info
      providerName: configMap['sr_provider_name'] || '',
      providerAddress: configMap['sr_provider_address'] || '',
      providerPhone: configMap['sr_provider_phone'] || '',
      providerEmail: configMap['sr_provider_email'] || '',
      providerTaxId: configMap['sr_provider_tax_id'] || '',
      providerLogo: configMap['sr_provider_logo'] || '',
      ticketNumber: incident.ticketNumber,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      priority: incident.priority,
      status: incident.status,
      store: incident.store ? {
        storeCode: incident.store.storeCode,
        name: incident.store.name,
        company: incident.store.company,
        address: incident.store.address,
        province: incident.store.province,
        phone: incident.store.phone,
        email: incident.store.email,
      } : null,
      technician: incident.assignee ? {
        name: `${incident.assignee.firstName} ${incident.assignee.lastName}`,
        phone: incident.assignee.phone,
      } : null,
      technicians: (incident as any).assignees?.length > 0
        ? (incident as any).assignees.map((a: any) => ({
            name: `${a.user.firstName} ${a.user.lastName}`,
            phone: a.user.phone,
          }))
        : incident.assignee
          ? [{ name: `${incident.assignee.firstName} ${incident.assignee.lastName}`, phone: incident.assignee.phone }]
          : [],
      checkedInTechnicians: (incident as any).assignees
        ?.filter((a: any) => a.checkedInAt)
        .map((a: any) => ({ name: `${a.user.firstName} ${a.user.lastName}`, phone: a.user.phone })) || [],
      resolvedBy: incident.resolvedBy ? {
        name: `${incident.resolvedBy.firstName} ${incident.resolvedBy.lastName}`,
        signaturePath: incident.resolvedBy.signaturePath,
      } : null,
      confirmedBy: incident.confirmedBy ? {
        name: `${incident.confirmedBy.firstName} ${incident.confirmedBy.lastName}`,
      } : null,
      resolutionNote: incident.resolutionNote,
      usedSpareParts: incident.usedSpareParts,
      spareParts: incident.spareParts.map(sp => {
        const s = sp as any;
        return {
          deviceName: sp.deviceName,
          oldSerialNo: sp.oldSerialNo,
          newSerialNo: sp.newSerialNo,
          repairType: sp.repairType,
          componentName: sp.componentName,
          oldComponentSerial: sp.oldComponentSerial,
          newComponentSerial: sp.newComponentSerial,
          equipmentName: s.oldEquipment?.name || sp.deviceName || '-',
          oldBrandModel: [s.oldEquipment?.brand, s.oldEquipment?.model].filter(Boolean).join(' ') || '-',
          newBrandModel: [s.newBrand, s.newModel].filter(Boolean).join(' ') || [s.newEquipment?.brand, s.newEquipment?.model].filter(Boolean).join(' ') || '-',
        };
      }),
      beforePhotos: incident.beforePhotos,
      afterPhotos: incident.afterPhotos,
      signedReportPhotos: incident.signedReportPhotos,
      createdAt: incident.createdAt,
      checkInAt: incident.checkInAt,
      resolvedAt: incident.resolvedAt,
      confirmedAt: incident.confirmedAt,
      // Signature state
      isSigned: !!incident.customerSignedAt,
      customerSignature: incident.customerSignature || null,
      customerSignatureName: incident.customerSignatureName || null,
      customerSignedAt: incident.customerSignedAt || null,
      // Template style + theme colors
      templateStyle: configMap['sr_template_style'] || 'classic',
      themeColors: {
        bgStart: configMap['sr_theme_bg_start'] || configMap['theme_bg_start'] || '#0f172a',
        bgEnd: configMap['sr_theme_bg_end'] || configMap['theme_bg_end'] || '#1e293b',
      },
      // Token expiry info
      isExpired: incident.serviceReportTokenExpiresAt ? new Date() > incident.serviceReportTokenExpiresAt : false,
    };
  }

  /**
   * Submit Customer Signature (Public)
   */
  @Post(':token/sign')
  async submitSignature(
    @Param('token') token: string,
    @Body() body: { signature: string; signerName: string },
  ) {
    if (!body.signature) {
      throw new BadRequestException('กรุณาเซ็นลายเซ็น');
    }
    if (!body.signerName || !body.signerName.trim()) {
      throw new BadRequestException('กรุณาระบุชื่อผู้เซ็น');
    }

    const incident = await this.prisma.incident.findUnique({
      where: { serviceReportToken: token },
    });

    if (!incident) {
      throw new NotFoundException('ไม่พบ Service Report หรือลิงก์ไม่ถูกต้อง');
    }

    // Check if already signed
    if (incident.customerSignedAt) {
      throw new BadRequestException('เอกสารนี้ได้รับการเซ็นแล้ว');
    }

    // Block online signing if paper SR photos were already uploaded
    if (incident.signedReportPhotos && incident.signedReportPhotos.length > 0) {
      throw new BadRequestException('ไม่สามารถยืนยันลายเซ็นออนไลน์ได้ เนื่องจากมีการใช้ Service Report แบบอัพโหลดรูปเซ็นแล้ว');
    }

    // Check token expiry
    if (incident.serviceReportTokenExpiresAt && new Date() > incident.serviceReportTokenExpiresAt) {
      throw new BadRequestException('ลิงก์หมดอายุแล้ว ไม่สามารถเซ็นได้');
    }

    await this.prisma.incident.update({
      where: { id: incident.id },
      data: {
        customerSignature: body.signature,
        customerSignatureName: body.signerName.trim(),
        customerSignedAt: new Date(),
      },
    });

    return { message: 'บันทึกลายเซ็นเรียบร้อยแล้ว' };
  }
}
