#!/usr/bin/env node
/**
 * create-patch.js
 * ───────────────
 * Packages modified source files into a .rim-patch ZIP file for deployment
 * via Settings → Info → Patch Update.
 *
 * Usage:
 *   node scripts/create-patch.js [--from 1.0.0] [--to 1.0.1] [--files file1 file2 ...]
 *
 * Defaults:
 *   --from  1.0.0
 *   --to    1.0.1
 *   --files frontend/src/utils/serviceReportPdf.ts
 *
 * Output:
 *   patches/patch-<to>.rim-patch
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Try to load adm-zip from backend node_modules
let AdmZip;
try {
  AdmZip = require('../backend/node_modules/adm-zip');
} catch {
  try {
    AdmZip = require('adm-zip');
  } catch {
    console.error('❌  adm-zip not found. Run: npm install adm-zip  (or use backend/node_modules)');
    process.exit(1);
  }
}

// ─── Parse args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const FROM_VERSION = get('--from', '1.0.0');
const TO_VERSION   = get('--to',   '1.0.1');

// --files can be multiple — collect everything after --files until next --flag
let FILES = [];
const fi = args.indexOf('--files');
if (fi !== -1) {
  for (let i = fi + 1; i < args.length; i++) {
    if (args[i].startsWith('--')) break;
    FILES.push(args[i]);
  }
}
if (FILES.length === 0) {
  FILES = ['frontend/src/utils/serviceReportPdf.ts'];
}

const REPO_ROOT   = path.resolve(__dirname, '..');
const PATCHES_DIR = path.join(REPO_ROOT, 'patches');
const OUT_FILE    = path.join(PATCHES_DIR, `patch-${TO_VERSION}.rim-patch`);

// ─── Ensure patches dir ────────────────────────────────────────────────────────
if (!fs.existsSync(PATCHES_DIR)) fs.mkdirSync(PATCHES_DIR, { recursive: true });

// ─── Build ZIP ────────────────────────────────────────────────────────────────
const zip = new AdmZip();

console.log(`\n📦  Creating patch ${FROM_VERSION} → ${TO_VERSION}`);
console.log(`    Files to include:`);

const missing = [];
FILES.forEach((relPath) => {
  const absPath = path.join(REPO_ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.log(`    ✗  ${relPath}  ← NOT FOUND`);
    missing.push(relPath);
    return;
  }
  const stat = fs.statSync(absPath);
  const zipDir = path.dirname(relPath).replace(/\\/g, '/');
  zip.addLocalFile(absPath, zipDir);
  console.log(`    ✓  ${relPath}  (${(stat.size / 1024).toFixed(1)} KB)`);
});

if (missing.length > 0) {
  console.error(`\n❌  Aborting — ${missing.length} file(s) not found.`);
  process.exit(1);
}

// ─── manifest.json (no checksum — backend skips check when field is absent) ───
const manifest = {
  version:     TO_VERSION,
  fromVersion: FROM_VERSION,
  releaseDate: new Date().toISOString().split('T')[0],
  releaseNotes: `Version ${TO_VERSION}: Added compact Service Report PDF style`,
  changes: [
    'Add compact style to Service Report PDF (two-column layout, ticket badge, accent decorations)',
    'New generateCompactPDF() function in serviceReportPdf.ts',
    'PdfOptions now accepts style: "classic" | "modern" | "compact"',
  ],
  files: FILES,
};

zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

// release-notes.md
const releaseNotesMd = `# ${TO_VERSION} — ${manifest.releaseDate}\n\n${manifest.releaseNotes}\n\n## Changes\n\n${manifest.changes.map((c) => `- ${c}`).join('\n')}\n`;
zip.addFile('release-notes.md', Buffer.from(releaseNotesMd, 'utf8'));

zip.writeZip(OUT_FILE);

// Compute SHA-256 of the final file (for display only)
const hash = crypto.createHash('sha256').update(fs.readFileSync(OUT_FILE)).digest('hex');

// ─── Final report ─────────────────────────────────────────────────────────────
const outStat = fs.statSync(OUT_FILE);
console.log(`\n✅  Patch created successfully!`);
console.log(`    Output : ${OUT_FILE}`);
console.log(`    Size   : ${(outStat.size / 1024).toFixed(1)} KB`);
console.log(`    SHA-256: ${hash}  (for reference)`);
console.log(`\n📋  Next steps:`);
console.log(`    1. Open the app → Settings → Info`);
console.log(`    2. Upload: ${path.basename(OUT_FILE)}`);
console.log(`    3. Click "Validate" then "Install"`);
console.log(`    4. Watch the progress bar → version bumps to ${TO_VERSION}`);
console.log(`    5. Test: generate a Service Report → choose style "compact"\n`);
