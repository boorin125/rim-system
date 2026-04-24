/**
 * One-time migration: convert base64 photo strings still in DB → files on disk.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json prisma/migrate-photos.ts
 *
 * Safe to re-run: only processes entries that still start with "data:".
 * Set DRY_RUN=true to preview counts without writing anything.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH = 50;

let converted = 0;
let skipped = 0;
let errors = 0;

// ──────────────────────────────────────────────────────────────────────────────
// Core helper
// ──────────────────────────────────────────────────────────────────────────────

function isBase64(v: string): boolean {
  return v.startsWith('data:');
}

function base64ToFile(base64: string, subDir: string, filename: string): string {
  const match = base64.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid base64 data URL');
  const [, mimeType, data] = match;
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  };
  const ext = extMap[mimeType] ?? 'jpg';
  const dir = path.join(UPLOADS_DIR, subDir);
  if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
  const relativePath = `${subDir}/${filename}.${ext}`;
  if (!DRY_RUN) {
    fs.writeFileSync(path.join(UPLOADS_DIR, relativePath), Buffer.from(data, 'base64'));
  }
  converted++;
  return relativePath;
}

/** Convert an array field; returns new array (mixed paths/base64 converted). */
function migrateArray(
  photos: string[],
  subDir: string,
  prefix: string,
): string[] {
  return photos.map((p, i) => {
    if (!isBase64(p)) { skipped++; return p; }
    try {
      return base64ToFile(p, subDir, `${prefix}_${i}_${Date.now()}`);
    } catch (e) {
      errors++;
      console.error(`  ✗ Error converting photo ${i}: ${e}`);
      return p; // keep original on error
    }
  });
}

