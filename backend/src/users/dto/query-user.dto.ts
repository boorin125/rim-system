// src/users/dto/query-user.dto.ts
import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, UserStatus } from '@prisma/client';

export class QueryUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  search?: string; // Search by email, firstName, lastName

  // Pagination
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}