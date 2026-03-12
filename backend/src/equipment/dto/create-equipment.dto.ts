import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsInt,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EquipmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateEquipmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Serial Number is required' })
  @MinLength(3, { message: 'Serial Number must be at least 3 characters' })
  @MaxLength(100, { message: 'Serial Number must not exceed 100 characters' })
  serialNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Equipment name is required' })
  @MaxLength(200, { message: 'Equipment name must not exceed 200 characters' })
  name: string; // ชื่ออุปกรณ์รวมตำแหน่ง เช่น "POS#1 Printer"

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Brand must not exceed 100 characters' })
  brand?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Model must not exceed 100 characters' })
  model?: string;

  @IsDateString(
    {},
    { message: 'Purchase Date must be a valid ISO 8601 date string' },
  )
  @IsOptional()
  purchaseDate?: string;

  @IsDateString(
    {},
    { message: 'Warranty Expiry must be a valid ISO 8601 date string' },
  )
  @IsOptional()
  warrantyExpiry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(45, { message: 'IP Address must not exceed 45 characters' })
  ipAddress?: string;

  @IsEnum(EquipmentStatus, {
    message: 'Status must be a valid equipment status',
  })
  @IsOptional()
  status?: EquipmentStatus;

  @IsInt({ message: 'Store ID must be an integer' })
  @IsNotEmpty({ message: 'Store ID is required' })
  @Type(() => Number)
  storeId: number;
}
