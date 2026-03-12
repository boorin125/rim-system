#!/usr/bin/env node
/**
 * RIM-System Patch Creator
 * Usage: node create-patch.js --from=1.0.0 --to=1.1.0
 *
 * Prerequisites:
 *   - Git tags must exist for fromVersion (e.g. git tag v1.0.0)
 *   - Run from the root of the RIM-System project
 *   - npm install adm-zip (run once: npm install in this directory)
 */

const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const readline = require('readline')

// ─── Parse args ─────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace('--', '').split('='))
)
const FROM_VERSION = args.from
const TO_VERSION = args.to

if (!FROM_VERSION || !TO_VERSION) {
  console.error('Usage: node create-patch.js --from=1.0.0 --to=1.1.0')
  process.exit(1)
}

const ROOT = path.join(__dirname, '..')
const PATCHES_OUT = path.join(__dirname, 'output')
const MIGRATIONS_DIR = path.join(__dirname, `migrations-${TO_VERSION}`)
const ROLLBACK_DIR = path.join(__dirname, `rollback-${TO_VERSION}`)
const RELEASE_NOTES_FILE = path.join(__dirname, `release-notes-${TO_VERSION}.md`)
const OUTPUT_FILE = path.join(PATCHES_OUT, `patch-${TO_VERSION}.rim-patch`)

// ─── Helpers ─────────────────────────────────────────────────────────────────
function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).trim()
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans) }))
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔧 RIM-System Patch Creator`)
  console.log(`   From: v${FROM_VERSION}  →  To: v${TO_VERSION}\n`)

  // Ensure output dir exists
  if (!fs.existsSync(PATCHES_OUT)) fs.mkdirSync(PATCHES_OUT, { recursive: true })

  // 1. Check git tags
  const tags = run('git tag').split('\n')
  if (!tags.includes(`v${FROM_VERSION}`)) {
    console.error(`❌  Git tag v${FROM_VERSION} not found. Run: git tag v${FROM_VERSION}`)
    process.exit(1)
  }

  // 2. Get changed files since fromVersion tag
  console.log(`📋 Getting changed files since v${FROM_VERSION}...`)
  let changedFiles = []
  try {
    const diff = run(`git diff --name-only v${FROM_VERSION} HEAD`)
    changedFiles = diff.split('\n').filter(Boolean)
  } catch {
    console.warn('⚠️  Could not get git diff — will create patch with no file changes')
  }

  const frontendFiles = changedFiles.filter((f) => f.startsWith('frontend/src/'))
  const backendFiles = changedFiles.filter((f) => f.startsWith('backend/src/'))

  console.log(`   Frontend files changed: ${frontendFiles.length}`)
  console.log(`   Backend files changed:  ${backendFiles.length}`)

  // 3. Build changes list interactively
  console.log('\n📝 Enter release changes (empty line to finish):')
  console.log('   Types: feature | fix | ui | security | perf')
  const changes = []
  while (true) {
    const type = await prompt('   Type (or Enter to finish): ')
    if (!type) break
    const desc = await prompt('   Description: ')
    if (desc) changes.push({ type, desc })
  }

  // 4. Build manifest
  const manifest = {
    version: TO_VERSION,
    fromVersion: FROM_VERSION,
    releaseDate: new Date().toISOString().split('T')[0],
    changes,
    migrations: [],
    requiresRestart: true,
    checksum: null, // filled after zip
  }

  // 5. Create zip
  console.log('\n📦 Building patch package...')
  const zip = new AdmZip()

  // Add changed frontend/backend files
  for (const file of [...frontendFiles, ...backendFiles]) {
    const fullPath = path.join(ROOT, file)
    if (fs.existsSync(fullPath)) {
      const dir = path.dirname(file)
      zip.addLocalFile(fullPath, dir)
      console.log(`   + ${file}`)
    }
  }

  // Add migrations if directory exists
  if (fs.existsSync(MIGRATIONS_DIR)) {
    const migFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
    for (const mf of migFiles) {
      zip.addLocalFile(path.join(MIGRATIONS_DIR, mf), 'migrations')
      manifest.migrations.push(mf)
      console.log(`   + migrations/${mf}`)
    }
  } else {
    console.log(`   ℹ️  No migrations directory found at: ${MIGRATIONS_DIR}`)
    console.log(`      Create it if you need DB schema changes.`)
  }

  // Add rollback SQL if directory exists
  if (fs.existsSync(ROLLBACK_DIR)) {
    const rbFiles = fs.readdirSync(ROLLBACK_DIR).filter((f) => f.endsWith('.sql'))
    for (const rf of rbFiles) {
      zip.addLocalFile(path.join(ROLLBACK_DIR, rf), 'rollback')
      console.log(`   + rollback/${rf}`)
    }
  }

  // Add release notes
  if (fs.existsSync(RELEASE_NOTES_FILE)) {
    zip.addLocalFile(RELEASE_NOTES_FILE, '', 'release-notes.md')
    console.log(`   + release-notes.md`)
  } else {
    // Auto-generate simple release notes
    const autoNotes = [
      `# Release Notes — v${TO_VERSION}`,
      `Released: ${manifest.releaseDate}`,
      '',
      ...changes.map((c) => `- [${c.type}] ${c.desc}`),
    ].join('\n')
    zip.addFile('release-notes.md', Buffer.from(autoNotes, 'utf8'))
  }

  // Add manifest (without checksum first)
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))

  // Write zip to temp file to compute checksum
  const tempFile = OUTPUT_FILE + '.tmp'
  zip.writeZip(tempFile)

  // Compute checksum
  const fileBuffer = fs.readFileSync(tempFile)
  const checksum = `sha256:${crypto.createHash('sha256').update(fileBuffer).digest('hex')}`
  manifest.checksum = checksum
  fs.unlinkSync(tempFile)

  // Rebuild zip with checksum
  const zip2 = new AdmZip()
  for (const entry of zip.getEntries()) {
    if (entry.entryName === 'manifest.json') continue
    zip2.addFile(entry.entryName, entry.getData())
  }
  zip2.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'))
  zip2.writeZip(OUTPUT_FILE)

  const finalSize = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(1)
  console.log(`\n✅ Patch created: ${OUTPUT_FILE}`)
  console.log(`   Size: ${finalSize} KB`)
  console.log(`   Checksum: ${checksum}`)
  console.log(`\n📌 Next steps:`)
  console.log(`   1. Test on Test Server: upload patch-${TO_VERSION}.rim-patch via Settings → Version`)
  console.log(`   2. Verify all features work correctly`)
  console.log(`   3. Deploy to Production Server`)
  console.log(`   4. Tag this release: git tag v${TO_VERSION} && git push --tags\n`)
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
