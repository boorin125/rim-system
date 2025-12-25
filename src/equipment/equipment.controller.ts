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
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Res,
  Request,
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

@Controller('api/equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // =========================================================
  // CRUD Operations
  // =========================================================

  /**
   * Create new equipment
   * Access: HELP_DESK only
   * Note: IT_MANAGER ถ้าต้องการสร้าง ต้องมี Role HELP_DESK ด้วย
   */
  @Post()
  @Roles(UserRole.HELP_DESK)
  async create(
    @Body() createEquipmentDto: CreateEquipmentDto,
    @Request() req,
  ) {
    return this.equipmentService.create(createEquipmentDto, req.user.id);
  }

  /**
   * Get all equipment with filters and pagination
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS (Settings only)
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
  async findAll(@Query() filterDto: FilterEquipmentDto) {
    return this.equipmentService.findAll(filterDto);
  }

  /**
   * Get equipment by ID
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS (Settings only)
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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equipmentService.findOne(id);
  }

  /**
   * Get equipment statistics
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS (Settings only)
   */
  @Get(':id/statistics')
  @Roles(
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
   * Access: All authenticated users EXCEPT SUPER_ADMIN
   * 
   * ⚠️ SUPER_ADMIN: NO ACCESS (Settings only)
   */
  @Get(':id/logs')
  @Roles(
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
   * Access: HELP_DESK only
   */
  @Put(':id')
  @Roles(UserRole.HELP_DESK)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipmentDto: UpdateEquipmentDto,
    @Request() req,
  ) {
    return this.equipmentService.update(id, updateEquipmentDto, req.user.id);
  }

  /**
   * Delete equipment (soft delete - set status to RETIRED)
   * Access: HELP_DESK only
   */
  @Delete(':id')
  @Roles(UserRole.HELP_DESK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.equipmentService.remove(id, req.user.id);
  }

  // =========================================================
  // Dashboard & Analytics
  // =========================================================
  
  /**
   * NOTE: Dashboard methods are commented out because they are not 
   * implemented in the service yet. Uncomment when service methods are ready.
   */
  
  // @Get('dashboard/stats')
  // @Roles(
  //   UserRole.IT_MANAGER,
  //   UserRole.SUPERVISOR,
  //   UserRole.HELP_DESK,
  //   UserRole.READ_ONLY,
  // )
  // async getDashboardStats() {
  //   return this.equipmentService.getDashboardStats();
  // }

  // @Get('dashboard/health')
  // @Roles(
  //   UserRole.IT_MANAGER,
  //   UserRole.SUPERVISOR,
  //   UserRole.HELP_DESK,
  //   UserRole.READ_ONLY,
  // )
  // async getHealthReport() {
  //   return this.equipmentService.getHealthReport();
  // }
}