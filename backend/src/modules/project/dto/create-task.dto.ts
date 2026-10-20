import { IsInt, IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

export enum ProjectTaskTypeDto {
  GENERAL = 'GENERAL',
  OPENING = 'OPENING', // store opening day — the store turns ACTIVE on scheduledDate
  CLOSING = 'CLOSING', // Closed Store — the store is closed when the technician completes the task
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
