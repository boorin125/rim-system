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
  NotFoundException,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { StoresService } from './stores.service';
import { TemplateService } from './services/template.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, AuditModule, AuditAction } from '@prisma/client';
import { AuditTrailService } from '../audit-trail/audit-trail.service';

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

@Controller('stores')
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly templateService: TemplateService,
    private readonly auditTrailService: AuditTrailService,
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
    @Request() req,
  ): Promise<void> {
    try {
      const buffer = await this.storesService.exportToExcel(filters);

      const filename = `stores_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Audit log
      await this.auditTrailService.logDirect({
        module: AuditModule.STORE,
        action: AuditAction.EXPORT,
        entityType: 'Store',
        entityId: 0,
        userId: req.user.id,
        description: `ส่งออกข้อมูลสาขาเป็น Excel ไฟล์: ${filename}`,
      });

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
   * Access: All authenticated users including SUPER_ADMIN (for Import)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
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
   * Get all distinct province names
   * Access: All authenticated users
   */
  @Get('provinces')
  @UseGuards(JwtAuthGuard)
  getProvinces() {
    return this.storesService.getProvinces();
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
   * Get store incidents with pagination
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   */
  @Get(':id/incidents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStoreIncidents(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: any,
  ) {
    return this.storesService.getStoreIncidents(id, {
      page: query.page ? parseInt(query.page) : 1,
      limit: query.limit ? parseInt(query.limit) : 10,
      status: query.status,
      priority: query.priority,
      period: query.period ? parseInt(query.period) : 30,
    });
  }

  /**
   * Get distinct filter options (statuses, priorities) for a store's incidents
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   */
  @Get(':id/incidents/filter-options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStoreIncidentFilterOptions(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period?: string,
  ) {
    return this.storesService.getStoreIncidentFilterOptions(
      id,
      period ? parseInt(period) : 30,
    );
  }

  /**
   * Get incidents per equipment for a store
   */
  @Get(':id/incidents/equipment-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK, UserRole.TECHNICIAN, UserRole.END_USER, UserRole.READ_ONLY)
  async getStoreEquipmentIncidentStats(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period?: string,
  ) {
    return this.storesService.getStoreEquipmentIncidentStats(id, period ? parseInt(period) : 30);
  }

  /**
   * Get monthly incidents count for a store (last 12 months)
   */
  @Get(':id/incidents/monthly-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.IT_MANAGER, UserRole.SUPERVISOR, UserRole.HELP_DESK, UserRole.TECHNICIAN, UserRole.END_USER, UserRole.READ_ONLY)
  async getStoreMonthlyIncidentStats(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getStoreMonthlyIncidentStats(id);
  }

  /**
   * Get store incidents summary
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   */
  @Get(':id/incidents/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStoreIncidentsSummary(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period?: string,
  ) {
    return this.storesService.getStoreIncidentsSummary(
      id,
      period ? parseInt(period) : 30,
    );
  }

  /**
   * Get store equipment
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   */
  @Get(':id/equipment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStoreEquipment(@Param('id', ParseIntPipe) id: number) {
    return this.storesService.getStoreEquipment(id);
  }

  /**
   * Get store top issues (most common incident categories)
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   */
  @Get(':id/top-issues')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStoreTopIssues(
    @Param('id', ParseIntPipe) id: number,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storesService.getStoreTopIssues(
      id,
      period ? parseInt(period) : 30,
      limit ? parseInt(limit) : 5,
    );
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

  // ==========================================
  // STORE DELETION ENDPOINTS
  // ==========================================

  /**
   * Soft Delete: Change store status to PERMANENTLY_CLOSED
   * HELP_DESK can do this directly without approval
   * Access: HELP_DESK ONLY
   */
  @Post(':id/soft-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @HttpCode(HttpStatus.OK)
  async softDelete(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
    @Request() req,
  ) {
    return this.storesService.softDeleteStore(id, req.user.id, body.reason);
  }

  /**
   * Request PERMANENT deletion (HELP_DESK creates request)
   * This will PERMANENTLY DELETE the store after IT_MANAGER approval
   * Access: HELP_DESK ONLY
   */
  @Post(':id/request-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @HttpCode(HttpStatus.CREATED)
  async requestDelete(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.storesService.requestDelete(id, req.user.id, body.reason);
  }

  /**
   * Get pending delete requests (IT_MANAGER only)
   * Access: IT_MANAGER ONLY
   */
  @Get('delete-requests/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.IT_MANAGER)
  async getPendingDeleteRequests() {
    return this.storesService.getPendingDeleteRequests();
  }

  /**
   * Approve delete request - PERMANENTLY DELETES the store
   * IT_MANAGER approves → Store is PERMANENTLY deleted from database
   * Access: IT_MANAGER ONLY
   */
  @Post('delete-requests/:requestId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async approveDeleteRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() body: { note?: string },
    @Request() req,
  ) {
    return this.storesService.approveDeleteRequest(requestId, req.user.id, body.note);
  }

  /**
   * Reject delete request (IT_MANAGER rejects)
   * Access: IT_MANAGER ONLY
   */
  @Post('delete-requests/:requestId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async rejectDeleteRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() body: { note?: string },
    @Request() req,
  ) {
    return this.storesService.rejectDeleteRequest(requestId, req.user.id, body.note);
  }

  // ==========================================
  // LAYOUT IMAGE UPLOAD
  // ==========================================

  /**
   * Upload / replace store layout image (JPEG)
   * Access: HELP_DESK ONLY
   */
  @Patch(':id/layout-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'store-layouts');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          cb(null, `store-${req.params.id}-layout.jpg`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
      fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/jpg'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPEG images are allowed'), false);
        }
      },
    }),
  )
  async uploadLayoutImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('กรุณาอัปโหลดไฟล์ภาพ');
    const store = await this.storesService.findOne(id);
    if (!store) throw new NotFoundException('ไม่พบสาขา');

    // Delete old file if it had a different path
    if (store.layoutImagePath) {
      const oldPath = path.join(process.cwd(), store.layoutImagePath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const layoutImagePath = `/uploads/store-layouts/store-${id}-layout.jpg`;
    const updated = await this.storesService.updateLayoutImage(id, layoutImagePath);

    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.UPDATE,
      entityType: 'Store',
      entityId: id,
      userId: req.user.id,
      description: `อัปโหลด Layout Image สาขา ${store.storeCode}`,
    });

    return { layoutImagePath: updated.layoutImagePath };
  }

  /**
   * Upload / replace store IP Range image (JPEG)
   * Access: HELP_DESK ONLY
   */
  @Patch(':id/ip-range-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HELP_DESK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'store-layouts');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          cb(null, `store-${req.params.id}-iprange.jpg`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/jpg'].includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only JPEG images are allowed'), false);
        }
      },
    }),
  )
  async uploadIpRangeImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('กรุณาอัปโหลดไฟล์ภาพ');
    const store = await this.storesService.findOne(id);
    if (!store) throw new NotFoundException('ไม่พบสาขา');

    if (store.ipRangeImagePath) {
      const oldPath = path.join(process.cwd(), store.ipRangeImagePath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const ipRangeImagePath = `/uploads/store-layouts/store-${id}-iprange.jpg`;
    const updated = await this.storesService.updateIpRangeImage(id, ipRangeImagePath);

    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.UPDATE,
      entityType: 'Store',
      entityId: id,
      userId: req.user.id,
      description: `อัปโหลด IP Range Image สาขา ${store.storeCode}`,
    });

    return { ipRangeImagePath: updated.ipRangeImagePath };
  }

  // ==========================================
  // IMPORT OPERATION (with Preview + Update support)
  // ==========================================

  /**
   * Preview import - analyze file before importing
   * Shows what will be created, updated, unchanged, or errored
   * Access: SUPER_ADMIN ONLY (System Configuration)
   */
  @Post('import/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์');
    }

    return this.storesService.previewStoreImport(file);
  }

  /**
   * Import stores from Excel with update support
   * Mode: 'create_only' = only create new stores (default)
   *       'update_or_create' = update existing and create new
   * Access: SUPER_ADMIN ONLY (System Configuration)
   */
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
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
    @Body('mode') mode: string,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์');
    }

    // Use new importWithUpdate method if mode is specified
    let result;
    if (mode) {
      const importMode = mode === 'update_or_create' ? 'update_or_create' : 'create_only';
      result = await this.storesService.importWithUpdate(file, importMode);
    } else {
      // Fallback to legacy import for backward compatibility
      result = await this.storesService.importFromExcel(file, { updateExisting: false });
    }

    // Audit log
    await this.auditTrailService.logDirect({
      module: AuditModule.STORE,
      action: AuditAction.IMPORT,
      entityType: 'Store',
      entityId: 0,
      userId: req.user.id,
      description: `นำเข้าข้อมูลสาขาจาก Excel โหมด: ${mode || 'create_only'} สร้างใหม่: ${result.created} อัปเดต: ${result.updated} ข้อผิดพลาด: ${result.errors?.length || 0}`,
    });

    return result;
  }

}