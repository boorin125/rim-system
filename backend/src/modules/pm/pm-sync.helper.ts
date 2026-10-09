// src/modules/pm/pm-sync.helper.ts
//
// Keeps the equipment list of OPEN PM jobs in sync with the store's real equipment.
// Plain functions (no DI) so Equipment / Incidents / PM services can all call them
// without circular module imports.

import { EquipmentStatus, IncidentStatus } from '@prisma/client';

/** Equipment statuses that belong on a PM checklist (same rule as createPmRecord) */
export const PM_EQUIPMENT_STATUSES: EquipmentStatus[] = [EquipmentStatus.ACTIVE, EquipmentStatus.MAINTENANCE];

/** PM job is still editable: not yet tech-confirmed / resolved / closed */
export const OPEN_PM_INCIDENT_WHERE = {
  jobType: 'Preventive Maintenance',
  status: { in: [IncidentStatus.OPEN, IncidentStatus.PENDING, IncidentStatus.ASSIGNED, IncidentStatus.IN_PROGRESS] },
  techConfirmedAt: null,
};

const hasPhotos = (r: { beforePhotos: string[]; afterPhotos: string[] }) =>
  (r.beforePhotos?.length ?? 0) > 0 || (r.afterPhotos?.length ?? 0) > 0;

/**
 * Add / remove PmEquipmentRecords of open PM jobs in the given stores so they match
 * the store's ACTIVE/MAINTENANCE equipment. Records that already have photos are never
 * removed (photo = equipment really exists; photos must be deleted first).
 */
export async function syncOpenPmEquipment(prisma: any, storeIds: Array<number | null | undefined>) {
  const ids = Array.from(new Set(storeIds.filter((v): v is number => typeof v === 'number')));
  if (ids.length === 0) return;

  const openPms = await prisma.pmRecord.findMany({
    where: { storeId: { in: ids }, incident: OPEN_PM_INCIDENT_WHERE },
    select: {
      id: true,
      storeId: true,
      equipmentRecords: { select: { id: true, equipmentId: true, beforePhotos: true, afterPhotos: true } },
    },
  });
  if (openPms.length === 0) return;

  for (const pm of openPms) {
    const storeEquipment = await prisma.equipment.findMany({
      where: { storeId: pm.storeId, status: { in: PM_EQUIPMENT_STATUSES } },
      select: { id: true },
    });
    const wanted = new Set<number>(storeEquipment.map((e: { id: number }) => e.id));
    const existing = new Set<number>(pm.equipmentRecords.map((r: { equipmentId: number }) => r.equipmentId));

    const toAdd = [...wanted].filter((id) => !existing.has(id));
    const toRemove = pm.equipmentRecords
      .filter((r: any) => !wanted.has(r.equipmentId) && !hasPhotos(r))
      .map((r: any) => r.id);

    if (toAdd.length > 0) {
      await prisma.pmEquipmentRecord.createMany({
        data: toAdd.map((equipmentId) => ({ pmRecordId: pm.id, equipmentId })),
        skipDuplicates: true,
      });
    }
    if (toRemove.length > 0) {
      await prisma.pmEquipmentRecord.deleteMany({ where: { id: { in: toRemove } } });
    }
  }
}

/**
 * Returns the ticket number of an open PM job where this equipment already has photos,
 * or null. Used to block deleting / removing equipment that was photographed in PM.
 */
export async function findOpenPmPhotoLock(prisma: any, equipmentId: number): Promise<string | null> {
  const records = await prisma.pmEquipmentRecord.findMany({
    where: { equipmentId, pmRecord: { incident: OPEN_PM_INCIDENT_WHERE } },
    select: {
      beforePhotos: true,
      afterPhotos: true,
      pmRecord: { select: { incident: { select: { ticketNumber: true } } } },
    },
  });
  const locked = records.find(hasPhotos);
  return locked ? (locked.pmRecord.incident.ticketNumber ?? 'PM') : null;
}

/** Sync every store that currently has an open PM (used after bulk imports) */
export async function syncAllOpenPmEquipment(prisma: any) {
  const openPms = await prisma.pmRecord.findMany({
    where: { incident: OPEN_PM_INCIDENT_WHERE },
    select: { storeId: true },
  });
  await syncOpenPmEquipment(prisma, openPms.map((p: { storeId: number }) => p.storeId));
}
