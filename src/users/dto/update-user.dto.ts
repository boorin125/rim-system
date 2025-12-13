// src/users/dto/update-user.dto.ts
import { IsString, IsOptional, IsEnum, Matches } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^0\d{1,2}-\d{3}-\d{4}$/, {
    message: 'Phone must be in format: 0XX-XXX-XXXX',
  })
  phone?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}