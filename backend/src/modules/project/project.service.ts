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
import { randomUUID } from 'crypto';
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
import { WORK_TYPES, workTypeDef, evaluateEvidence } from './work-types';

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

/** Closed = accepted by Help Desk (COMPLETED is the older name of the same end state) */
const CLOSED_TASK_STATUSES = ['ACCEPTED', 'COMPLETED'];

/**
 * Close-email colours from Project.color, as plain hex (email clients ignore CSS variables / color-mix):
 * c = project colour, on = text on it, tint ≈ 9% / border ≈ 28% / bg ≈ 6% of the colour over white.
 */
function projectEmailTheme(color?: string | null) {
  const c = /^#[0-9a-f]{6}$/i.test(color ?? '') ? (color as string).toLowerCase() : '#3b82f6';
  const rgb = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const mix = (t: number) =>
    '#' + rgb.map((v) => Math.round(v * t + 255 * (1 - t)).toString(16).padStart(2, '0')).join('');
  return { c, on: lum > 0.4 ? '#1f2937' : '#ffffff', tint: mix(0.09), border: mix(0.28), bg: mix(0.06) };
}

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
    // Closed Store tasks made before work types existed (task type CLOSING) → work type CLOSED_STORE
    await this.prisma.projectTask
      .updateMany({ where: { taskType: 'CLOSING', workType: 'GENERAL' }, data: { workType: 'CLOSED_STORE' } })
      .catch((err) => this.logger.error('Closed Store work type backfill failed', err));
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
  /** A closed task (accepted by Help Desk) is read-only for every role — its data is what the close email reported */
  private assertTaskOpen(task: { status: string }) {
    if (CLOSED_TASK_STATUSES.includes(task.status)) {
      throw new BadRequestException('งานนี้ปิดแล้ว — แก้ไขไม่ได้');
    }
  }

  async assertCanEditTaskMedia(taskId: number, user: any) {
    const current = await this.prisma.projectTask.findUnique({ where: { id: taskId }, select: { status: true } });
    if (current) this.assertTaskOpen(current);
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
          workType: true,
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

  /** Edit a photo's caption and/or point name (fields left undefined are kept) */
  async updatePhoto(photoId: number, data: { comment?: string | null; pointName?: string | null }) {
    const clean = (v: string | null | undefined, max: number) => {
      const t = (v ?? '').trim();
      return t ? t.slice(0, max) : null;
    };
    return this.prisma.projectPhoto.update({
      where: { id: photoId },
      data: {
        ...(data.comment !== undefined && { comment: clean(data.comment, 500) }),
        ...(data.pointName !== undefined && { pointName: clean(data.pointName, 100) }),
      },
    });
  }

  async taskIdOfTestResult(id: number) {
    const row = await this.prisma.projectTestResult.findUnique({ where: { id }, select: { taskId: true } });
    if (!row) throw new NotFoundException(`Test result #${id} not found`);
    return row.taskId;
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
            project: { select: { id: true, name: true, status: true, color: true, managers: { select: { userId: true } } } },
            store: { select: { id: true, storeCode: true, name: true, province: true, storeStatus: true, storeType: true, closeDate: true } },
          },
        },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarPath: true, phone: true } },
        verifiedBy: { select: { id: true, firstName: true, lastName: true } },
        photos: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        testResults: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        equipment: { orderBy: { createdAt: 'asc' } },
        checklists: { orderBy: { uploadedAt: 'asc' } },
        logs: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });

    if (!task) throw new NotFoundException(`Task #${taskId} not found`);
    // Evidence progress for the task's work type (the UI shows it; completeTask enforces it)
    return { ...task, evidence: evaluateEvidence(task.workType, task) };
  }

  /** Work types and the evidence each needs (UI: task forms + evidence sections) */
  getWorkTypes() {
    return WORK_TYPES;
  }

  async createTask(projectId: number, storeId: number, dto: CreateTaskDto) {
    const ps = await this.prisma.projectStore.findUnique({
      where: { projectId_storeId: { projectId, storeId } },
    });
    if (!ps) throw new NotFoundException('Store not found in this project');

    const { taskType, workType } = this.resolveTaskTypes(dto.taskType, dto.workType);
    await this.assertOpeningTaskRules(ps.id, taskType, dto.scheduledDate);

    // Same ticket series as Incidents (organization prefix + YYMM + running)
    const ticketNo = await this.jobNumberService.nextTicketNumber();

    const updated = await this.prisma.projectTask.create({
      data: {
        projectStoreId: ps.id,
        ticketNo,
        taskType,
        workType,
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
   * Work type and task type go together for Closed Store: work type CLOSED_STORE ⇔ task type CLOSING
   * (closes the store on completion). OPENING (store opening day) is a flag on any work type.
   */
  private resolveTaskTypes(
    taskType: 'GENERAL' | 'OPENING' | 'CLOSING' | undefined,
    workType: string | undefined,
    old?: { taskType: 'GENERAL' | 'OPENING' | 'CLOSING'; workType: string },
  ) {
    let t = taskType ?? old?.taskType ?? 'GENERAL';
    let w = workType ?? old?.workType ?? 'GENERAL';
    if (workType === 'CLOSED_STORE' || (workType === undefined && taskType === 'CLOSING')) {
      t = 'CLOSING';
      w = 'CLOSED_STORE';
    } else if (workType !== undefined && t === 'CLOSING') {
      t = 'GENERAL'; // moved away from Closed Store
    }
    return { taskType: t, workType: w as any };
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
    this.assertTaskOpen(old);
    const typesChanged = dto.taskType !== undefined || dto.workType !== undefined;
    const types = this.resolveTaskTypes(dto.taskType, dto.workType, old);

    if (typesChanged || dto.scheduledDate) {
      await this.assertOpeningTaskRules(
        old.projectStoreId,
        types.taskType,
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
        ...(typesChanged && { taskType: types.taskType, workType: types.workType }),
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
    this.assertTaskOpen(task);
    await this.prisma.projectTask.delete({ where: { id: taskId } });
    await Promise.all([
      this.removeUpload(task.checkInPhotoPath),
      ...task.photos.map((p) => this.removeUpload(p.photoPath)),
      ...task.testResults.map((t) => this.removeUpload(t.photoPath)),
      ...task.checklists.map((c) => this.removeUpload(c.filePath)),
    ]);
  }

  async duplicateTasks(projectId: number, taskIds: number[], targetStoreIds: number[]) {
    // Same order as the source store shows them (scheduledDate, no date last, then id) —
    // copies have no date, so the store lists them in creation order
    const sourceTasks = await this.prisma.projectTask.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, title: true, workType: true },
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

        // Same work type; Closed Store keeps its one-per-store rule
        const { taskType, workType } = this.resolveTaskTypes(undefined, src.workType);
        if (taskType === 'CLOSING') {
          try {
            await this.assertOpeningTaskRules(ps.id, 'CLOSING');
          } catch {
            skipped.push({ title: src.title || '', storeName, reason: 'สาขาปลายทางมีงาน Closed Store อยู่แล้ว' });
            continue;
          }
        }
        const ticketNo = await this.jobNumberService.nextTicketNumber();
        await this.prisma.projectTask.create({
          data: { projectStoreId: ps.id, ticketNo, title: src.title, status: 'PENDING', taskType, workType },
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
    this.assertTaskOpen(task);

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

  async addPhoto(
    taskId: number,
    dto: AddPhotoDto & { category?: string; section?: string; phase?: string; pointName?: string },
  ) {
    const task = await this.findTask(taskId);
    this.assertCheckedIn(task);
    if (dto.section) this.assertSection(task.workType, dto.section, ['photos', 'beforeAfter']);
    if (dto.phase && !['BEFORE', 'AFTER'].includes(dto.phase)) throw new BadRequestException('phase ต้องเป็น BEFORE หรือ AFTER');
    return this.prisma.projectPhoto.create({
      data: {
        taskId,
        photoPath: dto.photoPath,
        comment: dto.comment,
        sortOrder: dto.sortOrder ?? 0,
        category: dto.category ?? 'WORK',
        section: dto.section || null,
        phase: dto.phase || null,
        pointName: dto.pointName?.trim().slice(0, 100) || null,
      },
    });
  }

  /** The section must exist in the task's work type and be of an allowed kind */
  private assertSection(workType: string, section: string, kinds: string[]) {
    const s = workTypeDef(workType).sections.find((x) => x.key === section);
    if (!s || !kinds.includes(s.kind)) throw new BadRequestException(`หัวข้อหลักฐาน "${section}" ไม่ตรงกับประเภทงานนี้`);
    return s;
  }

  /** Save one test item (create or update by section + item name); a new photo replaces the old one */
  async saveTestResult(
    taskId: number,
    data: { section: string; itemName: string; result: string; note?: string; photoPath?: string },
  ) {
    const task = await this.findTask(taskId);
    this.assertCheckedIn(task);
    this.assertSection(task.workType, data.section, ['tests']);
    const itemName = (data.itemName || '').trim().slice(0, 150);
    if (!itemName) throw new BadRequestException('ต้องระบุชื่อหัวข้อทดสอบ');
    if (!['PASS', 'FAIL', 'NA'].includes(data.result)) throw new BadRequestException('ผลทดสอบต้องเป็น PASS / FAIL / NA');

    const existing = await this.prisma.projectTestResult.findUnique({
      where: { taskId_section_itemName: { taskId, section: data.section, itemName } },
    });
    const row = await this.prisma.projectTestResult.upsert({
      where: { taskId_section_itemName: { taskId, section: data.section, itemName } },
      create: {
        taskId,
        section: data.section,
        itemName,
        result: data.result,
        note: data.note?.trim() || null,
        photoPath: data.photoPath ?? null,
      },
      update: {
        result: data.result,
        note: data.note !== undefined ? data.note.trim() || null : undefined,
        ...(data.photoPath && { photoPath: data.photoPath }),
      },
    });
    if (data.photoPath && existing?.photoPath && existing.photoPath !== data.photoPath) {
      await this.removeUpload(existing.photoPath);
    }
    return row;
  }

  async deleteTestResult(id: number) {
    const row = await this.prisma.projectTestResult.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Test result #${id} not found`);
    await this.prisma.projectTestResult.delete({ where: { id } });
    await this.removeUpload(row.photoPath);
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
    // Evidence required by the work type (GENERAL: work photo + checklist file)
    const missing: string[] = [];
    if (!task.checkInPhotoPath) missing.push('รูป Check-in');
    for (const s of task.evidence) missing.push(...s.missing);
    if (missing.length) throw new BadRequestException(`ยังขาด: ${missing.join(' · ')}`);

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
    this.sendVerifyNotificationEmail(task).catch((err) =>
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

  private async sendVerifyNotificationEmail(task: Awaited<ReturnType<typeof this.findTask>>) {
    // Same recipients as Incident close notifications (Settings › Email)
    const emailSettings = await this.settingsService.getEmailSettings();
    const to = emailSettings?.closeNotificationTo?.trim();
    if (!to) return null; // no recipient configured

    const cc = emailSettings?.closeNotificationCc
      ? emailSettings.closeNotificationCc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : [];

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ticketNo = task.ticketNo || '';
    const taskTitle = task.title || task.ticketNo || `Task #${task.id}`;
    const projectName = task.projectStore?.project?.name || '-';
    const storeCode = task.projectStore?.store?.storeCode || '';
    const storeName = task.projectStore?.store?.name || '';
    const store = [storeCode, storeName].filter(Boolean).join(' ') || '-';
    const province = task.projectStore?.store?.province || '';
    const techName = task.assignedTo
      ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
      : '-';

    // Theme from the project colour — plain hex values (email clients ignore CSS variables / color-mix)
    const theme = projectEmailTheme(task.projectStore?.project?.color);

    // App name of this server (Settings › Organization), shown in the footer
    const appNameCfg = await this.prisma.systemConfig.findUnique({ where: { key: 'pwa_app_name' } });
    const appName = appNameCfg?.value?.trim() || 'RIM System';

    // Permanent public link — created once, the same token on every resend
    const publicToken = await this.ensurePublicToken(task.id, task.publicToken);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const publicLink = `${frontendUrl}/project-task/${publicToken}`;

    // Photos of the job: check-in, work / evidence photos (point + before/after), test-result photos
    const PHASE: Record<string, string> = { BEFORE: 'ก่อน', AFTER: 'หลัง' };
    const allPhotos: Array<{ path: string; caption?: string }> = [
      ...(task.checkInPhotoPath ? [{ path: task.checkInPhotoPath, caption: 'Check-in' }] : []),
      ...task.photos.map((p) => ({
        path: p.photoPath,
        caption: [p.pointName, p.phase ? PHASE[p.phase] ?? p.phase : null, p.comment].filter(Boolean).join(' · ') || undefined,
      })),
      ...task.testResults
        .filter((t) => t.photoPath)
        .map((t) => ({ path: t.photoPath as string, caption: `${t.itemName}: ${t.result}` })),
    ];
    const MAX_PHOTOS = 40; // keeps the email a few MB at most
    const grid = await this.emailService.buildEmailPhotoGrid(allPhotos.slice(0, MAX_PHOTOS), {
      cidPrefix: `task-${task.id}`,
      cols: 3,
      size: 176,
    });
    const photosHtml = grid.html
      ? `
    <tr><td style="padding:18px 30px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="border-left:4px solid ${theme.c};padding:2px 0 2px 10px;font-size:15px;font-weight:bold;color:#111827;">📷 รูปงาน <span style="font-weight:normal;color:#6b7280;font-size:13px;">(${allPhotos.length} รูป)</span></td>
      </tr></table>
      <div style="margin-top:12px;">${grid.html}</div>
      ${allPhotos.length > MAX_PHOTOS ? `<div style="font-size:11px;color:#9ca3af;margin-top:6px;">ดูรูปทั้งหมดได้ที่ "ดูรายละเอียดงาน"</div>` : ''}
    </td></tr>`
      : '';

    // "22 ตุลาคม 2569 · 09:30" (Thai time regardless of the container TZ)
    const fmtDate = (d: Date | null) =>
      d
        ? `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })} · ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok' })}`
        : '-';

    const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${theme.c};margin-right:6px;"></span>`;
    const labelCell = (label: string, last = false) =>
      `<td width="34%" style="padding:11px 14px;background:${theme.tint};font-weight:bold;font-size:13px;color:#374151;${last ? '' : `border-bottom:1px solid ${theme.border};`}">${label}</td>`;
    const valueStyle = (last = false) =>
      `padding:11px 14px;font-size:14px;color:#111827;${last ? '' : `border-bottom:1px solid ${theme.border};`}`;
    const resolution = `เจ้าหน้าที่เข้าดำเนินการ ${taskTitle} ${projectName} ${store} เรียบร้อยแล้ว`;

    const html = `<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Confirm Close · ${esc(taskTitle)}</title></head>
<body style="margin:0;padding:0;background:${theme.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${theme.bg};padding:24px 0;">
<tr><td align="center">
  <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${theme.border};font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#1f2937;">

    <!-- HEADER -->
    <tr><td style="background:${theme.c};height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
    <tr><td style="padding:22px 30px 18px;background:#ffffff;border-bottom:3px solid ${theme.c};">
      <div style="font-size:24px;line-height:1.3;font-weight:bold;color:#111827;">Confirm Close · ${esc(taskTitle)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;"><tr>
        <td valign="top" style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;font-weight:bold;">
          ${dot}PROJECT · ${esc(`${projectName} ${store}`)}
          ${province ? `<div style="font-size:12px;letter-spacing:0;text-transform:none;font-weight:normal;color:#6b7280;margin:3px 0 0 16px;">${esc(province)}</div>` : ''}
        </td>
        ${ticketNo ? `<td valign="top" align="right" style="white-space:nowrap;padding-left:12px;">
          <span style="display:inline-block;border:2px solid ${theme.c};color:#111827;border-radius:6px;padding:3px 12px;font-size:13px;font-weight:bold;letter-spacing:.5px;">${esc(ticketNo)}</span>
        </td>` : ''}
      </tr></table>
    </td></tr>

    <!-- OVERVIEW -->
    <tr><td style="padding:24px 30px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${theme.border};border-radius:8px;border-collapse:separate;overflow:hidden;">
        <tr>
          ${labelCell('Task')}
          <td style="padding:11px 14px;border-bottom:1px solid ${theme.border};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:14px;font-weight:bold;color:#111827;">${esc(taskTitle)}</td>
              <td align="right" style="white-space:nowrap;">
                <span style="display:inline-block;background:#dcfce7;color:#15803d;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:bold;">✓ ปิดงานแล้ว</span>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr>${labelCell('Project')}<td style="${valueStyle()}">${dot}${esc(projectName)}</td></tr>
        <tr>${labelCell('Store')}<td style="${valueStyle()}">${esc(store)}</td></tr>
        <tr>${labelCell('Technician', true)}<td style="${valueStyle(true)}">${esc(techName)}</td></tr>
      </table>
    </td></tr>

    <!-- TIMELINE -->
    <tr><td style="padding:14px 30px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="49%" valign="top" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">เวลาเริ่มงาน (Check-in)</div>
          <div style="font-size:14px;color:#111827;margin-top:3px;">${fmtDate(task.checkInAt)}</div>
        </td>
        <td width="2%"></td>
        <td width="49%" valign="top" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;">
          <div style="font-size:11px;color:#15803d;text-transform:uppercase;letter-spacing:.5px;">เวลาปิดงาน (Resolve)</div>
          <div style="font-size:14px;color:#15803d;font-weight:bold;margin-top:3px;">${fmtDate(task.completedAt)}</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- RESOLUTION -->
    <tr><td style="padding:14px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="background:${theme.tint};border-left:4px solid ${theme.c};border-radius:0 8px 8px 0;padding:12px 16px;font-size:14px;line-height:1.6;color:#111827;">
          <b>Resolution:</b> ${esc(resolution)}
        </td>
      </tr></table>
    </td></tr>
${photosHtml}
    <!-- CTA : public link -->
    <tr><td align="center" style="padding:18px 30px 26px;">
      <a href="${publicLink}" style="display:inline-block;background:${theme.c};color:${theme.on};text-decoration:none;font-weight:bold;font-size:15px;padding:13px 30px;border-radius:8px;">🔗 ดูรายละเอียดงาน</a>
    </td></tr>

    <!-- FOOTER -->
    <tr><td style="padding:18px 30px 22px;border-top:1px solid ${theme.border};text-align:center;color:#9ca3af;font-size:12px;">
      <div>Automated message from ${esc(appName)} · Please do not reply</div>
      <div style="margin-top:4px;">© ${new Date().getFullYear()} RIM System. All rights reserved.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

    await this.emailService.sendEmail({
      to,
      ...(cc.length > 0 && { cc }),
      subject: `✅ Confirm Close ${taskTitle} ${projectName} ${store}`,
      html,
      attachments: grid.attachments,
    });
    return { to, cc };
  }

  /** The task's permanent public-link token — created on first use, never replaced (resend keeps the same link) */
  private async ensurePublicToken(taskId: number, current: string | null) {
    if (current) return current;
    const created = await this.prisma.projectTask.updateMany({
      where: { id: taskId, publicToken: null },
      data: { publicToken: randomUUID() },
    });
    // Whether we set it or a concurrent send did, read back the stored one
    const row = await this.prisma.projectTask.findUnique({ where: { id: taskId }, select: { publicToken: true } });
    if (!row?.publicToken) throw new Error(`Failed to create public token for task #${taskId} (${created.count})`);
    return row.publicToken;
  }

  /** IT Manager: send the close email of a closed task again (e.g. the first send failed or a recipient was added) */
  async resendCloseEmail(taskId: number, userId: number) {
    const task = await this.findTask(taskId);
    if (!CLOSED_TASK_STATUSES.includes(task.status) || !task.verifiedAt) {
      throw new BadRequestException('ส่งอีเมลได้เฉพาะงานที่ยืนยันปิดงานแล้ว');
    }
    const sent = await this.sendVerifyNotificationEmail(task);
    if (!sent) throw new BadRequestException('ยังไม่ได้ตั้งผู้รับอีเมลแจ้งปิดงาน (Settings › Email)');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
    await this.prisma.projectTaskLog.create({
      data: {
        taskId,
        userId,
        action: 'RESEND_EMAIL',
        message: `${user ? `${user.firstName} ${user.lastName}` : 'IT Manager'} ส่งอีเมลปิดงานอีกครั้ง ถึง ${[sent.to, ...sent.cc].join(', ')}`,
      },
    });
    return sent;
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
