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

// Detect Docker environment — source files don't exist in production containers
const IS_DOCKER =
  fs.existsSync('/.dockerenv') ||
  process.env.DOCKER_ENV === 'true' ||
  !fs.existsSync(path.join(APP_ROOT, 'frontend', 'src'));

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

    // Checksum validation (optional — skip if not present)
    if (manifest.checksum) {
      const fileBuffer = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      if (manifest.checksum !== `sha256:${hash}`) {
        throw new BadRequestException('Patch checksum mismatch — file may be corrupted');
      }
    }

    const current = await this.getCurrentVersion();
    if (current.version !== manifest.fromVersion) {
      throw new BadRequestException(
        `Patch requires base version ${manifest.fromVersion}, but current is ${current.version}`,
      );
    }

    // Check if patch has file changes that can't apply in Docker
    const hasFileChanges = zip.getEntries().some(
      (e: any) =>
        !e.isDirectory &&
        e.entryName !== 'manifest.json' &&
        e.entryName !== 'release-notes.md' &&
        !e.entryName.startsWith('migrations/') &&
        !e.entryName.startsWith('rollback/'),
    );

    return { valid: true, manifest, hasFileChanges, isDocker: IS_DOCKER };
  }

  // ─── Start async install — returns jobId immediately ─────────────────────
  startInstall(filePath: string, userId: number): string {
    const jobId = crypto.randomBytes(8).toString('hex');

    const job: InstallProgress = {
      jobId,
      step: 0,
      total: 4,
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

    // Restore source files only if not Docker and snapshot exists
    if (!IS_DOCKER && target.snapshotPath && fs.existsSync(target.snapshotPath)) {
      const zip = new AdmZip(target.snapshotPath);
      zip.extractAllTo(APP_ROOT, true);
    }

    // Run rollback SQL if available
    const patchFile = path.join(PATCHES_DIR, `patch-${(await this.getCurrentVersion()).version}.rim-patch`);
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
    const TOTAL = 4;

    const update = (step: number, message: string) => {
      const job = this.jobs.get(jobId);
      if (!job) return;
      job.step = step;
      job.total = TOTAL;
      job.pct = Math.round((step / TOTAL) * 100);
      job.message = message;
    };

    try {
      // Step 1: Validate
      update(1, 'Validating patch file…');
      const { manifest, hasFileChanges } = await this.validatePatch(filePath);

      // Step 2: Create snapshot (source files if available, else skip)
      let snapshotPath: string | null = null;
      if (!IS_DOCKER) {
        update(2, 'Creating snapshot of current version…');
        snapshotPath = await this.createSnapshot(manifest.fromVersion);
      } else {
        update(2, IS_DOCKER && hasFileChanges
          ? 'Docker mode: file changes will be applied via image update (skipping snapshot)…'
          : 'Preparing to apply migrations…');
        await new Promise((r) => setTimeout(r, 300));
      }

      // Step 3: Apply file changes (source-based deploy only — skip in Docker)
      if (!IS_DOCKER && hasFileChanges) {
        update(3, 'Applying file changes…');
        const zip = new AdmZip(filePath);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const name = entry.entryName;
          if (name === 'manifest.json' || name === 'release-notes.md') continue;
          if (name.startsWith('rollback/') || name.startsWith('migrations/')) continue;
          if (name.startsWith('frontend/') || name.startsWith('backend/')) {
            const destPath = path.join(APP_ROOT, name);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, entry.getData());
          }
        }
      } else {
        update(3, 'Running database migrations…');
      }

      // Step 4: Run SQL migrations + update version record
      update(4, 'Applying migrations and updating version…');
      const zip = new AdmZip(filePath);
      const migrations = zip.getEntries().filter(
        (e: any) => !e.isDirectory && e.entryName.startsWith('migrations/') && e.entryName.endsWith('.sql'),
      );
      for (const entry of migrations) {
        const sql = entry.getData().toString('utf8');
        if (sql.trim()) await this.prisma.$executeRawUnsafe(sql);
      }

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

      const job = this.jobs.get(jobId);
      if (job) {
        job.step = TOTAL;
        job.pct = 100;
        job.message = IS_DOCKER && hasFileChanges
          ? `Version ${manifest.version} recorded. Deploy new image to apply code changes.`
          : `Version ${manifest.version} installed successfully`;
        job.status = 'done';
        job.result = { ...newVersion, isDocker: IS_DOCKER, hasFileChanges };
        job.finishedAt = new Date();
      }

      setTimeout(() => this.jobs.delete(jobId), 10 * 60 * 1000);
    } catch (err: any) {
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }

      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = err?.message || 'Unknown error';
        job.message = 'Installation failed';
        job.finishedAt = new Date();
      }
    }
  }

  // ─── Private: create snapshot zip (source-based only) ─────────────────────
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
