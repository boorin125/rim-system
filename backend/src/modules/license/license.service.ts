// src/modules/license/license.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateLicenseDto,
  UpdateLicenseDto,
  ActivateLicenseDto,
  RenewLicenseDto,
  SetConfigDto,
} from './dto';
import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';

// Feature limits by license type
const LICENSE_FEATURES = {
  TRIAL: {
    maxUsers: 5,
    maxStores: 10,
    maxIncidentsMonth: 50,
    features: ['basic_incidents', 'basic_stores'],
    durationDays: 14,
  },
  BASIC: {
    maxUsers: 10,
    maxStores: 10,
    maxIncidentsMonth: 200,
    features: ['basic_incidents', 'basic_stores', 'equipment', 'reports'],
    durationDays: 365,
  },
  PROFESSIONAL: {
    maxUsers: 50,
    maxStores: 300,
    maxIncidentsMonth: 1000,
    features: ['basic_incidents', 'basic_stores', 'equipment', 'reports', 'sla', 'performance', 'knowledge_base', 'realtime_tracking'],
    durationDays: 365,
  },
  ENTERPRISE: {
    maxUsers: 500,
    maxStores: 1000,
    maxIncidentsMonth: null, // unlimited
    features: ['all'],
    durationDays: 365,
  },
  UNLIMITED: {
    maxUsers: 99999,
    maxStores: 99999,
    maxIncidentsMonth: null,
    features: ['all'],
    durationDays: 3650, // 10 years
  },
};

