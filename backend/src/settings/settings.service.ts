// src/settings/settings.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all settings by category
   */
  async getByCategory(category: string) {
    const configs = await this.prisma.systemConfig.findMany({
      where: { category },
      select: {
        key: true,
        value: true,
        isEncrypted: true,
      },
    });

    // Convert array to object
    const result: Record<string, string> = {};
    for (const config of configs) {
      // Mask encrypted values
      result[config.key] = config.isEncrypted ? '********' : config.value;
    }
    return result;
  }

  /**
   * Get a single setting
   */
  async get(key: string): Promise<string | null> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });
    return config?.value || null;
  }

  /**
   * Set a single setting
   */
  async set(key: string, value: string, category = 'general', isEncrypted = false) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value,
        category,
        isEncrypted,
      },
      update: {
        value,
        isEncrypted,
      },
    });
  }

  /**
   * Set multiple settings at once
   */
  async setMany(settings: Record<string, string>, category = 'general') {
    const operations = Object.entries(settings).map(([key, value]) =>
      this.prisma.systemConfig.upsert({
        where: { key },
        create: {
          key,
          value: value || '',
          category,
          isEncrypted: key.toLowerCase().includes('password'),
        },
        update: {
          value: value || '',
        },
      })
    );

    await this.prisma.$transaction(operations);
    return { message: 'Settings saved successfully' };
  }

  /**
   * Get email settings
   */
  async getEmailSettings() {
    const keys = [
      'smtp_host',
      'smtp_port',
      'smtp_user',
      'smtp_password',
      'smtp_secure',
      'from_email',
      'from_name',
      'close_notification_to',
      'close_notification_cc',
      'cc_store_email',
    ];

    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: { in: keys },
      },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.isEncrypted ? '' : c.value;
    }

    return {
      smtpHost: configMap['smtp_host'] || '',
      smtpPort: parseInt(configMap['smtp_port']) || 587,
      smtpUser: configMap['smtp_user'] || '',
      smtpPassword: '', // Never return password
      smtpSecure: configMap['smtp_secure'] === 'true',
      fromEmail: configMap['from_email'] || '',
      fromName: configMap['from_name'] || 'RIM System',
      closeNotificationTo: configMap['close_notification_to'] || '',
      closeNotificationCc: configMap['close_notification_cc'] || '',
      ccStoreEmail: configMap['cc_store_email'] === 'true',
    };
  }

  /**
   * Save email settings
   */
  async saveEmailSettings(data: {
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    smtpSecure?: boolean;
    fromEmail?: string;
    fromName?: string;
    closeNotificationTo?: string;
    closeNotificationCc?: string;
    ccStoreEmail?: boolean;
  }) {
    const operations = [];

    if (data.smtpHost !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'smtp_host' },
          create: { key: 'smtp_host', value: data.smtpHost, category: 'email' },
          update: { value: data.smtpHost },
        })
      );
    }

    if (data.smtpPort !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'smtp_port' },
          create: { key: 'smtp_port', value: String(data.smtpPort), category: 'email' },
          update: { value: String(data.smtpPort) },
        })
      );
    }

    if (data.smtpUser !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'smtp_user' },
          create: { key: 'smtp_user', value: data.smtpUser, category: 'email' },
          update: { value: data.smtpUser },
        })
      );
    }

    // Only update password if provided and not empty
    if (data.smtpPassword && data.smtpPassword.trim() !== '') {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'smtp_password' },
          create: { key: 'smtp_password', value: data.smtpPassword, category: 'email', isEncrypted: true },
          update: { value: data.smtpPassword },
        })
      );
    }

    if (data.smtpSecure !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'smtp_secure' },
          create: { key: 'smtp_secure', value: String(data.smtpSecure), category: 'email' },
          update: { value: String(data.smtpSecure) },
        })
      );
    }

    if (data.fromEmail !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'from_email' },
          create: { key: 'from_email', value: data.fromEmail, category: 'email' },
          update: { value: data.fromEmail },
        })
      );
    }

    if (data.fromName !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'from_name' },
          create: { key: 'from_name', value: data.fromName, category: 'email' },
          update: { value: data.fromName },
        })
      );
    }

    if (data.closeNotificationTo !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'close_notification_to' },
          create: { key: 'close_notification_to', value: data.closeNotificationTo, category: 'email' },
          update: { value: data.closeNotificationTo },
        })
      );
    }

    if (data.closeNotificationCc !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'close_notification_cc' },
          create: { key: 'close_notification_cc', value: data.closeNotificationCc, category: 'email' },
          update: { value: data.closeNotificationCc },
        })
      );
    }

    if (data.ccStoreEmail !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'cc_store_email' },
          create: { key: 'cc_store_email', value: String(data.ccStoreEmail), category: 'email' },
          update: { value: String(data.ccStoreEmail) },
        })
      );
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return { message: 'Email settings saved successfully' };
  }

  /**
   * Get system info
   */
  async getSystemInfo() {
    return {
      version: '1.0.0',
      buildDate: '2024-01-15',
      developer: 'RIM Development Team',
      website: 'https://rim-system.com',
      email: 'support@rim-system.com',
      phone: '+66 2 xxx xxxx',
      licenseStatus: 'active',
      licenseExpiry: '2025-12-31',
      licensedTo: 'Your Company Name',
    };
  }

  // ========================================
  // ORGANIZATION SETTINGS
  // ========================================

  /**
   * Get organization settings
   */
  async getOrganizationSettings() {
    const keys = [
      'organization_name',
      'organization_prefix',
      'organization_logo',
      'organization_address',
    ];

    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: { in: keys },
      },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return {
      organizationName: configMap['organization_name'] || '',
      incidentPrefix: configMap['organization_prefix'] || 'INC',
      logoPath: configMap['organization_logo'] || '',
      organizationAddress: configMap['organization_address'] || '',
    };
  }

  /**
   * Save organization settings
   */
  async saveOrganizationSettings(data: {
    organizationName?: string;
    incidentPrefix?: string;
    logoPath?: string;
    organizationAddress?: string;
  }) {
    const operations = [];

    if (data.organizationName !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'organization_name' },
          create: { key: 'organization_name', value: data.organizationName, category: 'organization', description: 'Organization/Customer name' },
          update: { value: data.organizationName },
        })
      );
    }

    if (data.incidentPrefix !== undefined) {
      // Validate prefix (3 uppercase letters)
      const prefix = data.incidentPrefix.toUpperCase().slice(0, 3);
      if (!/^[A-Z]{1,3}$/.test(prefix)) {
        throw new Error('Incident prefix must be 1-3 uppercase letters');
      }
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'organization_prefix' },
          create: { key: 'organization_prefix', value: prefix, category: 'organization', description: 'Prefix for incident ticket numbers (e.g., WAT, INC)' },
          update: { value: prefix },
        })
      );
    }

    if (data.logoPath !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'organization_logo' },
          create: { key: 'organization_logo', value: data.logoPath, category: 'organization', description: 'Path to organization logo' },
          update: { value: data.logoPath },
        })
      );
    }

    if (data.organizationAddress !== undefined) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'organization_address' },
          create: { key: 'organization_address', value: data.organizationAddress, category: 'organization', description: 'Organization address for service reports' },
          update: { value: data.organizationAddress },
        })
      );
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return { message: 'Organization settings saved successfully' };
  }

  // ========================================
  // SERVICE REPORT SETTINGS
  // ========================================

  /**
   * Get service report settings (provider info for Service Report header)
   */
  async getServiceReportSettings() {
    const keys = [
      'sr_provider_name',
      'sr_provider_address',
      'sr_provider_phone',
      'sr_provider_email',
      'sr_provider_tax_id',
      'sr_provider_logo',
      'sr_template_style',
      'sr_theme_bg_start',
      'sr_theme_bg_end',
    ];

    const configs = await this.prisma.systemConfig.findMany({
      where: { key: { in: keys } },
    });

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return {
      providerName: configMap['sr_provider_name'] || '',
      providerAddress: configMap['sr_provider_address'] || '',
      providerPhone: configMap['sr_provider_phone'] || '',
      providerEmail: configMap['sr_provider_email'] || '',
      providerTaxId: configMap['sr_provider_tax_id'] || '',
      providerLogo: configMap['sr_provider_logo'] || '',
      templateStyle: configMap['sr_template_style'] || 'classic',
      srThemeBgStart: configMap['sr_theme_bg_start'] || '',
      srThemeBgEnd: configMap['sr_theme_bg_end'] || '',
    };
  }

  /**
   * Save service report settings
   */
  async saveServiceReportSettings(data: {
    providerName?: string;
    providerAddress?: string;
    providerPhone?: string;
    providerEmail?: string;
    providerTaxId?: string;
    providerLogo?: string;
    templateStyle?: string;
    srThemeBgStart?: string;
    srThemeBgEnd?: string;
  }) {
    const operations = [];
    const fieldMap: Record<string, string | undefined> = {
      sr_provider_name: data.providerName,
      sr_provider_address: data.providerAddress,
      sr_provider_phone: data.providerPhone,
      sr_provider_email: data.providerEmail,
      sr_provider_tax_id: data.providerTaxId,
      sr_provider_logo: data.providerLogo,
      sr_template_style: data.templateStyle,
      sr_theme_bg_start: data.srThemeBgStart,
      sr_theme_bg_end: data.srThemeBgEnd,
    };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        operations.push(
          this.prisma.systemConfig.upsert({
            where: { key },
            create: { key, value: value || '', category: 'service_report', description: `Service Report: ${key}` },
            update: { value: value || '' },
          }),
        );
      }
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return { message: 'Service Report settings saved successfully' };
  }

  /**
   * Get theme settings
   */
  async getThemeSettings() {
    const keys = ['theme_bg_start', 'theme_bg_end'];
    const configs = await this.prisma.systemConfig.findMany({
      where: { key: { in: keys } },
    });
    const configMap: Record<string, string> = {};
    configs.forEach((c) => (configMap[c.key] = c.value));

    return {
      bgStart: configMap['theme_bg_start'] || '#0f172a',
      bgEnd: configMap['theme_bg_end'] || '#1e293b',
    };
  }

  /**
   * Save theme settings
   */
  async saveThemeSettings(data: { bgStart: string; bgEnd: string }) {
    const operations = [];

    if (data.bgStart) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'theme_bg_start' },
          create: { key: 'theme_bg_start', value: data.bgStart, category: 'theme', description: 'Background gradient start color' },
          update: { value: data.bgStart },
        }),
      );
    }

    if (data.bgEnd) {
      operations.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'theme_bg_end' },
          create: { key: 'theme_bg_end', value: data.bgEnd, category: 'theme', description: 'Background gradient end color' },
          update: { value: data.bgEnd },
        }),
      );
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return { message: 'Theme settings saved successfully' };
  }

  /**
   * Get incident prefix for ticket number generation
   */
  async getIncidentPrefix(): Promise<string> {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: 'organization_prefix' },
    });
    return config?.value || 'INC';
  }

  /**
   * Get incident-specific settings (service warranty days, auto assign onsite, etc.)
   */
  async getIncidentSettings() {
    const configs = await this.prisma.systemConfig.findMany({
      where: { key: { in: ['service_warranty_days', 'auto_assign_onsite'] } },
    });
    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    return {
      serviceWarrantyDays: map['service_warranty_days'] ? parseInt(map['service_warranty_days']) : 30,
      autoAssignOnsite: map['auto_assign_onsite'] === 'true',
    };
  }

  /**
   * Save incident-specific settings
   */
  async saveIncidentSettings(data: { serviceWarrantyDays?: number; autoAssignOnsite?: boolean }) {
    const ops: Promise<any>[] = [];

    if (data.serviceWarrantyDays !== undefined) {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'service_warranty_days' },
          create: {
            key: 'service_warranty_days',
            value: String(data.serviceWarrantyDays),
            category: 'incident',
            description: 'Number of days after closing an incident that the service warranty is valid',
          },
          update: { value: String(data.serviceWarrantyDays) },
        }),
      );
    }

    if (data.autoAssignOnsite !== undefined) {
      ops.push(
        this.prisma.systemConfig.upsert({
          where: { key: 'auto_assign_onsite' },
          create: {
            key: 'auto_assign_onsite',
            value: String(data.autoAssignOnsite),
            category: 'incident',
            description: 'Auto-assign ONSITE incidents to the sole INSOURCE technician covering the store province',
          },
          update: { value: String(data.autoAssignOnsite) },
        }),
      );
    }

    await Promise.all(ops);
    return { message: 'Incident settings saved successfully' };
  }
}
