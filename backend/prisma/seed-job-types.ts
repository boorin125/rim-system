// prisma/seed-job-types.ts
// Adds Preventive Maintenance job type (and ensures other default job types exist)
// Run: npx ts-node prisma/seed-job-types.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultJobTypes = [
  { name: 'Incident', color: '#EF4444', sortOrder: 1 },
  { name: 'MA', color: '#3B82F6', sortOrder: 2 },
  { name: 'Project', color: '#8B5CF6', sortOrder: 3 },
  { name: 'Adhoc', color: '#F59E0B', sortOrder: 4 },
  { name: 'Preventive Maintenance', color: '#A855F7', sortOrder: 5, description: 'งาน PM ตรวจสอบและบำรุงรักษาอุปกรณ์ประจำสาขา' },
];

async function main() {
  console.log('Seeding job types...');

  for (const jt of defaultJobTypes) {
    const existing = await prisma.jobType.findUnique({ where: { name: jt.name } });
    if (existing) {
      console.log(`  ✓ Already exists: ${jt.name}`);
      continue;
    }
    await prisma.jobType.create({ data: jt });
    console.log(`  + Created: ${jt.name}`);
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
