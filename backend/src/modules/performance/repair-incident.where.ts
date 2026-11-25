// src/modules/performance/repair-incident.where.ts
// Which incidents count as a repair request. Shared by Performance (Top 10 Category, equipment boxes)
// and the Integration API stats (RIM Demand v1) so both always give the same numbers.
import { IncidentStatus, Prisma } from '@prisma/client';

/** Repair requests: PM jobs ("Preventive Maintenance") and cancelled incidents are excluded */
export function repairIncidentWhere(jobTypes?: string[]): Prisma.IncidentWhereInput {
  return {
    status: { notIn: [IncidentStatus.CANCELLED] },
    jobType: jobTypes?.length
      ? { in: jobTypes.filter((jt) => jt !== 'Preventive Maintenance') }
      : { not: 'Preventive Maintenance' },
  };
}
