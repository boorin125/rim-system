import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum MaintenanceType {
  ROUTINE = 'ROUTINE',
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  EMERGENCY = 'EMERGENCY',
}

export class ScheduleMaintenanceDto {
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  equipmentId: number;

  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @IsDateString()
  @IsNotEmpty()
  scheduledDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}

export class CompleteMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  completionNotes: string;

  @IsDateString()
  @IsOptional()
  completedDate?: string; // Default: now
}
