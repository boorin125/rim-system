// src/incidents/dto/create-incident.dto.ts
import { IsString, IsInt, IsEnum, IsOptional, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

export class CreateIncidentDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  jobType?: string;

  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @IsInt()
  storeId: number;

  @IsInt()
  @IsOptional()
  equipmentId?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  equipmentIds?: number[];

  @IsInt()
  @IsOptional()
  reportedBy?: number;

  @IsDateString()
  @IsOptional()
  incidentDate?: string; // วันที่ลูกค้าแจ้ง (ISO 8601 format)

  @IsDateString()
  @IsOptional()
  scheduledAt?: string; // วันเวลานัดเข้าดำเนินการ (Project/Adhoc)
}
