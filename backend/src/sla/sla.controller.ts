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
import { UserRole, Priority } from '@prisma/client';
import { SlaService } from './sla.service';
import { CreateSlaConfigDto, UpdateSlaConfigDto } from './dto/sla-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('sla')
@UseGuards(JwtAuthGuard)
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  // ========================================
  // SLA CONFIG CRUD
  // ========================================

  @Get()
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.slaService.findAll(includeInactive === 'true');
  }

  @Get('priority/:priority')
  async findByPriority(@Param('priority') priority: Priority) {
    return this.slaService.findByPriority(priority);
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.slaService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async create(@Body() dto: CreateSlaConfigDto) {
    return this.slaService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlaConfigDto,
  ) {
    return this.slaService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.slaService.delete(id);
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER)
  async toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.slaService.toggleActive(id);
  }

  @Post('seed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async seedDefaults() {
    return this.slaService.seedDefaults();
  }

  // ========================================
  // SLA CALCULATION ENDPOINTS
  // ========================================

  @Get('calculate/deadline')
  async calculateDeadline(
    @Query('priority') priority: Priority,
    @Query('createdAt') createdAt?: string,
  ) {
    const createdDate = createdAt ? new Date(createdAt) : new Date();
    const slaDeadline = await this.slaService.calculateSlaDeadline(priority, createdDate);
    const responseDeadline = await this.slaService.calculateResponseDeadline(priority, createdDate);

    return {
      priority,
      createdAt: createdDate,
      responseDeadline,
      slaDeadline,
    };
  }

  @Get('check/status')
  async checkSlaStatus(
    @Query('priority') priority: Priority,
    @Query('createdAt') createdAt: string,
    @Query('resolvedAt') resolvedAt?: string,
  ) {
    const createdDate = new Date(createdAt);
    const resolvedDate = resolvedAt ? new Date(resolvedAt) : null;

    return this.slaService.checkSlaStatus(priority, createdDate, resolvedDate);
  }
}
