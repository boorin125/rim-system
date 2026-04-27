// src/setup/setup.service.ts
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<{ needsSetup: boolean }> {
    const count = await this.prisma.userRole.count({
      where: { role: 'SUPER_ADMIN' },
    });
    return { needsSetup: count === 0 };
  }

  async createFirstAdmin(dto: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    // Guard: only allowed when no SUPER_ADMIN exists
    const count = await this.prisma.userRole.count({
      where: { role: 'SUPER_ADMIN' },
    });
    if (count > 0) {
      throw new ForbiddenException('System is already set up');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const username = dto.email.split('@')[0];

    const user = await this.prisma.user.create({
      data: {
        username,
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        status: 'ACTIVE',
        isProtected: true,
        roles: {
          create: [{ role: 'SUPER_ADMIN' }],
        },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    return { success: true, user };
  }
}
