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
import { Prisma, EquipmentStatus, EquipmentLogAction, EquipmentLogSource } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { SettingsService } from '../../settings/settings.service';
import { JobNumberService } from '../job-number/job-number.service';
import { StoresService } from '../stores/stores.service';
import { syncOpenPmEquipment } from '../pm/pm-sync.helper';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddStoreDto } from './dto/add-store.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CheckInDto } from './dto/check-in.dto';
import { AddPhotoDto } from './dto/add-photo.dto';
import { AddEquipmentDto } from './dto/add-equipment.dto';
import { CreateProjectStoreDto } from './dto/create-project-store.dto';

// Incidents linked to a project store via Incident.forProjectStoreId
const SUPPORT_INCIDENT_SELECT = {
  id: true,
  ticketNumber: true,
  title: true,
  status: true,
  jobType: true,
  storeCode: true,
  storeName: true,
  checkInAt: true,
  createdAt: true,
  workRounds: { where: { checkInAt: { not: null } }, select: { id: true } },
} satisfies Prisma.IncidentSelect;

/** One visit per checked-in project task, per checked-in incident work round (or the incident check-in) */
function countVisits(
  tasks: { checkInAt: Date | null }[],
  incidents: { checkInAt: Date | null; workRounds: { id: number }[] }[],
) {
  const taskVisits = tasks.filter((t) => t.checkInAt).length;
  const incidentVisits = incidents.reduce((sum, i) => sum + (i.workRounds.length || (i.checkInAt ? 1 : 0)), 0);
  return { tasks: taskVisits, incidents: incidentVisits, total: taskVisits + incidentVisits };
}

