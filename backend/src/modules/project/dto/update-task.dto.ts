import { IsInt, IsOptional, IsDateString, IsString, IsEnum, IsIn } from 'class-validator';
import { ProjectTaskTypeDto } from './create-task.dto';
import { WORK_TYPE_KEYS, WorkTypeKey } from '../work-types';

export enum TaskStatusDto {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_VERIFY = 'PENDING_VERIFY',
  COMPLETED = 'COMPLETED',
  RESCHEDULED = 'RESCHEDULED',
}

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum(ProjectTaskTypeDto)
  @IsOptional()
  taskType?: ProjectTaskTypeDto;

  @IsIn(WORK_TYPE_KEYS)
  @IsOptional()
  workType?: WorkTypeKey;

  @IsInt()
  @IsOptional()
  assignedToId?: number;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;

  @IsEnum(TaskStatusDto)
  @IsOptional()
  status?: TaskStatusDto;

  @IsString()
  @IsOptional()
  notes?: string;
}
