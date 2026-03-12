import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuditTrailService } from './audit-trail.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('audit-trail')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditTrailController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Get()
  @Roles(UserRole.IT_MANAGER)
  async findAll(
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.auditTrailService.findAll({
      module,
      action,
      userId: userId ? parseInt(userId) : undefined,
      entityType,
      search,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get(':id')
  @Roles(UserRole.IT_MANAGER)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.auditTrailService.findOne(id);
  }
}
