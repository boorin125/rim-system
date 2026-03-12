// src/modules/reassignments/dto/create-reassignment.dto.ts

import { IsInt, IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateReassignmentDto {
  @IsInt()
  @IsNotEmpty()
  toTechnicianId: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'เหตุผลต้องมีอย่างน้อย 10 ตัวอักษร' })
  reason: string;
}
