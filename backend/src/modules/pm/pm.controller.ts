import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PmService } from './pm.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { UpdatePmEquipmentRecordDto, SignInventoryListDto, UploadSignedInventoryDto } from './dto/index';

// ─── Authenticated endpoints ───────────────────────────────────────────────

@Controller('pm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PmController {
  constructor(private readonly pmService: PmService) {}

  /**
   * GET /pm/store-check/:storeId
   * Pre-creation check: returns open PM incident (if any) and last PM date for the store.
   */
  @Get('store-check/:storeId')
  @Roles(
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.IT_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  checkStoreBeforePm(@Param('storeId', ParseIntPipe) storeId: number) {
    return this.pmService.checkStoreBeforePm(storeId);
  }

  /**
   * GET /pm/incident/:incidentId
   * Get the full PM record (all equipment records) for an incident.
   */
  @Get('incident/:incidentId')
  @Roles(
    UserRole.TECHNICIAN,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.IT_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  getPmRecord(@Param('incidentId') incidentId: string) {
    return this.pmService.getPmRecord(incidentId);
  }

  /**
   * PATCH /pm/equipment-record/:id
   * Update a single equipment record (photos, comment, condition, brand/model/serial).
   */
  @Patch('equipment-record/:id')
  @Roles(UserRole.TECHNICIAN, UserRole.SUPERVISOR, UserRole.HELP_DESK, UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  updateEquipmentRecord(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePmEquipmentRecordDto,
  ) {
    return this.pmService.updateEquipmentRecord(id, dto);
  }

  /**
   * POST /pm/incident/:incidentId/submit
   * Finalize PM — apply equipment updates, set Store.lastPmAt.
   */
  @Post('incident/:incidentId/submit')
  @Roles(UserRole.TECHNICIAN, UserRole.SUPERVISOR, UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  submitPm(@Param('incidentId') incidentId: string, @Request() req) {
    return this.pmService.submitPm(incidentId, req.user.id);
  }

  /**
   * POST /pm/incident/:incidentId/inventory-token
   * Generate a 30-day public token for online inventory list signing.
   */
  @Post('incident/:incidentId/inventory-token')
  @Roles(
    UserRole.TECHNICIAN,
    UserRole.SUPERVISOR,
    UserRole.HELP_DESK,
    UserRole.IT_MANAGER,
    UserRole.SUPER_ADMIN,
  )
  @HttpCode(HttpStatus.OK)
  createInventoryListToken(@Param('incidentId') incidentId: string) {
    return this.pmService.createInventoryListToken(incidentId);
  }

  /**
   * POST /pm/incident/:incidentId/upload-signed
   * Upload a photo/scan of the signed paper inventory list.
   */
  @Post('incident/:incidentId/upload-signed')
  @Roles(UserRole.TECHNICIAN, UserRole.SUPERVISOR, UserRole.HELP_DESK, UserRole.IT_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  uploadSignedInventory(
    @Param('incidentId') incidentId: string,
    @Body() dto: UploadSignedInventoryDto,
  ) {
    return this.pmService.uploadSignedInventory(incidentId, dto.photo);
  }
}

// ─── Public endpoints (no auth) ────────────────────────────────────────────

@Controller('public/pm')
export class PmPublicController {
  constructor(private readonly pmService: PmService) {}

  /**
   * GET /public/pm/inventory-sign/:token
   * Get inventory data for the public signing page.
   */
  @Get('inventory-sign/:token')
  getByToken(@Param('token') token: string) {
    return this.pmService.getByToken(token);
  }

  /**
   * POST /public/pm/inventory-sign/:token/sign
   * Submit the store staff's signature.
   */
  @Post('inventory-sign/:token/sign')
  @HttpCode(HttpStatus.OK)
  signInventoryList(@Param('token') token: string, @Body() dto: SignInventoryListDto) {
    return this.pmService.signInventoryList(token, dto);
  }
}
