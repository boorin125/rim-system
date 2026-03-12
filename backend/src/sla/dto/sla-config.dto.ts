import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { Priority } from '@prisma/client';

export class CreateSlaConfigDto {
  @IsEnum(Priority, { message: 'Priority must be CRITICAL, HIGH, MEDIUM, or LOW' })
  priority: Priority;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1, { message: 'Response time must be at least 1 minute' })
  @Type(() => Number)
  responseTimeMinutes: number;

  @IsInt()
  @Min(1, { message: 'Resolution time must be at least 1 minute' })
  @Type(() => Number)
  resolutionTimeMinutes: number;

  // Provincial SLA times (optional - falls back to default if not set)
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Provincial response time must be at least 1 minute' })
  @Type(() => Number)
  responseTimeProvincial?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Provincial resolution time must be at least 1 minute' })
  @Type(() => Number)
  resolutionTimeProvincial?: number;

  @IsOptional()
  @IsBoolean()
  escalationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  escalationAfterMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  warningThreshold?: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #EF4444)' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSlaConfigDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Response time must be at least 1 minute' })
  @Type(() => Number)
  responseTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Resolution time must be at least 1 minute' })
  @Type(() => Number)
  resolutionTimeMinutes?: number;

  // Provincial SLA times
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Provincial response time must be at least 1 minute' })
  @Type(() => Number)
  responseTimeProvincial?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Provincial resolution time must be at least 1 minute' })
  @Type(() => Number)
  resolutionTimeProvincial?: number;

  @IsOptional()
  @IsBoolean()
  escalationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  escalationAfterMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  warningThreshold?: number;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g., #EF4444)' })
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
