/**
 * Backfill IncidentAssignee records for outsource jobs that were AWARDED
 * but missing the junction table entry (causing jobs not to appear in "My Incidents").
 *
 * Run: npx ts-node prisma/backfill-outsource-assignees.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all awarded outsource jobs that have an awardedToId
  const awardedJobs = await prisma.outsourceJob.findMany({
    where: {
      status: { in: ['AWARDED', 'IN_PROGRESS', 'COMPLETED', 'DOCUMENT_SUBMITTED', 'VERIFIED'] },
      awardedToId: { not: null },
    },
    select: {
      id: true,
      jobCode: true,
      incidentId: true,
      awardedToId: true,
    },
  });

  console.log(`Found ${awardedJobs.length} awarded outsource jobs to check.`);

  let created = 0;
  let skipped = 0;

  for (const job of awardedJobs) {
    const result = await prisma.incidentAssignee.upsert({
      where: {
        incidentId_userId: {
          incidentId: job.incidentId!,
          userId: job.awardedToId!,
        },
      },
      create: {
        incidentId: job.incidentId!,
        userId: job.awardedToId!,
      },
      update: {},
    });

    // Check if it was newly created or already existed
    const existing = await prisma.incidentAssignee.findUnique({
      where: {
        incidentId_userId: {
          incidentId: job.incidentId!,
          userId: job.awardedToId!,
        },
      },
    });

    if (existing) {
      console.log(`  ✔ ${job.jobCode} (incident ${job.incidentId}) → user ${job.awardedToId}`);
      created++;
    }
  }

  console.log(`\nDone. ${created} records ensured, ${skipped} already existed.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
