// src/incidents/incidents.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto, UpdateIncidentDto, QueryIncidentDto } from './dto';
import { JwtGuard } from '../auth/guard/jwt.guard';

@Controller('incidents')
@UseGuards(JwtGuard) // Protect all routes
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createIncidentDto: CreateIncidentDto, @Request() req) {
    return this.incidentsService.create(createIncidentDto, req.user.id);
  }

  @Get()
  findAll(@Query() query: QueryIncidentDto) {
    return this.incidentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateIncidentDto: UpdateIncidentDto,
    @Request() req,
  ) {
    return this.incidentsService.update(id, updateIncidentDto, req.user.id);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body('technicianId') technicianId: number) {
    return this.incidentsService.assign(id, technicianId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Request() req) {
    return this.incidentsService.remove(id, req.user.id);
  }
}