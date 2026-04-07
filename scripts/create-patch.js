#!/usr/bin/env node
/**
 * create-patch.js
 * ───────────────
 * สร้าง .rim-patch file สำหรับ upload ผ่าน Settings → Info → Patch Update
 *
 * การใช้งาน:
 *   node scripts/create-patch.js --from 1.0.0 --to 1.0.1 [options]
 *
 * Options:
 *   --from <version>        base version (required)
 *   --to   <version>        target version (required)
 *   --files file1 file2 ... ไฟล์ที่เปลี่ยน (ถ้าไม่ระบุ ใช้ git diff อัตโนมัติ)
 *   --migrations file.sql   SQL migration file(s) ที่จะรันบน server
 *   --notes "text"          release notes (ถ้าไม่ระบุ จะถามทีหลัง)
 *   --no-code               ไม่รวมไฟล์โค้ด (DB migration only)
 *
 * Output:
 *   patches/patch-<to>.rim-patch
 *
 * ตัวอย่าง:
 *   node scripts/create-patch.js --from 1.0.0 --to 1.0.1 --notes "Fix bug in report"
 *   node scripts/create-patch.js --from 1.0.0 --to 1.0.1 --migrations migrations/add_column.sql
 *   node scripts/create-patch.js --from 1.0.0 --to 1.0.1 --no-code --migrations migrations/v101.sql
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ─── Load adm-zip ──────────────────────────────────────────────────────────────
let AdmZip;
try {
  AdmZip = require('../backend/node_modules/adm-zip');
} catch {
  try {
    AdmZip = require('adm-zip');
  } catch {
    console.error('❌  adm-zip not found. Run: cd backend && npm install');
    process.exit(1);
  }
}

// ─── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

const getArg = (flag, def = null) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
};

const getMultiArg = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1) return [];
  const result = [];
  for (let j = i + 1; j < args.length; j++) {
    if (args[j].startsWith('--')) break;
    result.push(args[j]);
  }
  return result;
};

const FROM_VERSION = getArg('--from');
const TO_VERSION   = getArg('--to');
const NOTES        = getArg('--notes');
const NO_CODE      = args.includes('--no-code');

if (!FROM_VERSION || !TO_VERSION) {
  console.error('❌  ต้องระบุ --from และ --to\n');
  console.error('   ตัวอย่าง: node scripts/create-patch.js --from 1.0.0 --to 1.0.1');
  process.exit(1);
}

let FILES      = getMultiArg('--files');
let MIGRATIONS = getMultiArg('--migrations');

const REPO_ROOT   = path.resolve(__dirname, '..');
const PATCHES_DIR = path.join(REPO_ROOT, 'patches');
const OUT_FILE    = path.join(PATCHES_DIR, `patch-${TO_VERSION}.rim-patch`);

// ─── Auto-detect changed files via git diff ────────────────────────────────────
if (FILES.length === 0 && !NO_CODE) {
  try {
    // Try diff between git tags
    const fromTag = `v${FROM_VERSION}`;
    const tags = execSync('git tag', { cwd: REPO_ROOT }).toString().trim().split('\n');

    let diffCmd;
    if (tags.includes(fromTag)) {
      diffCmd = `git diff ${fromTag} HEAD --name-only --diff-filter=ACMR`;
    } else {
      // Fallback: staged + modified files
      diffCmd = 'git diff HEAD --name-only --diff-filter=ACMR';
    }

    const diffOutput = execSync(diffCmd, { cwd: REPO_ROOT }).toString().trim();
    if (diffOutput) {
      FILES = diffOutput
        .split('\n')
        .map(f => f.trim())
        .filter(f => f.startsWith('frontend/') || f.startsWith('backend/'))
        .filter(f => !f.includes('node_modules') && !f.includes('.next') && !f.includes('/dist/'));
    }

    if (FILES.length > 0) {
      console.log(`\n🔍  Auto-detected ${FILES.length} changed file(s) via git diff (${fromTag} → HEAD)`);
    }
  } catch {
    // git not available or no tags — continue with empty FILES
  }
}

// ─── Validate ─────────────────────────────────────────────────────────────────
console.log(`\n📦  Creating patch ${FROM_VERSION} → ${TO_VERSION}`);

if (FILES.length === 0 && MIGRATIONS.length === 0 && !NO_CODE) {
  console.error('\n❌  ไม่พบไฟล์ที่เปลี่ยนแปลง');
  console.error('   ระบุด้วย --files หรือ --migrations');
  console.error('   ถ้าต้องการ DB-only patch: ใช้ --no-code --migrations file.sql');
  process.exit(1);
}

if (!fs.existsSync(PATCHES_DIR)) fs.mkdirSync(PATCHES_DIR, { recursive: true });

// ─── Build ZIP ────────────────────────────────────────────────────────────────
const zip = new AdmZip();
const changes = [];

// Add source files
if (FILES.length > 0 && !NO_CODE) {
  console.log('\n  📄 Source files:');
  const missing = [];
  FILES.forEach((relPath) => {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.log(`     ✗  ${relPath}  ← NOT FOUND`);
      missing.push(relPath);
      return;
    }
    const stat = fs.statSync(absPath);
    zip.addLocalFile(absPath, path.dirname(relPath).replace(/\\/g, '/'));
    console.log(`     ✓  ${relPath}  (${(stat.size / 1024).toFixed(1)} KB)`);
    changes.push({ type: 'code', desc: `Updated ${path.basename(relPath)}` });
  });
  if (missing.length > 0) {
    console.error(`\n❌  Aborting — ${missing.length} file(s) not found.`);
    process.exit(1);
  }
}

// Add SQL migration files
if (MIGRATIONS.length > 0) {
  console.log('\n  🗄️  Migrations:');
  MIGRATIONS.forEach((relPath, i) => {
    const absPath = path.isAbsolute(relPath) ? relPath : path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.error(`❌  Migration not found: ${relPath}`);
      process.exit(1);
    }
    const zipName = `migrations/${String(i + 1).padStart(3, '0')}_${path.basename(relPath)}`;
    zip.addFile(zipName, fs.readFileSync(absPath));
    console.log(`     ✓  ${zipName}`);
    changes.push({ type: 'db', desc: `Migration: ${path.basename(relPath)}` });
  });
}

// ─── manifest.json ─────────────────────────────────────────────────────────────
const releaseNotes = NOTES || `Version ${TO_VERSION}`;

const manifest = {
  version:     TO_VERSION,
  fromVersion: FROM_VERSION,
  releaseDate: new Date().toISOString().split('T')[0],
  releaseNotes,
  changes,
  files: FILES,
  migrations: MIGRATIONS.map(f => path.basename(f)),
};

zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

// release-notes.md
const md = [
  `# ${TO_VERSION} — ${manifest.releaseDate}`,
  '',
  releaseNotes,
  '',
  '## Changes',
  '',
  ...changes.map(c => `- [${c.type.toUpperCase()}] ${c.desc}`),
].join('\n');
zip.addFile('release-notes.md', Buffer.from(md, 'utf8'));

zip.writeZip(OUT_FILE);

// ─── Final report ──────────────────────────────────────────────────────────────
const outStat  = fs.statSync(OUT_FILE);
const hash     = crypto.createHash('sha256').update(fs.readFileSync(OUT_FILE)).digest('hex');
const patchType = FILES.length > 0 && MIGRATIONS.length > 0 ? 'Full patch'
                : FILES.length > 0 ? 'Code-only patch'
                : 'Migration-only patch';

console.log(`\n✅  Patch created!`);
console.log(`    Type   : ${patchType}`);
console.log(`    Output : ${OUT_FILE}`);
console.log(`    Size   : ${(outStat.size / 1024).toFixed(1)} KB`);
console.log(`    SHA-256: sha256:${hash}`);
console.log(`\n📋  ขั้นตอน:`);
console.log(`    1. เปิดระบบ → Settings → Info`);
console.log(`    2. กด "Patch Update" → อัพโหลด ${path.basename(OUT_FILE)}`);
console.log(`    3. กด Validate → Install`);
if (FILES.length > 0) {
  console.log(`    4. ⚠️  Docker: ต้อง push image ใหม่แล้ว deploy ด้วย เพื่อให้โค้ดใหม่มีผล`);
  console.log(`       (patch บันทึก version + run migrations เท่านั้น)`);
}
console.log('');