/** Convert a single nullable string field. */
function migrateField(
  value: string | null,
  subDir: string,
  prefix: string,
): string | null {
  if (!value || !isBase64(value)) { if (value) skipped++; return value; }
  try {
    return base64ToFile(value, subDir, `${prefix}_${Date.now()}`);
  } catch (e) {
    errors++;
    console.error(`  ✗ Error converting field: ${e}`);
    return value;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Incidents
// ──────────────────────────────────────────────────────────────────────────────

async function migrateIncidents() {
  console.log('\n── Incidents ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.incident.findMany({
      select: {
        id: true,
        beforePhotos: true, afterPhotos: true,
        signedReportPhotos: true, customerSignature: true,
      },
      skip: offset,
      take: BATCH,
    });
    if (!rows.length) break;

    for (const row of rows) {
      const needsBefore = row.beforePhotos.some(isBase64);
      const needsAfter = row.afterPhotos.some(isBase64);
      const needsSigned = row.signedReportPhotos.some(isBase64);
      const needsSig = row.customerSignature && isBase64(row.customerSignature);

      if (!needsBefore && !needsAfter && !needsSigned && !needsSig) {
        offset++;
        continue;
      }

      console.log(`  incident ${row.id}`);
      const update: Record<string, unknown> = {};

      if (needsBefore)
        update.beforePhotos = migrateArray(row.beforePhotos, `incidents/${row.id}`, 'before');
      if (needsAfter)
        update.afterPhotos = migrateArray(row.afterPhotos, `incidents/${row.id}`, 'after');
      if (needsSigned)
        update.signedReportPhotos = migrateArray(row.signedReportPhotos, `incidents/${row.id}`, 'signed');
      if (needsSig)
        update.customerSignature = migrateField(row.customerSignature, 'signatures', `customer_${row.id}`);

      if (!DRY_RUN) {
        await prisma.incident.update({ where: { id: row.id }, data: update });
      }
      offset++;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PM Equipment Records
// ──────────────────────────────────────────────────────────────────────────────

async function migratePmEquipmentRecords() {
  console.log('\n── PM Equipment Records ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.pmEquipmentRecord.findMany({
      select: { id: true, beforePhotos: true, afterPhotos: true },
      skip: offset,
      take: BATCH,
    });
    if (!rows.length) break;

    for (const row of rows) {
      const needsBefore = row.beforePhotos.some(isBase64);
      const needsAfter = row.afterPhotos.some(isBase64);

      if (!needsBefore && !needsAfter) { offset++; continue; }

      console.log(`  pm_equipment_record ${row.id}`);
      const update: Record<string, unknown> = {};
      if (needsBefore)
        update.beforePhotos = migrateArray(row.beforePhotos, `pm/equipment/${row.id}`, 'before');
      if (needsAfter)
        update.afterPhotos = migrateArray(row.afterPhotos, `pm/equipment/${row.id}`, 'after');

      if (!DRY_RUN) {
        await prisma.pmEquipmentRecord.update({ where: { id: row.id }, data: update });
      }
      offset++;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PM Records (store signature + signed inventory photos)
// ──────────────────────────────────────────────────────────────────────────────

async function migratePmRecords() {
  console.log('\n── PM Records ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.pmRecord.findMany({
      select: { id: true, storeSignature: true, signedInventoryPhoto: true },
      skip: offset,
      take: BATCH,
    });
    if (!rows.length) break;

    for (const row of rows) {
      const needsSig = row.storeSignature && isBase64(row.storeSignature);
      // signedInventoryPhoto is stored as JSON string array or plain string
      let photoArr: string[] = [];
      let photoNeedsMigration = false;
      if (row.signedInventoryPhoto) {
        try {
          const parsed = JSON.parse(row.signedInventoryPhoto);
          photoArr = Array.isArray(parsed) ? parsed : [row.signedInventoryPhoto];
        } catch {
          photoArr = [row.signedInventoryPhoto];
        }
        photoNeedsMigration = photoArr.some(isBase64);
      }

      if (!needsSig && !photoNeedsMigration) { offset++; continue; }

      console.log(`  pm_record ${row.id}`);
      const update: Record<string, unknown> = {};

      if (needsSig)
        update.storeSignature = migrateField(row.storeSignature, 'signatures', `pm_store_${row.id}`);

      if (photoNeedsMigration) {
        const converted2 = migrateArray(photoArr, `pm/signed/${row.id}`, 'inventory');
        update.signedInventoryPhoto = JSON.stringify(converted2);
      }

      if (!DRY_RUN) {
        await prisma.pmRecord.update({ where: { id: row.id }, data: update });
      }
      offset++;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Outsource Jobs
// ──────────────────────────────────────────────────────────────────────────────

async function migrateOutsourceJobs() {
  console.log('\n── Outsource Jobs ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.outsourceJob.findMany({
      select: { id: true, completionPhotos: true, documentPhotos: true },
      skip: offset,
      take: BATCH,
    });
    if (!rows.length) break;

    for (const row of rows) {
      const needsCompletion = row.completionPhotos.some(isBase64);
      const needsDoc = row.documentPhotos.some(isBase64);

      if (!needsCompletion && !needsDoc) { offset++; continue; }

      console.log(`  outsource_job ${row.id}`);
      const update: Record<string, unknown> = {};
      if (needsCompletion)
        update.completionPhotos = migrateArray(row.completionPhotos, `outsource/${row.id}`, 'completion');
      if (needsDoc)
        update.documentPhotos = migrateArray(row.documentPhotos, `outsource/${row.id}`, 'document');

      if (!DRY_RUN) {
        await prisma.outsourceJob.update({ where: { id: row.id }, data: update });
      }
      offset++;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('RIM Photo Migration: base64 in DB → files on disk');
  if (DRY_RUN) console.log('*** DRY RUN — no files or DB changes ***');
  console.log(`${'='.repeat(60)}`);

  await migrateIncidents();
  await migratePmEquipmentRecords();
  await migratePmRecords();
  await migrateOutsourceJobs();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Done. converted=${converted}  skipped=${skipped}  errors=${errors}`);
  if (DRY_RUN) console.log('Re-run without DRY_RUN=true to apply.');
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
