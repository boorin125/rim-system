// src/modules/knowledge-base/knowledge-base.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateArticleDto,
  UpdateArticleDto,
  SubmitFeedbackDto,
  RecordUsageDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Knowledge Base Controller
 *
 * Feature 12: Knowledge Base System
 *
 * CATEGORY ENDPOINTS:
 * - GET    /api/kb/categories               - List all categories
 * - GET    /api/kb/categories/:idOrSlug     - Get category details
 * - POST   /api/kb/categories               - Create category (Admin)
 * - PUT    /api/kb/categories/:id           - Update category (Admin)
 * - DELETE /api/kb/categories/:id           - Delete category (Admin)
 *
 * ARTICLE ENDPOINTS:
 * - GET    /api/kb/articles                 - List articles
 * - GET    /api/kb/articles/search          - Search articles
 * - GET    /api/kb/articles/popular         - Popular articles
 * - GET    /api/kb/articles/suggested       - Suggested articles for incident
 * - GET    /api/kb/articles/:idOrSlug       - Get article details
 * - POST   /api/kb/articles                 - Create article (Admin)
 * - PUT    /api/kb/articles/:id             - Update article (Admin)
 * - POST   /api/kb/articles/:id/publish     - Publish article (Admin)
 * - DELETE /api/kb/articles/:id             - Delete article (Admin)
 *
 * FEEDBACK & USAGE:
 * - POST   /api/kb/articles/:id/feedback    - Submit feedback
 * - POST   /api/kb/articles/:id/usage       - Record usage
 * - GET    /api/kb/articles/:id/usage       - Get usage stats
 *
 * STATISTICS:
 * - GET    /api/kb/stats                    - KB statistics
 */

@Controller('kb')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  // ==========================================
  // CATEGORY ENDPOINTS
  // ==========================================

  /**
   * Get all categories
   */
  @Get('categories')
  async getCategories(@Query('includeInactive') includeInactive?: string) {
    return this.kbService.getCategories(includeInactive === 'true');
  }

  /**
   * Get category by ID or slug
   */
  @Get('categories/:idOrSlug')
  async getCategory(@Param('idOrSlug') idOrSlug: string) {
    return this.kbService.getCategory(idOrSlug);
  }

  /**
   * Create category (Admin)
   */
  @Post('categories')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.kbService.createCategory(dto);
  }

  /**
   * Update category (Admin)
   */
  @Put('categories/:id')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.kbService.updateCategory(id, dto);
  }

  /**
   * Delete category (Admin)
   */
  @Delete('categories/:id')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK)
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.deleteCategory(id);
  }

  // ==========================================
  // ARTICLE ENDPOINTS
  // ==========================================

  /**
   * Get all articles
   */
  @Get('articles')
  async getArticles(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isPublished') isPublished?: string,
    @Query('authorId') authorId?: string,
  ) {
    return this.kbService.getArticles({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
      search,
      isPublished: isPublished ? isPublished === 'true' : undefined,
      authorId: authorId ? parseInt(authorId) : undefined,
    });
  }

  /**
   * Search articles
   */
  @Get('articles/search')
  async searchArticles(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.kbService.searchArticles(query || '', limit ? parseInt(limit) : 10);
  }

  /**
   * Get popular articles
   */
  @Get('articles/popular')
  async getPopularArticles(@Query('limit') limit?: string) {
    return this.kbService.getPopularArticles(limit ? parseInt(limit) : 10);
  }

  /**
   * Get suggested articles for incident
   */
  @Get('articles/suggested')
  async getSuggestedArticles(
    @Query('category') category: string,
    @Query('keywords') keywords?: string,
  ) {
    const keywordList = keywords ? keywords.split(',').map((k) => k.trim()) : [];
    return this.kbService.getSuggestedArticles(category || '', keywordList);
  }

  /**
   * Get article by ID or slug
   */
  @Get('articles/:idOrSlug')
  async getArticle(
    @Param('idOrSlug') idOrSlug: string,
    @Query('incrementView') incrementView?: string,
  ) {
    return this.kbService.getArticle(idOrSlug, incrementView === 'true');
  }

  /**
   * Create article (Admin)
   */
  @Post('articles')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR, UserRole.TECHNICIAN)
  async createArticle(@Request() req, @Body() dto: CreateArticleDto) {
    return this.kbService.createArticle(req.user.id, dto);
  }

  /**
   * Update article (Admin)
   */
  @Put('articles/:id')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR, UserRole.TECHNICIAN)
  async updateArticle(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.kbService.updateArticle(id, req.user.id, dto);
  }

  /**
   * Publish/Unpublish article (Admin)
   */
  @Post('articles/:id/publish')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async togglePublish(
    @Param('id', ParseIntPipe) id: number,
    @Body('isPublished') isPublished: boolean,
  ) {
    return this.kbService.togglePublish(id, isPublished);
  }

  /**
   * Delete article (Admin)
   */
  @Delete('articles/:id')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK)
  async deleteArticle(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.deleteArticle(id);
  }

  // ==========================================
  // FEEDBACK & USAGE
  // ==========================================

  /**
   * Submit feedback for article
   */
  @Post('articles/:id/feedback')
  @HttpCode(HttpStatus.OK)
  async submitFeedback(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.kbService.submitFeedback(id, req.user.id, dto);
  }

  /**
   * Record article usage
   */
  @Post('articles/:id/usage')
  @HttpCode(HttpStatus.CREATED)
  async recordUsage(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: RecordUsageDto,
  ) {
    return this.kbService.recordUsage(id, req.user.id, dto);
  }

  /**
   * Get article usage stats
   */
  @Get('articles/:id/usage')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async getArticleUsageStats(@Param('id', ParseIntPipe) id: number) {
    return this.kbService.getArticleUsageStats(id);
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get KB statistics
   */
  @Get('stats')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async getStats() {
    return this.kbService.getStats();
  }
}
