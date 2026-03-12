// src/modules/ratings/dto/submit-rating.dto.ts

import {
  IsInt,
  IsString,
  IsOptional,
  Min,
  Max,
  IsEmail,
  MaxLength,
} from 'class-validator';

export class SubmitRatingDto {
  @IsInt()
  @Min(1, { message: 'Rating ต้องอยู่ระหว่าง 1-5' })
  @Max(5, { message: 'Rating ต้องอยู่ระหว่าง 1-5' })
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'Comment ต้องไม่เกิน 1000 ตัวอักษร' })
  comment?: string;

  // Detailed Ratings (Optional)
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  qualityRating?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  professionalismRating?: number;

  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  politenessRating?: number;

  // Rater Info (Optional)
  @IsString()
  @IsOptional()
  @MaxLength(100)
  raterName?: string;

  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  @IsOptional()
  raterEmail?: string;
}
