// src/modules/outsource/outsource.controller.ts

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
  UseInterceptors,
  UploadedFile,
  Request,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { OutsourceService } from './outsource.service';
import {
  CreateOutsourceJobDto,
  UpdateOutsourceJobDto,
  SubmitBidDto,
  AwardJobDto,
  CompleteJobDto,
  VerifyJobDto,
  ProcessPaymentDto,
  RateJobDto,
  ApproveJobDto,
  SubmitDocumentsDto,
  RequestMoreDocumentsDto,
} from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

/**
 * Outsource Marketplace Controller
 *
 * Feature 7: Outsource Marketplace System
 *
 * ADMIN ENDPOINTS:
 * - POST   /api/outsource/jobs                 - Create outsource job
 * - GET    /api/outsource/jobs                 - List all jobs (admin view)
 * - GET    /api/outsource/jobs/:id             - Get job details
 * - PUT    /api/outsource/jobs/:id             - Update job
 * - POST   /api/outsource/jobs/:id/award       - Award job to technician
 * - POST   /api/outsource/jobs/:id/verify      - Verify completed job
 * - POST   /api/outsource/jobs/:id/cancel      - Cancel / request cancel job
 * - POST   /api/outsource/jobs/:id/confirm-cancel - Confirm cancel (Outsource tech)
 * - GET    /api/outsource/stats                - Get marketplace statistics
 *
 * FINANCE ENDPOINTS:
 * - POST   /api/outsource/jobs/:id/pay         - Process payment
 *
 * TECHNICIAN ENDPOINTS:
 * - GET    /api/outsource/marketplace          - Browse open jobs
 * - POST   /api/outsource/jobs/:id/bid         - Submit bid
 * - DELETE /api/outsource/bids/:id             - Withdraw bid
 * - GET    /api/outsource/my-bids              - Get my bids
 * - GET    /api/outsource/my-jobs              - Get my awarded jobs
 * - POST   /api/outsource/jobs/:id/start       - Start job
 * - POST   /api/outsource/jobs/:id/complete    - Complete job
 * - POST   /api/outsource/jobs/:id/rate        - Rate job
 */

