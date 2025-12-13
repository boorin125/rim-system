// src/incidents/dto/update-incident.dto.ts
import { IsString, IsOptional, IsEnum, IsInt } from 'class-validator';
import { Priority, IncidentStatus } from '@prisma/client';

export class UpdateIncidentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsEnum(IncidentStatus)
  @IsOptional()
  status?: IncidentStatus;

  @IsInt()
  @IsOptional()
  storeId?: number;

  @IsInt()
  @IsOptional()
  equipmentId?: number;

  @IsInt()
  @IsOptional()
  assigneeId?: number;

  @IsString()
  @IsOptional()
  resolutionNote?: string;
}