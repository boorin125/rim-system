import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ImportEquipmentDto } from '../dto/import-equipment.dto';
import { ExportEquipmentDto } from '../dto/export-equipment.dto';
import { EquipmentStatus } from '@prisma/client';

@Injectable()
export class EquipmentExcelService {
  constructor(private prisma: PrismaService) {}

  /**
   * Parse and validate equipment data from Excel file
   */
  async parseEquipmentImport(
    buffer: Buffer,
    userId: number,
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; errors: string[] }>;
    imported: any[];
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet('ข้อมูลอุปกรณ์');
    if (!worksheet) {
      throw new BadRequestException(
        'Invalid template: "ข้อมูลอุปกรณ์" sheet not found',
      );
    }

    const equipment: ImportEquipmentDto[] = [];
    const errors: Array<{ row: number; errors: string[] }> = [];

    // Skip header row, start from row 2
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // Skip empty rows
      if (!row.getCell(1).value) continue;

      // Limit to 1000 rows
      if (equipment.length >= 1000) {
        errors.push({
          row: rowNumber,
          errors: ['Import limit exceeded (max 1000 equipment)'],
        });
        break;
      }

      const equipmentData = {
        serialNumber: row.getCell(1).value?.toString().trim() || '',
        name: row.getCell(2).value?.toString().trim() || '',
        category: row.getCell(3).value?.toString().trim(),
        brand: row.getCell(4).value?.toString().trim() || undefined,
        model: row.getCell(5).value?.toString().trim() || undefined,
        purchaseDate: this.parseDate(row.getCell(6).value),
        warrantyExpiry: this.parseDate(row.getCell(7).value),
        status: (row.getCell(8).value?.toString().trim().toUpperCase() as EquipmentStatus) || EquipmentStatus.ACTIVE,
        storeCode: row.getCell(9).value?.toString().trim() || '',
      };

      // Validate DTO
      const dto = plainToClass(ImportEquipmentDto, equipmentData);
      const validationErrors = await validate(dto as object);

      if (validationErrors.length > 0) {
        const errorMessages = validationErrors.map((error) =>
          Object.values(error.constraints || {}).join(', '),
        );
        errors.push({ row: rowNumber, errors: errorMessages });
        continue;
      }

