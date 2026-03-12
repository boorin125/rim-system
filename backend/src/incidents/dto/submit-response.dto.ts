// src/incidents/dto/submit-response.dto.ts
// DTO for technician submitting response before going onsite

import { IsString, IsISO8601, MinLength, MaxLength } from 'class-validator';

export class SubmitResponseDto {
  @IsISO8601()
  estimatedArrivalTime: string; // ISO8601 format: "2026-02-07T10:30:00.000Z"

  @IsString()
  @MinLength(5, { message: 'ข้อความต้องมีอย่างน้อย 5 ตัวอักษร' })
  @MaxLength(1000, { message: 'ข้อความต้องไม่เกิน 1000 ตัวอักษร' })
  responseMessage: string;
}
