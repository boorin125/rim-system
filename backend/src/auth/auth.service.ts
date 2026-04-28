// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UserStatus, NotificationType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
   * Register a new user
   * - New users get READ_ONLY role by default with PENDING status
   * - IT_MANAGER users receive notification to approve and assign proper roles
   */
  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user with READ_ONLY role and PENDING status (requires approval by IT Manager)
    const user = await this.prisma.user.create({
      data: {
        username: dto.email.split('@')[0],
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: UserStatus.PENDING,
        roles: {
          create: [{ role: 'READ_ONLY' }],
        },
      },
      include: {
        roles: true,
      },
    });

    // Notify all IT_MANAGER users about new registration requiring approval
    await this.notifyITManagersAboutNewUser(user);

    // Remove password from response
    const { password, ...result } = user;

    return {
      message: 'Registration submitted successfully. Please wait for approval from IT Manager.',
      user: this.formatUserWithRoles(result),
    };
  }

  /**
   * Send notification to all IT_MANAGER users about new user registration
   */
  private async notifyITManagersAboutNewUser(user: any) {
    // Find all users with IT_MANAGER or SUPER_ADMIN role
    const managers = await this.prisma.user.findMany({
      where: {
        roles: {
          some: { role: { in: ['IT_MANAGER', 'SUPER_ADMIN'] } },
        },
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true },
    });

    // Create notifications for each manager
    const notifications = managers.map((manager) =>
      this.prisma.notification.create({
        data: {
          userId: manager.id,
          type: NotificationType.NEW_USER_REGISTERED,
          title: 'New User Registration - Approval Required',
          message: `${user.firstName} ${user.lastName} (${user.email}) has registered and is pending approval. Please review and approve the account.`,
        },
      }),
    );

    await Promise.all(notifications);

    // Send email notifications to managers
    for (const manager of managers) {
      await this.emailService.sendNewUserNotificationEmail({
        to: manager.email,
        newUserName: `${user.firstName} ${user.lastName}`,
        newUserEmail: user.email,
      });
    }
  }

  /**
   * Login user
   */
  async login(dto: LoginDto) {
    // Find user by email with roles
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.status === UserStatus.LOCKED) {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException(
          `Account is locked until ${user.lockedUntil.toISOString()}`,
        );
      }

      // Unlock account if lock period has expired
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          status: UserStatus.ACTIVE,
        },
      });
    }

    // Check if account is pending approval
    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Account is pending approval. Please wait for IT Manager to approve your registration.');
    }

    // Check if account is pending deletion
    if (user.status === UserStatus.PENDING_DELETION) {
      throw new UnauthorizedException('บัญชีนี้กำลังรอลบถาวร กรุณาติดต่อ Administrator เพื่อยกเลิกการลบ');
    }

    // Check if account is inactive or suspended
    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('Account is inactive');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account is suspended');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        const lockedUntil = new Date();
        lockedUntil.setHours(lockedUntil.getHours() + 1); // Lock for 1 hour

        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.LOCKED,
            failedLoginAttempts: failedAttempts,
            lockedUntil,
          },
        });

        throw new UnauthorizedException(
          'Account locked due to too many failed login attempts. Please try again in 1 hour.',
        );
      }

      // Update failed attempts
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failedAttempts },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts, update last login, set online status
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const isFirstLoginToday = !user.lastLogin || user.lastLogin < todayStart

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLogin: now,
        isOnline: true,
        ...(isFirstLoginToday && { firstLoginTodayAt: now }),
      },
    });

    // Record login in activity log (upsert: only set loginAt on first login of the day)
    await this.prisma.userActivityLog.upsert({
      where: { userId_date: { userId: user.id, date: todayStart } },
      create: { userId: user.id, date: todayStart, loginAt: now },
      update: {},
    });

    // Revoke all existing refresh tokens (single-session enforcement)
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    // Extract roles as array
    const roles = user.roles.map(r => r.role);

    // Generate JWT access token with roles array (short-lived: 15 min)
    const payload = {
      sub: user.id,
      email: user.email,
      roles: roles,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    const { token: refreshToken, expiresAt: sessionExpiresAt } =
      await this.generateRefreshToken(user.id);

    const { password, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      user: this.formatUserWithRoles(userWithoutPassword),
    };
  }

  /**
   * Calculate session expiry based on time-of-day policy:
   * - Before 22:00 Thailand (15:00 UTC) → expire at today's 22:00 Thailand
   * - At/after 22:00 Thailand → expire in 1 hour (allows immediate re-login after forced logout)
   *
   * Uses UTC arithmetic so it is correct regardless of the server's local timezone.
   */
  private calculateSessionExpiry(): Date {
    const now = new Date();
    // 22:00 Thailand = 15:00 UTC
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 15, 0, 0));
    if (now < cutoff) {
      return cutoff;
    }
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  /**
   * Generate a refresh token and store in database
   */
  private async generateRefreshToken(
    userId: number,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomUUID();
    const expiresAt = this.calculateSessionExpiry();

    await this.prisma.refreshToken.create({
      data: { userId, token, expiresAt, userAgent, ipAddress },
    });

    return { token, expiresAt };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: {
        user: {
          include: {
            roles: { select: { role: true } },
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('SESSION_REVOKED');
    }

    if (storedToken.expiresAt < new Date()) {
      // Delete expired token
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = storedToken.user;

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate new access token
    const roles = user.roles.map(r => r.role);
    const payload = {
      sub: user.id,
      email: user.email,
      roles: roles,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    await Promise.all([
      this.prisma.refreshToken.delete({ where: { id: storedToken.id } }),
      this.prisma.user.update({ where: { id: user.id }, data: { isOnline: true } }),
    ]);

    const { token: newRefreshToken, expiresAt: sessionExpiresAt } =
      await this.generateRefreshToken(user.id);

    const { password, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      user: this.formatUserWithRoles(userWithoutPassword),
    };
  }

  /**
   * Logout - invalidate refresh token and set user offline
   */
  async logout(refreshToken: string) {
    if (refreshToken) {
      // Find userId from refresh token before deleting
      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        select: { userId: true },
      })

      await this.prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      })

      // Mark user offline
      if (tokenRecord?.userId) {
        await this.prisma.user.update({
          where: { id: tokenRecord.userId },
          data: { isOnline: false },
        })

        // Record logout time in today's activity log
        const logoutNow = new Date()
        const todayForLogout = new Date(logoutNow.getFullYear(), logoutNow.getMonth(), logoutNow.getDate())
        await this.prisma.userActivityLog.updateMany({
          where: { userId: tokenRecord.userId, date: todayForLogout },
          data: { logoutAt: logoutNow },
        })
      }
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const { password, ...result } = user;
    return this.formatUserWithRoles(result);
  }

  /**
   * Get user profile
   */
  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        firstNameEn: true,
        lastNameEn: true,
        phone: true,
        department: true,
        technicianType: true,
        address: true,
        subDistrict: true,
        district: true,
        province: true,
        avatarPath: true,
        bankBookPath: true,
        idCardPath: true,
        signaturePath: true,
        roles: {
          select: { role: true },
        },
        responsibleProvinces: true,
        status: true,
        twoFactorEnabled: true,
        lastLogin: true,
        lastPasswordChange: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.formatUserWithRoles(user);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...(dto.firstNameEn !== undefined && { firstNameEn: dto.firstNameEn }),
        ...(dto.lastNameEn !== undefined && { lastNameEn: dto.lastNameEn }),
        phone: dto.phone,
        department: dto.department,
        address: dto.address,
        ...(dto.subDistrict !== undefined && { subDistrict: dto.subDistrict }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.province !== undefined && { province: dto.province }),
        ...(dto.responsibleProvinces !== undefined && { responsibleProvinces: dto.responsibleProvinces }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        firstNameEn: true,
        lastNameEn: true,
        phone: true,
        department: true,
        technicianType: true,
        address: true,
        subDistrict: true,
        district: true,
        province: true,
        avatarPath: true,
        responsibleProvinces: true,
        roles: {
          select: { role: true },
        },
        status: true,
        updatedAt: true,
      },
    });

    return {
      message: 'Profile updated successfully',
      user: this.formatUserWithRoles(updatedUser),
    };
  }

  /**
   * Update user avatar
   */
  async updateAvatar(userId: number, avatarPath: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });

    // Delete old avatar file if exists
    if (user?.avatarPath) {
      const oldPath = path.join(process.cwd(), 'uploads', user.avatarPath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath },
    });

    return {
      message: 'Avatar updated successfully',
      avatarUrl: `/uploads/${avatarPath}`,
    };
  }

  /**
   * Delete user avatar
   */
  async deleteAvatar(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });

    if (user?.avatarPath) {
      const filePath = path.join(process.cwd(), 'uploads', user.avatarPath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: null },
    });

    return { message: 'Avatar deleted successfully' };
  }

  /**
   * Update bank book document
   */
  async updateBankBook(userId: number, bankBookPath: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bankBookPath: true },
    });

    if (user?.bankBookPath) {
      const oldPath = path.join(process.cwd(), 'uploads', user.bankBookPath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { bankBookPath },
    });

    return {
      message: 'อัปโหลดหน้าบัญชีธนาคารสำเร็จ',
      bankBookUrl: `/uploads/${bankBookPath}`,
    };
  }

  /**
   * Update ID card document
   */
  async updateIdCard(userId: number, idCardPath: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { idCardPath: true },
    });

    if (user?.idCardPath) {
      const oldPath = path.join(process.cwd(), 'uploads', user.idCardPath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { idCardPath },
    });

    return {
      message: 'อัปโหลดสำเนาบัตรประชาชนสำเร็จ',
      idCardUrl: `/uploads/${idCardPath}`,
    };
  }

  /**
   * Update digital signature
   */
  async updateSignature(userId: number, signaturePath: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { signaturePath: true },
    });

    if (user?.signaturePath) {
      const oldPath = path.join(process.cwd(), 'uploads', user.signaturePath);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { signaturePath },
    });

    return {
      message: 'อัปโหลดลายเซ็นดิจิทัลสำเร็จ',
      signatureUrl: `/uploads/${signaturePath}`,
    };
  }

  /**
   * Delete digital signature
   */
  async deleteSignature(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { signaturePath: true },
    });

    if (user?.signaturePath) {
      const filePath = path.join(process.cwd(), 'uploads', user.signaturePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { signaturePath: null },
    });

    return { message: 'ลบลายเซ็นดิจิทัลสำเร็จ' };
  }

  /**
   * Change password (while logged in)
   */
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Check if new password is same as current
    const isSame = await bcrypt.compare(dto.newPassword, user.password);
    if (isSame) {
      throw new BadRequestException('New password must be different from current password');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
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
   * Request password reset (forgot password)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return success message to prevent email enumeration
    const successMessage = 'If your email is registered, you will receive a password reset link.';

    if (!user) {
      return { message: successMessage };
    }

    if (user.status !== UserStatus.ACTIVE) {
      return { message: successMessage };
    }

    // Generate reset token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Invalidate any existing tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send email with reset link
    try {
      await this.emailService.sendPasswordResetEmail({
        to: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        resetToken: token,
      });
    } catch {
      throw new InternalServerErrorException(
        'ไม่สามารถส่ง Email ได้ กรุณาตรวจสอบการตั้งค่า SMTP ในระบบ (Settings → Email)'
      );
    }

    console.log(`Password reset token for ${user.email}: ${token}`);

    return {
      message: successMessage,
    };
  }

  /**
   * Verify reset token is valid
   */
  async verifyResetToken(token: string) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.used) {
      throw new BadRequestException('This reset link has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    return {
      valid: true,
      email: resetToken.user.email,
    };
  }

  /**
   * Reset password with token
   */
  async resetPassword(dto: ResetPasswordDto) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (resetToken.used) {
      throw new BadRequestException('This reset link has already been used');
    }

    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    // Update password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          password: hashedPassword,
          lastPasswordChange: new Date(),
          // Reset failed login attempts if any
          failedLoginAttempts: 0,
          status: resetToken.user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : resetToken.user.status,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          used: true,
          usedAt: new Date(),
        },
      }),
    ]);

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }
}