@Injectable()
export class LicenseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate unique license key
   */
  private generateLicenseKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];

    for (let s = 0; s < 4; s++) {
      let segment = '';
      for (let i = 0; i < 4; i++) {
        segment += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      segments.push(segment);
    }

    return segments.join('-');
  }

  /**
   * Get machine ID — uses MAC address + CPU model only (stable across OS reinstalls)
   */
  getMachineId(): string {
    const cpus = os.cpus();
    const networkInterfaces = os.networkInterfaces();

    // Get first non-loopback MAC address (survives OS reinstall)
    let mac = '';
    for (const ifaces of Object.values(networkInterfaces)) {
      for (const iface of ifaces ?? []) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          mac = iface.mac;
          break;
        }
      }
      if (mac) break;
    }

    // MAC + CPU model = stable hardware fingerprint
    // Fallback to platform + cpu + arch if no MAC found (some VMs)
    const hardware = mac
      ? `${mac}-${cpus[0]?.model || ''}`
      : `${os.platform()}-${cpus[0]?.model || ''}-${os.arch()}`;

    return crypto.createHash('sha256').update(hardware).digest('hex').substring(0, 32);
  }

  /**
   * Detect if the server is running inside a Virtual Machine.
   * Checks SMBIOS/DMI data on Linux and WMI on Windows.
   */
  private detectVirtualization(): { isVirtualMachine: boolean; vmType: string | null } {
    try {
      const platform = os.platform();

      if (platform === 'linux') {
        // ── 1. systemd-detect-virt (most reliable — covers KVM, LXC, VMware, Xen, etc.) ──
        try {
          const virt = execSync('systemd-detect-virt 2>/dev/null', { timeout: 2000 }).toString().trim().toLowerCase();
          if (virt && virt !== 'none') {
            const virtMap: Record<string, string> = {
              kvm: 'KVM/QEMU (Proxmox or bare)',
              qemu: 'KVM/QEMU',
              lxc: 'Proxmox LXC',
              'lxc-libvirt': 'LXC (libvirt)',
              vmware: 'VMware',
              microsoft: 'Hyper-V',
              oracle: 'VirtualBox',
              xen: 'Xen',
              bochs: 'Bochs',
              uml: 'User-mode Linux',
              parallels: 'Parallels',
              bhyve: 'bhyve',
            };
            return { isVirtualMachine: true, vmType: virtMap[virt] ?? virt.toUpperCase() };
          }
        } catch { /* systemd-detect-virt not available — fall through */ }

        // ── 2. Proxmox LXC fallback (for systems without systemd-detect-virt) ──
        try {
          const environ = execSync('cat /proc/1/environ 2>/dev/null', { timeout: 1000 }).toString();
          if (environ.includes('container=lxc')) return { isVirtualMachine: true, vmType: 'Proxmox LXC' };
        } catch { /* ignore */ }

        // ── 3. DMI/SMBIOS fallback (for KVM/VMware/VirtualBox without systemd) ──
        const readDmi = (file: string) => {
          try { return execSync(`cat /sys/class/dmi/id/${file} 2>/dev/null`, { timeout: 1000 }).toString().trim(); } catch { return ''; }
        };
        const vendor = readDmi('sys_vendor').toLowerCase();
        const product = readDmi('product_name').toLowerCase();
        const bios = readDmi('bios_vendor').toLowerCase();

        if (vendor.includes('vmware') || product.includes('vmware')) return { isVirtualMachine: true, vmType: 'VMware' };
        if (vendor.includes('microsoft') || product.includes('virtual machine')) return { isVirtualMachine: true, vmType: 'Hyper-V' };
        if (vendor.includes('innotek') || vendor.includes('virtualbox') || product.includes('virtualbox')) return { isVirtualMachine: true, vmType: 'VirtualBox' };
        if (vendor.includes('qemu') || product.includes('qemu') || product.includes('standard pc')) return { isVirtualMachine: true, vmType: 'KVM/QEMU (Proxmox or bare)' };
        if (vendor.includes('xen') || bios.includes('xen')) return { isVirtualMachine: true, vmType: 'Xen' };
        if (vendor.includes('bochs') || product.includes('bochs')) return { isVirtualMachine: true, vmType: 'Bochs' };

      } else if (platform === 'win32') {
        try {
          const model = execSync('wmic computersystem get model /value', { timeout: 3000 }).toString().toLowerCase();
          const manufacturer = execSync('wmic computersystem get manufacturer /value', { timeout: 3000 }).toString().toLowerCase();

          if (model.includes('vmware')) return { isVirtualMachine: true, vmType: 'VMware' };
          if (model.includes('virtual machine') || manufacturer.includes('microsoft corporation')) return { isVirtualMachine: true, vmType: 'Hyper-V' };
          if (model.includes('virtualbox') || manufacturer.includes('innotek')) return { isVirtualMachine: true, vmType: 'VirtualBox' };
          if (model.includes('kvm') || model.includes('qemu')) return { isVirtualMachine: true, vmType: 'KVM/QEMU (Proxmox or bare)' };
        } catch { /* WMIC unavailable on newer Windows — try PowerShell */ }

        try {
          const ps = execSync(
            'powershell -NoProfile -Command "(Get-WmiObject Win32_ComputerSystem).Model"',
            { timeout: 4000 }
          ).toString().toLowerCase();
          if (ps.includes('vmware')) return { isVirtualMachine: true, vmType: 'VMware' };
          if (ps.includes('virtual machine')) return { isVirtualMachine: true, vmType: 'Hyper-V' };
          if (ps.includes('virtualbox')) return { isVirtualMachine: true, vmType: 'VirtualBox' };
          if (ps.includes('kvm') || ps.includes('qemu')) return { isVirtualMachine: true, vmType: 'KVM/QEMU (Proxmox or bare)' };
        } catch { /* ignore */ }
      }
    } catch { /* ignore detection errors */ }

    return { isVirtualMachine: false, vmType: null };
  }

  /**
   * Get full machine information including VM detection
   */
  getMachineInfo() {
    const machineId = this.getMachineId();
    const { isVirtualMachine, vmType } = this.detectVirtualization();
    return {
      machineId,
      isVirtualMachine,
      vmType,
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
    };
  }

  /**
   * Create new license (Admin/Internal use)
   */
  async createLicense(dto: CreateLicenseDto) {
    const licenseKey = this.generateLicenseKey();
    const typeConfig = LICENSE_FEATURES[dto.licenseType as keyof typeof LICENSE_FEATURES];

    return this.prisma.license.create({
      data: {
        licenseKey,
        licenseType: dto.licenseType,
        organizationName: dto.organizationName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        maxUsers: dto.maxUsers || typeConfig.maxUsers,
        maxStores: dto.maxStores || typeConfig.maxStores,
        maxIncidentsMonth: dto.maxIncidentsMonth ?? typeConfig.maxIncidentsMonth,
        featuresEnabled: dto.featuresEnabled || typeConfig.features,
        expiresAt: new Date(dto.expiresAt),
        maxActivations: dto.maxActivations || 1,
        notes: dto.notes,
      },
    });
  }

  /**
   * Get all licenses
   */
  async getLicenses(query?: {
    page?: number;
    limit?: number;
    status?: string;
    licenseType?: string;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.licenseType) {
      where.licenseType = query.licenseType;
    }

    const [licenses, total] = await Promise.all([
      this.prisma.license.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.license.count({ where }),
    ]);

    return {
      data: licenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get license by ID
   */
  async getLicense(id: number) {
    const license = await this.prisma.license.findUnique({
      where: { id },
      include: {
        activationLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!license) {
      throw new NotFoundException(`License not found: ${id}`);
    }

    return license;
  }

  /**
   * Update license
   */
  async updateLicense(id: number, dto: UpdateLicenseDto) {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License not found: ${id}`);
    }

    return this.prisma.license.update({
      where: { id },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  /**
   * Delete license
   */
  async deleteLicense(id: number) {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License not found: ${id}`);
    }

    return this.prisma.license.delete({
      where: { id },
    });
  }

  /**
   * Activate license
   */
  async activateLicense(dto: ActivateLicenseDto, ipAddress?: string, userAgent?: string) {
    const license = await this.prisma.license.findUnique({
      where: { licenseKey: dto.licenseKey },
    });

    if (!license) {
      // Log failed attempt
      throw new BadRequestException('Invalid license key');
    }

    const machineId = dto.machineId || this.getMachineId();
    const existingMachineIds: string[] = (license as any).machineIds || [];

    // Already activated on THIS machine — just refresh
    if (license.status === 'ACTIVE' && existingMachineIds.includes(machineId)) {
      await this.prisma.license.update({ where: { id: license.id }, data: { lastCheckAt: new Date() } });
      return {
        success: true,
        message: 'License is already active on this machine',
        license: this.sanitizeLicense(license),
      };
    }

    // Check if suspended/revoked
    if (['SUSPENDED', 'REVOKED'].includes(license.status)) {
      await this.logActivation(license.id, 'ACTIVATE', machineId, ipAddress, userAgent, false, `License is ${license.status.toLowerCase()}`);
      throw new BadRequestException(`License is ${license.status.toLowerCase()}`);
    }

    // Check if expired
    if (new Date() > license.expiresAt) {
      await this.logActivation(license.id, 'ACTIVATE', machineId, ipAddress, userAgent, false, 'License expired');
      throw new BadRequestException('License has expired');
    }

    // Check if this machine is trying to activate but max slots are full
    const currentlyBound = existingMachineIds.length;
    if (currentlyBound >= license.maxActivations) {
      await this.logActivation(license.id, 'ACTIVATE', machineId, ipAddress, userAgent, false,
        `Max activations reached (${currentlyBound}/${license.maxActivations})`);
      throw new BadRequestException(
        `License activation limit reached (${currentlyBound}/${license.maxActivations} machines). ` +
        `Contact your vendor to upgrade to a Volume License or deactivate an existing machine.`
      );
    }

    // New machine slot — add to machineIds[]
    const newMachineIds = [...existingMachineIds, machineId];

    const updatedLicense = await this.prisma.license.update({
      where: { id: license.id },
      data: {
        status: 'ACTIVE',
        machineId: existingMachineIds.length === 0 ? machineId : license.machineId, // primary stays first
        machineIds: newMachineIds,
        activatedAt: license.activatedAt || new Date(),
        lastActivationAt: new Date(),
        lastCheckAt: new Date(),
        activationCount: { increment: 1 },
      },
    });

    await this.logActivation(license.id, 'ACTIVATE', machineId, ipAddress, userAgent, true,
      `Machine ${currentlyBound + 1}/${license.maxActivations}`);

    return {
      success: true,
      message: `License activated successfully (${newMachineIds.length}/${license.maxActivations} machines)`,
      license: this.sanitizeLicense(updatedLicense),
      machineSlot: { used: newMachineIds.length, total: license.maxActivations },
    };
  }

  /**
   * Auto-create a 30-day TRIAL license for this machine on first install
   */
  private async autoCreateTrial(machineId: string) {
    const TRIAL_DAYS = 30;
    const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const license = await this.prisma.license.create({
      data: {
        licenseKey: this.generateLicenseKey(),
        licenseType: 'TRIAL',
        organizationName: 'Trial',
        contactEmail: 'trial@local',
        maxUsers: LICENSE_FEATURES.TRIAL.maxUsers,
        maxStores: LICENSE_FEATURES.TRIAL.maxStores,
        maxIncidentsMonth: LICENSE_FEATURES.TRIAL.maxIncidentsMonth,
        featuresEnabled: ['all'],
        expiresAt,
        maxActivations: 1,
        status: 'ACTIVE',
        machineId,
        activatedAt: new Date(),
        lastActivationAt: new Date(),
        lastCheckAt: new Date(),
        activationCount: 1,
        notes: 'Auto-created 30-day trial license',
      },
    });

    await this.logActivation(license.id, 'ACTIVATE', machineId, null, null, true, 'Auto-created trial');
    return license;
  }

  /**
   * Validate current license
   * For TRIAL licenses:
   *   Day 1–7   → valid: true,  trialPhase: 'FULL'   (full access)
   *   Day 8–30  → valid: false, trialPhase: 'GRACE'  (Level 1 features blocked)
   *   Day 31+   → valid: false, trialPhase: 'EXPIRED'
   */
  async validateLicense(machineId?: string) {
    const currentMachineId = machineId || this.getMachineId();

    let license = await this.prisma.license.findFirst({
      where: {
        OR: [
          { machineId: currentMachineId },          // backward compat: single machineId
          { machineIds: { has: currentMachineId } }, // Volume License: machineIds array
          { status: 'ACTIVE', machineId: null, machineIds: { isEmpty: true } }, // no binding
        ],
      },
      orderBy: { activatedAt: 'desc' },
    });

    // Auto-create trial on first install (only if this machine has NEVER had a license)
    if (!license) {
      const hadLicenseBefore = await this.prisma.license.findFirst({
        where: { machineId: currentMachineId },
      });
      if (!hadLicenseBefore) {
        license = await this.autoCreateTrial(currentMachineId);
      }
    }

    if (!license) {
      return {
        valid: false,
        reason: 'NO_LICENSE',
        message: 'No license found for this machine',
      };
    }

    // ── TRIAL phase logic ──────────────────────────────────────────────
    if (license.licenseType === 'TRIAL') {
      const TOTAL_TRIAL_DAYS = 30;
      const trialStart = license.activatedAt || license.createdAt;
      const daysSinceStart = Math.floor((Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24));
      const trialDaysRemaining = Math.max(0, TOTAL_TRIAL_DAYS - daysSinceStart);

      if (daysSinceStart < TOTAL_TRIAL_DAYS) {
        // Full access for all 30 days
        await this.prisma.license.update({ where: { id: license.id }, data: { lastCheckAt: new Date() } });
        return {
          valid: true,
          trialPhase: 'FULL',
          trialDaysRemaining,
          daysRemaining: trialDaysRemaining,
          license: this.sanitizeLicense(license),
        };
      }

      // Trial fully expired (Day 31+)
      await this.prisma.license.update({ where: { id: license.id }, data: { status: 'EXPIRED' } });
      return {
        valid: false,
        reason: 'TRIAL_EXPIRED',
        trialPhase: 'EXPIRED',
        trialDaysRemaining: 0,
        daysRemaining: 0,
        message: 'ระยะทดลองใช้งาน 30 วันสิ้นสุดแล้ว กรุณา Activate License เพื่อใช้งานต่อ',
      };
    }

    // ── Paid license logic ─────────────────────────────────────────────
    if (new Date() > license.expiresAt) {
      await this.prisma.license.update({ where: { id: license.id }, data: { status: 'EXPIRED' } });
      return {
        valid: false,
        reason: 'EXPIRED',
        message: 'License has expired',
        expiresAt: license.expiresAt,
      };
    }

    if (license.status !== 'ACTIVE') {
      return {
        valid: false,
        reason: license.status,
        message: `License is ${license.status.toLowerCase()}`,
      };
    }

    await this.prisma.license.update({ where: { id: license.id }, data: { lastCheckAt: new Date() } });
    return {
      valid: true,
      trialPhase: null,
      license: this.sanitizeLicense(license),
      daysRemaining: Math.ceil((license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    };
  }

  /**
   * Get current license status
   */
  async getCurrentLicense() {
    const machineId = this.getMachineId();

    const license = await this.prisma.license.findFirst({
      where: {
        status: 'ACTIVE',
      },
      orderBy: { activatedAt: 'desc' },
    });

    if (!license) {
      return {
        hasLicense: false,
        machineId,
      };
    }

    const validation = await this.validateLicense(machineId);

    return {
      hasLicense: true,
      ...validation,
      machineId,
    };
  }

  /**
   * Renew license
   */
  async renewLicense(id: number, dto: RenewLicenseDto) {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License not found: ${id}`);
    }

    const newExpiresAt = new Date(dto.newExpiresAt);

    const updatedLicense = await this.prisma.license.update({
      where: { id },
      data: {
        expiresAt: newExpiresAt,
        status: 'ACTIVE',
        notes: dto.notes
          ? `${license.notes || ''}\n[Renewed: ${new Date().toISOString()}] ${dto.notes}`
          : license.notes,
      },
    });

    await this.logActivation(id, 'RENEW', license.machineId, null, null, true, null);

    return updatedLicense;
  }

  /**
   * Suspend license
   */
  async suspendLicense(id: number, reason: string) {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License not found: ${id}`);
    }

    const updatedLicense = await this.prisma.license.update({
      where: { id },
      data: {
        status: 'SUSPENDED',
        notes: `${license.notes || ''}\n[Suspended: ${new Date().toISOString()}] ${reason}`,
      },
    });

    await this.logActivation(id, 'DEACTIVATE', license.machineId, null, null, true, reason);

    return updatedLicense;
  }

  /**
   * Revoke license
   */
  async revokeLicense(id: number, reason: string) {
    const license = await this.prisma.license.findUnique({
      where: { id },
    });

    if (!license) {
      throw new NotFoundException(`License not found: ${id}`);
    }

    const updatedLicense = await this.prisma.license.update({
      where: { id },
      data: {
        status: 'REVOKED',
        notes: `${license.notes || ''}\n[Revoked: ${new Date().toISOString()}] ${reason}`,
      },
    });

    await this.logActivation(id, 'DEACTIVATE', license.machineId, null, null, true, reason);

    return updatedLicense;
  }

  /**
   * Check feature availability
   */
  async checkFeature(feature: string): Promise<boolean> {
    const result = await this.validateLicense();

    if (!result.valid) {
      return false;
    }

    const license = result.license as any;
    const enabledFeatures = license.featuresEnabled || [];

    return enabledFeatures.includes('all') || enabledFeatures.includes(feature);
  }

  /**
   * Check usage limits
   */
  async checkLimits(): Promise<{
    users: { current: number; max: number; available: boolean };
    stores: { current: number; max: number; available: boolean };
    incidents: { current: number; max: number | null; available: boolean };
  }> {
    const result = await this.validateLicense();

    if (!result.valid) {
      throw new ForbiddenException('No valid license');
    }

    const license = result.license as any;

    // Count current usage
    const [userCount, storeCount, incidentCount] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.store.count({ where: { storeStatus: 'ACTIVE' } }),
      this.prisma.incident.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      users: {
        current: userCount,
        max: license.maxUsers,
        available: userCount < license.maxUsers,
      },
      stores: {
        current: storeCount,
        max: license.maxStores,
        available: storeCount < license.maxStores,
      },
      incidents: {
        current: incidentCount,
        max: license.maxIncidentsMonth,
        available: license.maxIncidentsMonth === null || incidentCount < license.maxIncidentsMonth,
      },
    };
  }

  /**
   * Log activation attempt
   */
  private async logActivation(
    licenseId: number,
    action: string,
    machineId?: string | null,
    ipAddress?: string | null,
    userAgent?: string | null,
    success = true,
    errorMessage?: string | null,
  ) {
    await this.prisma.licenseActivationLog.create({
      data: {
        licenseId,
        action: action as any,
        machineId,
        ipAddress,
        userAgent,
        success,
        errorMessage,
      },
    });
  }

  /**
   * Sanitize license for public response
   */
  private sanitizeLicense(license: any) {
    const { hardwareHash, ...rest } = license;
    return rest;
  }

  // ==========================================
  // SYSTEM CONFIG METHODS
  // ==========================================

  /**
   * Get system config
   */
  async getConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    return config?.value;
  }

  /**
   * Set system config
   */
  async setConfig(dto: SetConfigDto) {
    return this.prisma.systemConfig.upsert({
      where: { key: dto.key },
      update: {
        value: dto.value,
        description: dto.description,
        isEncrypted: dto.isEncrypted,
        category: dto.category,
      },
      create: {
        key: dto.key,
        value: dto.value,
        description: dto.description,
        isEncrypted: dto.isEncrypted || false,
        category: dto.category || 'general',
      },
    });
  }

  /**
   * Get all configs
   */
  async getAllConfigs(category?: string) {
    const where = category ? { category } : {};

    return this.prisma.systemConfig.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  /**
   * Delete config
   */
  async deleteConfig(key: string) {
    return this.prisma.systemConfig.delete({
      where: { key },
    });
  }

  /**
   * Deactivate this machine's slot from a Volume License (or fully deactivate single-machine license).
   * For Volume licenses, only this machine's slot is released — other machines stay bound.
   * Pass `deactivateAll=true` to release all machines (SUPER_ADMIN intent, but still requires key match).
   */
  async deactivateLicense(licenseKey: string, machineId?: string, deactivateAll = false) {
    const license = await this.prisma.license.findUnique({ where: { licenseKey } });

    if (!license) throw new BadRequestException('Invalid license key');
    if (license.status !== 'ACTIVE') throw new BadRequestException('License is not active');

    const currentMachineId = machineId || this.getMachineId();
    const existingMachineIds: string[] = (license as any).machineIds || [];
    const isVolumeBindingMatch = existingMachineIds.includes(currentMachineId);
    const isPrimaryMatch = license.machineId === currentMachineId;

    if (!isVolumeBindingMatch && !isPrimaryMatch && existingMachineIds.length > 0) {
      throw new BadRequestException(
        'This machine is not bound to this license. Deactivate from one of the registered machines.',
      );
    }

    if (deactivateAll || license.maxActivations === 1) {
      // Full deactivation — release all machine bindings
      await this.prisma.license.update({
        where: { id: license.id },
        data: { status: 'INACTIVE', machineId: null, machineIds: [], activationCount: 0 },
      });
      await this.logActivation(license.id, 'DEACTIVATE', currentMachineId, null, null, true, 'Full deactivation — ready for transfer');
      return { success: true, message: 'License fully deactivated. Ready to activate on a new server.' };
    }

    // Volume License — release only this machine's slot
    const newMachineIds = existingMachineIds.filter((id) => id !== currentMachineId);
    const newPrimary = newMachineIds[0] ?? null;
    const isLastMachine = newMachineIds.length === 0;

    await this.prisma.license.update({
      where: { id: license.id },
      data: {
        machineIds: newMachineIds,
        machineId: newPrimary,
        activationCount: { decrement: 1 },
        ...(isLastMachine && { status: 'INACTIVE' }),
      },
    });

    await this.logActivation(license.id, 'DEACTIVATE', currentMachineId, null, null, true,
      `Machine slot released (${newMachineIds.length}/${license.maxActivations} remaining)`);

    return {
      success: true,
      message: isLastMachine
        ? 'Last machine deactivated. License is now inactive.'
        : `Machine slot released. ${newMachineIds.length}/${license.maxActivations} machines still bound.`,
    };
  }

  /**
   * Force transfer — clears ALL machine bindings (SUPER_ADMIN + VendorGuard)
   * Optionally revoke a single machine's slot from a Volume License.
   */
  async forceTransfer(id: number, adminNote?: string, revokeMachineId?: string) {
    const license = await this.prisma.license.findUnique({ where: { id } });
    if (!license) throw new NotFoundException(`License not found: ${id}`);

    const existingMachineIds: string[] = (license as any).machineIds || [];

    if (revokeMachineId) {
      // Revoke single machine slot from Volume License
      const newMachineIds = existingMachineIds.filter((m) => m !== revokeMachineId);
      await this.prisma.license.update({
        where: { id },
        data: {
          machineIds: newMachineIds,
          machineId: newMachineIds[0] ?? null,
          activationCount: { decrement: 1 },
          ...(newMachineIds.length === 0 && { status: 'INACTIVE' }),
        },
      });
      await this.logActivation(id, 'TRANSFER', revokeMachineId, null, null, true,
        adminNote ? `Single machine revoked by admin: ${adminNote}` : 'Single machine revoked by admin');
      return { success: true, message: `Machine slot revoked. ${newMachineIds.length}/${license.maxActivations} machines remain.` };
    }

    // Full transfer — clear all bindings
    await this.prisma.license.update({
      where: { id },
      data: { status: 'INACTIVE', machineId: null, machineIds: [], activationCount: 0 },
    });

    await this.logActivation(id, 'TRANSFER', license.machineId, null, null, true,
      adminNote ? `Force transfer by admin: ${adminNote}` : 'Force transfer by admin');

    return { success: true, message: 'All machine bindings cleared. License can now be activated on new servers.' };
  }

  /**
   * Get license statistics
   */
  async getStats() {
    const [
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      trialLicenses,
      recentActivations,
    ] = await Promise.all([
      this.prisma.license.count(),
      this.prisma.license.count({ where: { status: 'ACTIVE' } }),
      this.prisma.license.count({ where: { status: 'EXPIRED' } }),
      this.prisma.license.count({ where: { licenseType: 'TRIAL' } }),
      this.prisma.licenseActivationLog.findMany({
        include: {
          license: {
            select: { licenseKey: true, organizationName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      totalLicenses,
      activeLicenses,
      expiredLicenses,
      trialLicenses,
      inactiveLicenses: totalLicenses - activeLicenses - expiredLicenses,
      recentActivations,
    };
  }
}
