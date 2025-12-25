import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EquipmentCategory, EquipmentStatus } from '@prisma/client';

export class FilterEquipmentDto {
  // Pagination
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  // Filters
  @IsEnum(EquipmentStatus)
  @IsOptional()
  status?: EquipmentStatus;

  @IsEnum(EquipmentCategory)
  @IsOptional()
  category?: EquipmentCategory;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  storeId?: number;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  // Search (by name or serial number)
  @IsString()
  @IsOptional()
  search?: string;

  // Warranty status
  @IsOptional()
  warrantyExpired?: boolean; // true = expired, false = active, undefined = all
}
