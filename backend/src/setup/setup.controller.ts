// src/setup/setup.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { SetupService } from './setup.service';

class CreateAdminDto {
  firstName: string;
  lastName: string;
  email: string;
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
