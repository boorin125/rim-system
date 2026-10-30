import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ArrayMinSize,
  ValidateNested,
  MaxLength,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One store's values for the device. The row is the truth (rule agreed 2026-10-30):
 * a blank field clears the old value — except status (blank = keep / ACTIVE for new).
 */
export class BulkDeviceRowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  storeCode: string;

  @IsOptional() @IsString() @MaxLength(100) serialNumber?: string;
  @IsOptional() @IsString() @MaxLength(45) ipAddress?: string;
  @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @IsOptional() @IsString() @MaxLength(100) model?: string;
  @IsOptional() @IsString() @MaxLength(30) purchaseDate?: string; // YYYY-MM-DD
  @IsOptional() @IsString() @MaxLength(30) warrantyExpiry?: string; // YYYY-MM-DD
  @IsOptional() @IsString() @MaxLength(20) status?: string;
}

/** Add / update one device (matched by name) across many stores */
export class BulkDeviceDto {
  @IsString()
  @IsNotEmpty({ message: 'Device Name is required' })
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  @MaxLength(100)
  category: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'เลือกอย่างน้อย 1 สาขา' })
  @ArrayMaxSize(3000)
  @ValidateNested({ each: true })
  @Type(() => BulkDeviceRowDto)
  rows: BulkDeviceRowDto[];
}

/** Current values of the device in the chosen stores — pre-fills the grid / Excel */
export class BulkDeviceExistingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsArray()
  @ArrayMaxSize(3000)
  @IsInt({ each: true })
  @Type(() => Number)
  storeIds: number[];
}
