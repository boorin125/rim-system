// src/users/dto/update-user.dto.ts

import { IsString, IsEmail, IsOptional, IsEnum, MaxLength, IsArray, IsNumber, IsBoolean, ArrayMaxSize } from 'class-validator';
import { UserRole, UserStatus, TechnicianType } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  department?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsEnum(TechnicianType)
  @IsOptional()
  technicianType?: TechnicianType;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  serviceCenter?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @IsOptional()
  responsibleProvinces?: string[];

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}
