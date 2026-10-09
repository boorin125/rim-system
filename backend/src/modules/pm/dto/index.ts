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

  /** Replace the entire beforePhotos array (used for deletion) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  setBeforePhotos?: string[];

  /** Replace the entire afterPhotos array (used for deletion) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  setAfterPhotos?: string[];

  /** Remove these photo paths from beforePhotos (safe when several people edit at once) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removeBeforePhotos?: string[];

  /** Remove these photo paths from afterPhotos */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  removeAfterPhotos?: string[];

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

/** Helpdesk / Supervisor adds equipment to the store from the PM page */
export class AddPmEquipmentDto {
  @IsString()
  name: string;

  @IsString()
  category: string;

  @IsString()
  serialNumber: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
