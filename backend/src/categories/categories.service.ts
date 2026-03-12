import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateJobTypeDto, UpdateJobTypeDto } from './dto/create-job-type.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  // ========================================
  // INCIDENT CATEGORIES
  // ========================================

  async findAllCategories(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.prisma.incidentCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findCategoryById(id: number) {
    const category = await this.prisma.incidentCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    // Check if name already exists
    const existing = await this.prisma.incidentCategory.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Category "${dto.name}" already exists`);
    }

    return this.prisma.incidentCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: number, dto: UpdateCategoryDto) {
    // Check if category exists
    await this.findCategoryById(id);

    // Check if name already exists (if changing name)
    if (dto.name) {
      const existing = await this.prisma.incidentCategory.findFirst({
        where: {
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Category "${dto.name}" already exists`);
      }
    }

    return this.prisma.incidentCategory.update({
      where: { id },
      data: dto,
    });
  }

  async deleteCategory(id: number) {
    // Check if category exists
    await this.findCategoryById(id);

    // Check if category is used by any incidents
    const incidentsCount = await this.prisma.incident.count({
      where: { category: { equals: id.toString() } },
    });

    if (incidentsCount > 0) {
      throw new ConflictException(
        `Cannot delete category. It is used by ${incidentsCount} incident(s). Please deactivate it instead.`,
      );
    }

    return this.prisma.incidentCategory.delete({
      where: { id },
    });
  }

  async toggleCategoryActive(id: number) {
    const category = await this.findCategoryById(id);
    return this.prisma.incidentCategory.update({
      where: { id },
      data: { isActive: !category.isActive },
    });
  }

  async reorderCategories(ids: number[]) {
    const updates = ids.map((id, index) =>
      this.prisma.incidentCategory.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return this.findAllCategories(true);
  }

  // ========================================
  // JOB TYPES
  // ========================================

  async findAllJobTypes(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.prisma.jobType.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findJobTypeById(id: number) {
    const jobType = await this.prisma.jobType.findUnique({
      where: { id },
    });

    if (!jobType) {
      throw new NotFoundException(`Job Type with ID ${id} not found`);
    }

    return jobType;
  }

  async createJobType(dto: CreateJobTypeDto) {
    // Check if name already exists
    const existing = await this.prisma.jobType.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Job Type "${dto.name}" already exists`);
    }

    return this.prisma.jobType.create({
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateJobType(id: number, dto: UpdateJobTypeDto) {
    // Check if job type exists
    await this.findJobTypeById(id);

    // Check if name already exists (if changing name)
    if (dto.name) {
      const existing = await this.prisma.jobType.findFirst({
        where: {
          name: dto.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException(`Job Type "${dto.name}" already exists`);
      }
    }

    return this.prisma.jobType.update({
      where: { id },
      data: dto,
    });
  }

  async deleteJobType(id: number) {
    // Check if job type exists
    await this.findJobTypeById(id);

    // Check if job type is used by any incidents
    const incidentsCount = await this.prisma.incident.count({
      where: { jobType: { equals: id.toString() } },
    });

    if (incidentsCount > 0) {
      throw new ConflictException(
        `Cannot delete job type. It is used by ${incidentsCount} incident(s). Please deactivate it instead.`,
      );
    }

    return this.prisma.jobType.delete({
      where: { id },
    });
  }

  async toggleJobTypeActive(id: number) {
    const jobType = await this.findJobTypeById(id);
    return this.prisma.jobType.update({
      where: { id },
      data: { isActive: !jobType.isActive },
    });
  }

  async reorderJobTypes(ids: number[]) {
    const updates = ids.map((id, index) =>
      this.prisma.jobType.update({
        where: { id },
        data: { sortOrder: index },
      }),
    );

    await this.prisma.$transaction(updates);
    return this.findAllJobTypes(true);
  }

  // ========================================
  // SEED DEFAULT DATA
  // ========================================

  async seedDefaultCategories() {
    const defaultCategories = [
      { name: 'POS', description: 'Point of Sale systems', color: '#3B82F6', icon: 'Monitor', sortOrder: 0 },
      { name: 'Network', description: 'Network and connectivity issues', color: '#10B981', icon: 'Wifi', sortOrder: 1 },
      { name: 'Hardware', description: 'Hardware equipment issues', color: '#F59E0B', icon: 'HardDrive', sortOrder: 2 },
      { name: 'Software', description: 'Software and application issues', color: '#8B5CF6', icon: 'Code', sortOrder: 3 },
      { name: 'Printer', description: 'Printer and printing issues', color: '#EC4899', icon: 'Printer', sortOrder: 4 },
      { name: 'Monitor', description: 'Display and monitor issues', color: '#06B6D4', icon: 'Monitor', sortOrder: 5 },
      { name: 'CCTV', description: 'Security camera issues', color: '#EF4444', icon: 'Camera', sortOrder: 6 },
      { name: 'Other', description: 'Other issues', color: '#6B7280', icon: 'MoreHorizontal', sortOrder: 99 },
    ];

    for (const category of defaultCategories) {
      await this.prisma.incidentCategory.upsert({
        where: { name: category.name },
        update: {},
        create: category,
      });
    }

    return this.findAllCategories(true);
  }

  async seedDefaultJobTypes() {
    const defaultJobTypes = [
      { name: 'MA', description: 'Maintenance Agreement - งานบำรุงรักษาตามสัญญา', color: '#3B82F6', sortOrder: 0 },
      { name: 'Adhoc', description: 'Ad-hoc request - งานเฉพาะกิจ', color: '#F59E0B', sortOrder: 1 },
      { name: 'Project', description: 'Project work - งานโปรเจค', color: '#10B981', sortOrder: 2 },
    ];

    for (const jobType of defaultJobTypes) {
      await this.prisma.jobType.upsert({
        where: { name: jobType.name },
        update: {},
        create: jobType,
      });
    }

    return this.findAllJobTypes(true);
  }
}
