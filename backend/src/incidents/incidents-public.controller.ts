// src/incidents/incidents-public.controller.ts
// Public read-only Incident View (No Authentication)

import { Controller, Get, Param, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('public/incidents')
export class IncidentsPublicController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get Incident by Rating Token (Public Read-Only)
   * Used for public incident detail page linked from closure email
   */
  @Get(':token')
  async getIncidentByToken(@Param('token') token: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { ratingToken: token },
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
            address: true,
            province: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        confirmedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        spareParts: {
          select: {
            deviceName: true,
            oldSerialNo: true,
            newSerialNo: true,
            repairType: true,
          },
        },
        rating: {
          select: {
            rating: true,
            comment: true,
            qualityRating: true,
            professionalismRating: true,
            politenessRating: true,
            createdAt: true,
          },
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('ไม่พบข้อมูล Incident หรือลิงก์ไม่ถูกต้อง');
    }

    // Fetch organization name from settings
    const orgConfig = await this.prisma.systemConfig.findUnique({
      where: { key: 'organization_name' },
    });
    const organizationName = orgConfig?.value || 'Incident Management';

    // Return sanitized public data (no internal IDs, no sensitive info)
    return {
      organizationName,
      ticketNumber: incident.ticketNumber,
      title: incident.title,
      description: incident.description,
      status: incident.status,
      priority: incident.priority,
      category: incident.category,
      store: incident.store ? {
        storeCode: incident.store.storeCode,
        name: incident.store.name,
        address: incident.store.address,
        province: incident.store.province,
      } : null,
      technician: incident.assignee ? {
        name: `${incident.assignee.firstName} ${incident.assignee.lastName}`,
      } : null,
      resolvedBy: incident.resolvedBy ? {
        name: `${incident.resolvedBy.firstName} ${incident.resolvedBy.lastName}`,
      } : null,
      confirmedBy: incident.confirmedBy ? {
        name: `${incident.confirmedBy.firstName} ${incident.confirmedBy.lastName}`,
      } : null,
      resolutionNote: incident.resolutionNote,
      usedSpareParts: incident.usedSpareParts,
      spareParts: incident.spareParts.map(sp => ({
        deviceName: sp.deviceName,
        oldSerialNo: sp.oldSerialNo,
        newSerialNo: sp.newSerialNo,
        repairType: sp.repairType,
      })),
      beforePhotos: incident.beforePhotos,
      afterPhotos: incident.afterPhotos,
      createdAt: incident.createdAt,
      resolvedAt: incident.resolvedAt,
      confirmedAt: incident.confirmedAt,
      checkInAt: incident.checkInAt,
      rating: incident.rating ? {
        rating: incident.rating.rating,
        comment: incident.rating.comment,
        qualityRating: incident.rating.qualityRating,
        professionalismRating: incident.rating.professionalismRating,
        politenessRating: incident.rating.politenessRating,
        createdAt: incident.rating.createdAt,
      } : null,
      isRated: !!incident.rating,
      serviceReportToken: incident.serviceReportToken || null,
    };
  }
}
