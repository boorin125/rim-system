// src/modules/reassignments/dto/respond-reassignment.dto.ts

import { IsEnum, IsString, IsOptional, ValidateIf, MinLength } from 'class-validator';
import { ReassignmentStatus } from '@prisma/client';

export class RespondReassignmentDto {
  @IsEnum({ ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED' }, {
    message: 'status ต้องเป็น ACCEPTED หรือ REJECTED เท่านั้น',
  })
  status: 'ACCEPTED' | 'REJECTED';

  @ValidateIf((o) => o.status === 'REJECTED')
  @IsString()
  @MinLength(10, { message: 'เหตุผลการปฏิเสธต้องมีอย่างน้อย 10 ตัวอักษร' })
  responseNote?: string;
}
