// src/users/users.service.ts
import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto, QueryUserDto, ChangePasswordDto } from './dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Create new user (Admin only)
  async create(createUserDto: CreateUserDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        phone: createUserDto.phone,
        role: createUserDto.role,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return user;
  }

  // Get all users with filters and pagination
  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, role, status, search } = query;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (role) where.role = role;
    if (status) where.status = status;

    // Search by email, firstName, or lastName
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.user.count({ where });

    // Get users
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Get single user by ID
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLogin: true,
        lastPasswordChange: true,
        createdAt: true,
        updatedAt: true,
        // Include statistics
        _count: {
          select: {
            createdIncidents: true,
            assignedIncidents: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Update user
  async update(id: number, updateUserDto: UpdateUserDto, currentUserId: number) {
    const user = await this.findOne(id);

    // Prevent users from changing their own role (except SUPER_ADMIN)
const currentUser = await this.prisma.user.findUnique({
  where: { id: currentUserId },
});

if (!currentUser) {
  throw new NotFoundException('Current user not found');
}

if (updateUserDto.role && id === currentUserId && currentUser.role !== UserRole.SUPER_ADMIN) {
  throw new ForbiddenException('You cannot change your own role');
}

    // Update user
    const updated = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  // Change user role (Admin only)
  async changeRole(id: number, role: UserRole, currentUserId: number) {
    const user = await this.findOne(id);

    // Prevent changing own role
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    // Update role
    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    return updated;
  }

  // Change password
  async changePassword(id: number, changePasswordDto: ChangePasswordDto, currentUserId: number) {
    // Only allow users to change their own password
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only change your own password');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

    // Update password
    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        lastPasswordChange: new Date(),
      },
    });

    return { message: 'Password changed successfully' };
  }

  // Deactivate user (soft delete)
  async deactivate(id: number, currentUserId: number) {
    const user = await this.findOne(id);

    // Prevent deactivating self
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    // Update status to INACTIVE
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'INACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    return updated;
  }

  // Activate user
  async activate(id: number) {
    const user = await this.findOne(id);

    // Update status to ACTIVE
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    return updated;
  }

  // Delete user (hard delete - use with caution)
  async remove(id: number, currentUserId: number) {
    const user = await this.findOne(id);

    // Prevent deleting self
    if (id === currentUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    // Check if user has created incidents
    const incidentCount = await this.prisma.incident.count({
      where: { createdById: id },
    });

    if (incidentCount > 0) {
      throw new BadRequestException(
        `Cannot delete user. User has ${incidentCount} incidents. Please deactivate instead.`,
      );
    }

    // Delete user
    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  // Get user statistics
  async getStatistics(id: number) {
    const user = await this.findOne(id);

    // Get incident statistics
    const createdIncidents = await this.prisma.incident.count({
      where: { createdById: id },
    });

    const assignedIncidents = await this.prisma.incident.count({
      where: { assigneeId: id },
    });

    const resolvedIncidents = await this.prisma.incident.count({
      where: {
        assigneeId: id,
        status: 'RESOLVED',
      },
    });

    const pendingIncidents = await this.prisma.incident.count({
      where: {
        assigneeId: id,
        status: {
          in: ['OPEN', 'IN_PROGRESS', 'PENDING'],
        },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      statistics: {
        createdIncidents,
        assignedIncidents,
        resolvedIncidents,
        pendingIncidents,
        resolutionRate:
          assignedIncidents > 0
            ? ((resolvedIncidents / assignedIncidents) * 100).toFixed(2) + '%'
            : '0%',
      },
    };
  }
}