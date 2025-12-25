// src/incidents/dto/create-incident.dto.ts

import { IsString, IsNotEmpty, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsEnum(Priority)
  @IsNotEmpty()
  priority: Priority;

  @IsInt()
  @IsNotEmpty()
  storeId: number;

  @IsInt()
  @IsOptional()
  equipmentId?: number;
}
