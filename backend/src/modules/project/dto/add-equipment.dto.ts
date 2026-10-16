import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddEquipmentDto {
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @IsString()
  @IsOptional()
  oldModel?: string;

  @IsString()
  @IsOptional()
  oldSN?: string;

  @IsString()
  @IsOptional()
  newModel?: string;

  @IsString()
  @IsOptional()
  newSN?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
