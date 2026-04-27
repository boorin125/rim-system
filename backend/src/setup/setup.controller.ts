// src/setup/setup.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { SetupService } from './setup.service';

class CreateAdminDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  getStatus() {
    return this.setupService.getStatus();
  }

  @Post()
  createFirstAdmin(@Body() dto: CreateAdminDto) {
    return this.setupService.createFirstAdmin(dto);
  }
}
