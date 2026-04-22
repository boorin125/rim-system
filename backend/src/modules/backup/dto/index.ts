// src/modules/backup/dto/index.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum BackupType {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
  DIFFERENTIAL = 'DIFFERENTIAL',
}

export enum BackupScope {
  ALL = 'ALL',
  CORE = 'CORE',
  TRANSACTIONS = 'TRANSACTIONS',
  CONFIG = 'CONFIG',
  SELECTIVE = 'SELECTIVE',
}

export enum RestoreType {
  FULL = 'FULL',
  SELECTIVE = 'SELECTIVE',
}

export enum OverwriteMode {
  SKIP_EXISTING = 'SKIP_EXISTING',
  OVERWRITE = 'OVERWRITE',
  MERGE = 'MERGE',
}

export enum ScheduleFrequency {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export class CreateBackupDto {
  @IsOptional()
  @IsEnum(BackupType)
  backupType?: BackupType;

  @IsOptional()
  @IsEnum(BackupScope)
  scope?: BackupScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopeDetails?: string[];

  @IsOptional()
  @IsBoolean()
  isCompressed?: boolean;

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  customName?: string;
}

export class RestoreFromFileDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedTables?: string[];
}

export class CreateRestoreDto {
  @IsInt()
  @Type(() => Number)
  backupId: number;

  @IsOptional()
  @IsEnum(RestoreType)
  restoreType?: RestoreType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetTables?: string[];

  @IsOptional()
  @IsEnum(OverwriteMode)
  overwriteMode?: OverwriteMode;
}

export enum StorageType {
  LOCAL = 'LOCAL',
  EXTERNAL = 'EXTERNAL',
}

export class CreateScheduleDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(ScheduleFrequency)
  frequency: ScheduleFrequency;

  @IsOptional()
  @IsEnum(StorageType)
  storageType?: StorageType;

  @IsOptional()
  @IsString()
  externalPath?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsString()
  timeOfDay?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsEnum(BackupType)
  backupType?: BackupType;

  @IsOptional()
  @IsEnum(BackupScope)
  scope?: BackupScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopeDetails?: string[];

  @IsOptional()
  @IsBoolean()
  isCompressed?: boolean;

  @IsOptional()
  @IsBoolean()
  isEncrypted?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxBackups?: number;

  @IsOptional()
  @IsString()
  schedulePassword?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  diffIntervalMinutes?: number | null;

  @IsOptional()
  @IsString()
  diffStartTime?: string | null;
}

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ScheduleFrequency)
  frequency?: ScheduleFrequency;

  @IsOptional()
  @IsEnum(StorageType)
  storageType?: StorageType;

  @IsOptional()
  @IsString()
  externalPath?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsString()
  timeOfDay?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  retentionDays?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  maxBackups?: number;

  @IsOptional()
  @IsString()
  schedulePassword?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  diffIntervalMinutes?: number | null;

  @IsOptional()
  @IsString()
  diffStartTime?: string | null;

  @IsOptional()
  @IsEnum(BackupType)
  backupType?: BackupType;
}