      equipment.push(dto);
    }

    // Import validated equipment
    const imported: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < equipment.length; i++) {
      const dto = equipment[i];
      const rowNumber = i + 2; // Excel row number (starting from 2)

      try {
        // Check if serial number already exists
        const existing = await this.prisma.equipment.findUnique({
          where: { serialNumber: dto.serialNumber },
        });

        if (existing) {
          errors.push({
            row: rowNumber,
            errors: [`Serial Number "${dto.serialNumber}" already exists`],
          });
          failedCount++;
          continue;
        }

        // Find store by storeCode
        const store = await this.prisma.store.findFirst({
          where: {
            storeCode: dto.storeCode,
            storeStatus: 'ACTIVE',
          },
        });

        if (!store) {
          errors.push({
            row: rowNumber,
            errors: [`Store with code "${dto.storeCode}" not found or inactive`],
          });
          failedCount++;
          continue;
        }

        // Create equipment with log
        const newEquipment = await this.prisma.$transaction(async (tx) => {
          const created = await tx.equipment.create({
            data: {
              serialNumber: dto.serialNumber,
              name: dto.name,
              category: dto.category,
              brand: dto.brand,
              model: dto.model,
              purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
              warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
              status: dto.status || EquipmentStatus.ACTIVE,
              storeId: store.id,
            },
            include: {
              store: {
                select: {
                  id: true,
                  storeCode: true,
                  name: true,
                },
              },
            },
          });

          // Create log entry
          await tx.equipmentLog.create({
            data: {
              equipmentId: created.id,
              action: 'CREATED',
              description: `Equipment imported from Excel (Row ${rowNumber})`,
              changedBy: userId,
              newValue: JSON.stringify({
                serialNumber: created.serialNumber,
                name: created.name,
                category: created.category,
              }),
            },
          });

          return created;
        });

        imported.push(newEquipment);
        successCount++;
      } catch (error) {
        errors.push({
          row: rowNumber,
          errors: [error.message || 'Unknown error'],
        });
        failedCount++;
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors,
      imported,
    };
  }

  /**
   * Generate Excel file with equipment data
   */
  async generateEquipmentExport(filters: ExportEquipmentDto): Promise<ExcelJS.Buffer> {
    // Build where clause
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.storeId) {
      where.storeId = filters.storeId;
    }

    if (filters.brand) {
      where.brand = { contains: filters.brand, mode: 'insensitive' };
    }

    if (filters.model) {
      where.model = { contains: filters.model, mode: 'insensitive' };
    }

    if (filters.storeCode) {
      where.store = {
        storeCode: filters.storeCode,
      };
    }

    if (filters.province) {
      where.store = {
        ...where.store,
        province: filters.province,
      };
    }

    // Warranty expiry filter
    if (filters.warrantyExpired !== undefined) {
      const now = new Date();
      if (filters.warrantyExpired) {
        where.warrantyExpiry = { lt: now };
      } else {
        where.warrantyExpiry = { gte: now };
      }
    }

    // Fetch equipment
    const equipment = await this.prisma.equipment.findMany({
      where,
      include: {
        store: {
          select: {
            storeCode: true,
            name: true,
            province: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Equipment Export');

    // Define columns
    worksheet.columns = [
      { header: 'Serial Number', key: 'serialNumber', width: 20 },
      { header: 'Name', key: 'name', width: 30 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Model', key: 'model', width: 20 },
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Warranty Expiry', key: 'warrantyExpiry', width: 15 },
      { header: 'Warranty Status', key: 'warrantyStatus', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Store Code', key: 'storeCode', width: 15 },
      { header: 'Store Name', key: 'storeName', width: 30 },
      { header: 'Province', key: 'province', width: 20 },
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Add data rows
    equipment.forEach((eq) => {
      const warrantyStatus = this.getWarrantyStatus(eq.warrantyExpiry);
      
      worksheet.addRow({
        serialNumber: eq.serialNumber,
        name: eq.name,
        category: eq.category,
        brand: eq.brand || '',
        model: eq.model || '',
        purchaseDate: eq.purchaseDate ? this.formatDate(eq.purchaseDate) : '',
        warrantyExpiry: eq.warrantyExpiry ? this.formatDate(eq.warrantyExpiry) : '',
        warrantyStatus: warrantyStatus,
        status: eq.status,
        storeCode: eq.store.storeCode,
        storeName: eq.store.name,
        province: eq.store.province || '',
      });
    });

    // Apply borders and formatting
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
        
        // Color code warranty status
        if (rowNumber > 1) {
          const warrantyCell = row.getCell('warrantyStatus');
          if (warrantyCell.value === 'EXPIRED') {
            warrantyCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE6E6' }, // Light red
            };
          } else if (warrantyCell.value === 'EXPIRING_SOON') {
            warrantyCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF4E6' }, // Light orange
            };
          }
        }
      });
    });

    return await workbook.xlsx.writeBuffer();
  }

  /**
   * Helper: Parse date from Excel cell
   */
  private parseDate(value: any): string | undefined {
    if (!value) return undefined;

    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'string') {
      // Try to parse the date string
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    return undefined;
  }

  /**
   * Helper: Format date for Excel export
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Helper: Get warranty status
   */
  private getWarrantyStatus(warrantyExpiry: Date | null): string {
    if (!warrantyExpiry) {
      return 'NO_WARRANTY';
    }

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry < 0) {
      return 'EXPIRED';
    } else if (daysUntilExpiry <= 30) {
      return 'EXPIRING_SOON';
    } else {
      return 'ACTIVE';
    }
  }
}
