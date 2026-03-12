// src/modules/outsource/dto/index.ts

import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  Min,
  Max,
  IsInt,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UrgencyLevel {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export class CreateOutsourceJobDto {
  @IsString()
  incidentId: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  jobType?: string; // 'MARKETPLACE' | 'DIRECT_ASSIGN'

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  assignToId?: number; // Outsource technician user ID (for DIRECT_ASSIGN)

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimatedHours?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  agreedPrice?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgencyLevel?: UrgencyLevel;
}

export class UpdateOutsourceJobDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimatedHours?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgencyLevel?: UrgencyLevel;
}

export class SubmitBidDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  proposedPrice: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  estimatedHours?: number;

  @IsOptional()
  @IsDateString()
  proposedStartDate?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export class AwardJobDto {
  @IsInt()
  @Type(() => Number)
  bidId: number;

  @IsOptional()
  @IsString()
  awardNotes?: string;
}

export class CompleteJobDto {
  @IsOptional()
  @IsString()
  completionNotes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completionPhotos?: string[];
}

export class VerifyJobDto {
  @IsEnum(['APPROVED', 'REJECTED', 'NEEDS_REVISION'])
  status: 'APPROVED' | 'REJECTED' | 'NEEDS_REVISION';

  @IsOptional()
  @IsString()
  verificationNotes?: string;
}

export class ProcessPaymentDto {
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  paymentAmount: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  withholdingTax?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  netPaymentAmount?: number;

  @IsOptional()
  @IsString()
  paymentSlipPath?: string;

  @IsOptional()
  @IsString()
  paymentNote?: string;
}

export class RateJobDto {
  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ApproveJobDto {
  @IsString()
  action: string; // 'APPROVED' | 'REJECTED'

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class SubmitDocumentsDto {
  @IsOptional()
  @IsString()
  documentSlipPath?: string;

  @IsOptional()
  @IsString()
  documentWorkOrderPath?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentPhotos?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  shippingCost?: number;
}

export class RequestMoreDocumentsDto {
  @IsString()
  @IsNotEmpty()
  note: string;
}
