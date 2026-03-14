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

// ─── Job Progress ────────────────────────────────────────────────────────────

export interface InstallProgress {
  jobId: string;
  step: number;
  total: number;
  pct: number;
  message: string;
  /** 'running' | 'done' | 'error' */
  status: 'running' | 'done' | 'error';
  result?: any;
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
}

@Injectable()
export class VersionService {
  /** In-memory job store — keyed by jobId */
  private jobs = new Map<string, InstallProgress>();

  constructor(private readonly prisma: PrismaService) {
    [PATCHES_DIR, SNAPSHOTS_DIR].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });
  }

  // ─── Get current version ──────────────────────────────────────────────────
  async getCurrentVersion() {
    const current = await this.prisma.appVersion.findFirst({
      where: { status: VersionStatus.CURRENT },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    return current ?? { version: '1.0.0', status: 'CURRENT', releaseNotes: null, changes: [], appliedAt: null, appliedBy: null };
  }

  // ─── Get version history ──────────────────────────────────────────────────
  async getHistory() {
    return this.prisma.appVersion.findMany({
      orderBy: { appliedAt: 'desc' },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  // ─── Validate patch ───────────────────────────────────────────────────────
  async validatePatch(filePath: string) {
    const zip = new AdmZip(filePath);
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) throw new BadRequestException('Invalid patch: missing manifest.json');

    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
    if (!manifest.version || !manifest.fromVersion) {
      throw new BadRequestException('Invalid manifest: missing version or fromVersion');
    }

    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    if (manifest.checksum && manifest.checksum !== `sha256:${hash}`) {
      throw new BadRequestException('Patch checksum mismatch — file may be corrupted');
    }

    const current = await this.getCurrentVersion();
    if (current.version !== manifest.fromVersion) {
      throw new BadRequestException(
        `Patch requires base version ${manifest.fromVersion}, but current is ${current.version}`,
      );
    }

    return { valid: true, manifest };
  }

  // ─── Start async install — returns jobId immediately ─────────────────────
  startInstall(filePath: string, userId: number): string {
    const jobId = crypto.randomBytes(8).toString('hex');

    const job: InstallProgress = {
      jobId,
      step: 0,
      total: 5,
      pct: 0,
      message: 'Starting…',
      status: 'running',
      startedAt: new Date(),
    };
    this.jobs.set(jobId, job);

    // Run in background (intentionally not awaited)
    this.runInstall(filePath, userId, jobId).catch(() => {});

    return jobId;
  }

  // ─── Poll job status ──────────────────────────────────────────────────────
  getJobStatus(jobId: string): InstallProgress {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return job;
  }

  // ─── Rollback ─────────────────────────────────────────────────────────────
  async rollback(targetVersion: string, userId: number) {
    const target = await this.prisma.appVersion.findUnique({ where: { version: targetVersion } });
    if (!target) throw new NotFoundException(`Version ${targetVersion} not found`);
    if (target.status === VersionStatus.CURRENT) {
      throw new BadRequestException('Cannot rollback to the current version');
    }

    if (target.snapshotPath && fs.existsSync(target.snapshotPath)) {
      const zip = new AdmZip(target.snapshotPath);
      zip.extractAllTo(APP_ROOT, true);
    }

    const currentVer = await this.getCurrentVersion();
    const patchFile = path.join(PATCHES_DIR, `patch-${currentVer.version}.rim-patch`);
    if (fs.existsSync(patchFile)) {
      const zip = new AdmZip(patchFile);
      const entries = zip.getEntries().filter(
        (e: any) => e.entryName.startsWith('rollback/') && e.entryName.endsWith('.sql'),
      );
      for (const entry of entries.sort((a: any, b: any) => b.entryName.localeCompare(a.entryName))) {
        const sql = entry.getData().toString('utf8');
        if (sql.trim()) await this.prisma.$executeRawUnsafe(sql);
      }
    }

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

  // ─── List snapshots ───────────────────────────────────────────────────────
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

  // ─── Private: run actual installation with progress reporting ─────────────
  private async runInstall(filePath: string, userId: number, jobId: string) {
    const update = (step: number, total: number, message: string) => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.step = step;
      job.total = total;
      job.pct = Math.round((step / total) * 100);
      job.message = message;
    };

    const TOTAL = 5;
    let snapshotPath: string | null = null; // track snapshot for auto-rollback

    try {
      // Step 1: Validate
      update(1, TOTAL, 'Validating patch file…');
      const { manifest } = await this.validatePatch(filePath);

      // Step 2: Create snapshot (MUST complete before any file changes)
      update(2, TOTAL, 'Creating snapshot of current version…');
      snapshotPath = await this.createSnapshot(manifest.fromVersion);

      // Step 3: Apply file changes
      update(3, TOTAL, 'Applying file changes…');
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const name = entry.entryName;
        if (name === 'manifest.json' || name === 'release-notes.md') continue;
        if (name.startsWith('rollback/')) continue;
        if (name.startsWith('frontend/') || name.startsWith('backend/')) {
          const destPath = path.join(APP_ROOT, name);
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          fs.writeFileSync(destPath, entry.getData());
        }
      }

      // Step 4: Run migrations
      update(4, TOTAL, 'Running database migrations…');
      for (const entry of entries) {
        if (entry.isDirectory) continue;
        if (entry.entryName.startsWith('migrations/') && entry.entryName.endsWith('.sql')) {
          const sql = entry.getData().toString('utf8');
          if (sql.trim()) await this.prisma.$executeRawUnsafe(sql);
        }
      }

      // Step 5: Update version record
      update(5, TOTAL, 'Updating version record…');
      await this.prisma.appVersion.updateMany({
        where: { status: VersionStatus.CURRENT },
        data: { status: VersionStatus.PREVIOUS },
      });

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

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      // Done
      const job = this.jobs.get(jobId);
      if (job) {
        job.step = TOTAL;
        job.pct = 100;
        job.message = `Version ${manifest.version} installed successfully`;
        job.status = 'done';
        job.result = newVersion;
        job.finishedAt = new Date();
      }

      // Auto-cleanup job after 10 minutes
      setTimeout(() => this.jobs.delete(jobId), 10 * 60 * 1000);
    } catch (err: any) {
      // ── Auto-rollback: restore snapshot if file changes may have been applied ──
      const currentJob = this.jobs.get(jobId);
      const stepReached = currentJob?.step ?? 0;
      let rollbackNote = '';

      if (snapshotPath && stepReached >= 3 && fs.existsSync(snapshotPath)) {
        try {
          update(stepReached, TOTAL, 'Rolling back — restoring previous version…');
          const snapZip = new AdmZip(snapshotPath);
          snapZip.extractAllTo(APP_ROOT, /*overwrite=*/ true);
          rollbackNote = ' Previous version restored automatically.';
        } catch (rbErr: any) {
          rollbackNote = ` Auto-rollback failed: ${rbErr?.message}. Manual restore needed from snapshot: ${snapshotPath}`;
        }
      }

      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }

      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = (err?.message || 'Unknown error') + rollbackNote;
        job.message = 'Installation failed' + (rollbackNote ? ' — rolled back' : '');
        job.finishedAt = new Date();
        // Keep snapshot path in result for manual recovery
        if (snapshotPath) job.result = { snapshotPath };
      }
    }
  }

  // ─── Private: create snapshot zip ─────────────────────────────────────────
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
}
