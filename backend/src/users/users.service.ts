// src/users/users.service.ts

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UserStatus, UserRole, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Helper to format user with roles array
   */
  private formatUserWithRoles(user: any) {
    const roles = user.roles?.map((r: any) => r.role) || [];
    const { roles: _, ...userWithoutRoles } = user;
    return {
      ...userWithoutRoles,
      roles,
    };
  }

  /**
   * Check if user is protected (cannot be modified/deleted)
   */
  private async checkProtectedUser(userId: number, action: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isProtected: true, email: true },
    });

    if (user?.isProtected) {
      throw new ForbiddenException(
        `Cannot ${action} protected user account (${user.email}). This account is system-protected.`,
      );
    }
  }

  /**
   * IT_MANAGER cannot modify another IT_MANAGER (or SUPER_ADMIN).
   * SUPER_ADMIN has no such restriction.
   */
  private async checkNotPeerManager(targetId: number, currentUserRoles: string[]) {
    if (currentUserRoles.includes('SUPER_ADMIN')) return;

    const targetRoles = await this.prisma.userRoleAssignment.findMany({
      where: { userId: targetId },
      select: { role: true },
    });
    const hasManagerRole = targetRoles.some(
      (r) => r.role === UserRole.IT_MANAGER || r.role === UserRole.SUPER_ADMIN,
    );
    if (hasManagerRole) {
      throw new ForbiddenException(
        'IT Manager ไม่มีสิทธิ์แก้ไขหรือเปลี่ยนสถานะ IT Manager / Super Admin คนอื่น',
      );
    }
  }

  /**
   * Create a new user (from registration)
   */
  async create(dto: CreateUserDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user with default END_USER role
    const user = await this.prisma.user.create({
      data: {
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: 'ACTIVE',
        roles: {
          create: [{ role: 'END_USER' }],
        },
      },
      include: {
        roles: true,
      },
    });

    // Remove password from response
    const { password, ...result } = user;

    return this.formatUserWithRoles(result);
  }

  /**
   * Get all TECHNICIAN users with their location (province) for map display
   */
  async findTechnicianLocations() {
    const users = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: 'TECHNICIAN' as any } },
        status: 'ACTIVE' as any,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameEn: true,
        lastNameEn: true,
        phone: true,
        technicianType: true,
        serviceCenter: true,
        address: true,
        subDistrict: true,
        district: true,
        province: true,
        avatarPath: true,
        responsibleProvinces: true,
        isOnline: true,
        firstLoginTodayAt: true,
        roles: { select: { role: true } },
      },
      orderBy: { firstName: 'asc' },
    });
    return users.map((u) => ({
      ...u,
      roles: u.roles.map((r: any) => r.role),
    }));
  }

  /**
   * Get all users, with optional role and technicianType filters
   */
  async findAll(filters?: { role?: string; technicianType?: string; status?: string }) {
    const where: any = {};

    if (filters?.role) {
      where.roles = { some: { role: filters.role as any } };
    }

    if (filters?.technicianType) {
      where.technicianType = filters.technicianType as any;
    }

    if (filters?.status) {
      where.status = filters.status as any;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        department: true,
        technicianType: true,
        serviceCenter: true,
        responsibleProvinces: true,
        address: true,
        roles: {
          select: {
            role: true,
          },
        },
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(this.formatUserWithRoles);
  }

  /**
   * Get user by ID
   */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        department: true,
        technicianType: true,
        serviceCenter: true,
        responsibleProvinces: true,
        address: true,
        roles: {
          select: {
            role: true,
          },
        },
        status: true,
        twoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            incidentsCreated: true,
            incidentsAssigned: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.formatUserWithRoles(user);
  }

  /**
   * Update user basic info (not roles)
   */
  async update(id: number, dto: UpdateUserDto, currentUser?: any) {
    // Check if user exists
    await this.findOne(id);

    // Check if user is protected
    await this.checkProtectedUser(id, 'update');

    // IT_MANAGER cannot edit another IT_MANAGER / SUPER_ADMIN
    if (currentUser) {
      const currentUserRoles: string[] = Array.isArray(currentUser.roles)
        ? currentUser.roles
        : [currentUser.role];
      await this.checkNotPeerManager(id, currentUserRoles);
    }

    // If email is being updated, check if it's already taken
    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser && existingUser.id !== id) {
        throw new BadRequestException('Email already in use');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        department: dto.department,
        address: dto.address,
        technicianType: dto.technicianType,
        serviceCenter: dto.serviceCenter,
        responsibleProvinces: dto.responsibleProvinces
          ? dto.responsibleProvinces.map((p: string) => p.toUpperCase().trim())
          : undefined,
        status: dto.status,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        department: true,
        technicianType: true,
        responsibleProvinces: true,
        address: true,
        roles: {
          select: {
            role: true,
          },
        },
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.formatUserWithRoles(user);
  }

  /**
   * Update user roles (multi-roles support)
   * - SUPER_ADMIN can assign any role including IT_MANAGER and SUPER_ADMIN
   * - IT_MANAGER cannot assign SUPER_ADMIN role
   */
  async updateRoles(id: number, dto: UpdateUserRolesDto, currentUser: any) {
    // Check if user exists
    await this.findOne(id);

    // Check if user is protected
    await this.checkProtectedUser(id, 'modify roles of');

    // Validate that at least one role is provided
    if (!dto.roles || dto.roles.length === 0) {
      throw new BadRequestException('At least one role is required');
    }

    // Get current user's roles
    const currentUserRoles: string[] = Array.isArray(currentUser.roles)
      ? currentUser.roles
      : [currentUser.role];
    const isSuperAdmin = currentUserRoles.includes('SUPER_ADMIN');

    // IT_MANAGER cannot edit another IT_MANAGER / SUPER_ADMIN
    await this.checkNotPeerManager(id, currentUserRoles);

    // IT_MANAGER cannot assign SUPER_ADMIN role
    if (!isSuperAdmin && dto.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException('You do not have permission to assign Super Admin role');
    }

    // Deduplicate roles to prevent unique-constraint 500 errors
    const uniqueRoles = [...new Set(dto.roles)];

    // Delete all existing roles and create new ones, also activate user
    await this.prisma.$transaction(async (tx) => {
      // Delete existing roles
      await tx.userRoleAssignment.deleteMany({
        where: { userId: id },
      });

      // Create new roles
      await tx.userRoleAssignment.createMany({
        data: uniqueRoles.map((role) => ({
          userId: id,
          role: role as UserRole,
        })),
      });

      // ✅ Auto-activate user when roles are assigned by admin
      // This handles the case where user was PENDING after registration
      await tx.user.update({
        where: { id },
        data: { status: UserStatus.ACTIVE },
      });
    });

    // Return updated user
    return this.findOne(id);
  }

  /**
   * Schedule user for deletion after 7-day grace period
   */
  async scheduleDelete(id: number, requestedById: number) {
    await this.findOne(id);
    await this.checkProtectedUser(id, 'schedule delete');

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { status: true, roles: { select: { role: true } } },
    });

    if (user!.status === UserStatus.PENDING_DELETION) {
      throw new BadRequestException('User is already scheduled for deletion');
    }

    // Prevent deleting the last Super Admin
    const isTargetSuperAdmin = user!.roles.some((r) => r.role === UserRole.SUPER_ADMIN);
    if (isTargetSuperAdmin) {
      const superAdminCount = await this.prisma.userRoleAssignment.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          user: { status: { not: UserStatus.PENDING_DELETION } },
        },
      });
      if (superAdminCount <= 1) {
        throw new ForbiddenException(
          'ไม่สามารถลบ Super Admin คนสุดท้ายได้ กรุณาเพิ่ม Super Admin อีกคนก่อน',
        );
      }
    }

    const scheduledDeleteAt = new Date();
    scheduledDeleteAt.setDate(scheduledDeleteAt.getDate() + 7);

    await this.prisma.user.update({
      where: { id },
      data: {
        statusBeforeDeletion: user!.status,
        status: UserStatus.PENDING_DELETION,
        scheduledDeleteAt,
        deleteRequestedAt: new Date(),
        deleteRequestedBy: requestedById,
      },
    });

    return { message: 'User scheduled for deletion in 7 days', scheduledDeleteAt };
  }

  /**
   * Cancel scheduled deletion — restore previous status
   */
  async cancelDelete(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { status: true, statusBeforeDeletion: true },
    });

    if (!user) throw new NotFoundException(`User with ID ${id} not found`);

    if (user.status !== UserStatus.PENDING_DELETION) {
      throw new BadRequestException('User is not scheduled for deletion');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: user.statusBeforeDeletion ?? UserStatus.ACTIVE,
        statusBeforeDeletion: null,
        scheduledDeleteAt: null,
        deleteRequestedAt: null,
        deleteRequestedBy: null,
      },
    });

    return { message: 'Deletion cancelled successfully' };
  }

  /**
   * Permanently delete all users whose grace period has expired (called by scheduler)
   */
  async purgeExpiredDeletions() {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.PENDING_DELETION,
        scheduledDeleteAt: { lte: new Date() },
      },
      select: { id: true, email: true },
    });

    for (const user of users) {
      await this.prisma.user.delete({ where: { id: user.id } });
    }

    return users.length;
  }

  /**
   * Delete user (immediate — used by purge scheduler)
   */
  async remove(id: number) {
    await this.findOne(id);
    await this.checkProtectedUser(id, 'delete');

    await this.prisma.user.delete({ where: { id } });

    return { message: 'User deleted successfully' };
  }

  /**
   * Change password
   */
  async changePassword(id: number, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid old password');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        lastPasswordChange: new Date(),
      },
    });

    return {
      message: 'Password changed successfully',
    };
  }

  /**
   * Update user status
   */
  async updateStatus(id: number, status: UserStatus, currentUser?: any) {
    await this.findOne(id);

    // Check if user is protected
    await this.checkProtectedUser(id, 'change status of');

    // IT_MANAGER cannot change status of another IT_MANAGER / SUPER_ADMIN
    if (currentUser) {
      const currentUserRoles: string[] = Array.isArray(currentUser.roles)
        ? currentUser.roles
        : [currentUser.role];
      await this.checkNotPeerManager(id, currentUserRoles);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        username: true,
        email: true,
        roles: {
          select: {
            role: true,
          },
        },
        status: true,
      },
    });

    return this.formatUserWithRoles(user);
  }

  /**
   * Unlock user account
   */
  async unlockAccount(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return {
      message: 'Account unlocked successfully',
    };
  }

  /**
   * Get user incidents
   */
  async getUserIncidents(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Get incidents created by user
    const createdIncidents = await this.prisma.incident.findMany({
      where: { createdById: id },
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
          },
        },
        equipment: {
          select: {
            id: true,
            serialNumber: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get incidents assigned to user (for technicians) - via junction table
    const assignedIncidents = await this.prisma.incident.findMany({
      where: { assignees: { some: { userId: id } } },
      include: {
        store: {
          select: {
            id: true,
            storeCode: true,
            name: true,
          },
        },
        equipment: {
          select: {
            id: true,
            serialNumber: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get open incidents
    const openIncidents = await this.prisma.incident.count({
      where: {
        assignees: { some: { userId: id } },
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'ASSIGNED'],
        },
      },
    });

    return {
      created: createdIncidents,
      assigned: assignedIncidents,
      openCount: openIncidents,
    };
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(id: number) {
    await this.findOne(id);

    const incidentsCreated = await this.prisma.incident.count({
      where: { createdById: id },
    });

    const incidentsAssigned = await this.prisma.incident.count({
      where: { assignees: { some: { userId: id } } },
    });

    const incidentsResolved = await this.prisma.incident.count({
      where: {
        assignees: { some: { userId: id } },
        status: 'RESOLVED',
      },
    });

    return {
      incidentsCreated,
      incidentsAssigned,
      incidentsResolved,
    };
  }

  /**
   * Get pending users (for approval workflow)
   */
  async findPending() {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.PENDING,
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        roles: {
          select: {
            role: true,
          },
        },
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(this.formatUserWithRoles);
  }

  /**
   * Approve user account (change from PENDING to ACTIVE)
   */
  async approveUser(id: number, approvedBy: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('User is not pending approval');
    }

    // Update status to ACTIVE
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        roles: {
          select: {
            role: true,
          },
        },
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Create notification for the user
    await this.prisma.notification.create({
      data: {
        userId: id,
        type: 'ACCOUNT_STATUS' as NotificationType,
        title: 'Account Approved',
        message: 'Your account has been approved. You can now access the system.',
      },
    });

    // Send email notification
    await this.emailService.sendAccountApprovedEmail({
      to: updatedUser.email,
      userName: `${updatedUser.firstName} ${updatedUser.lastName}`,
    });

    return this.formatUserWithRoles(updatedUser);
  }

  /**
   * Reject user account (delete pending user)
   */
  async rejectUser(id: number, rejectedBy: number, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('User is not pending approval');
    }

    // Delete the user
    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'User registration rejected and removed',
      reason,
    };
  }

  // ========================================
  // PUSH NOTIFICATIONS
  // ========================================

  /**
   * Save the Expo push token for the authenticated user so the server can
   * deliver targeted push notifications to this device.
   *
   * NOTE: Requires `pushToken String? @map("push_token") @db.Text` on the
   * User model in schema.prisma + a migration before this will persist data.
   */
  async savePushToken(userId: number, token: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushToken: token } as any, // `as any` until migration adds the field
    })
  }

  // ========================================
  // RESPONSIBLE STORES MANAGEMENT
  // ========================================

  /**
   * Check implications of changing a technician's type (OUTSOURCE ↔ INSOURCE)
   * Returns counts of active jobs/incidents that will be affected
   */
  async checkTypeChange(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        technicianType: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Count active outsource jobs (awarded but not finished)
    const activeOutsourceJobs = await this.prisma.outsourceJob.count({
      where: {
        awardedToId: id,
        status: {
          notIn: ['CANCELLED', 'COMPLETED', 'PAID'],
        },
      },
    });

    // Count pending bids
    const pendingBids = await this.prisma.outsourceBid.count({
      where: {
        technicianId: id,
        status: 'PENDING',
      },
    });

    // Count active incidents assigned to this technician
    const activeIncidents = await this.prisma.incident.count({
      where: {
        assigneeId: id,
        status: {
          notIn: ['CLOSED', 'CANCELLED'],
        },
      },
    });

    return {
      currentType: user.technicianType,
      activeOutsourceJobs,
      pendingBids,
      activeIncidents,
    };
  }
}
