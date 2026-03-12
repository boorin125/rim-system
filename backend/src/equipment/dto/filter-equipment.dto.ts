import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
  // Accepts single status or comma-separated list e.g. "ACTIVE,MAINTENANCE"
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  category?: string;

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
