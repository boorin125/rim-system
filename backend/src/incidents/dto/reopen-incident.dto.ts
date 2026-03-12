// backend/src/incidents/dto/reopen-incident.dto.ts

import { IsString, IsOptional, MinLength, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class ReopenIncidentDto {
  @IsString()
  @MinLength(10, { message: 'Reopen reason must be at least 10 characters' })
  reason: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  assignTo?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
