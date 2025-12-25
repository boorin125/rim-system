// src/modules/stores/dto/create-store.dto.ts

import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export enum StoreType {
  PERMANENT = 'PERMANENT',
  POP_UP = 'POP_UP',
}

export enum StoreStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

export class CreateStoreDto {
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
  @IsNotEmpty()
  storeType: StoreType;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  subDistrict?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  googleMapLink?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  longitude?: number;

  @IsString()
  @IsOptional()
  routerIp?: string;

  @IsString()
  @IsOptional()
  switchIp?: string;

  @IsString()
  @IsOptional()
  mondayOpen?: string;

  @IsString()
  @IsOptional()
  mondayClose?: string;

  @IsString()
  @IsOptional()
  tuesdayOpen?: string;

  @IsString()
  @IsOptional()
  tuesdayClose?: string;

  @IsString()
  @IsOptional()
  wednesdayOpen?: string;

  @IsString()
  @IsOptional()
  wednesdayClose?: string;

  @IsString()
  @IsOptional()
  thursdayOpen?: string;

  @IsString()
  @IsOptional()
  thursdayClose?: string;

  @IsString()
  @IsOptional()
  fridayOpen?: string;

  @IsString()
  @IsOptional()
  fridayClose?: string;

  @IsString()
  @IsOptional()
  saturdayOpen?: string;

  @IsString()
  @IsOptional()
  saturdayClose?: string;

  @IsString()
  @IsOptional()
  sundayOpen?: string;

  @IsString()
  @IsOptional()
  sundayClose?: string;

  @IsString()
  @IsOptional()
  holidayOpen?: string;

  @IsString()
  @IsOptional()
  holidayClose?: string;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  openDate?: Date;

  @IsDate()
  @IsOptional()
  @Type(() => Date)
  closeDate?: Date;

  @IsEnum(StoreStatus)
  @IsNotEmpty()
  storeStatus: StoreStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}
