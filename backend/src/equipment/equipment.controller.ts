import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Res,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { FilterEquipmentDto } from './dto/filter-equipment.dto';
import { memoryStorage, diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // =========================================================
  // Import / Export (MUST be before :id routes)
  // =========================================================

  /**
   * Export equipment inventory list to Excel (by Store)
   * Access: SUPER_ADMIN, IT_MANAGER, HELP_DESK, SUPERVISOR
   */
  @Get('export/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async exportToExcel(
    @Query('storeId') storeId: string,
    @Res() res: Response,
  ) {
    if (!storeId) {
      throw new BadRequestException('Store ID is required for inventory export');
    }

    const storeIdNum = parseInt(storeId, 10);
    if (isNaN(storeIdNum)) {
      throw new BadRequestException('Invalid Store ID');
    }

    const workbook = await this.equipmentService.exportToExcel(storeIdNum);

    // Set headers for Excel download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=inventory-list-${new Date().toISOString().split('T')[0]}.xlsx`,
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Download import template for a specific store
   * Access: SUPER_ADMIN, IT_MANAGER, HELP_DESK, SUPERVISOR
   */
  @Get('import/template')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async getImportTemplate(
    @Query('storeId') storeId: string,
    @Res() res: Response,
  ) {
    if (!storeId) {
      throw new BadRequestException('Store ID is required for import template');
    }

    const storeIdNum = parseInt(storeId, 10);
    if (isNaN(storeIdNum)) {
      throw new BadRequestException('Invalid Store ID');
    }

    const workbook = await this.equipmentService.getImportTemplate(storeIdNum);

    // Set headers for Excel download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=inventory-import-template.xlsx`,
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Download bulk import template (all stores) for SUPER_ADMIN
   */
  @Get('import/bulk-template')
  @Roles(UserRole.SUPER_ADMIN)
  async getBulkImportTemplate(@Res() res: Response) {
    const workbook = await this.equipmentService.getBulkImportTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=bulk-import-template.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  /**
   * Bulk import equipment (multi-store) for SUPER_ADMIN
   */
  @Post('import/bulk')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for bulk
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'),
            false,
          );
        }
      },
    }),
  )
  async bulkImport(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.equipmentService.bulkImport(file.buffer, req.user.id);
  }

  /**
   * Preview import - analyze file and show what will be created/updated
   * Access: SUPER_ADMIN, HELP_DESK
   */
  @Post('import/preview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HELP_DESK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'),
            false,
          );
        }
      },
    }),
  )
  async previewImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.equipmentService.previewImport(file.buffer);
  }

  /**
   * Import equipment from Excel with update support
   * Store is read from Excel header (Row 4, Cell B4)
   * Access: SUPER_ADMIN, HELP_DESK
   */
  @Post('import/excel')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HELP_DESK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (req, file, callback) => {
        if (
          file.mimetype ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel'
        ) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only Excel files (.xlsx, .xls) are allowed'),
            false,
          );
        }
      },
    }),
  )
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('mode') mode: string,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const importMode = mode === 'update_or_create' ? 'update_or_create' : 'create_only';
    return this.equipmentService.importWithUpdate(file.buffer, req.user.id, importMode);
  }

  // =========================================================
  // CRUD Operations
  // =========================================================

  /**
   * Create new equipment
   */
  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HELP_DESK)
  async create(
    @Body() createEquipmentDto: CreateEquipmentDto,
    @Request() req,
  ) {
    return this.equipmentService.create(createEquipmentDto, req.user.id);
  }

  /**
   * Get distinct categories that actually exist in equipment table
   */
  @Get('distinct-categories')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getDistinctCategories() {
    return this.equipmentService.getDistinctCategories();
  }

  /**
   * Get all equipment with filters and pagination
   */
  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async findAll(@Query() filterDto: FilterEquipmentDto) {
    return this.equipmentService.findAll(filterDto);
  }

  /**
   * Get equipment by ID
   */
  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentService.findOne(id);
  }

  /**
   * Get equipment statistics
   */
  @Get(':id/statistics')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentService.getStatistics(id);
  }

  /**
   * Get equipment logs (history)
   */
  @Get(':id/logs')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.IT_MANAGER,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.TECHNICIAN,
    UserRole.END_USER,
    UserRole.READ_ONLY,
  )
  async getLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;

    return this.equipmentService.getLogs(id, pageNumber, limitNumber);
  }

  /**
   * Update equipment
   */
  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.HELP_DESK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
    @Request() req,
  ) {
    return this.equipmentService.update(id, updateEquipmentDto, req.user.id);
  }

  /**
   * Upload / replace equipment image (JPEG or PNG)
   * Access: HELP_DESK, SUPER_ADMIN
   */
  @Patch(':id/image')
  @Roles(UserRole.HELP_DESK, UserRole.SUPER_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'equipment-images');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          cb(null, `equipment-${req.params.id}.jpg`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
    }),
  )
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('กรุณาอัปโหลดไฟล์ภาพ');
    const equipment = await this.equipmentService.findOne(id);
    if (!equipment) throw new NotFoundException('ไม่พบอุปกรณ์');

    // Remove old file if exists and different
    if (equipment.imagePath) {
      const oldPath = path.join(process.cwd(), equipment.imagePath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const imagePath = `/uploads/equipment-images/equipment-${id}.jpg`;
    const updated = await this.equipmentService.updateImage(id, imagePath);
    return { imagePath: updated.imagePath };
  }

  /**
   * Delete equipment:
   * - SUPER_ADMIN / IT_MANAGER: soft-delete INACTIVE equipment (sets status → RETIRED)
   * - HELP_DESK: hard-delete RETIRED equipment permanently
   */
  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.equipmentService.remove(id, req.user.id, req.user.role as string);
  }

  // =========================================================
  // Retirement Request Workflow
  // =========================================================

  /**
   * Request retirement of equipment (HELP_DESK, SUPERVISOR)
   * Creates a PENDING request that IT_MANAGER must approve
   */
  @Post(':id/request-retire')
  @Roles(UserRole.HELP_DESK, UserRole.SUPERVISOR, UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  async requestRetirement(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('กรุณาระบุเหตุผลในการปลดระวาง');
    }
    return this.equipmentService.requestRetirement(id, req.user.id, body.reason.trim());
  }

  /**
   * Get pending retirement requests (IT_MANAGER, SUPER_ADMIN)
   */
  @Get('retirement-requests/pending')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  async getPendingRetirementRequests() {
    return this.equipmentService.getPendingRetirementRequests();
  }

  /**
   * Approve a retirement request (IT_MANAGER, SUPER_ADMIN)
   */
  @Post('retirement-requests/:requestId/approve')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  async approveRetirementRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() body: { note?: string },
    @Request() req,
  ) {
    return this.equipmentService.approveRetirementRequest(requestId, req.user.id, body.note);
  }

  /**
   * Reject a retirement request (IT_MANAGER, SUPER_ADMIN)
   */
  @Post('retirement-requests/:requestId/reject')
  @Roles(UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  async rejectRetirementRequest(
    @Param('requestId', ParseIntPipe) requestId: number,
    @Body() body: { note?: string },
    @Request() req,
  ) {
    return this.equipmentService.rejectRetirementRequest(requestId, req.user.id, body.note);
  }
}
