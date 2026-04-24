/**
 * migrate-photos.js — plain Node.js, works in production Docker image
 *
 * Usage (from host):
 *   docker cp backend/prisma/migrate-photos.js rim-backend:/app/migrate-photos.js
 *   docker exec rim-backend node /app/migrate-photos.js
 *   docker exec -e DRY_RUN=true rim-backend node /app/migrate-photos.js
 */

'use strict';
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH = 50;

let converted = 0;
let skipped = 0;
let errors = 0;

function isBase64(v) {
  return typeof v === 'string' && v.startsWith('data:');
}

function base64ToFile(base64, subDir, filename) {
  const match = base64.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error('Invalid base64 data URL');
  const [, mimeType, data] = match;
  const extMap = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  };
  const ext = extMap[mimeType] || 'jpg';
  const dir = path.join(UPLOADS_DIR, subDir);
  if (!DRY_RUN) fs.mkdirSync(dir, { recursive: true });
  const relativePath = `${subDir}/${filename}.${ext}`;
  if (!DRY_RUN) {
    fs.writeFileSync(path.join(UPLOADS_DIR, relativePath), Buffer.from(data, 'base64'));
  }
  converted++;
  return relativePath;
}

function migrateArray(photos, subDir, prefix) {
  return photos.map((p, i) => {
    if (!isBase64(p)) { skipped++; return p; }
    try {
      return base64ToFile(p, subDir, `${prefix}_${i}_${Date.now()}`);
    } catch (e) {
      errors++;
      console.error(`  ✗ Error: ${e.message}`);
      return p;
    }
  });
}

function migrateField(value, subDir, prefix) {
  if (!value || !isBase64(value)) { if (value) skipped++; return value; }
  try {
    return base64ToFile(value, subDir, `${prefix}_${Date.now()}`);
  } catch (e) {
    errors++;
    console.error(`  ✗ Error: ${e.message}`);
    return value;
  }
}

async function migrateIncidents() {
  console.log('\n── Incidents ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.incident.findMany({
      select: { id: true, beforePhotos: true, afterPhotos: true, signedReportPhotos: true, customerSignature: true },
      skip: offset, take: BATCH,
    });
    if (!rows.length) break;
    for (const row of rows) {
      const nb = row.beforePhotos.some(isBase64);
      const na = row.afterPhotos.some(isBase64);
      const ns = row.signedReportPhotos.some(isBase64);
      const nc = row.customerSignature && isBase64(row.customerSignature);
      if (!nb && !na && !ns && !nc) { offset++; continue; }
      console.log(`  incident ${row.id}`);
      const update = {};
      if (nb) update.beforePhotos = migrateArray(row.beforePhotos, `incidents/${row.id}`, 'before');
      if (na) update.afterPhotos = migrateArray(row.afterPhotos, `incidents/${row.id}`, 'after');
      if (ns) update.signedReportPhotos = migrateArray(row.signedReportPhotos, `incidents/${row.id}`, 'signed');
      if (nc) update.customerSignature = migrateField(row.customerSignature, 'signatures', `customer_${row.id}`);
      if (!DRY_RUN) await prisma.incident.update({ where: { id: row.id }, data: update });
      offset++;
    }
  }
}

async function migratePmEquipmentRecords() {
  console.log('\n── PM Equipment Records ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.pmEquipmentRecord.findMany({
      select: { id: true, beforePhotos: true, afterPhotos: true },
      skip: offset, take: BATCH,
    });
    if (!rows.length) break;
    for (const row of rows) {
      const nb = row.beforePhotos.some(isBase64);
      const na = row.afterPhotos.some(isBase64);
      if (!nb && !na) { offset++; continue; }
      console.log(`  pm_equipment_record ${row.id}`);
      const update = {};
      if (nb) update.beforePhotos = migrateArray(row.beforePhotos, `pm/equipment/${row.id}`, 'before');
      if (na) update.afterPhotos = migrateArray(row.afterPhotos, `pm/equipment/${row.id}`, 'after');
      if (!DRY_RUN) await prisma.pmEquipmentRecord.update({ where: { id: row.id }, data: update });
      offset++;
    }
  }
}

async function migratePmRecords() {
  console.log('\n── PM Records ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.pmRecord.findMany({
      select: { id: true, storeSignature: true, signedInventoryPhoto: true },
      skip: offset, take: BATCH,
    });
    if (!rows.length) break;
    for (const row of rows) {
      const ns = row.storeSignature && isBase64(row.storeSignature);
      let photoArr = [];
      let np = false;
      if (row.signedInventoryPhoto) {
        try { const p = JSON.parse(row.signedInventoryPhoto); photoArr = Array.isArray(p) ? p : [row.signedInventoryPhoto]; }
        catch { photoArr = [row.signedInventoryPhoto]; }
        np = photoArr.some(isBase64);
      }
      if (!ns && !np) { offset++; continue; }
      console.log(`  pm_record ${row.id}`);
      const update = {};
      if (ns) update.storeSignature = migrateField(row.storeSignature, 'signatures', `pm_store_${row.id}`);
      if (np) update.signedInventoryPhoto = JSON.stringify(migrateArray(photoArr, `pm/signed/${row.id}`, 'inventory'));
      if (!DRY_RUN) await prisma.pmRecord.update({ where: { id: row.id }, data: update });
      offset++;
    }
  }
}

async function migrateOutsourceJobs() {
  console.log('\n── Outsource Jobs ──');
  let offset = 0;
  while (true) {
    const rows = await prisma.outsourceJob.findMany({
      select: { id: true, completionPhotos: true, documentPhotos: true },
      skip: offset, take: BATCH,
    });
    if (!rows.length) break;
    for (const row of rows) {
      const nc = row.completionPhotos.some(isBase64);
      const nd = row.documentPhotos.some(isBase64);
      if (!nc && !nd) { offset++; continue; }
      console.log(`  outsource_job ${row.id}`);
      const update = {};
      if (nc) update.completionPhotos = migrateArray(row.completionPhotos, `outsource/${row.id}`, 'completion');
      if (nd) update.documentPhotos = migrateArray(row.documentPhotos, `outsource/${row.id}`, 'document');
      if (!DRY_RUN) await prisma.outsourceJob.update({ where: { id: row.id }, data: update });
      offset++;
    }
  }
}

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
