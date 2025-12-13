// src/users/dto/create-user.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional, Matches } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  @Matches(/^0\d{1,2}-\d{3}-\d{4}$/, {
    message: 'Phone must be in format: 0XX-XXX-XXXX',
  })
  phone?: string;

  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}