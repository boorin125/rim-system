import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateJobTypeDto, UpdateJobTypeDto } from './dto/create-job-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // ========================================
  // INCIDENT CATEGORIES
  // ========================================

  @Get()
  async findAllCategories(
    @Query('includeInactive') includeInactive?: string,
    @Query('jobTypeId') jobTypeId?: string,
  ) {
    const jobTypeIdNum = jobTypeId ? parseInt(jobTypeId) : undefined;
    return this.categoriesService.findAllCategories(includeInactive === 'true', jobTypeIdNum);
  }

  @Get(':id')
  async findCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findCategoryById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.createCategory(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.deleteCategory(id);
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async toggleCategoryActive(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.toggleCategoryActive(id);
  }

  @Post('reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async reorderCategories(@Body('ids') ids: number[]) {
    return this.categoriesService.reorderCategories(ids);
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultCategories() {
    return this.categoriesService.seedDefaultCategories();
  }

  // ========================================
  // JOB TYPES
  // ========================================

  @Get('job-types/all')
  async findAllJobTypes(@Query('includeInactive') includeInactive?: string) {
    return this.categoriesService.findAllJobTypes(includeInactive === 'true');
  }

  @Get('job-types/:id')
  async findJobTypeById(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findJobTypeById(id);
  }

  @Post('job-types')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async createJobType(@Body() dto: CreateJobTypeDto) {
    return this.categoriesService.createJobType(dto);
  }

  @Put('job-types/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async updateJobType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobTypeDto,
  ) {
    return this.categoriesService.updateJobType(id, dto);
  }

  @Delete('job-types/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async deleteJobType(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.deleteJobType(id);
  }

  @Patch('job-types/:id/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async toggleJobTypeActive(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.toggleJobTypeActive(id);
  }

  @Post('job-types/reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async reorderJobTypes(@Body('ids') ids: number[]) {
    return this.categoriesService.reorderJobTypes(ids);
  }

  @Post('job-types/seed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaultJobTypes() {
    return this.categoriesService.seedDefaultJobTypes();
  }
}
