import {
  IsString,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One device in one store, from the Excel import (rules agreed 2026-10-30):
 * blank cell = keep the old value, "-" = clear it. A store may appear on several rows (one per device).
 */
export class BulkDeviceRowDto {
  @IsOptional() @IsString() @MaxLength(50) storeCode?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() @MaxLength(100) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(45) ipAddress?: string;
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsOptional() @IsString() @MaxLength(100) model?: string;
  @IsOptional() @IsString() @MaxLength(30) purchaseDate?: string; // YYYY-MM-DD
  @IsOptional() @IsString() @MaxLength(30) warrantyExpiry?: string; // YYYY-MM-DD
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() row?: number; // Excel row number — echoed back in problems
}

/** Add / update devices in many stores from one Excel file */
export class BulkDeviceDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'ไม่พบแถวที่กรอก Device Name ในไฟล์' })
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => BulkDeviceRowDto)
  rows: BulkDeviceRowDto[];
}
