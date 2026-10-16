// src/modules/project/project.service.ts
// Project module merged from RPM-System (v1.1.0)
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SettingsService } from '../../settings/settings.service';
import { JobNumberService } from '../job-number/job-number.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddStoreDto } from './dto/add-store.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CheckInDto } from './dto/check-in.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { AddEquipmentDto } from './dto/add-equipment.dto';

@Injectable()
export class ProjectService implements OnModuleInit {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
    private readonly jobNumberService: JobNumberService,
  ) {}

  /** Remove an uploaded file (stored as "uploads/..." relative to cwd). Missing files are ignored. */
  private async removeUpload(relPath?: string | null) {
    if (!relPath || !relPath.startsWith('uploads/')) return;
    await fs.unlink(path.join(process.cwd(), relPath)).catch(() => {});
  }

  async onModuleInit() {
    await this.autoUpdateProjectStatuses();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async autoUpdateProjectStatuses() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // DRAFT → ACTIVE when startDate has arrived (and endDate not yet passed)
    const activated = await this.prisma.project.updateMany({
      where: {
        status: 'DRAFT',
        startDate: { not: null, lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: today } }],
      },
      data: { status: 'ACTIVE' },
    });

    // DRAFT / ACTIVE / PAUSED → COMPLETED when endDate has passed
    const completed = await this.prisma.project.updateMany({
      where: {
        status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] },
        endDate: { not: null, lt: today },
      },
      data: { status: 'COMPLETED' },
    });

    if (activated.count > 0 || completed.count > 0) {
      this.logger.log(
        `Auto-status: ${activated.count} activated, ${completed.count} completed`,
      );
    }
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  async findAll(query: { status?: string; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
          projectManager: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
          _count: { select: { projectStores: true } },
          projectStores: {
            select: {
              tasks: { select: { id: true, status: true } },
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const mapped = data.map((p) => {
      const allTasks = p.projectStores.flatMap((ps) => ps.tasks);
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter((t) => t.status === 'COMPLETED').length;
      const { projectStores: _, ...rest } = p;
      return {
        ...rest,
        totalTasks,
        completedTasks,
        progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    });

    return { data: mapped, total, page, limit };
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
        projectManager: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
        projectStores: {
          include: {
            store: {
              select: {
                id: true,
                storeCode: true,
                name: true,
                address: true,
                province: true,
                phone: true,
                googleMapLink: true,
                company: true,
                storeStatus: true,
              },
            },
            tasks: {
              orderBy: { createdAt: 'asc' },
              include: {
                assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
                _count: { select: { photos: true, equipment: true, checklists: true } },
              },
            },
          },
        },
      },
    });

    if (!project) throw new NotFoundException(`Project #${id} not found`);
    return project;
  }

  async create(dto: CreateProjectDto, userId: number) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        budget: dto.budget,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status ?? 'DRAFT',
        color: dto.color ?? '#3b82f6',
        createdById: userId,
        ...(dto.projectManagerId && { projectManagerId: dto.projectManagerId }),
      },
    });

    this.notificationsService
      .notifyProjectCreated(project.id, project.name)
      .catch((err) => this.logger.error('Failed to send project-created notification', err));

    return project;
  }

  async update(id: number, dto: UpdateProjectDto) {
    await this.findOne(id);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.budget !== undefined && { budget: dto.budget }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.status && { status: dto.status }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.projectManagerId !== undefined && { projectManagerId: dto.projectManagerId || null }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.project.delete({ where: { id } });
  }

  // ── Project Stores ────────────────────────────────────────────────────────

  async addStore(projectId: number, dto: AddStoreDto) {
    await this.findOne(projectId);

    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException(`Store #${dto.storeId} not found`);

    const existing = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId: dto.storeId } },
    });
    if (existing) throw new BadRequestException('Store is already added to this project');

    return this.prisma.projectStore.create({
      data: { projectId, storeId: dto.storeId, notes: dto.notes },
      include: { store: { select: { id: true, storeCode: true, name: true, province: true } } },
    });
  }

  async removeStore(projectId: number, storeId: number) {
    const ps = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId } },
    });
    if (!ps) throw new NotFoundException('Store not found in this project');

    await this.prisma.projectStore.delete({ where: { id: ps.id } });
  }

  async updateProjectStoreStatus(projectId: number, storeId: number, status: 'ACTIVE' | 'PAUSED') {
    const ps = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId } },
    });
    if (!ps) throw new NotFoundException('Store not found in this project');

    return this.prisma.projectStore.update({
      where: { id: ps.id },
      data: { status },
      include: { store: { select: { id: true, storeCode: true, name: true, province: true } } },
    });
  }

  // ── Project Tasks ─────────────────────────────────────────────────────────

  async getPendingVerifyTasks() {
    return this.prisma.projectTask.findMany({
      where: { status: 'PENDING_VERIFY' },
      orderBy: { completedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        ticketNo: true,
        completedAt: true,
        projectStore: {
          select: {
            project: { select: { id: true, name: true, color: true } },
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findTask(taskId: number) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: {
        projectStore: {
          include: {
            project: { select: { id: true, name: true, status: true } },
            store: { select: { id: true, storeCode: true, name: true, province: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true, phone: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        equipment: { orderBy: { createdAt: 'asc' } },
        checklists: { orderBy: { uploadedAt: 'asc' } },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!task) throw new NotFoundException(`Task #${taskId} not found`);
    return task;
  }

  async createTask(projectId: number, storeId: number, dto: CreateTaskDto) {
    const ps = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId } },
    });
    if (!ps) throw new NotFoundException('Store not found in this project');

    // Same ticket series as Incidents (organization prefix + YYMM + running)
    const ticketNo = await this.jobNumberService.nextTicketNumber();

    const updated = await this.prisma.projectTask.create({
      data: {
        projectStoreId: ps.id,
        ticketNo,
        title: dto.title ?? null,
        assignedToId: dto.assignedToId ?? null,
        scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
        status: dto.assignedToId ? 'SCHEDULED' : 'PENDING',
        notes: dto.notes,
      },
    });

    if (dto.assignedToId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
      this.notificationsService
        .notifyProjectTaskAssigned(dto.assignedToId, updated.id, updated.title || ticketNo, project?.name || '')
        .catch((err) => this.logger.error('Failed to send task-assigned notification', err));
    }

    return updated;
  }

  async updateTask(taskId: number, dto: UpdateTaskDto, userId?: number) {
    const old = await this.findTask(taskId);

    // Auto-advance PENDING → SCHEDULED when a tech is assigned and a date is set
    const willHaveAssignee = dto.assignedToId !== undefined ? dto.assignedToId : old.assignedToId;
    const willHaveDate = dto.scheduledDate ? new Date(dto.scheduledDate) : old.scheduledDate;
    const autoSchedule =
      old.status === 'PENDING' &&
      !dto.status &&
      !!willHaveAssignee &&
      !!willHaveDate;

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title || null }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.scheduledDate && { scheduledDate: new Date(dto.scheduledDate) }),
        ...(dto.status && { status: dto.status }),
        ...(autoSchedule && { status: 'SCHEDULED' }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    // Log changes if editor is known
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, roles: { select: { role: true } } },
      });
      const primaryRole = user?.roles?.[0]?.role;
      const roleLabel = primaryRole === 'SUPERVISOR' ? 'Supervisor'
        : primaryRole === 'IT_MANAGER' ? 'IT Manager'
        : primaryRole === 'HELP_DESK' ? 'Help Desk'
        : primaryRole === 'SUPER_ADMIN' ? 'Admin'
        : '';
      const name = user ? `${user.firstName} ${user.lastName}${roleLabel ? ` (${roleLabel})` : ''}` : 'ผู้ใช้';
      const taskLabel = old.title || old.ticketNo || `Task #${taskId}`;

      if (dto.assignedToId !== undefined && dto.assignedToId !== old.assignedToId) {
        const tech = dto.assignedToId
          ? await this.prisma.user.findUnique({ where: { id: dto.assignedToId }, select: { firstName: true, lastName: true } })
          : null;
        const techName = tech ? `${tech.firstName} ${tech.lastName} (Technician)` : 'ไม่มีผู้รับผิดชอบ';
        const action = old.assignedToId ? 'REASSIGN' : 'ASSIGN';
        const verb = old.assignedToId ? 'เปลี่ยนผู้รับผิดชอบ' : 'มอบหมาย';
        await this.prisma.projectTaskLog.create({
          data: { taskId, userId, action, message: `${name} ${verb} ${taskLabel} ให้ ${techName}` },
        });

        if (dto.assignedToId) {
          this.notificationsService
            .notifyProjectTaskAssigned(dto.assignedToId, taskId, taskLabel, old.projectStore.project.name)
            .catch((err) => this.logger.error('Failed to send task-assigned notification', err));
        }
      }
      if (dto.title !== undefined && dto.title !== old.title) {
        await this.prisma.projectTaskLog.create({
          data: { taskId, userId, action: 'UPDATE_TITLE', message: `${name} แก้ไขชื่อ Task เป็น "${dto.title}"` },
        });
      }
    }
    return updated;
  }

  async deleteTask(taskId: number) {
    const task = await this.findTask(taskId);
    await this.prisma.projectTask.delete({ where: { id: taskId } });
    await Promise.all([
      this.removeUpload(task.checkInPhotoPath),
      ...task.photos.map((p) => this.removeUpload(p.photoPath)),
      ...task.checklists.map((c) => this.removeUpload(c.filePath)),
    ]);
  }

  async duplicateTasks(projectId: number, taskIds: number[], targetStoreIds: number[]) {
    const sourceTasks = await this.prisma.projectTask.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, title: true },
    });

    let created = 0;
    const skipped: { title: string; storeName: string; reason: string }[] = [];

    for (const targetStoreId of targetStoreIds) {
      const ps = await this.prisma.projectStore.findUnique({
        where: { projectId_storeId: { projectId, storeId: targetStoreId } },
        include: { store: { select: { name: true, storeCode: true } } },
      });
      if (!ps) continue;

      const existing = await this.prisma.projectTask.findMany({
        where: { projectStoreId: ps.id },
        select: { title: true },
      });
      const existingTitles = new Set(existing.map(t => (t.title || '').toLowerCase().trim()));
      const storeName = `[${ps.store.storeCode}] ${ps.store.name}`;

      for (const src of sourceTasks) {
        const key = (src.title || '').toLowerCase().trim();
        if (key && existingTitles.has(key)) {
          skipped.push({ title: src.title || '', storeName, reason: 'ชื่อ Task ซ้ำในสาขาปลายทาง' });
          continue;
        }

        const ticketNo = await this.jobNumberService.nextTicketNumber();
        await this.prisma.projectTask.create({
          data: { projectStoreId: ps.id, ticketNo, title: src.title, status: 'PENDING' },
        });
        existingTitles.add(key);
        created++;
      }
    }

    return { created, skippedCount: skipped.length, skipped };
  }

  // ── Technician Workflow ──────────────────────────────────────────────────

  async checkIn(taskId: number, userId: number, dto: CheckInDto) {
    const task = await this.findTask(taskId);

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You are not assigned to this task');
    }
    if (task.status === 'COMPLETED' || task.status === 'PENDING_VERIFY') {
      throw new BadRequestException('Task is already completed');
    }

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        checkInAt: new Date(),
        checkInLat: dto.lat,
        checkInLng: dto.lng,
        checkInPhotoPath: dto.checkInPhotoPath,
        status: 'IN_PROGRESS',
      },
    });

    const name = task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'ช่าง';
    const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
    await this.prisma.projectTaskLog.create({
      data: { taskId, userId, action: 'CHECK_IN', message: `${name} Check-in เริ่มงาน ${taskLabel}` },
    });

    return updated;
  }

  async resetCheckIn(taskId: number, userId: number) {
    const task = await this.findTask(taskId);

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You are not assigned to this task');
    }
    if (!['IN_PROGRESS', 'SCHEDULED', 'PENDING'].includes(task.status)) {
      throw new BadRequestException('Cannot reset check-in at this stage');
    }

    const resetStatus = task.scheduledDate ? 'SCHEDULED' : 'PENDING';

    return this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        checkInAt: null,
        checkInLat: null,
        checkInLng: null,
        checkInPhotoPath: null,
        status: resetStatus,
      },
    });
  }

  async addPhoto(taskId: number, dto: AddPhotoDto & { category?: string }) {
    await this.findTask(taskId);
    return this.prisma.projectPhoto.create({
      data: {
        taskId,
        photoPath: dto.photoPath,
        comment: dto.comment,
        sortOrder: dto.sortOrder ?? 0,
        category: dto.category ?? 'WORK',
      },
    });
  }

  async deletePhoto(photoId: number) {
    const photo = await this.prisma.projectPhoto.findUnique({ where: { id: photoId } });
    if (!photo) throw new NotFoundException(`Photo #${photoId} not found`);
    await this.prisma.projectPhoto.delete({ where: { id: photoId } });
    await this.removeUpload(photo.photoPath);
  }

  async addEquipment(taskId: number, dto: AddEquipmentDto) {
    await this.findTask(taskId);
    return this.prisma.projectEquipment.create({ data: { taskId, ...dto } });
  }

  async updateEquipment(equipmentId: number, dto: AddEquipmentDto) {
    const eq = await this.prisma.projectEquipment.findUnique({ where: { id: equipmentId } });
    if (!eq) throw new NotFoundException(`Equipment record #${equipmentId} not found`);
    return this.prisma.projectEquipment.update({
      where: { id: equipmentId },
      data: {
        itemName: dto.itemName,
        oldModel: dto.oldModel ?? null,
        oldSN: dto.oldSN ?? null,
        newModel: dto.newModel ?? null,
        newSN: dto.newSN ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async deleteEquipment(equipmentId: number) {
    const eq = await this.prisma.projectEquipment.findUnique({ where: { id: equipmentId } });
    if (!eq) throw new NotFoundException(`Equipment record #${equipmentId} not found`);
    await this.prisma.projectEquipment.delete({ where: { id: equipmentId } });
  }

  async addChecklist(taskId: number, data: { fileName: string; filePath: string; fileSize?: number }) {
    await this.findTask(taskId);
    return this.prisma.projectChecklist.create({ data: { taskId, ...data } });
  }

  async deleteChecklist(checklistId: number) {
    const cl = await this.prisma.projectChecklist.findUnique({ where: { id: checklistId } });
    if (!cl) throw new NotFoundException(`Checklist #${checklistId} not found`);
    await this.prisma.projectChecklist.delete({ where: { id: checklistId } });
    await this.removeUpload(cl.filePath);
  }

  async completeTask(taskId: number, userId: number) {
    const task = await this.findTask(taskId);

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('You are not assigned to this task');
    }
    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Task must be IN_PROGRESS to complete');
    }

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { status: 'PENDING_VERIFY', completedAt: new Date() },
    });

    const name = task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'ช่าง';
    const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
    await this.prisma.projectTaskLog.create({
      data: { taskId, userId, action: 'COMPLETE', message: `${name} ปิดงานและส่งตรวจสอบ ${taskLabel}` },
    });

    this.notificationsService
      .notifyProjectTaskCompleted(taskId, taskLabel, task.projectStore.project.name, [userId])
      .catch((err) => this.logger.error('Failed to send task-completed notification', err));

    return updated;
  }

  async verifyTask(taskId: number, userId: number) {
    const task = await this.findTask(taskId);

    if (task.status !== 'PENDING_VERIFY') {
      throw new BadRequestException('Task must be PENDING_VERIFY to verify');
    }

    const verifiedAt = new Date();
    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { status: 'ACCEPTED', verifiedAt, verifiedById: userId },
    });

    const verifier = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const name = verifier ? `${verifier.firstName} ${verifier.lastName}` : 'ผู้ตรวจสอบ';
    const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
    await this.prisma.projectTaskLog.create({
      data: { taskId, userId, action: 'VERIFY', message: `${name} ยืนยันปิดงาน (ACCEPTED) ${taskLabel}` },
    });

    // Send close-notification email (fire-and-forget — don't block response)
    this.sendVerifyNotificationEmail(task, verifier, verifiedAt).catch((err) =>
      this.logger.error('Failed to send verify notification email', err),
    );

    return updated;
  }

  private async sendVerifyNotificationEmail(
    task: Awaited<ReturnType<typeof this.findTask>>,
    verifier: { firstName: string; lastName: string } | null,
    verifiedAt: Date,
  ) {
    // Same recipients as Incident close notifications (Settings › Email)
    const emailSettings = await this.settingsService.getEmailSettings();
    const to = emailSettings?.closeNotificationTo?.trim();
    if (!to) return; // no recipient configured

    const cc = emailSettings?.closeNotificationCc
      ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];

    const ticketNo = task.ticketNo || `Task #${task.id}`;
    const taskTitle = task.title || ticketNo;
    const projectName = task.projectStore?.project?.name || '-';
    const storeCode = task.projectStore?.store?.storeCode || '-';
    const storeName = task.projectStore?.store?.name || '-';
    const techName = task.assignedTo
      ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
      : '-';
    const verifierName = verifier ? `${verifier.firstName} ${verifier.lastName}` : 'Helpdesk';

    const fmtDate = (d: Date | null) =>
      d
        ? d.toLocaleString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '-';

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><title>ยืนยันปิดงาน - RIM System</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f0f5f0; padding: 20px;">
        <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #d1ddd1; box-shadow: 0 2px 8px rgba(45,90,71,0.08);">

          <!-- Header -->
          <div style="background-color: #2d5a47; padding: 28px 30px 24px; text-align: center; border-bottom: 3px solid #22c55e;">
            <div style="display: inline-flex; align-items: center; justify-content: center; background: #22c55e; border-radius: 50%; width: 44px; height: 44px; margin-bottom: 10px;">
              <span style="font-size: 22px; line-height: 1;">✅</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 22px;">ยืนยันปิดงานแล้ว</h1>
            <p style="color: rgba(255,255,255,0.7); margin: 6px 0 0 0; font-size: 14px;">RIM - Project</p>
          </div>

          <!-- Task Info -->
          <div style="padding: 24px 30px;">
            <table style="width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden;">
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; width: 40%; color: #374151;">Ticket No.</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937; font-weight: bold;">${ticketNo}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">งาน</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937;">${taskTitle}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">โครงการ</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937;">${projectName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">สาขา</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937;">[${storeCode}] ${storeName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">ช่างผู้รับผิดชอบ</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937;">${techName}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">ส่งปิดงานเมื่อ</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937;">${fmtDate(task.completedAt)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">ยืนยันปิดงานเมื่อ</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #16a34a; font-weight: bold;">${fmtDate(verifiedAt)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #f0f5f0; border: 1px solid #d1ddd1; font-weight: bold; color: #374151;">ยืนยันโดย</td>
                <td style="padding: 10px 14px; background: #ffffff; border: 1px solid #d1ddd1; color: #1f2937;">${verifierName} (Helpdesk)</td>
              </tr>
            </table>
          </div>

          <!-- Footer -->
          <div style="padding: 16px 30px 20px; border-top: 1px solid #d1ddd1; text-align: center; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">อีเมลนี้ส่งโดยอัตโนมัติจาก RIM System</p>
            <p style="margin: 4px 0 0 0;">© ${new Date().getFullYear()} RIM System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.emailService.sendEmail({
      to,
      ...(cc.length > 0 && { cc }),
      subject: `✅ ยืนยันปิดงาน ${ticketNo} - [${storeCode}] ${storeName}`,
      html,
    });
  }

  async rejectTask(
    taskId: number,
    userId: number,
    type: 'FAILED' | 'REVISIT' | 'ROLLBACK',
    note?: string,
  ) {
    const task = await this.findTask(taskId);

    if (task.status !== 'PENDING_VERIFY') {
      throw new BadRequestException('Task must be PENDING_VERIFY to reject');
    }

    const ALLOWED = ['FAILED', 'REVISIT', 'ROLLBACK'] as const;
    if (!ALLOWED.includes(type as any)) {
      throw new BadRequestException('ประเภทการปฏิเสธต้องเป็น FAILED, REVISIT หรือ ROLLBACK');
    }

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: {
        status: type as any,
        rejectionNote: note?.trim() || null,
      },
    });

    const reviewer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const name = reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : 'ผู้ตรวจสอบ';
    const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
    const typeLabel = type === 'FAILED' ? 'ล้มเหลว' : type === 'REVISIT' ? 'ต้อง Revisit' : 'Rollback';
    await this.prisma.projectTaskLog.create({
      data: {
        taskId,
        userId,
        action: 'REJECT',
        message: `${name} อัปเดตสถานะเป็น ${typeLabel} — ${taskLabel}`,
        reason: note?.trim() || undefined,
      },
    });

    return updated;
  }

  async rescheduleTask(taskId: number, scheduledDate: string, userId?: number, reason?: string) {
    const task = await this.findTask(taskId);

    if (['COMPLETED', 'ACCEPTED', 'PENDING_VERIFY'].includes(task.status)) {
      throw new BadRequestException('Cannot reschedule a completed task');
    }

    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { status: 'RESCHEDULED', scheduledDate: new Date(scheduledDate) },
    });

    // Log the reschedule
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      const name = user ? `${user.firstName} ${user.lastName}` : 'ผู้ใช้';
      const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
      const dateLabel = new Date(scheduledDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
      const message = `${name} เลื่อนวันนัดหมาย ${taskLabel} เป็นวันที่ ${dateLabel}`;
      await this.prisma.projectTaskLog.create({
        data: { taskId, userId, action: 'RESCHEDULE', message, reason: reason || null },
      });
    }
    return updated;
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getDashboardAnalytics(projectId?: number) {
    const projectFilter = projectId ? { projectStore: { projectId } } : {};

    const [rescheduledCount, completedTasks, activeCheckins, projectsList] = await Promise.all([
      this.prisma.projectTask.count({ where: { status: 'RESCHEDULED', ...projectFilter } }),

      this.prisma.projectTask.findMany({
        where: { status: 'ACCEPTED', checkInAt: { not: null }, completedAt: { not: null }, ...projectFilter },
        select: { checkInAt: true, completedAt: true },
        take: 500,
      }),

      this.prisma.projectTask.findMany({
        where: { status: 'IN_PROGRESS', checkInLat: { not: null }, checkInLng: { not: null } },
        select: {
          id: true, checkInAt: true, checkInLat: true, checkInLng: true, status: true,
          projectStore: {
            select: {
              project: { select: { id: true, name: true } },
              store: { select: { id: true, name: true, storeCode: true } },
            },
          },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
        },
      }),

      this.prisma.project.findMany({
        select: { id: true, name: true, status: true, color: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Task stats
    const taskTotals: Record<string, number> = {};
    if (projectId) {
      const tasks = await this.prisma.projectTask.findMany({
        where: { projectStore: { projectId } },
        select: { status: true },
      });
      for (const t of tasks) taskTotals[t.status] = (taskTotals[t.status] ?? 0) + 1;
    } else {
      const grouped = await this.prisma.projectTask.groupBy({ by: ['status' as any], _count: { id: true } });
      for (const g of grouped) taskTotals[(g as any).status] = g._count.id;
    }

    // Brand breakdown — % completion per project
    const allTasksForBrand = await this.prisma.projectTask.findMany({
      where: projectFilter,
      select: {
        status: true,
        projectStore: { select: { project: { select: { id: true, name: true, color: true } } } },
      },
    });
    const brandMap: Record<number, { id: number; name: string; color: string; total: number; completed: number; accepted: number }> = {};
    for (const t of allTasksForBrand) {
      const proj = t.projectStore?.project;
      if (!proj) continue;
      if (!brandMap[proj.id]) brandMap[proj.id] = { id: proj.id, name: proj.name, color: proj.color || '#3b82f6', total: 0, completed: 0, accepted: 0 };
      brandMap[proj.id].total++;
      if (t.status === 'COMPLETED' || t.status === 'ACCEPTED') brandMap[proj.id].completed++;
      if (t.status === 'ACCEPTED') brandMap[proj.id].accepted++;
    }
    const brandBreakdown = Object.values(brandMap).map(b => ({
      ...b,
      successPct: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
    }));

    // Aging — tasks stuck in FAILED / REVISIT / ROLLBACK
    const now = Date.now();
    const agingTasks = await this.prisma.projectTask.findMany({
      where: { status: { in: ['FAILED', 'REVISIT', 'ROLLBACK'] as any[] }, ...projectFilter },
      select: {
        id: true, ticketNo: true, title: true, status: true, updatedAt: true, rejectionNote: true,
        projectStore: {
          select: {
            project: { select: { id: true, name: true } },
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });
    const agingStores = agingTasks.map(t => ({
      id: t.id,
      ticketNo: t.ticketNo,
      title: t.title,
      status: t.status,
      agingDays: Math.floor((now - new Date(t.updatedAt).getTime()) / 86_400_000),
      rejectionNote: t.rejectionNote,
      project: t.projectStore?.project,
      store: t.projectStore?.store,
      assignedTo: t.assignedTo,
    }));

    // First-time success rate
    // FTS = ACCEPTED / (ACCEPTED + FAILED + REVISIT + ROLLBACK)
    const terminalStatuses = ['ACCEPTED', 'FAILED', 'REVISIT', 'ROLLBACK'];
    const terminalFilter = { status: { in: terminalStatuses as any[] }, ...projectFilter };
    const terminalTasks = await this.prisma.projectTask.findMany({
      where: terminalFilter,
      select: {
        status: true,
        projectStore: { select: { project: { select: { id: true, name: true } } } },
      },
    });
    const ftsTotal = terminalTasks.length;
    const ftsAccepted = terminalTasks.filter(t => t.status === 'ACCEPTED').length;
    const ftsRate = ftsTotal > 0 ? Math.round((ftsAccepted / ftsTotal) * 100) : null;

    // FTS per brand
    const ftsBrandMap: Record<number, { name: string; total: number; accepted: number }> = {};
    for (const t of terminalTasks) {
      const proj = t.projectStore?.project;
      if (!proj) continue;
      if (!ftsBrandMap[proj.id]) ftsBrandMap[proj.id] = { name: proj.name, total: 0, accepted: 0 };
      ftsBrandMap[proj.id].total++;
      if (t.status === 'ACCEPTED') ftsBrandMap[proj.id].accepted++;
    }
    const ftsByBrand = Object.entries(ftsBrandMap).map(([id, b]) => ({
      projectId: Number(id),
      name: b.name,
      rate: b.total > 0 ? Math.round((b.accepted / b.total) * 100) : null,
      accepted: b.accepted,
      total: b.total,
    }));

    const durations = completedTasks
      .map(t => (new Date(t.completedAt!).getTime() - new Date(t.checkInAt!).getTime()) / 60000)
      .filter(d => d > 0 && d < 1440);

    const timingStats = durations.length > 0
      ? {
          count: durations.length,
          avgMinutes: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
          minMinutes: Math.round(Math.min(...durations)),
          maxMinutes: Math.round(Math.max(...durations)),
        }
      : { count: 0, avgMinutes: 0, minMinutes: 0, maxMinutes: 0 };

    return {
      taskStats: taskTotals,
      rescheduledCount,
      timingStats,
      activeCheckins,
      projects: projectsList,
      brandBreakdown,
      agingStores,
      ftsRate,
      ftsTotal,
      ftsAccepted,
      ftsByBrand,
    };
  }

  async getCalendarTasks(year: number, month: number, projectId?: number) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return this.prisma.projectTask.findMany({
      where: {
        scheduledDate: { gte: start, lte: end },
        ...(projectId ? { projectStore: { projectId } } : {}),
      },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        projectStore: {
          select: {
            project: { select: { id: true, name: true, color: true } },
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  async getCheckinsByDate(date: string, projectId?: number) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59`);
    return this.prisma.projectTask.findMany({
      where: {
        checkInAt: { gte: start, lte: end },
        checkInLat: { not: null },
        checkInLng: { not: null },
        ...(projectId ? { projectStore: { projectId } } : {}),
      },
      select: {
        id: true,
        checkInAt: true,
        checkInLat: true,
        checkInLng: true,
        status: true,
        projectStore: {
          select: {
            project: { select: { id: true, name: true } },
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
      },
    });
  }

  async getActiveCheckins() {
    return this.prisma.projectTask.findMany({
      where: {
        status: 'IN_PROGRESS',
        checkInLat: { not: null },
        checkInLng: { not: null },
      },
      select: {
        id: true,
        checkInAt: true,
        checkInLat: true,
        checkInLng: true,
        status: true,
        projectStore: {
          select: {
            project: { select: { id: true, name: true } },
            store: { select: { id: true, name: true, storeCode: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
      },
    });
  }

  async getWeeklyStores(projectId?: number) {
    const now = new Date();

    const earliest = new Date(now);
    earliest.setDate(now.getDate() - now.getDay() - 11 * 7);
    earliest.setHours(0, 0, 0, 0);

    const tasks = await this.prisma.projectTask.findMany({
      where: {
        scheduledDate: { gte: earliest },
        ...(projectId ? { projectStore: { projectId } } : {}),
      },
      select: {
        scheduledDate: true,
        assignedToId: true,
        status: true,
      },
    });

    // Build 12-week slots (Sunday-based)
    const slots: { key: string; label: string; dateRange: string; assigned: number; completed: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const sun = new Date(now);
      sun.setDate(now.getDate() - now.getDay() - i * 7);
      sun.setHours(0, 0, 0, 0);
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      const weekNum = this.isoWeekNumber(sun);
      slots.push({
        key: sun.toISOString().slice(0, 10),
        label: `W${weekNum}`,
        dateRange: `${sun.getDate()}/${sun.getMonth() + 1} – ${sat.getDate()}/${sat.getMonth() + 1}`,
        assigned: 0,
        completed: 0,
      });
    }

    for (const task of tasks) {
      if (!task.scheduledDate) continue;
      const d = new Date(task.scheduledDate);
      const sun = new Date(d);
      sun.setDate(d.getDate() - d.getDay());
      sun.setHours(0, 0, 0, 0);
      const key = sun.toISOString().slice(0, 10);
      const slot = slots.find(s => s.key === key);
      if (!slot) continue;
      if (task.assignedToId !== null) slot.assigned++;
      if (task.status === 'COMPLETED') slot.completed++;
    }

    return slots.map(s => ({ label: s.label, dateRange: s.dateRange, assigned: s.assigned, completed: s.completed }));
  }

  private isoWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
