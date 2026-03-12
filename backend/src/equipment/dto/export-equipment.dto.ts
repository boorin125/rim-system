import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { EquipmentStatus } from '@prisma/client';

export class ExportEquipmentDto {
  @IsEnum(EquipmentStatus)
  @IsOptional()
  status?: EquipmentStatus;

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

  @IsString()
  @IsOptional()
  storeCode?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsOptional()
  warrantyExpired?: boolean;
}
