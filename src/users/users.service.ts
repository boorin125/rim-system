// src/users/users.service.ts

import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new user
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

    // Create user
    const user = await this.prisma.user.create({
      data: {
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: 'ACTIVE',
      },
    });

    // Remove password from response
    const { password, ...result } = user;

    return result;
  }

  /**
   * Get all users
   */
  async findAll() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users;
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
        role: true,
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

    return user;
  }

  /**
   * Update user
   */
  async update(id: number, dto: UpdateUserDto) {
    // Check if user exists
    await this.findOne(id);

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
      data: dto,
      select: {
        id: true,
        username: true,
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

    return user;
  }

  /**
   * Delete user
   */
  async remove(id: number) {
    // Check if user exists
    await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'User deleted successfully',
    };
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
  async updateStatus(id: number, status: UserStatus) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
      },
    });

    return user;
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

    // Get incidents assigned to user (for technicians)
    const assignedIncidents = await this.prisma.incident.findMany({
      where: { assigneeId: id },
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
        assigneeId: id,
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
      where: { assigneeId: id },
    });

    const incidentsResolved = await this.prisma.incident.count({
      where: {
        assigneeId: id,
        status: 'RESOLVED',
      },
    });

    return {
      incidentsCreated,
      incidentsAssigned,
      incidentsResolved,
    };
  }
}
