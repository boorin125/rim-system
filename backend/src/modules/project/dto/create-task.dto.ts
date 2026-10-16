import { IsInt, IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

export enum ProjectTaskTypeDto {
  GENERAL = 'GENERAL',
  OPENING = 'OPENING', // store opening day — the store turns ACTIVE on scheduledDate
}

export class CreateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(ProjectTaskTypeDto)
  @IsOptional()
  taskType?: ProjectTaskTypeDto;

  @IsInt()
  @IsOptional()
  assignedToId?: number;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
