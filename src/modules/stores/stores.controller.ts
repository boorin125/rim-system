// src/modules/stores/stores.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Res,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { StoresService } from './stores.service';
import { TemplateService } from './services/template.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Stores Controller
 * 
 * ⚠️ CRITICAL PERMISSION RULES (SRS v3.10.1):
 * 
 * 1. SUPER_ADMIN:
 *    - ❌ NO ACCESS to any store operations
 *    - ✅ Only Settings/Configuration pages
 *    - 💡 If needs operation access → Must login as different user
 * 
 * 2. HELP_DESK:
 *    - ✅ ONLY role with CRUD permissions
 *    - ✅ Create, Update, Delete stores
 *    - ✅ Import/Export stores
 * 
 * 3. IT_MANAGER:
 *    - ✅ View stores
 *    - ❌ NO CRUD permissions
 *    - 💡 If needs CRUD → Must add HELP_DESK role
 * 
 * 4. OTHER ROLES:
 *    - ✅ View stores only
 *    - ❌ NO CRUD permissions
 */

@Controller('api/stores')
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly templateService: TemplateService,
  ) {}

  // ==========================================
  // PUBLIC ENDPOINTS (NO AUTH REQUIRED)
  // ==========================================

  /**
   * Download Excel template (PUBLIC)
   * Anyone can download the template
   */
  @Get('template')
  async downloadTemplate(@Res() res: Response): Promise<void> {
    try {
      const buffer = await this.templateService.generateTemplate();

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="store_import_template.xlsx"',
      );

      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        message: 'Failed to generate template',
        error: error.message,
      });
    }
  }

  /**
   * Export stores to Excel
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   */
  @Get('export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async exportStores(
    @Query() filters: any,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const buffer = await this.storesService.exportToExcel(filters);

      const filename = `stores_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.send(buffer);
    } catch (error) {
      res.status(500).json({
        statusCode: 500,
        message: 'Failed to export stores',
        error: error.message,
      });
    }
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  /**
   * Create new store
   * Access: HELP_DESK ONLY
   * 
   * ⚠️ SUPER_ADMIN cannot create (must use Settings page only)
   * ⚠️ IT_MANAGER needs HELP_DESK role to create
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createStoreDto: CreateStoreDto,
    @Request() req,
  ) {
    return this.storesService.create(createStoreDto);
  }

  /**
   * Get all stores with optional filters
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async findAll(@Query() query: any) {
    return this.storesService.findAll(query);
  }

  /**
   * Get store by ID
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.findOne(id);
  }

  /**
   * Get store statistics
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   */
  @Get(':id/statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getStoreStatistics(id);
  }

  /**
   * Update store
   * Access: HELP_DESK ONLY
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   * ⚠️ IT_MANAGER needs HELP_DESK role to update
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStoreDto: UpdateStoreDto,
    @Request() req,
  ) {
    return this.storesService.update(id, updateStoreDto);
  }

  /**
   * Delete store (soft delete)
   * Access: HELP_DESK ONLY
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   * ⚠️ IT_MANAGER needs HELP_DESK role to delete
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.storesService.remove(id);
  }

  // ==========================================
  // IMPORT OPERATION
  // ==========================================

  /**
   * Import stores from Excel
   * Access: HELP_DESK ONLY
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS
   * ⚠️ IT_MANAGER needs HELP_DESK role to import
   */
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const validMimes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];

        if (validMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'),
            false,
          );
        }
      },
    }),
  )
  async importStores(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: any,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.storesService.importFromExcel(file, dto);
  }
}