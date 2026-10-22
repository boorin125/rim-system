import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddStoreDto } from './dto/add-store.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CheckInDto } from './dto/check-in.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { AddEquipmentDto } from './dto/add-equipment.dto';
import { CreateProjectStoreDto } from './dto/create-project-store.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ProjectModuleGuard } from './project-module.guard';

const STAFF = [UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR] as const;

// Class-level roles = who may read; write endpoints override with their own @Roles
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard, ProjectModuleGuard)
@Roles(...STAFF, UserRole.TECHNICIAN, UserRole.MONITOR, UserRole.READ_ONLY)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // ── Analytics ────────────────────────────────────────────────────────────

  @Get('analytics/dashboard')
  getDashboardAnalytics(@Query('projectId') projectId?: string) {
    return this.projectService.getDashboardAnalytics(projectId ? parseInt(projectId) : undefined);
  }

  @Get('analytics/calendar')
  getCalendarTasks(
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.projectService.getCalendarTasks(
      parseInt(year),
      parseInt(month),
      projectId ? parseInt(projectId) : undefined,
    );
  }

  @Get('analytics/checkins-by-date')
  getCheckinsByDate(
    @Query('date') date: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.projectService.getCheckinsByDate(date, projectId ? parseInt(projectId) : undefined);
  }

  @Get('analytics/active-checkins')
  getActiveCheckins() {
    return this.projectService.getActiveCheckins();
  }

  @Get('analytics/store-visits')
  getStoreVisits(@Query('projectId') projectId?: string) {
    return this.projectService.getStoreVisits(projectId ? parseInt(projectId) : undefined);
  }

  // Choices for "ทำงานให้โปรเจกต์" on the incident form (incident creators)
  @Get('project-store-options')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  getProjectStoreOptions() {
    return this.projectService.getProjectStoreOptions();
  }

  @Get('analytics/weekly-stores')
  getWeeklyStores(@Query('projectId') projectId?: string) {
    return this.projectService.getWeeklyStores(projectId ? parseInt(projectId) : undefined);
  }

  // ── Projects ────────────────────────────────────────────────────────────

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectService.findAll({
      status,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  create(@Body() dto: CreateProjectDto, @Request() req: any) {
    return this.projectService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projectService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.remove(id);
  }

  // ── Project Stores ───────────────────────────────────────────────────────

  @Post(':id/stores')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  addStore(@Param('id', ParseIntPipe) id: number, @Body() dto: AddStoreDto) {
    return this.projectService.addStore(id, dto);
  }

  @Post(':id/stores/new')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  createStoreInProject(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateProjectStoreDto) {
    return this.projectService.createStoreInProject(id, dto);
  }

  @Patch(':id/stores/:storeId/close-date')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  updateStoreCloseDate(
    @Param('id', ParseIntPipe) projectId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body('closeDate') closeDate: string,
    @Request() req: any,
  ) {
    return this.projectService.updateStoreCloseDate(projectId, storeId, closeDate, req.user.id);
  }

  @Patch(':id/stores/:storeId/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  activateStore(
    @Param('id', ParseIntPipe) projectId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Request() req: any,
  ) {
    return this.projectService.activateStore(projectId, storeId, req.user.id);
  }

  @Patch(':id/stores/:storeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  updateProjectStoreStatus(
    @Param('id', ParseIntPipe) projectId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body('status') status: 'ACTIVE' | 'PAUSED',
  ) {
    return this.projectService.updateProjectStoreStatus(projectId, storeId, status);
  }

  @Delete(':id/stores/:storeId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeStore(
    @Param('id', ParseIntPipe) projectId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
  ) {
    return this.projectService.removeStore(projectId, storeId);
  }

  // ── Project Tasks ────────────────────────────────────────────────────────

  @Get('tasks/pending-verify')
  getPendingVerifyTasks() {
    return this.projectService.getPendingVerifyTasks();
  }

  // Technician's open project tasks (shown on the Incidents page) + whether they manage any project
  // (two segments + declared before tasks/:taskId — a one-segment path would be caught by @Get(':id'))
  @Get('tasks/mine')
  getMyWork(@Request() req: any) {
    return this.projectService.getMyWork(req.user.id);
  }

  @Get('tasks/:taskId')
  findTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.projectService.findTask(taskId);
  }

  @Post(':id/stores/:storeId/tasks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  createTask(
    @Param('id', ParseIntPipe) projectId: number,
    @Param('storeId', ParseIntPipe) storeId: number,
    @Body() dto: CreateTaskDto,
  ) {
    return this.projectService.createTask(projectId, storeId, dto);
  }

  @Patch('tasks/:taskId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  updateTask(@Param('taskId', ParseIntPipe) taskId: number, @Body() dto: UpdateTaskDto, @Request() req: any) {
    return this.projectService.updateTask(taskId, dto, req.user.id);
  }

  @Delete('tasks/:taskId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.projectService.deleteTask(taskId);
  }

  // ── Technician Workflow ──────────────────────────────────────────────────

  @Post('tasks/:taskId/check-in')
  @Roles(UserRole.TECHNICIAN)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = 'uploads/project-checkin';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `checkin-${Date.now()}${ext}`);
        },
      }),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  checkIn(
    @Param('taskId', ParseIntPipe) taskId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CheckInDto,
    @Request() req: any,
  ) {
    return this.projectService.checkIn(taskId, req.user.id, {
      ...dto,
      checkInPhotoPath: file ? file.path.replace(/\\/g, '/') : undefined,
    });
  }

  @Delete('tasks/:taskId/check-in')
  @Roles(UserRole.TECHNICIAN)
  @HttpCode(HttpStatus.NO_CONTENT)
  resetCheckIn(@Param('taskId', ParseIntPipe) taskId: number, @Request() req: any) {
    return this.projectService.resetCheckIn(taskId, req.user.id);
  }

  // Assigned technician, or a Project Manager of the project on their behalf (checked in the service)
  @Post('tasks/:taskId/complete')
  completeTask(@Param('taskId', ParseIntPipe) taskId: number, @Request() req: any) {
    return this.projectService.completeTask(taskId, req.user.id);
  }

  @Post('tasks/:taskId/verify')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  verifyTask(@Param('taskId', ParseIntPipe) taskId: number, @Request() req: any) {
    return this.projectService.verifyTask(taskId, req.user.id);
  }

  @Post('tasks/:taskId/reject')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK)
  rejectTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body('type') type: 'FAILED' | 'REVISIT' | 'ROLLBACK',
    @Body('note') note: string,
    @Request() req: any,
  ) {
    return this.projectService.rejectTask(taskId, req.user.id, type, note);
  }

  @Post(':id/duplicate-tasks')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  duplicateTasks(
    @Param('id', ParseIntPipe) projectId: number,
    @Body('taskIds') taskIds: number[],
    @Body('targetStoreIds') targetStoreIds: number[],
  ) {
    return this.projectService.duplicateTasks(projectId, taskIds, targetStoreIds);
  }

  @Post('tasks/:taskId/reschedule')
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_MANAGER, UserRole.HELP_DESK, UserRole.SUPERVISOR)
  rescheduleTask(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body('scheduledDate') scheduledDate: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.projectService.rescheduleTask(taskId, scheduledDate, req.user.id, reason);
  }

  // ── Photos / Equipment / Checklists ─────────────────────────────────────
  // Class-level roles + assertCanEditTaskMedia: technicians, staff, or a Project Manager of the project

  /** Permission check after an upload — drop the stored file when refused */
  private async assertMediaUpload(taskId: number, user: any, file?: Express.Multer.File) {
    try {
      await this.projectService.assertCanEditTaskMedia(taskId, user);
    } catch (err) {
      if (file?.path) fs.promises.unlink(file.path).catch(() => {});
      throw err;
    }
  }

  @Post('tasks/:taskId/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = 'uploads/project-photos';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async addPhoto(
    @Param('taskId', ParseIntPipe) taskId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
    @Body('comment') comment?: string,
    @Body('sortOrder') sortOrder?: string,
    @Body('category') category?: string,
  ) {
    if (!file) throw new BadRequestException('Photo file is required');
    await this.assertMediaUpload(taskId, req.user, file);
    return this.dropFileOnError(file, this.projectService.addPhoto(taskId, {
      photoPath: file.path.replace(/\\/g, '/'),
      comment,
      sortOrder: sortOrder ? parseInt(sortOrder) : 0,
      category: category ?? 'WORK',
    }));
  }

  /** The upload is already on disk — remove it when saving fails (e.g. not checked in yet) */
  private async dropFileOnError<T>(file: Express.Multer.File, work: Promise<T>): Promise<T> {
    try {
      return await work;
    } catch (err) {
      fs.promises.unlink(file.path).catch(() => {});
      throw err;
    }
  }

  @Delete('photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePhoto(@Param('photoId', ParseIntPipe) photoId: number, @Request() req: any) {
    await this.projectService.assertCanEditTaskMedia(await this.projectService.taskIdOf('photo', photoId), req.user);
    return this.projectService.deletePhoto(photoId);
  }

  // Edit a photo's caption
  @Patch('photos/:photoId')
  async updatePhoto(
    @Param('photoId', ParseIntPipe) photoId: number,
    @Body('comment') comment: string,
    @Request() req: any,
  ) {
    await this.projectService.assertCanEditTaskMedia(await this.projectService.taskIdOf('photo', photoId), req.user);
    return this.projectService.updatePhotoComment(photoId, comment);
  }

  @Post('tasks/:taskId/equipment')
  async addEquipment(@Param('taskId', ParseIntPipe) taskId: number, @Body() dto: AddEquipmentDto, @Request() req: any) {
    await this.projectService.assertCanEditTaskMedia(taskId, req.user);
    return this.projectService.addEquipment(taskId, dto);
  }

  @Patch('equipment/:equipmentId')
  async updateEquipment(
    @Param('equipmentId', ParseIntPipe) equipmentId: number,
    @Body() dto: AddEquipmentDto,
    @Request() req: any,
  ) {
    await this.projectService.assertCanEditTaskMedia(await this.projectService.taskIdOf('equipment', equipmentId), req.user);
    return this.projectService.updateEquipment(equipmentId, dto);
  }

  @Delete('equipment/:equipmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEquipment(@Param('equipmentId', ParseIntPipe) equipmentId: number, @Request() req: any) {
    await this.projectService.assertCanEditTaskMedia(await this.projectService.taskIdOf('equipment', equipmentId), req.user);
    return this.projectService.deleteEquipment(equipmentId);
  }

  @Post('tasks/:taskId/checklists')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = 'uploads/project-checklists';
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async addChecklist(
    @Param('taskId', ParseIntPipe) taskId: number,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Checklist file is required');
    await this.assertMediaUpload(taskId, req.user, file);
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.dropFileOnError(file, this.projectService.addChecklist(taskId, {
      fileName,
      filePath: file.path.replace(/\\/g, '/'),
      fileSize: file.size,
    }));
  }

  @Delete('checklists/:checklistId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteChecklist(@Param('checklistId', ParseIntPipe) checklistId: number, @Request() req: any) {
    await this.projectService.assertCanEditTaskMedia(await this.projectService.taskIdOf('checklist', checklistId), req.user);
    return this.projectService.deleteChecklist(checklistId);
  }
}
