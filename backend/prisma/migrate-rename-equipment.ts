// prisma/migrate-rename-equipment.ts
// Renames existing equipment records:
//   People#1      → PPC#1,  category: Access Control → PPC
//   Hand Held#1   → HHT#1,  category: Scanner → HHT
//   Hand Held#2   → HHT#2,  category: Scanner → HHT
//   POS Scanner#1/#2:        category: Scanner → POS Scanner
//   Access Point#1 → AP#1,  category: Network → Access Point
// Run: npx ts-node prisma/migrate-rename-equipment.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Renaming equipment records...\n');

  // People#1 → PPC#1 (category: Access Control → PPC)
  const ppc = await prisma.equipment.updateMany({
    where: { name: 'People#1' },
    data: { name: 'PPC#1', category: 'PPC' },
  });
  console.log(`  ✅ People#1 → PPC#1: ${ppc.count} records updated`);

  // Hand Held#1 → HHT#1 (category: Scanner → HHT)
  const hht1 = await prisma.equipment.updateMany({
    where: { name: 'Hand Held#1' },
    data: { name: 'HHT#1', category: 'HHT' },
  });
  console.log(`  ✅ Hand Held#1 → HHT#1: ${hht1.count} records updated`);

  // Hand Held#2 → HHT#2 (category: Scanner → HHT)
  const hht2 = await prisma.equipment.updateMany({
    where: { name: 'Hand Held#2' },
    data: { name: 'HHT#2', category: 'HHT' },
  });
  console.log(`  ✅ Hand Held#2 → HHT#2: ${hht2.count} records updated`);

  // POS Scanner#1 → category: Scanner → POS Scanner
  const ps1 = await prisma.equipment.updateMany({
    where: { name: 'POS Scanner#1', category: 'Scanner' },
    data: { category: 'POS Scanner' },
  });
  console.log(`  ✅ POS Scanner#1 category → POS Scanner: ${ps1.count} records updated`);

  // POS Scanner#2 → category: Scanner → POS Scanner
  const ps2 = await prisma.equipment.updateMany({
    where: { name: 'POS Scanner#2', category: 'Scanner' },
    data: { category: 'POS Scanner' },
  });
  console.log(`  ✅ POS Scanner#2 category → POS Scanner: ${ps2.count} records updated`);

  // Access Point#1 → AP#1 (category: Network → Access Point)
  const ap = await prisma.equipment.updateMany({
    where: { name: 'Access Point#1' },
    data: { name: 'AP#1', category: 'Access Point' },
  });
  console.log(`  ✅ Access Point#1 → AP#1: ${ap.count} records updated`);

  console.log('\n✅ Migration complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
