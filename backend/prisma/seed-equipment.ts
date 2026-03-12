// prisma/seed-equipment.ts
// Adds 27 equipment items to every Store in the database (non-destructive)
// Run: npx ts-node prisma/seed-equipment.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Equipment list: [name, category]
const EQUIPMENT_LIST: [string, string][] = [
  ['Firewall',                'Network'],
  ['Switch#1',                'Network'],
  ['PC Server',               'Computer'],
  ['PC Monitor',              'Computer'],
  ['PC Printer',              'Printer'],
  ['PC Scanner',              'Scanner'],
  ['POS#1',                   'POS'],
  ['POS#2',                   'POS'],
  ['POS Printer#1',           'Printer'],
  ['POS Printer#2',           'Printer'],
  ['POS Cash Drawer#1',       'POS'],
  ['POS Cash Drawer#2',       'POS'],
  ['POS Monitor#1',           'POS'],
  ['POS Monitor#2',           'POS'],
  ['POS Scanner#1',           'POS Scanner'],
  ['POS Scanner#2',           'POS Scanner'],
  ['POS Customer Display#1',  'POS'],
  ['POS Customer Display#2',  'POS'],
  ['AP#1',                    'Access Point'],
  ['PPC#1',                   'PPC'],
  ['UPS POS#1',               'UPS'],
  ['UPS POS#2',               'UPS'],
  ['UPS PC',                  'UPS'],
  ['UPS Rack',                'UPS'],
  ['UPS CCTV',                'UPS'],
  ['HHT#1',                   'HHT'],
  ['HHT#2',                   'HHT'],
];

// Generate a unique serial number: EQ-{storeCode}-{index padded 2}
function generateSerial(storeCode: string, index: number): string {
  const idx = String(index + 1).padStart(2, '0');
  return `EQ-${storeCode}-${idx}`;
}

async function main() {
  console.log('🔧 Seeding Equipment for all Stores...\n');

  const stores = await prisma.store.findMany({
    select: { id: true, storeCode: true, name: true },
    orderBy: { id: 'asc' },
  });

  if (stores.length === 0) {
    console.log('⚠️  No stores found. Please seed stores first.');
    return;
  }

  console.log(`📦 Found ${stores.length} stores. Adding ${EQUIPMENT_LIST.length} equipment each...\n`);

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const store of stores) {
    const storeCode = store.storeCode || `S${store.id}`;
    let storeCreated = 0;

    for (let i = 0; i < EQUIPMENT_LIST.length; i++) {
      const [name, category] = EQUIPMENT_LIST[i];
      const serialNumber = generateSerial(storeCode, i);

      // Check if this serial already exists (idempotent)
      const existing = await prisma.equipment.findUnique({
        where: { serialNumber },
        select: { id: true },
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      await prisma.equipment.create({
        data: {
          serialNumber,
          name,
          category,
          status: 'ACTIVE',
          storeId: store.id,
        },
      });

      storeCreated++;
      totalCreated++;
    }

    if (storeCreated > 0) {
      console.log(`  ✅ ${store.storeCode} — ${store.name}: +${storeCreated} items`);
    } else {
      console.log(`  ⏭️  ${store.storeCode} — ${store.name}: already seeded (skipped)`);
    }
  }

  console.log(`\n✅ Done! Created: ${totalCreated}, Skipped (already exist): ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
