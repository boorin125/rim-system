// src/modules/version/version.service.ts

import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VersionStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip');

const PATCHES_DIR = process.env.PATCHES_DIR || './patches';
const SNAPSHOTS_DIR = process.env.SNAPSHOTS_DIR || './snapshots';
const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '../../../../..');

@Injectable()
export class VersionService {
  constructor(private readonly prisma: PrismaService) {
    [PATCHES_DIR, SNAPSHOTS_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  // ─── Get current version ────────────────────────────────────────────────────
  async getCurrentVersion() {
    const current = await this.prisma.appVersion.findFirst({
      where: { status: VersionStatus.CURRENT },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    return current ?? { version: '1.0.0', status: 'CURRENT', releaseNotes: null, changes: [], appliedAt: null, appliedBy: null };
  }

  // ─── Get version history ────────────────────────────────────────────────────
  async getHistory() {
    return this.prisma.appVersion.findMany({
      orderBy: { appliedAt: 'desc' },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── Validate uploaded patch ─────────────────────────────────────────────────
  async validatePatch(filePath: string) {
    const zip = new AdmZip(filePath);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) throw new BadRequestException('Invalid patch: missing manifest.json');

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    if (!manifest.version || !manifest.fromVersion) {
      throw new BadRequestException('Invalid manifest: missing version or fromVersion');
    }

    // Verify checksum
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (manifest.checksum && manifest.checksum !== `sha256:${hash}`) {
      throw new BadRequestException('Patch checksum mismatch — file may be corrupted');
    }

    // Verify fromVersion matches current
    const current = await this.getCurrentVersion();
    if (current.version !== manifest.fromVersion) {
      throw new BadRequestException(
        `Patch requires base version ${manifest.fromVersion}, but current is ${current.version}`,
      );
    }

    return { valid: true, manifest };
  }

  // ─── Install patch ───────────────────────────────────────────────────────────
  async installPatch(filePath: string, userId: number) {
    const { manifest } = await this.validatePatch(filePath);

    // 1. Create snapshot of current state
    const snapshotPath = await this.createSnapshot(manifest.fromVersion);

    // 2. Apply file changes
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;

      // Skip manifest, release-notes, rollback
      if (name === 'manifest.json' || name === 'release-notes.md') continue;
      if (name.startsWith('rollback/')) continue;

      // Apply frontend/backend file changes
      if (name.startsWith('frontend/') || name.startsWith('backend/')) {
        const destPath = path.join(APP_ROOT, name);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(destPath, entry.getData());
      }

      // Apply migrations
      if (name.startsWith('migrations/') && name.endsWith('.sql')) {
        const sql = entry.getData().toString('utf8');
        if (sql.trim()) await this.prisma.$executeRawUnsafe(sql);
      }
    }

    // 3. Mark previous CURRENT as PREVIOUS
    await this.prisma.appVersion.updateMany({
      where: { status: VersionStatus.CURRENT },
      data: { status: VersionStatus.PREVIOUS },
    });

    // 4. Record new version
    const releaseNotesEntry = zip.getEntry('release-notes.md');
    const releaseNotes = releaseNotesEntry
      ? releaseNotesEntry.getData().toString('utf8')
      : manifest.releaseNotes ?? null;

    const newVersion = await this.prisma.appVersion.create({
      data: {
        version: manifest.version,
        fromVersion: manifest.fromVersion,
        status: VersionStatus.CURRENT,
        releaseNotes,
        changes: manifest.changes ?? [],
        appliedById: userId,
        snapshotPath,
        checksum: manifest.checksum ?? null,
      },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    // 5. Clean up temp file
    fs.unlinkSync(filePath);

    return newVersion;
  }

  // ─── Rollback to a previous version ─────────────────────────────────────────
  async rollback(targetVersion: string, userId: number) {
    const target = await this.prisma.appVersion.findUnique({
      where: { version: targetVersion },
    });
    if (!target) throw new NotFoundException(`Version ${targetVersion} not found`);
    if (target.status === VersionStatus.CURRENT) {
      throw new BadRequestException('Cannot rollback to the current version');
    }

    // Restore snapshot
    if (target.snapshotPath && fs.existsSync(target.snapshotPath)) {
      const zip = new AdmZip(target.snapshotPath);
      zip.extractAllTo(APP_ROOT, true);
    }

    // Find patch file for the version we're rolling back FROM to run rollback SQL
    const currentVer = await this.getCurrentVersion();
    const patchFile = path.join(PATCHES_DIR, `patch-${currentVer.version}.rim-patch`);
    if (fs.existsSync(patchFile)) {
      const zip = new AdmZip(patchFile);
      const entries = zip.getEntries().filter(
        (e) => e.entryName.startsWith('rollback/') && e.entryName.endsWith('.sql'),
      );
      for (const entry of entries.sort((a, b) => b.entryName.localeCompare(a.entryName))) {
        const sql = entry.getData().toString('utf8');
        if (sql.trim()) await this.prisma.$executeRawUnsafe(sql);
      }
    }

    // Update statuses
    await this.prisma.appVersion.updateMany({
      where: { status: VersionStatus.CURRENT },
      data: { status: VersionStatus.PREVIOUS },
    });
    await this.prisma.appVersion.update({
      where: { version: targetVersion },
      data: { status: VersionStatus.CURRENT, appliedById: userId, appliedAt: new Date() },
    });

    return { success: true, rolledBackTo: targetVersion };
  }

  // ─── Create snapshot (zip current frontend+backend src) ──────────────────────
  private async createSnapshot(version: string): Promise<string> {
    const snapshotPath = path.join(SNAPSHOTS_DIR, `snapshot-${version}-${Date.now()}.zip`);
    const zip = new AdmZip();

    const addDir = (dir: string, zipPrefix: string) => {
      if (!fs.existsSync(dir)) return;
      const walk = (current: string, prefix: string) => {
        for (const entry of fs.readdirSync(current)) {
          const fullPath = path.join(current, entry);
          const zipPath = path.join(prefix, entry);
          if (fs.statSync(fullPath).isDirectory()) {
            // Skip node_modules, .next, dist
            if (['node_modules', '.next', 'dist', '.git'].includes(entry)) continue;
            walk(fullPath, zipPath);
          } else {
            zip.addLocalFile(fullPath, path.dirname(zipPath));
          }
        }
      };
      walk(dir, zipPrefix);
    };

    addDir(path.join(APP_ROOT, 'frontend', 'src'), 'frontend/src');
    addDir(path.join(APP_ROOT, 'backend', 'src'), 'backend/src');

    zip.writeZip(snapshotPath);
    return snapshotPath;
  }

  // ─── List available snapshots ────────────────────────────────────────────────
  async listSnapshots() {
    if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
    return fs.readdirSync(SNAPSHOTS_DIR)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => ({
        file: f,
        path: path.join(SNAPSHOTS_DIR, f),
        size: fs.statSync(path.join(SNAPSHOTS_DIR, f)).size,
        createdAt: fs.statSync(path.join(SNAPSHOTS_DIR, f)).mtime,
      }));
  }
}
