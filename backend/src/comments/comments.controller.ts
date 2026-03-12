// backend/src/comments/comments.controller.ts

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
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('incidents/:incidentId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /**
   * Create a new comment on an incident
   * Access: All authenticated users
   */
  @Post()
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  create(
    @Param('incidentId') incidentId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
  ) {
    return this.commentsService.create(incidentId, createCommentDto, req.user.id);
  }

  /**
   * Get all comments for an incident
   * Access: All authenticated users
   * END_USER can only see public comments
   */
  @Get()
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  findAll(@Param('incidentId') incidentId: string, @Request() req) {
    return this.commentsService.findAll(incidentId, req.user);
  }

  /**
   * Get a single comment by ID
   * Access: All authenticated users
   */
  @Get(':id')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  findOne(@Param('id') id: string, @Request() req) {
    return this.commentsService.findOne(+id, req.user);
  }

  /**
   * Update a comment
   * Access: Comment author only
   */
  @Patch(':id')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  update(
    @Param('id') id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Request() req,
  ) {
    return this.commentsService.update(+id, updateCommentDto, req.user.id);
  }

  /**
   * Delete a comment
   * Access: Comment author or HELP_DESK
   */
  @Delete(':id')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
  )
  remove(@Param('id') id: string, @Request() req) {
    return this.commentsService.remove(+id, req.user);
  }
}
