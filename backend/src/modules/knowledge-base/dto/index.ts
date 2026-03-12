// src/modules/knowledge-base/dto/index.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// Category DTOs
export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  parentId?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Article DTOs
export class CreateArticleDto {
  @IsInt()
  @Type(() => Number)
  categoryId: number;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsString()
  @MinLength(50)
  content: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  relatedArticleIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class UpdateArticleDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categoryId?: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  relatedArticleIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

// Feedback DTO
export class SubmitFeedbackDto {
  @IsBoolean()
  isHelpful: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

// Usage DTO
export class RecordUsageDto {
  @IsOptional()
  @IsString()
  incidentId?: string;

  @IsEnum(['VIEWED', 'APPLIED', 'SHARED', 'REFERENCED'])
  usageType: 'VIEWED' | 'APPLIED' | 'SHARED' | 'REFERENCED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
