import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ProjectStatusDto {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  budget?: number;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value === null || value === '') ? undefined : value)
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => (value === null || value === '') ? undefined : value)
  endDate?: string;

  @IsEnum(ProjectStatusDto)
  @IsOptional()
  status?: ProjectStatusDto;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  projectManagerId?: number;
}
