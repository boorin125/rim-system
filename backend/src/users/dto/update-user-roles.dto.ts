// src/users/dto/update-user-roles.dto.ts

import { IsArray, IsEnum, ArrayMinSize } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRolesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one role is required' })
  @IsEnum(UserRole, { each: true, message: 'Invalid role' })
  roles: UserRole[];
}
