// backend/src/comments/comments.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Helper to check if user has a specific role (supports multi-roles)
   */
  private hasRole(user: any, role: UserRole): boolean {
    if (Array.isArray(user.roles)) {
      return user.roles.includes(role);
    }
    return user.role === role;
  }

  /**
   * Helper to check if user ONLY has a specific role
   */
  private hasOnlyRole(user: any, role: UserRole): boolean {
    if (Array.isArray(user.roles)) {
      return user.roles.length === 1 && user.roles.includes(role);
    }
    return user.role === role;
  }

  /**
   * Create a new comment on an incident
   * All authenticated users can comment
   * Internal comments are only visible to staff (not END_USER)
   */
  async create(
    incidentId: string,
    createCommentDto: CreateCommentDto,
    userId: number,
  ) {
    // Verify incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    return this.prisma.comment.create({
      data: {
        incidentId,
        userId,
        content: createCommentDto.content,
        isInternal: createCommentDto.isInternal || false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
  }

  /**
   * Get all comments for an incident
   * END_USER can only see public comments
   * Staff can see all comments
   */
  async findAll(incidentId: string, user: any) {
    // Verify incident exists
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    const where: any = { incidentId };

    // END_USER can only see public comments (isInternal = false)
    if (this.hasOnlyRole(user, UserRole.END_USER)) {
      where.isInternal = false;
    }

    return this.prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get a single comment by ID
   */
  async findOne(id: number, user: any) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${id} not found`);
    }

    // END_USER cannot see internal comments
    if (this.hasOnlyRole(user, UserRole.END_USER) && comment.isInternal) {
      throw new ForbiddenException('You cannot view internal comments');
    }

    return comment;
  }

  /**
   * Update a comment
   * Only the comment author can update
   */
  async update(id: number, updateCommentDto: UpdateCommentDto, userId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${id} not found`);
    }

    // Only author can update
    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only update your own comments');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        content: updateCommentDto.content,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
  }

  /**
   * Delete a comment
   * Only the comment author or HELP_DESK can delete
   */
  async remove(id: number, user: any) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException(`Comment ${id} not found`);
    }

    // Only author or HELP_DESK can delete
    const isAuthor = comment.userId === user.id;
    const isHelpDesk = this.hasRole(user, UserRole.HELP_DESK);

    if (!isAuthor && !isHelpDesk) {
      throw new ForbiddenException(
        'You can only delete your own comments or you must be HELP_DESK',
      );
    }

    await this.prisma.comment.delete({
      where: { id },
    });

    return { message: `Comment ${id} deleted successfully` };
  }
}
