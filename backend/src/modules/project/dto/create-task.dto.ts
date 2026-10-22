import { IsInt, IsOptional, IsDateString, IsString, IsEnum, IsIn } from 'class-validator';
import { WORK_TYPE_KEYS, WorkTypeKey } from '../work-types';

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

  // Work type → evidence needed before sending (work-types.ts); CLOSED_STORE ⇔ taskType CLOSING
  @IsIn(WORK_TYPE_KEYS)
  @IsOptional()
  workType?: WorkTypeKey;

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
