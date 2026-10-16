import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { StoreType } from '../../stores/dto/create-store.dto';

/** New store created from a project (e.g. new branch opening) — saved with storeStatus OPENING */
export class CreateProjectStoreDto {
  @IsString()
  @IsNotEmpty()
  storeCode: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  company: string;

  @IsEnum(StoreType)
  @IsOptional()
  storeType?: StoreType;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
