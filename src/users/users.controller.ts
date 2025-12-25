// src/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserStatus } from '@prisma/client';

@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Post(':id/change-password')
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req,
  ) {
    // Check if user is changing their own password or is admin
    if (req.user.id !== id && !['SUPER_ADMIN', 'IT_MANAGER'].includes(req.user.role)) {
      return this.usersService.changePassword(
        id,
        changePasswordDto.oldPassword,
        changePasswordDto.newPassword,
      );
    }
    return this.usersService.changePassword(
      id,
      changePasswordDto.oldPassword,
      changePasswordDto.newPassword,
    );
  }

  @Post(':id/update-status')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: UserStatus,
  ) {
    return this.usersService.updateStatus(id, status);
  }

  @Post(':id/unlock')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  unlockAccount(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.unlockAccount(id);
  }

  @Get(':id/incidents')
  getUserIncidents(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserIncidents(id);
  }

  @Get(':id/statistics')
  getUserStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserStatistics(id);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
