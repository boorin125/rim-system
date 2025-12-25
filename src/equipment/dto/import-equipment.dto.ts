import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EquipmentCategory, EquipmentStatus } from '@prisma/client';

export class ImportEquipmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Serial Number is required' })
  @MinLength(3)
  @MaxLength(100)
  serialNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'Equipment name is required' })
  @MaxLength(200)
  name: string;

  @IsEnum(EquipmentCategory, {
    message: 'Category must be: NETWORK, COMPUTER, POS, PRINTER, ROUTER, SWITCH, CCTV, or OTHER',
  })
  category: EquipmentCategory;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  brand?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  model?: string;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;

  @IsDateString()
  @IsOptional()
  warrantyExpiry?: string;

  @IsEnum(EquipmentStatus, {
    message: 'Status must be: ACTIVE, INACTIVE, MAINTENANCE, or RETIRED',
  })
  @IsOptional()
  status?: EquipmentStatus;

  @IsString()
  @IsNotEmpty({ message: 'Store Code is required' })
  storeCode: string; // Will be converted to storeId
}
