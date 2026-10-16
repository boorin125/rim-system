import { IsInt, IsOptional, IsDateString, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

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
