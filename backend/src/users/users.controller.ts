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
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { PushTokenDto } from './dto/push-token.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserStatus } from '@prisma/client';
import { LicenseGuard } from '../modules/license/license.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard, LicenseGuard)
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(
    @Query('role') role?: string,
    @Query('technicianType') technicianType?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll({ role, technicianType, status });
  }

  @Get('pending')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  findPending() {
    return this.usersService.findPending();
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

  @Post(':id/update-roles')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  updateRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @Request() req,
  ) {
    return this.usersService.updateRoles(id, updateUserRolesDto, req.user);
  }

  @Post(':id/unlock')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  unlockAccount(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.unlockAccount(id);
  }

  @Post(':id/approve')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  approveUser(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.usersService.approveUser(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  rejectUser(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    return this.usersService.rejectUser(id, req.user.id, reason);
  }

  @Get(':id/incidents')
  getUserIncidents(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserIncidents(id);
  }

  @Get(':id/statistics')
  getUserStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserStatistics(id);
  }

  @Get(':id/type-change-check')
  @Roles('SUPER_ADMIN', 'IT_MANAGER')
  @UseGuards(RolesGuard)
  checkTypeChange(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.checkTypeChange(id);
  }

  /**
   * PATCH /users/me/push-token
   * Save the caller's Expo push token so the server can send targeted push
   * notifications to their device.
   */
  @Patch('me/push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  savePushToken(@Body() pushTokenDto: PushTokenDto, @Request() req) {
    return this.usersService.savePushToken(req.user.id, pushTokenDto.token);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

}
