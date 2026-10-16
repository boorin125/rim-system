import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddStoreDto {
  @IsInt()
  @IsNotEmpty()
  storeId: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
