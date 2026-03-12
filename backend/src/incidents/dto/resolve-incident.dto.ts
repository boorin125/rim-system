// src/incidents/dto/resolve-incident.dto.ts

import {
  IsString,
  IsBoolean,
  IsArray,
  IsOptional,
  ValidateNested,
  IsEnum,
  MinLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Spare Part DTO - Supports both OLD and NEW structure
 *
 * NEW structure (recommended):
 * - oldDeviceName, oldSerialNo
 * - newDeviceName, newSerialNo
 * - replacementType: PERMANENT | TEMPORARY
 *
 * OLD structure (backward compatible):
 * - deviceName (combined)
 * - oldSerialNo, newSerialNo
 *
 * REPAIR TYPE:
 * - EQUIPMENT_REPLACEMENT: เปลี่ยนอุปกรณ์ทั้งตัว
 * - COMPONENT_REPLACEMENT: เปลี่ยนเฉพาะชิ้นส่วนภายใน (เช่น Battery, Power Supply)
 */
export class SparePartDto {
  // ========================================
  // REPAIR TYPE - ประเภทการซ่อม
  // ========================================

  @IsOptional()
  @IsEnum(['EQUIPMENT_REPLACEMENT', 'COMPONENT_REPLACEMENT'], {
    message: 'Repair type must be EQUIPMENT_REPLACEMENT or COMPONENT_REPLACEMENT',
  })
  repairType?: 'EQUIPMENT_REPLACEMENT' | 'COMPONENT_REPLACEMENT';

  // ========================================
  // NEW STRUCTURE (Recommended) - EQUIPMENT_REPLACEMENT
  // ========================================

  @IsOptional()
  @IsString()
  oldDeviceName?: string;

  @IsOptional()
  @IsString()
  oldSerialNo?: string;

  @IsOptional()
  @IsString()
  newDeviceName?: string;

  @IsOptional()
  @IsString()
  newSerialNo?: string;

  @IsOptional()
  @IsEnum(['PERMANENT', 'TEMPORARY'], {
    message: 'Replacement type must be PERMANENT or TEMPORARY',
  })
  replacementType?: 'PERMANENT' | 'TEMPORARY';

  // ========================================
  // OLD STRUCTURE (Backward Compatible)
  // ========================================

  @IsOptional()
  @IsString()
  deviceName?: string;

  // ========================================
  // COMPONENT REPLACEMENT - เปลี่ยนชิ้นส่วนภายใน
  // เช่น เปลี่ยนแบตเตอรี่ใน UPS (อุปกรณ์หลักยังคง Serial เดิม)
  // ========================================

  @IsOptional()
  @IsString()
  componentName?: string;  // ชื่อชิ้นส่วน เช่น "Battery", "Power Supply"

  @IsOptional()
  @IsString()
  oldComponentSerial?: string;  // Serial เดิมของชิ้นส่วน

  @IsOptional()
  @IsString()
  newComponentSerial?: string;  // Serial ใหม่ของชิ้นส่วน

  @IsOptional()
  @IsInt({ message: 'Parent Equipment ID must be an integer' })
  @Type(() => Number)
  parentEquipmentId?: number;  // อุปกรณ์หลักที่ชิ้นส่วนอยู่ใน

  // ========================================
  // COMMON FIELDS
  // ========================================

  @IsOptional()
  @IsString()
  notes?: string;

  // ========================================
  // EQUIPMENT TRACKING (EQUIPMENT_REPLACEMENT)
  // เชื่อมโยงกับ Equipment ในระบบ
  // ========================================

  @IsOptional()
  @IsInt({ message: 'Old Equipment ID must be an integer' })
  @Type(() => Number)
  oldEquipmentId?: number;  // ID ของอุปกรณ์เดิมที่ถูกถอดออก

  @IsOptional()
  @IsInt({ message: 'New Equipment ID must be an integer' })
  @Type(() => Number)
  newEquipmentId?: number;  // ID ของอุปกรณ์ใหม่ที่ใส่เข้าไป

  @IsOptional()
  @IsString()
  newBrand?: string;  // ยี่ห้ออุปกรณ์ใหม่

  @IsOptional()
  @IsString()
  newModel?: string;  // รุ่นอุปกรณ์ใหม่
}

/**
 * Resolve Incident DTO
 */
export class ResolveIncidentDto {
  @IsString()
  @MinLength(10, { 
    message: 'Resolution note must be at least 10 characters' 
  })
  resolutionNote: string;

  @IsBoolean()
  usedSpareParts: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SparePartDto)
  spareParts?: SparePartDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  afterPhotos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signedReportPhotos?: string[];
}

/**
 * Update Resolution DTO (before Help Desk confirms)
 */
export class UpdateResolveDto {
  @IsOptional()
  @IsString()
  @MinLength(10, { 
    message: 'Resolution note must be at least 10 characters' 
  })
  resolutionNote?: string;

  @IsOptional()
  @IsBoolean()
  usedSpareParts?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SparePartDto)
  spareParts?: SparePartDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  afterPhotos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signedReportPhotos?: string[];
}
