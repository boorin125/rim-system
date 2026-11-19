// src/modules/project/project-public.controller.ts
// Public read-only Project Task view (no login) — the "ดูรายละเอียดงาน" link of the close email.
// Same idea as /public/incidents/:token, but the token never expires.

import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { workTypeDef } from './work-types';

const PHASE_LABEL: Record<string, string> = { BEFORE: 'ก่อน', AFTER: 'หลัง' };

@Controller('public/project-tasks')
export class ProjectPublicController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':token')
  async getTaskByToken(@Param('token') token: string) {
    // UUID tokens only — anything else is a wrong link (and never hits the DB)
    if (!/^[0-9a-f-]{36}$/i.test(token || '')) {
      throw new NotFoundException('ไม่พบข้อมูลงาน หรือลิงก์ไม่ถูกต้อง');
    }

    const task = await this.prisma.projectTask.findUnique({
      where: { publicToken: token },
      include: {
        projectStore: {
          select: {
            project: { select: { name: true, color: true } },
            store: { select: { storeCode: true, name: true, province: true, address: true } },
          },
        },
        assignedTo: { select: { firstName: true, lastName: true } },
        photos: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        testResults: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        equipment: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('ไม่พบข้อมูลงาน หรือลิงก์ไม่ถูกต้อง');

    const orgConfigs = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['organization_name', 'organization_logo'] } },
    });
    const org = Object.fromEntries(orgConfigs.map((c) => [c.key, c.value]));

    const def = workTypeDef(task.workType);
    const sectionLabel = (key: string | null) => (key && def.sections.find((s) => s.key === key)?.label) || null;

    // Photo groups: Check-in first, then each evidence section, then plain work photos
    const groups = new Map<string, { title: string; photos: { path: string; caption: string | null }[] }>();
    const add = (key: string, title: string, path: string, caption: string | null) => {
      if (!groups.has(key)) groups.set(key, { title, photos: [] });
      const g = groups.get(key)!;
      if (!g.photos.some((p) => p.path === path)) g.photos.push({ path, caption });
    };
    if (task.checkInPhotoPath) add('CHECK_IN', 'Check-in', task.checkInPhotoPath, null);
    for (const p of task.photos) {
      const caption = [p.pointName, p.phase ? PHASE_LABEL[p.phase] ?? p.phase : null, p.comment].filter(Boolean).join(' · ') || null;
      if (p.category === 'CHECK_IN') add('CHECK_IN', 'Check-in', p.photoPath, caption);
      else if (p.section) add(`S:${p.section}`, sectionLabel(p.section) || p.section, p.photoPath, caption);
      else add('WORK', 'รูปงาน', p.photoPath, caption);
    }

    // Test results grouped by section (each section label from the work type)
    const testSections: { title: string; items: { itemName: string; result: string; note: string | null; photoPath: string | null }[] }[] = [];
    for (const t of task.testResults) {
      const title = sectionLabel(t.section) || t.section;
      let sec = testSections.find((s) => s.title === title);
      if (!sec) testSections.push((sec = { title, items: [] }));
      sec.items.push({ itemName: t.itemName, result: t.result, note: t.note, photoPath: t.photoPath });
    }

    const store = task.projectStore.store;
    // Sanitized public data — no internal ids, no phone / email, no rejection notes or logs
    return {
      organizationName: org['organization_name'] || '',
      organizationLogo: org['organization_logo'] || '',
      ticketNo: task.ticketNo,
      title: task.title,
      workType: def.key === 'GENERAL' ? null : def.label,
      status: task.status,
      notes: task.notes,
      project: { name: task.projectStore.project.name, color: task.projectStore.project.color || '#3b82f6' },
      store: { storeCode: store.storeCode, name: store.name, province: store.province, address: store.address },
      technician: task.assignedTo ? { name: `${task.assignedTo.firstName} ${task.assignedTo.lastName}` } : null,
      scheduledDate: task.scheduledDate,
      checkInAt: task.checkInAt,
      completedAt: task.completedAt,
      verifiedAt: task.verifiedAt,
      photoGroups: [...groups.values()],
      testSections,
      equipment: task.equipment.map((e) => ({
        itemName: e.itemName,
        oldModel: e.oldModel,
        oldSN: e.oldSN,
        newModel: e.newModel,
        newSN: e.newSN,
        notes: e.notes,
      })),
    };
  }
}
