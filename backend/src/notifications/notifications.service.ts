// backend/src/notifications/notifications.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType, UserRole } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all active supervisors
   */
  private async getSupervisors() {
    return this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: UserRole.SUPERVISOR,
          },
        },
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });
  }

  /**
   * Notify all IT Managers
   */
  async notifyAllItManagers(
    type: NotificationType,
    title: string,
    message: string,
    incidentId?: string,
    link?: string,
    excludeUserIds?: number[],
  ) {
    const itManagers = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: UserRole.IT_MANAGER } },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    const targets = excludeUserIds?.length
      ? itManagers.filter(u => !excludeUserIds.includes(u.id))
      : itManagers;

    return Promise.all(
      targets.map(u => this.createNotification(u.id, type, title, message, incidentId, link)),
    );
  }

  /**
   * Notify all supervisors (excluding specific user IDs to prevent duplicates)
   */
  async notifyAllSupervisors(
    type: NotificationType,
    title: string,
    message: string,
    incidentId?: string,
    excludeUserIds?: number[],
  ) {
    const supervisors = await this.getSupervisors();

    const targets = excludeUserIds?.length
      ? supervisors.filter(s => !excludeUserIds.includes(s.id))
      : supervisors;

    return Promise.all(
      targets.map(supervisor =>
        this.createNotification(supervisor.id, type, title, message, incidentId),
      ),
    );
  }

  /**
   * Create a notification
   */
  async createNotification(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    incidentId?: string,
    link?: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        incidentId,
        ...(link && { link }),
      },
      include: {
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
          },
        },
      },
    });
  }

  /**
   * Get all notifications for a user
   * Optional filter by read status
   * Help Desk users only see INCIDENT_RESOLVED notifications
   */
  async getUserNotifications(userId: number, isRead?: boolean) {
    // Get user to check roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: { role: true },
        },
      },
    });

    const userRoles = user?.roles?.map(r => r.role) || [];

    const where: any = {
      userId,
      ...(isRead !== undefined && { isRead }),
    };

    // Filter notifications for Help Desk - only show INCIDENT_RESOLVED
    // Only apply this filter if user ONLY has HELP_DESK role
    if (userRoles.length === 1 && userRoles.includes(UserRole.HELP_DESK)) {
      where.type = NotificationType.INCIDENT_RESOLVED;
    }

    return this.prisma.notification.findMany({
      where,
      include: {
        incident: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to 50 most recent notifications
    });
  }

  /**
   * Get unread notification count for a user
   * Help Desk users only count INCIDENT_RESOLVED notifications
   */
  async getUnreadCount(userId: number) {
    // Get user to check roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: { role: true },
        },
      },
    });

    const userRoles = user?.roles?.map(r => r.role) || [];

    const where: any = {
      userId,
      isRead: false,
    };

    // Filter notifications for Help Desk - only count INCIDENT_RESOLVED
    // Only apply this filter if user ONLY has HELP_DESK role
    if (userRoles.length === 1 && userRoles.includes(UserRole.HELP_DESK)) {
      where.type = NotificationType.INCIDENT_RESOLVED;
    }

    return this.prisma.notification.count({
      where,
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: number, userId: number) {
    // Verify notification belongs to user
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: number, userId: number) {
    // Verify notification belongs to user
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId: number) {
    return this.prisma.notification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });
  }

  /**
   * Helper: Notify incident assignment
   */
  async notifyIncidentAssigned(
    assigneeId: number,
    incidentId: string,
    ticketNumber: string,
    incidentTitle: string,
    scheduledAt?: Date,
    scheduleReason?: string,
  ) {
    const scheduleNote = scheduledAt
      ? `\nกำหนดเข้าดำเนินการ: ${scheduledAt.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${scheduledAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}${scheduleReason ? `\nเหตุผล: ${scheduleReason}` : ''}`
      : '';
    return this.createNotification(
      assigneeId,
      NotificationType.INCIDENT_ASSIGNED,
      'มีงานใหม่มอบหมายให้คุณ',
      `คุณได้รับมอบหมาย Incident ${ticketNumber}: ${incidentTitle}${scheduleNote}`,
      incidentId,
    );
  }

  /**
   * Helper: Notify incident reassignment
   */
  async notifyIncidentReassigned(
    newAssigneeId: number,
    incidentId: string,
    ticketNumber: string,
    incidentTitle: string,
  ) {
    return this.createNotification(
      newAssigneeId,
      NotificationType.INCIDENT_REASSIGNED,
      'มีการโอนงานให้คุณ',
      `Incident ${ticketNumber} ถูกโอนให้คุณ: ${incidentTitle}`,
      incidentId,
    );
  }

  /**
   * Helper: Notify incident resolution
   */
  async notifyIncidentResolved(
    userId: number,
    incidentId: string,
    ticketNumber: string,
    incidentTitle: string,
  ) {
    return this.createNotification(
      userId,
      NotificationType.INCIDENT_RESOLVED,
      'Incident แก้ไขแล้ว',
      `Incident ${ticketNumber} ได้รับการแก้ไขแล้ว: ${incidentTitle}`,
      incidentId,
    );
  }

  /**
   * Helper: Notify incident confirmed/closed
   */
  async notifyIncidentConfirmed(
    userId: number,
    incidentId: string,
    ticketNumber: string,
    incidentTitle: string,
  ) {
    return this.createNotification(
      userId,
      NotificationType.INCIDENT_CONFIRMED,
      'Incident ปิดแล้ว',
      `Incident ${ticketNumber} ได้รับการยืนยันและปิดแล้ว: ${incidentTitle}`,
      incidentId,
    );
  }

  /**
   * Helper: Notify incident reopened
   */
  async notifyIncidentReopened(
    userId: number,
    incidentId: string,
    ticketNumber: string,
    incidentTitle: string,
    reason: string,
  ) {
    return this.createNotification(
      userId,
      NotificationType.INCIDENT_REOPENED,
      'Incident ถูกเปิดใหม่',
      `Incident ${ticketNumber} ถูกเปิดใหม่: ${incidentTitle} เหตุผล: ${reason}`,
      incidentId,
    );
  }

  /**
   * Helper: Notify new comment
   */
  async notifyNewComment(
    userId: number,
    incidentId: string,
    ticketNumber: string,
    commenterName: string,
  ) {
    return this.createNotification(
      userId,
      NotificationType.COMMENT_ADDED,
      'มีความคิดเห็นใหม่',
      `${commenterName} แสดงความคิดเห็นใน Incident ${ticketNumber}`,
      incidentId,
    );
  }

  /**
   * Save Expo Push Token for a user (stored in SystemConfig)
   * Key format: push_token:{userId}
   */
  async savePushToken(userId: number, token: string, platform?: string): Promise<void> {
    const key = `push_token:${userId}`
    await this.prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value: JSON.stringify({ token, platform: platform ?? 'unknown', updatedAt: new Date().toISOString() }),
        category: 'mobile',
        description: `Expo push token for user ${userId}`,
      },
      update: {
        value: JSON.stringify({ token, platform: platform ?? 'unknown', updatedAt: new Date().toISOString() }),
      },
    })
  }

  /**
   * Get Expo Push Token for a user
   */
  async getPushToken(userId: number): Promise<string | null> {
    const key = `push_token:${userId}`
    const record = await this.prisma.systemConfig.findUnique({ where: { key } })
    if (!record) return null
    try {
      const data = JSON.parse(record.value as string)
      return data.token ?? null
    } catch {
      return null
    }
  }

  async notifyIncidentCancelledAfterCheckin(
    incidentId: string,
    ticketNumber: string,
    title: string,
    checkInAt: Date,
  ) {
    const checkInTime = new Date(checkInAt).toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
    return this.notifyAllSupervisors(
      NotificationType.INCIDENT_CANCELLED,
      'งานถูกยกเลิกหลัง Technician Check-in แล้ว',
      `Incident ${ticketNumber} "${title}" ถูกยกเลิกหลังจาก Technician Check-in แล้ว (Check-in เมื่อ ${checkInTime}) กรุณาตรวจสอบค่าเดินทาง`,
      incidentId,
    );
  }
}
