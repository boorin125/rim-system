import { IsInt, IsOptional, IsDateString, IsString, IsEnum } from 'class-validator';

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
