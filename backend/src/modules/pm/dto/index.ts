import { IsString, IsOptional, IsArray, IsIn } from 'class-validator';

export class UpdatePmEquipmentRecordDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  beforePhotos?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  afterPhotos?: string[];

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  @IsIn(['GOOD', 'NEEDS_REPAIR', 'REPLACED'])
  condition?: string;

  @IsOptional()
  @IsString()
  updatedBrand?: string;

  @IsOptional()
  @IsString()
  updatedModel?: string;

  @IsOptional()
  @IsString()
  updatedSerial?: string;
}

export class SignInventoryListDto {
  @IsString()
  signature: string; // Base64 PNG

  @IsString()
  signerName: string;
}

export class UploadSignedInventoryDto {
  @IsString()
  photo: string; // Base64 image
}