@Controller('outsource')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OutsourceController {
  constructor(private readonly outsourceService: OutsourceService) {}

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  /**
   * Create new outsource job
   */
  @Post('jobs')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  async createJob(@Request() req, @Body() dto: CreateOutsourceJobDto) {
    return this.outsourceService.createJob(req.user.id, dto);
  }

  /**
   * Approve or reject outsource job (IT Manager only)
   */
  @Post('jobs/:id/approve')
  @Roles(UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async approveJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: ApproveJobDto,
  ) {
    return this.outsourceService.approveJob(id, req.user.id, dto);
  }

  /**
   * Get all jobs (Admin view)
   */
  @Get('jobs')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR, UserRole.FINANCE_ADMIN)
  async findAll(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('postedById') postedById?: string,
    @Query('awardedToId') awardedToId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.role || r) || [];
    const isFinance = userRoles.includes('FINANCE_ADMIN') || userRoles.includes('IT_MANAGER');
    return this.outsourceService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
      postedById: postedById ? parseInt(postedById) : undefined,
      awardedToId: awardedToId ? parseInt(awardedToId) : undefined,
      search,
      dateFrom,
      dateTo,
      isFinance,
    });
  }

  /**
   * Get job details
   */
  @Get('jobs/:id')
  @Roles(
    UserRole.IT_MANAGER,
    UserRole.HELP_DESK,
    UserRole.SUPERVISOR,
    UserRole.FINANCE_ADMIN,
    UserRole.TECHNICIAN,
  )
  async getJob(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.role) || [];
    return this.outsourceService.getJob(id, req.user.id, userRoles);
  }

  /**
   * Update job
   */
  @Put('jobs/:id')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK)
  async updateJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: UpdateOutsourceJobDto,
  ) {
    return this.outsourceService.updateJob(id, req.user.id, dto);
  }

  /**
   * Award job to technician
   */
  @Post('jobs/:id/award')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async awardJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: AwardJobDto,
  ) {
    return this.outsourceService.awardJob(id, req.user.id, dto);
  }

  /**
   * Verify completed job
   */
  @Post('jobs/:id/verify')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async verifyJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: VerifyJobDto,
  ) {
    return this.outsourceService.verifyJob(id, req.user.id, dto);
  }

  /**
   * Cancel job
   */
  @Post('jobs/:id/cancel')
  @Roles(UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.OK)
  async cancelJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body('reason') reason: string,
  ) {
    return this.outsourceService.cancelJob(id, req.user.id, reason);
  }

  /**
   * Confirm cancel (Outsource technician or IT Manager)
   */
  @Post('jobs/:id/confirm-cancel')
  @Roles(UserRole.TECHNICIAN, UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async confirmCancel(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.role || r) || [];
    return this.outsourceService.confirmCancel(id, req.user.id, userRoles);
  }

  /**
   * Get marketplace statistics
   */
  @Get('stats')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR, UserRole.FINANCE_ADMIN)
  async getStats() {
    return this.outsourceService.getStats();
  }

  // ==========================================
  // FINANCE ENDPOINTS
  // ==========================================

  /**
   * Process payment
   */
  @Post('jobs/:id/pay')
  @Roles(UserRole.FINANCE_ADMIN, UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async processPayment(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.outsourceService.processPayment(id, req.user.id, dto);
  }

  /**
   * Upload payment slip
   */
  @Post('jobs/:id/payment-slip')
  @Roles(UserRole.FINANCE_ADMIN, UserRole.IT_MANAGER)
  @UseInterceptors(
    FileInterceptor('slip', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads', 'payment-slips');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req: any, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `slip_${req.params.id}_${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpeg|jpg|gif|webp)$/)) {
          return cb(new BadRequestException('อนุญาตเฉพาะไฟล์รูปภาพ (png, jpg, gif, webp)'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadPaymentSlip(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์สลิป');
    }
    return { slipUrl: `/uploads/payment-slips/${file.filename}` };
  }

  // ==========================================
  // DOCUMENT & FINANCE CONFIRMATION ENDPOINTS
  // ==========================================

  /**
   * Upload outsource document file (slip, work order, photos)
   */
  @Post('jobs/:id/document-upload')
  @Roles(UserRole.TECHNICIAN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(process.cwd(), 'uploads', 'outsource-docs');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req: any, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `doc_${req.params.id}_${Date.now()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(png|jpeg|jpg|gif|webp)$/)) {
          return cb(new BadRequestException('อนุญาตเฉพาะไฟล์รูปภาพ (png, jpg, gif, webp)'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('กรุณาแนบไฟล์');
    }
    return { filePath: `/uploads/outsource-docs/${file.filename}` };
  }

  /**
   * Submit documents (Outsource technician - after completion)
   */
  @Post('jobs/:id/submit-documents')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async submitDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: SubmitDocumentsDto,
  ) {
    return this.outsourceService.submitDocuments(id, req.user.id, dto);
  }

  /**
   * Confirm spare parts returned (Finance)
   */
  @Post('jobs/:id/confirm-spare-parts')
  @Roles(UserRole.FINANCE_ADMIN, UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async confirmSpareParts(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.outsourceService.confirmSpareParts(id, req.user.id);
  }

  /**
   * Confirm documents received (Finance)
   */
  @Post('jobs/:id/confirm-documents')
  @Roles(UserRole.FINANCE_ADMIN, UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async confirmDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.outsourceService.confirmDocuments(id, req.user.id);
  }

  /**
   * Request more documents (Finance) — add review comment
   */
  @Post('jobs/:id/request-more-documents')
  @Roles(UserRole.FINANCE_ADMIN, UserRole.IT_MANAGER)
  @HttpCode(HttpStatus.OK)
  async requestMoreDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: RequestMoreDocumentsDto,
  ) {
    return this.outsourceService.requestMoreDocuments(id, req.user.id, dto.note);
  }

  // ==========================================
  // TECHNICIAN ENDPOINTS
  // ==========================================

  /**
   * Accept job (Outsource technician directly accepts)
   */
  @Post('jobs/:id/accept')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async acceptJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.outsourceService.acceptJob(id, req.user.id);
  }

  /**
   * Browse open jobs (Marketplace)
   * Filtered by the technician's responsibleProvinces if set.
   */
  @Get('marketplace')
  @Roles(UserRole.TECHNICIAN)
  async getOpenJobs(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('urgency') urgency?: string,
    @Query('minBudget') minBudget?: string,
    @Query('maxBudget') maxBudget?: string,
  ) {
    return this.outsourceService.getOpenJobs(req.user.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      urgency,
      minBudget: minBudget ? parseFloat(minBudget) : undefined,
      maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
    });
  }

  /**
   * Submit bid for a job
   */
  @Post('jobs/:id/bid')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.CREATED)
  async submitBid(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: SubmitBidDto,
  ) {
    return this.outsourceService.submitBid(id, req.user.id, dto);
  }

  /**
   * Withdraw bid
   */
  @Delete('bids/:id')
  @Roles(UserRole.TECHNICIAN)
  async withdrawBid(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.outsourceService.withdrawBid(id, req.user.id);
  }

  /**
   * Get my bids
   */
  @Get('my-bids')
  @Roles(UserRole.TECHNICIAN)
  async getMyBids(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.outsourceService.getMyBids(req.user.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
    });
  }

  /**
   * Get my awarded jobs
   */
  @Get('my-jobs')
  @Roles(UserRole.TECHNICIAN)
  async getMyJobs(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.outsourceService.getMyJobs(req.user.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      status,
    });
  }

  /**
   * Start job
   */
  @Post('jobs/:id/start')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async startJob(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.outsourceService.startJob(id, req.user.id);
  }

  /**
   * Complete job
   */
  @Post('jobs/:id/complete')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async completeJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: CompleteJobDto,
  ) {
    return this.outsourceService.completeJob(id, req.user.id, dto);
  }

  /**
   * Rate job (by technician or poster)
   */
  @Post('jobs/:id/rate')
  @Roles(UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.OK)
  async rateJob(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() dto: RateJobDto,
  ) {
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.role) || [];
    const isCustomerRating = userRoles.some((r: string) =>
      ['IT_MANAGER', 'HELP_DESK'].includes(r)
    );
    return this.outsourceService.rateJob(id, req.user.id, isCustomerRating, dto);
  }
}
