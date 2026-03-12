// backend/src/notifications/notifications.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get all notifications for current user
   * Query param: isRead (optional) - filter by read status
   */
  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async getMyNotifications(@Request() req, @Query('isRead') isRead?: string) {
    const isReadFilter = isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationsService.getUserNotifications(req.user.id, isReadFilter);
  }

  /**
   * Get unread notification count for current user
   */
  @Get('unread-count')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async getUnreadCount(@Request() req) {
    return {
      count: await this.notificationsService.getUnreadCount(req.user.id),
    };
  }

  /**
   * Mark a notification as read
   */
  @Patch(':id/read')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  /**
   * Mark all notifications as read for current user
   */
  @Patch('mark-all-read')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }

  /**
   * Delete a notification
   */
  @Delete(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async deleteNotification(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.notificationsService.deleteNotification(id, req.user.id);
  }

  /**
   * Register/update Expo Push Token for mobile app
   * Called by RIM Mobile app after login
   */
  @Post('push-token')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async savePushToken(
    @Body() body: { token: string; platform?: string },
    @Request() req,
  ) {
    await this.notificationsService.savePushToken(req.user.id, body.token, body.platform)
    return { success: true }
  }

  /**
   * Delete all read notifications for current user
   */
  @Delete('read/all')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  async deleteAllRead(@Request() req) {
    return this.notificationsService.deleteAllRead(req.user.id);
  }
}
