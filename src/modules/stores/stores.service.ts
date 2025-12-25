// src/modules/stores/stores.service.ts

import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExcelService, ParsedStoreRow } from './services/excel.service';
import { ImportStoresDto } from './dto/import-stores.dto';
import { ExportStoresDto } from './dto/export-stores.dto';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excelService: ExcelService,
  ) {}

  // ==========================================
  // CRUD Methods
  // ==========================================

  async create(data: any) {
    // Validate and create store
    try {
      return await this.prisma.store.create({
        data: {
          storeCode: data.storeCode,
          name: data.name,
          company: data.company,
          storeType: data.storeType || 'PERMANENT',
          storeStatus: data.storeStatus || 'ACTIVE',
          
          // Optional fields
          address: data.address || null,
          province: data.province || null,
          district: data.district || null,
          subDistrict: data.subDistrict || null,
          postalCode: data.postalCode || null,
          area: data.area || null,
          serviceCenter: data.serviceCenter || null,
          phone: data.phone || null,
          email: data.email || null,
          googleMapLink: data.googleMapLink || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          
          // Network
          circuitId: data.circuitId || null,
          routerIp: data.routerIp || null,
          switchIp: data.switchIp || null,
          accessPointIp: data.accessPointIp || null,
          pcServerIp: data.pcServerIp || null,
          pcPrinterIp: data.pcPrinterIp || null,
          pmcComputerIp: data.pmcComputerIp || null,
          sbsComputerIp: data.sbsComputerIp || null,
          vatComputerIp: data.vatComputerIp || null,
          posIp: data.posIp || null,
          edcIp: data.edcIp || null,
          scoIp: data.scoIp || null,
          peopleCounterIp: data.peopleCounterIp || null,
          digitalTvIp: data.digitalTvIp || null,
          timeAttendanceIp: data.timeAttendanceIp || null,
          cctvIp: data.cctvIp || null,
          
          // Working hours
          mondayOpen: data.mondayOpen || null,
          mondayClose: data.mondayClose || null,
          tuesdayOpen: data.tuesdayOpen || null,
          tuesdayClose: data.tuesdayClose || null,
          wednesdayOpen: data.wednesdayOpen || null,
          wednesdayClose: data.wednesdayClose || null,
          thursdayOpen: data.thursdayOpen || null,
          thursdayClose: data.thursdayClose || null,
          fridayOpen: data.fridayOpen || null,
          fridayClose: data.fridayClose || null,
          saturdayOpen: data.saturdayOpen || null,
          saturdayClose: data.saturdayClose || null,
          sundayOpen: data.sundayOpen || null,
          sundayClose: data.sundayClose || null,
          holidayOpen: data.holidayOpen || null,
          holidayClose: data.holidayClose || null,
          
          // Dates
          openDate: data.openDate ? new Date(data.openDate) : null,
          closeDate: data.closeDate ? new Date(data.closeDate) : null,
          
          notes: data.notes || null,
        },
      });
    } catch (error) {
      throw new BadRequestException(
        `Failed to create store: ${error.message}`,
      );
    }
  }

  async findAll(query: any) {
    const {
      page = 1,
      limit = 10,
      status,
      province,
      company,
      storeType,
      search,
    } = query;

    // Build where clause
    const where: any = {};

    // Filter by status
    if (status) {
      where.storeStatus = status;
    }

    // Filter by province
    if (province) {
      where.province = province;
    }

    // Filter by company
    if (company) {
      where.company = company;
    }

    // Filter by storeType
    if (storeType) {
      where.storeType = storeType;
    }

    // Search by name, code, or company
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { storeCode: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Fetch stores with pagination
    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    // Return paginated response
    return {
      data: stores,
      meta: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  async findOne(id: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    return store;
  }

  async update(id: number, data: any) {
    // Check if store exists
    await this.findOne(id);

    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    // Check if store exists
    await this.findOne(id);

    return this.prisma.store.delete({
      where: { id },
    });
  }

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get store statistics
   */
  async getStoreStatistics(id: number) {
    // Check if store exists
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Store with ID ${id} not found`);
    }

    // Count incidents by status
    const incidentsByStatus = await this.prisma.incident.groupBy({
      by: ['status'],
      where: { storeId: id },
      _count: true,
    });

    // Count incidents by priority
    const incidentsByPriority = await this.prisma.incident.groupBy({
      by: ['priority'],
      where: { storeId: id },
      _count: true,
    });

    // Count total incidents
    const totalIncidents = await this.prisma.incident.count({
      where: { storeId: id },
    });

    // Count open incidents
    const openIncidents = await this.prisma.incident.count({
      where: {
        storeId: id,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });

    // Count equipment (simple count)
    const totalEquipment = await this.prisma.equipment.count({
      where: { storeId: id },
    });

    // Get all equipment for this store (for manual grouping if needed)
    const equipment = await this.prisma.equipment.findMany({
      where: { storeId: id },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    // Get recent incidents (last 10)
    const recentIncidents = await this.prisma.incident.findMany({
      where: { storeId: id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        incidentCode: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });

    return {
      storeId: id,
      storeName: store.name,
      storeCode: store.storeCode,
      statistics: {
        incidents: {
          total: totalIncidents,
          open: openIncidents,
          byStatus: incidentsByStatus.reduce((acc, curr) => {
            acc[curr.status] = curr._count;
            return acc;
          }, {}),
          byPriority: incidentsByPriority.reduce((acc, curr) => {
            acc[curr.priority] = curr._count;
            return acc;
          }, {}),
        },
        equipment: {
          total: totalEquipment,
          items: equipment,
        },
      },
      recentIncidents,
    };
  }

  // ==========================================
  // Helper Methods for Enum Normalization
  // ==========================================

  /**
   * Normalize store type from Excel to Prisma enum
   * permanent → PERMANENT
   * pop_up → POP_UP
   * seasonal → SEASONAL
   */
  private normalizeStoreType(value: string): string {
    return value.toUpperCase().replace('-', '_');
  }

  /**
   * Normalize store status from Excel to Prisma enum
   * active → ACTIVE
   * inactive → INACTIVE
   */
  private normalizeStoreStatus(value: string): string {
    return value.toUpperCase();
  }

  // ==========================================
  // Import from Excel
  // ==========================================

  /**
   * Import stores from Excel file
   */
  async importFromExcel(file: Express.Multer.File, dto: ImportStoresDto) {
    // 1. Parse Excel file
    const rows = await this.excelService.parseExcelFile(file);

    if (rows.length === 0) {
      throw new BadRequestException('Excel file is empty');
    }

    if (rows.length > 1000) {
      throw new BadRequestException('Maximum 1000 stores per import');
    }

    // 2. Validate all rows
    const validRows: ParsedStoreRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];
    const skipped: Array<{ row: number; code: string; reason: string }> = [];

    for (const row of rows) {
      try {
        // Validate required fields
        if (!row.code || !row.name || !row.company) {
          errors.push({
            row: row.rowNumber,
            error: 'Missing required fields: code, name, or company',
          });
          continue;
        }

        // Validate IP addresses
        const ipFields: Array<keyof ParsedStoreRow> = [
          'routerIp',
          'switchIp',
          'accessPointIp',
          'pcServerIp',
          'pcPrinterIp',
          'pmcComputerIp',
          'sbsComputerIp',
          'vatComputerIp',
          'posIp',
          'edcIp',
          'scoIp',
          'peopleCounterIp',
          'digitalTvIp',
          'timeAttendanceIp',
          'cctvIp',
        ];

        let hasIpError = false;
        for (const field of ipFields) {
          const value = row[field];
          if (value && typeof value === 'string' && !this.isValidIp(value)) {
            errors.push({
              row: row.rowNumber,
              error: `Invalid IP address: ${field} = '${value}'`,
            });
            hasIpError = true;
            break;
          }
        }

        if (hasIpError) continue;

        // Check for duplicates if skipDuplicates is enabled
        if (dto.skipDuplicates) {
          const existing = await this.prisma.store.findFirst({
            where: {
              storeCode: row.code,
              storeStatus: 'ACTIVE',
            },
          });

          if (existing) {
            skipped.push({
              row: row.rowNumber,
              code: row.code,
              reason: dto.updateExisting
                ? 'Updated existing store'
                : 'Duplicate active store code',
            });

            // Update if requested
            if (dto.updateExisting) {
              await this.prisma.store.update({
                where: { id: existing.id },
                data: this.mapRowToStoreData(row),
              });
            }

            continue;
          }
        }

        validRows.push(row);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          row: row.rowNumber,
          error: errorMessage,
        });
      }
    }

    // 3. Import valid rows
    const imported: Array<{ row: number; code: string; name: string }> = [];

    for (const row of validRows) {
      try {
        const store = await this.prisma.store.create({
          data: this.mapRowToStoreData(row),
        });

        imported.push({
          row: row.rowNumber,
          code: store.storeCode,
          name: store.name,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          row: row.rowNumber,
          error: errorMessage,
        });
      }
    }

    // 4. Return results
    return {
      success: true,
      summary: {
        totalRows: rows.length,
        imported: imported.length,
        skipped: skipped.length,
        failed: errors.length,
      },
      imported,
      skipped,
      errors,
    };
  }

  /**
   * Map Excel row to Prisma create data
   */
  private mapRowToStoreData(row: ParsedStoreRow): any {
    return {
      storeCode: row.code,
      name: row.name,
      company: row.company,
      storeType: this.normalizeStoreType(row.storeType || 'permanent'),

      // Address Information
      address: row.address || null,
      province: row.province || null,
      postalCode: row.postalCode || null,
      area: row.area || null,
      serviceCenter: row.serviceCenter || null,

      // Contact
      phone: row.phone || null,
      email: row.email || null,
      googleMapLink: row.googleMapLink || null,

      // Network Information
      circuitId: row.circuitId || null,

      // IP addresses
      routerIp: row.routerIp || null,
      switchIp: row.switchIp || null,
      accessPointIp: row.accessPointIp || null,
      pcServerIp: row.pcServerIp || null,
      pcPrinterIp: row.pcPrinterIp || null,
      pmcComputerIp: row.pmcComputerIp || null,
      sbsComputerIp: row.sbsComputerIp || null,
      vatComputerIp: row.vatComputerIp || null,
      posIp: row.posIp || null,
      edcIp: row.edcIp || null,
      scoIp: row.scoIp || null,
      peopleCounterIp: row.peopleCounterIp || null,
      digitalTvIp: row.digitalTvIp || null,
      timeAttendanceIp: row.timeAttendanceIp || null,
      cctvIp: row.cctvIp || null,

      // Working Hours (Monday - Sunday + Holiday)
      mondayOpen: row.mondayOpen || null,
      mondayClose: row.mondayClose || null,
      tuesdayOpen: row.tuesdayOpen || null,
      tuesdayClose: row.tuesdayClose || null,
      wednesdayOpen: row.wednesdayOpen || null,
      wednesdayClose: row.wednesdayClose || null,
      thursdayOpen: row.thursdayOpen || null,
      thursdayClose: row.thursdayClose || null,
      fridayOpen: row.fridayOpen || null,
      fridayClose: row.fridayClose || null,
      saturdayOpen: row.saturdayOpen || null,
      saturdayClose: row.saturdayClose || null,
      sundayOpen: row.sundayOpen || null,
      sundayClose: row.sundayClose || null,
      holidayOpen: row.holidayOpen || null,
      holidayClose: row.holidayClose || null,

      // Dates
      openDate: row.openDate ? new Date(row.openDate) : null,
      closeDate: row.closeDate ? new Date(row.closeDate) : null,

      // Status
      storeStatus: this.normalizeStoreStatus(row.storeStatus || 'active'),

      notes: row.notes || null,
    };
  }

  /**
   * Validate IP address format
   */
  private isValidIp(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // ==========================================
  // Export to Excel
  // ==========================================

  /**
   * Export stores to Excel
   */
  async exportToExcel(filters: ExportStoresDto): Promise<Buffer> {
    // Build where clause
    const where: any = {};

    if (filters.status) {
      where.storeStatus = filters.status;
    }

    if (filters.province) {
      where.province = filters.province;
    }

    if (filters.company) {
      where.company = filters.company;
    }

    if (filters.storeType) {
      where.storeType = filters.storeType;
    }

    // Fetch stores
    const stores = await this.prisma.store.findMany({
      where,
      orderBy: {
        storeCode: 'asc',
      },
    });

    // Generate Excel file
    return this.excelService.generateExcel(stores);
  }
}