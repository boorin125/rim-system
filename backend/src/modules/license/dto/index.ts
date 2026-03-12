// src/modules/license/dto/index.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsEnum,
  IsEmail,
  IsDateString,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum LicenseType {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
  UNLIMITED = 'UNLIMITED',
}

export class CreateLicenseDto {
  @IsEnum(LicenseType)
  licenseType: LicenseType;

  @IsString()
  organizationName: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxStores?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  maxIncidentsMonth?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featuresEnabled?: string[];

  @IsDateString()
  expiresAt: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxActivations?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLicenseDto {
  @IsOptional()
  @IsEnum(LicenseType)
  licenseType?: LicenseType;

  @IsOptional()
  @IsString()
  organizationName?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxStores?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  maxIncidentsMonth?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featuresEnabled?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxActivations?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ActivateLicenseDto {
  @IsString()
  @Matches(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, {
    message: 'Invalid license key format. Expected: XXXX-XXXX-XXXX-XXXX',
  })
  licenseKey: string;

  @IsOptional()
  @IsString()
  machineId?: string;
}

export class ValidateLicenseDto {
  @IsOptional()
  @IsString()
  machineId?: string;
}

export class RenewLicenseDto {
  @IsDateString()
  newExpiresAt: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetConfigDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @IsOptional()
  @IsString()
  category?: string;
}