@Injectable()
export class ProjectService implements OnModuleInit {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
    private readonly jobNumberService: JobNumberService,
    private readonly storesService: StoresService,
  ) {}

  /** Remove an uploaded file (stored as "uploads/..." relative to cwd). Missing files are ignored. */
  private async removeUpload(relPath?: string | null) {
    if (!relPath || !relPath.startsWith('uploads/')) return;
    await fs.unlink(path.join(process.cwd(), relPath)).catch(() => {});
  }

  async onModuleInit() {
    await this.backfillProjectManagers();
    await this.autoUpdateProjectStatuses();
  }

  /**
   * v1.1.8: projects had one manager (project_manager_id) — copy it into project_managers.
   * Safe to re-run: projectManagerId is always the first entry of the list, so nothing new is added later.
   */
  private async backfillProjectManagers() {
    try {
      const added = await this.prisma.$executeRaw`
        INSERT INTO project_managers (project_id, user_id)
        SELECT id, project_manager_id FROM projects WHERE project_manager_id IS NOT NULL
        ON CONFLICT DO NOTHING`;
      if (added > 0) this.logger.log(`Project managers backfill: ${added} row(s)`);
    } catch (err) {
      this.logger.error('Project managers backfill failed', err as any);
    }
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

    // Stores being opened → ACTIVE on the day of their Opening task (so nobody forgets)
    const endOfToday = new Date(today);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const dueOpenings = await this.prisma.projectTask.findMany({
      where: {
        taskType: 'OPENING',
        scheduledDate: { lt: endOfToday },
        projectStore: { store: { storeStatus: 'OPENING' }, project: { status: { not: 'CANCELLED' } } },
      },
      select: { projectStore: { select: { storeId: true } } },
    });
    // Pop-up / Event without an Opening task open on their own openDate
    const dueByDate = await this.prisma.store.findMany({
      where: {
        storeStatus: 'OPENING',
        openDate: { not: null, lt: endOfToday },
        projectStores: { some: { tasks: { none: { taskType: 'OPENING' } } } },
      },
      select: { id: true },
    });
    const openingStoreIds = [...new Set([...dueOpenings.map((t) => t.projectStore.storeId), ...dueByDate.map((s) => s.id)])];
    if (openingStoreIds.length > 0) {
      const opened = await this.prisma.store.updateMany({
        where: { id: { in: openingStoreIds }, storeStatus: 'OPENING' },
        data: { storeStatus: 'ACTIVE' },
      });
      this.logger.log(`Auto-open: ${opened.count} store(s) OPENING → ACTIVE (store ids ${openingStoreIds.join(', ')})`);
    }

    // Pop-up / Event stores from a project close once their close day is over (extend = change closeDate).
    // Only autoClose stores — existing stores are closed by hand.
    const dueClose = await this.prisma.store.findMany({
      where: { autoClose: true, closeDate: { not: null, lt: today }, storeStatus: { not: 'PERMANENTLY_CLOSED' } },
      select: { id: true, storeCode: true, name: true },
    });
    if (dueClose.length > 0) {
      await this.prisma.store.updateMany({
        where: { id: { in: dueClose.map((s) => s.id) } },
        data: { storeStatus: 'PERMANENTLY_CLOSED' },
      });
      this.logger.log(`Auto-close: ${dueClose.map((s) => `${s.storeCode} ${s.name}`).join(', ')} → PERMANENTLY_CLOSED`);
    }

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
          managers: {
            orderBy: { createdAt: 'asc' },
            select: { user: { select: { id: true, firstName: true, lastName: true, avatarPath: true } } },
          },
          _count: { select: { projectStores: true } },
          projectStores: {
            select: {
              tasks: { select: { id: true, status: true, scheduledDate: true } },
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const DONE = ['COMPLETED', 'PENDING_VERIFY', 'ACCEPTED'];
    const mapped = data.map((p) => {
      const allTasks = p.projectStores.flatMap((ps) => ps.tasks);
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter((t) => t.status === 'COMPLETED').length;
      const { projectStores: _, managers, ...rest } = p;
      return {
        ...rest,
        managers: managers.map((m) => m.user),
        totalTasks,
        completedTasks,
        progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        // open tasks' dates — the list page counts due-soon / overdue in the viewer's timezone
        openTaskDates: allTasks
          .filter((t) => t.scheduledDate && !DONE.includes(t.status))
          .map((t) => t.scheduledDate),
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
        managers: {
          orderBy: { createdAt: 'asc' },
          select: { user: { select: { id: true, firstName: true, lastName: true, avatarPath: true, username: true } } },
        },
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
                storeType: true,
                openDate: true,
                closeDate: true,
                autoClose: true,
                hostStore: { select: { id: true, storeCode: true, name: true } },
              },
            },
            tasks: {
              orderBy: { createdAt: 'asc' },
              include: {
                assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true } },
                _count: { select: { photos: true, equipment: true, checklists: true } },
              },
            },
            supportIncidents: { select: SUPPORT_INCIDENT_SELECT, orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!project) throw new NotFoundException(`Project #${id} not found`);
    return {
      ...project,
      managers: project.managers.map((m) => m.user),
      projectStores: project.projectStores.map((ps) => ({ ...ps, visits: countVisits(ps.tasks, ps.supportIncidents) })),
    };
  }

  /**
   * Store visit counts (for future cost estimates): project task check-ins + check-ins of
   * incidents opened (at any store) to work for that project store.
   */
  async getStoreVisits(projectId?: number) {
    const rows = await this.prisma.projectStore.findMany({
      where: projectId ? { projectId } : undefined,
      select: {
        id: true,
        project: { select: { id: true, name: true, color: true } },
        store: { select: { id: true, storeCode: true, name: true, storeStatus: true } },
        tasks: { select: { checkInAt: true } },
        supportIncidents: { select: SUPPORT_INCIDENT_SELECT },
      },
    });
    return rows
      .map(({ tasks, supportIncidents, ...ps }) => ({ ...ps, visits: countVisits(tasks, supportIncidents) }))
      .sort((a, b) => b.visits.total - a.visits.total);
  }

  /** Project stores of open projects — choices for "ทำงานให้โปรเจกต์" on the incident form */
  async getProjectStoreOptions() {
    const rows = await this.prisma.projectStore.findMany({
      where: { project: { status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] } } },
      select: {
        id: true,
        project: { select: { id: true, name: true } },
        store: { select: { id: true, storeCode: true, name: true, storeStatus: true } },
      },
      orderBy: [{ projectId: 'desc' }, { id: 'asc' }],
    });
    return rows;
  }

  /** Manager list from the DTO: projectManagerIds wins, else the single projectManagerId (older clients) */
  private managerIdsFrom(dto: { projectManagerIds?: number[]; projectManagerId?: number | null }): number[] | undefined {
    if (dto.projectManagerIds !== undefined) return [...new Set(dto.projectManagerIds.filter((id) => id > 0))];
    if (dto.projectManagerId !== undefined) return dto.projectManagerId ? [dto.projectManagerId] : [];
    return undefined;
  }

  async create(dto: CreateProjectDto, userId: number) {
    const managerIds = this.managerIdsFrom(dto) ?? [];
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
        projectManagerId: managerIds[0] ?? null,
        managers: { create: managerIds.map((id) => ({ userId: id })) },
      },
    });

    this.notificationsService
      .notifyProjectCreated(project.id, project.name)
      .catch((err) => this.logger.error('Failed to send project-created notification', err));

    return project;
  }

  async update(id: number, dto: UpdateProjectDto) {
    await this.findOne(id);
    const managerIds = this.managerIdsFrom(dto);
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
        ...(managerIds !== undefined && {
          projectManagerId: managerIds[0] ?? null,
          managers: { deleteMany: {}, create: managerIds.map((uid) => ({ userId: uid })) },
        }),
      },
    });
  }

  /**
   * Who may add / delete / edit a task's photos, captions, equipment and checklists:
   * technicians and staff (as before) or a Project Manager of the task's project.
   */
  async assertCanEditTaskMedia(taskId: number, user: any) {
    const roles: string[] = [
      ...(Array.isArray(user?.roles) ? user.roles.map((r: any) => (typeof r === 'string' ? r : r?.role ?? r?.name)) : []),
      ...(typeof user?.role === 'string' ? [user.role] : []),
    ];
    if (roles.some((r) => ['TECHNICIAN', 'HELP_DESK', 'SUPERVISOR', 'IT_MANAGER', 'SUPER_ADMIN'].includes(r))) return;
    const isManager = await this.prisma.projectManager.findFirst({
      where: { userId: user?.id, project: { projectStores: { some: { tasks: { some: { id: taskId } } } } } },
      select: { userId: true },
    });
    if (!isManager) throw new ForbiddenException('เฉพาะช่าง / ทีมงาน หรือ Project Manager ของโปรเจกต์นี้');
  }

  /** Task id that a photo / equipment row / checklist belongs to (for the permission check) */
  async taskIdOf(kind: 'photo' | 'equipment' | 'checklist', id: number): Promise<number> {
    const row =
      kind === 'photo'
        ? await this.prisma.projectPhoto.findUnique({ where: { id }, select: { taskId: true } })
        : kind === 'equipment'
          ? await this.prisma.projectEquipment.findUnique({ where: { id }, select: { taskId: true } })
          : await this.prisma.projectChecklist.findUnique({ where: { id }, select: { taskId: true } });
    if (!row) throw new NotFoundException(`${kind} #${id} not found`);
    return row.taskId;
  }

  /**
   * Project tasks assigned to the user that are not accepted yet (incl. waiting for verification),
   * nearest date first — shown in the technician's Incidents list —
   * and whether the user is a Project Manager of an open project (keeps the Projects menu for them).
   */
  async getMyWork(userId: number) {
    const [tasks, managed] = await Promise.all([
      this.prisma.projectTask.findMany({
        where: {
          assignedToId: userId,
          status: { notIn: ['COMPLETED', 'ACCEPTED'] },
          projectStore: { project: { status: { notIn: ['CANCELLED', 'COMPLETED'] } } },
        },
        orderBy: [{ scheduledDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
        select: {
          id: true,
          ticketNo: true,
          title: true,
          status: true,
          taskType: true,
          scheduledDate: true,
          projectStore: {
            select: {
              store: { select: { storeCode: true, name: true } },
              project: { select: { id: true, name: true, color: true } },
            },
          },
        },
      }),
      this.prisma.projectManager.count({
        where: { userId, project: { status: { notIn: ['CANCELLED', 'COMPLETED'] } } },
      }),
    ]);
    return { tasks, managesProjects: managed > 0 };
  }

  async updatePhotoComment(photoId: number, comment: string | null) {
    const text = (comment ?? '').trim();
    return this.prisma.projectPhoto.update({
      where: { id: photoId },
      data: { comment: text ? text.slice(0, 500) : null },
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

  /**
   * Create a brand-new store (status OPENING) and add it to the project in one step.
   * It becomes ACTIVE on its Opening task date (or its openDate when there is no Opening task),
   * or earlier via activateStore(). Pop-up / Event stores close automatically after closeDate.
   * A store code can't be reused while another store with that code is still open (StoresService).
   */
  async createStoreInProject(projectId: number, dto: CreateProjectStoreDto) {
    await this.findOne(projectId);
    const kind = dto.kind ?? 'PERMANENT';
    const { notes, kind: _kind, eventName, hostStoreId, ...rest } = dto;

    if (kind !== 'PERMANENT') {
      if (!dto.openDate || !dto.closeDate) throw new BadRequestException('Pop-up / Event ต้องระบุวันเปิดและวันปิด');
      if (new Date(dto.closeDate) < new Date(dto.openDate)) throw new BadRequestException('วันปิดต้องไม่ก่อนวันเปิด');
    }

    let storeData: any = { ...rest, storeType: kind, storeStatus: 'OPENING', autoClose: kind !== 'PERMANENT' };

    if (kind === 'EVENT') {
      const host = await this.prisma.store.findUnique({ where: { id: hostStoreId! } });
      if (!host) throw new NotFoundException('ไม่พบสาขาหลักของ Event');
      if (host.storeType === 'EVENT') throw new BadRequestException('สาขาหลักต้องไม่ใช่ร้าน Event');
      // Event borrows the host branch's identity; the event name tells events at the same branch apart
      storeData = {
        ...storeData,
        storeCode: host.storeCode,
        name: `${host.name} (${eventName!.trim()})`,
        company: host.company,
        province: host.province,
        address: host.address,
        district: host.district,
        subDistrict: host.subDistrict,
        postalCode: host.postalCode,
        phone: host.phone,
        googleMapLink: host.googleMapLink,
        slaRegion: host.slaRegion,
        hostStoreId: host.id,
      };
    }

    const store = await this.storesService.create(storeData);

    return this.prisma.projectStore.create({
      data: { projectId, storeId: store.id, notes },
      include: { store: { select: { id: true, storeCode: true, name: true, province: true, storeStatus: true } } },
    });
  }

  /**
   * Switch an OPENING store to ACTIVE before its opening day (e.g. to open incidents early).
   */
  async activateStore(projectId: number, storeId: number, userId: number) {
    const ps = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId } },
      include: { store: { select: { storeCode: true, name: true, storeStatus: true } } },
    });
    if (!ps) throw new NotFoundException('Store not found in this project');
    if (ps.store.storeStatus !== 'OPENING') {
      throw new BadRequestException('สาขานี้ไม่ได้อยู่ในสถานะ "กำลังเปิดร้าน"');
    }

    const store = await this.prisma.store.update({
      where: { id: storeId },
      data: { storeStatus: 'ACTIVE' },
      select: { id: true, storeCode: true, name: true, storeStatus: true },
    });
    this.logger.log(`Store ${store.storeCode} activated manually by user #${userId} (project #${projectId})`);
    return store;
  }

  /**
   * Move the planned close date of a Pop-up / Event (e.g. selling well, or the new site isn't ready).
   */
  async updateStoreCloseDate(projectId: number, storeId: number, closeDate: string, userId: number) {
    const ps = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId } },
      include: { store: { select: { storeCode: true, name: true, storeStatus: true, openDate: true, closeDate: true } } },
    });
    if (!ps) throw new NotFoundException('Store not found in this project');
    if (ps.store.storeStatus === 'PERMANENTLY_CLOSED') throw new BadRequestException('สาขานี้ปิดแล้ว');
    const date = new Date(closeDate);
    if (isNaN(date.getTime())) throw new BadRequestException('วันปิดไม่ถูกต้อง');
    if (ps.store.openDate && date < ps.store.openDate) throw new BadRequestException('วันปิดต้องไม่ก่อนวันเปิด');

    const store = await this.prisma.store.update({
      where: { id: storeId },
      data: { closeDate: date },
      select: { id: true, storeCode: true, name: true, closeDate: true },
    });
    this.logger.log(
      `Store ${store.storeCode} close date ${ps.store.closeDate?.toISOString().slice(0, 10) ?? '-'} → ${closeDate} by user #${userId}`,
    );
    return store;
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
            project: { select: { id: true, name: true, status: true, managers: { select: { userId: true } } } },
            store: { select: { id: true, storeCode: true, name: true, province: true, storeStatus: true, storeType: true, closeDate: true } },
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

    const taskType = dto.taskType ?? 'GENERAL';
    await this.assertOpeningTaskRules(ps.id, taskType, dto.scheduledDate);

    // Same ticket series as Incidents (organization prefix + YYMM + running)
    const ticketNo = await this.jobNumberService.nextTicketNumber();

    const updated = await this.prisma.projectTask.create({
      data: {
        projectStoreId: ps.id,
        ticketNo,
        taskType,
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

  /**
   * One Opening and one Closed Store task per project store.
   * Opening needs a date (the store opens that day); Closed Store closes the store when the technician completes it.
   */
  private async assertOpeningTaskRules(
    projectStoreId: number,
    taskType: 'GENERAL' | 'OPENING' | 'CLOSING',
    scheduledDate?: string | Date | null,
    excludeTaskId?: number,
  ) {
    if (taskType === 'GENERAL') return;
    if (taskType === 'OPENING' && !scheduledDate) {
      throw new BadRequestException('งาน Opening ต้องระบุวันนัด (วันเปิดร้าน)');
    }
    const other = await this.prisma.projectTask.findFirst({
      where: { projectStoreId, taskType, ...(excludeTaskId && { id: { not: excludeTaskId } }) },
      select: { ticketNo: true },
    });
    if (other) {
      const label = taskType === 'OPENING' ? 'Opening' : 'Closed Store';
      throw new BadRequestException(`สาขานี้มีงาน ${label} อยู่แล้ว (${other.ticketNo})`);
    }
  }

  async updateTask(taskId: number, dto: UpdateTaskDto, userId?: number) {
    const old = await this.findTask(taskId);

    if (dto.taskType !== undefined || dto.scheduledDate) {
      await this.assertOpeningTaskRules(
        old.projectStoreId,
        dto.taskType ?? old.taskType,
        dto.scheduledDate ?? old.scheduledDate,
        taskId,
      );
    }

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
        ...(dto.taskType !== undefined && { taskType: dto.taskType }),
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
    // Same order as the source store shows them (scheduledDate, no date last, then id) —
    // copies have no date, so the store lists them in creation order
    const sourceTasks = await this.prisma.projectTask.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, title: true },
      orderBy: [{ scheduledDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
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

  /** Work photos / equipment / checklists come after the technician's check-in */
  private assertCheckedIn(task: { checkInAt: Date | null }) {
    if (!task.checkInAt) throw new BadRequestException('ต้อง Check-in ก่อนจึงจะเพิ่มรูปงาน อุปกรณ์ หรือ Checklist ได้');
  }

  async addPhoto(taskId: number, dto: AddPhotoDto & { category?: string }) {
    const task = await this.findTask(taskId);
    this.assertCheckedIn(task);
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
    this.assertCheckedIn(await this.findTask(taskId));
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
    this.assertCheckedIn(await this.findTask(taskId));
    return this.prisma.projectChecklist.create({ data: { taskId, ...data } });
  }

  async deleteChecklist(checklistId: number) {
    const cl = await this.prisma.projectChecklist.findUnique({ where: { id: checklistId } });
    if (!cl) throw new NotFoundException(`Checklist #${checklistId} not found`);
    await this.prisma.projectChecklist.delete({ where: { id: checklistId } });
    await this.removeUpload(cl.filePath);
  }

  /**
   * Send the task for verification. The assigned technician does it, or a Project Manager of the
   * project does it on their behalf (technician had to leave the site) — the log names who pressed it.
   * Check-in stays the technician's own step (GPS proof), so the task must already be IN_PROGRESS.
   */
  async completeTask(taskId: number, userId: number) {
    const task = await this.findTask(taskId);

    const onBehalf = task.assignedToId !== userId;
    if (onBehalf && !task.projectStore.project.managers.some((m) => m.userId === userId)) {
      throw new ForbiddenException('You are not assigned to this task');
    }
    if (task.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Task must be IN_PROGRESS to complete');
    }
    const missing: string[] = [];
    if (!task.checkInPhotoPath) missing.push('รูป Check-in');
    if (!task.photos.some((p) => p.category !== 'CHECK_IN')) missing.push('รูปภาพงาน');
    if (task.checklists.length === 0) missing.push('Checklist');
    if (missing.length) throw new BadRequestException(`ต้องเพิ่ม ${missing.join(' และ ')} ก่อนปิดงาน`);

    const completedAt = new Date();
    const updated = await this.prisma.projectTask.update({
      where: { id: taskId },
      data: { status: 'PENDING_VERIFY', completedAt },
    });

    const name = task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'ช่าง';
    const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
    let message = `${name} ปิดงานและส่งตรวจสอบ ${taskLabel}`;
    if (onBehalf) {
      const pm = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
      message = `${pm ? `${pm.firstName} ${pm.lastName}` : 'Project Manager'} (PM) ส่งงานแทน ${name} — ปิดงานและส่งตรวจสอบ ${taskLabel}`;
    }
    await this.prisma.projectTaskLog.create({
      data: { taskId, userId, action: 'COMPLETE', message },
    });

    // Closed Store: the store closes on the day the technician finishes the job.
    // It stays closed even if the task is later sent back — the shop front is already closed.
    if (task.taskType === 'CLOSING' && task.projectStore.store.storeStatus !== 'PERMANENTLY_CLOSED') {
      const store = task.projectStore.store;
      await this.prisma.store.update({
        where: { id: store.id },
        data: { storeStatus: 'PERMANENTLY_CLOSED', closeDate: completedAt },
      });
      await this.prisma.projectTaskLog.create({
        data: { taskId, userId, action: 'STORE_CLOSED', message: `ปิดสาขา ${store.storeCode} ${store.name} (ปิดถาวร) จากงาน Closed Store` },
      });
    }

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
    const verifier = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const name = verifier ? `${verifier.firstName} ${verifier.lastName}` : 'ผู้ตรวจสอบ';
    const taskLabel = task.title || task.ticketNo || `Task #${taskId}`;
    const storeId = task.projectStore.storeId;

    // Accept + push the task's equipment into the store's register atomically
    const { updated, sync } = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.projectTask.update({
        where: { id: taskId },
        data: { status: 'ACCEPTED', verifiedAt, verifiedById: userId },
      });
      const sync = await this.syncTaskEquipment(tx, taskId, storeId, task.equipment, userId, task.ticketNo || taskLabel);
      await tx.projectTaskLog.create({
        data: { taskId, userId, action: 'VERIFY', message: `${name} ยืนยันปิดงาน (ACCEPTED) ${taskLabel}` },
      });
      if (sync.created + sync.moved + sync.updated + sync.removed > 0) {
        await tx.projectTaskLog.create({
          data: {
            taskId,
            userId,
            action: 'EQUIPMENT_SYNC',
            message: `อัปเดตทะเบียนอุปกรณ์ของสาขา: เพิ่มใหม่ ${sync.created}, ย้ายเข้า ${sync.moved}, อัปเดต ${sync.updated}, ถอดออก ${sync.removed}`,
          },
        });
      }
      return { updated, sync };
    });

    if (sync.created + sync.moved + sync.removed > 0) {
      syncOpenPmEquipment(this.prisma, [storeId, ...sync.fromStoreIds]).catch((err) =>
        this.logger.error('Failed to sync open PM equipment', err),
      );
    }

    // Send close-notification email (fire-and-forget — don't block response)
    this.sendVerifyNotificationEmail(task, verifier, verifiedAt).catch((err) =>
      this.logger.error('Failed to send verify notification email', err),
    );

    return updated;
  }

  /**
   * Apply a verified task's equipment rows to the store's Equipment register.
   * - new S/N: create it in this store, or move/update the existing record (S/N is unique system-wide)
   * - old S/N (the unit taken out): mark INACTIVE when it is still ACTIVE in this store
   * Every change is written to equipment_logs with source PROJECT and sourceId = task id.
   */
  private async syncTaskEquipment(
    tx: Prisma.TransactionClient,
    taskId: number,
    storeId: number,
    rows: { itemName: string; oldSN: string | null; newModel: string | null; newSN: string | null }[],
    userId: number,
    ref: string,
  ) {
    const res = { created: 0, moved: 0, updated: 0, removed: 0, fromStoreIds: [] as number[] };
    const logBase = { source: EquipmentLogSource.PROJECT, sourceId: String(taskId), changedBy: userId };

    for (const row of rows) {
      const newSN = row.newSN?.trim() || null;
      const oldSN = row.oldSN?.trim() || null;
      const newModel = row.newModel?.trim() || null;

      if (oldSN && oldSN !== newSN) {
        const old = await tx.equipment.findUnique({ where: { serialNumber: oldSN } });
        if (old && old.storeId === storeId && old.status === EquipmentStatus.ACTIVE) {
          await tx.equipment.update({ where: { id: old.id }, data: { status: EquipmentStatus.INACTIVE } });
          await tx.equipmentLog.create({
            data: {
              ...logBase,
              equipmentId: old.id,
              action: EquipmentLogAction.REPLACED_OUT,
              description: `ถอดออกจากงานโปรเจกต์ ${ref}${newSN ? ` (แทนด้วย S/N ${newSN})` : ''}`,
              oldValue: { status: old.status },
              newValue: { status: EquipmentStatus.INACTIVE },
            },
          });
          res.removed++;
        }
      }

      if (!newSN) continue;
      const existing = await tx.equipment.findUnique({ where: { serialNumber: newSN } });

      if (!existing) {
        const created = await tx.equipment.create({
          data: { serialNumber: newSN, name: row.itemName, category: row.itemName, model: newModel, storeId, status: EquipmentStatus.ACTIVE },
        });
        await tx.equipmentLog.create({
          data: {
            ...logBase,
            equipmentId: created.id,
            action: EquipmentLogAction.CREATED,
            description: `เพิ่มจากงานโปรเจกต์ ${ref}`,
            newValue: { name: created.name, serialNumber: newSN, model: newModel, storeId },
          },
        });
        res.created++;
      } else if (existing.storeId !== storeId) {
        await tx.equipment.update({
          where: { id: existing.id },
          data: { storeId, status: EquipmentStatus.ACTIVE, ...(newModel && { model: newModel }) },
        });
        await tx.equipmentLog.create({
          data: {
            ...logBase,
            equipmentId: existing.id,
            action: EquipmentLogAction.TRANSFERRED,
            description: `ย้ายเข้าสาขาจากงานโปรเจกต์ ${ref}`,
            oldValue: { storeId: existing.storeId, status: existing.status },
            newValue: { storeId, status: EquipmentStatus.ACTIVE },
          },
        });
        res.moved++;
        res.fromStoreIds.push(existing.storeId);
      } else {
        const data: Prisma.EquipmentUpdateInput = {};
        if (existing.status !== EquipmentStatus.ACTIVE) data.status = EquipmentStatus.ACTIVE;
        if (newModel && newModel !== existing.model) data.model = newModel;
        if (Object.keys(data).length > 0) {
          await tx.equipment.update({ where: { id: existing.id }, data });
          await tx.equipmentLog.create({
            data: {
              ...logBase,
              equipmentId: existing.id,
              action: EquipmentLogAction.UPDATED,
              description: `อัปเดตจากงานโปรเจกต์ ${ref}`,
              oldValue: { status: existing.status, model: existing.model },
              newValue: data as any,
            },
          });
          res.updated++;
        }
      }
    }
    return res;
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
