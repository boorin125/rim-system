import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlaConfigDto, UpdateSlaConfigDto } from './dto/sla-config.dto';
import { Priority, SlaRegion } from '@prisma/client';

@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

  // ========================================
  // SLA CONFIG CRUD
  // ========================================

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.prisma.slaConfig.findMany({
      where,
      orderBy: {
        priority: 'asc', // CRITICAL, HIGH, MEDIUM, LOW
      },
    });
  }

  async findByPriority(priority: Priority) {
    const config = await this.prisma.slaConfig.findUnique({
      where: { priority },
    });

    if (!config) {
      throw new NotFoundException(`SLA config for priority ${priority} not found`);
    }

    return config;
  }

  async findById(id: number) {
    const config = await this.prisma.slaConfig.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`SLA config with ID ${id} not found`);
    }

    return config;
  }

  async create(dto: CreateSlaConfigDto) {
    // Check if config for this priority already exists
    const existing = await this.prisma.slaConfig.findUnique({
      where: { priority: dto.priority },
    });

    if (existing) {
      throw new ConflictException(`SLA config for priority ${dto.priority} already exists`);
    }

    return this.prisma.slaConfig.create({
      data: {
        priority: dto.priority,
        name: dto.name,
        description: dto.description,
        responseTimeMinutes: dto.responseTimeMinutes,
        resolutionTimeMinutes: dto.resolutionTimeMinutes,
        responseTimeProvincial: dto.responseTimeProvincial,
        resolutionTimeProvincial: dto.resolutionTimeProvincial,
        escalationEnabled: dto.escalationEnabled ?? true,
        escalationAfterMinutes: dto.escalationAfterMinutes,
        warningThreshold: dto.warningThreshold ?? 80,
        color: dto.color,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: number, dto: UpdateSlaConfigDto) {
    // Check if config exists
    await this.findById(id);

    // Map displayName to name (displayName is used by frontend but DB uses name)
    const updateData: any = { ...dto };
    if (dto.displayName !== undefined) {
      updateData.name = dto.displayName;
      delete updateData.displayName;
    }

    return this.prisma.slaConfig.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: number) {
    // Check if config exists
    await this.findById(id);

    return this.prisma.slaConfig.delete({
      where: { id },
    });
  }

  async toggleActive(id: number) {
    const config = await this.findById(id);
    return this.prisma.slaConfig.update({
      where: { id },
      data: { isActive: !config.isActive },
    });
  }

  // ========================================
  // SLA CALCULATION HELPERS
  // ========================================

  /**
   * Get SLA times based on region
   */
  private getSlaTimesForRegion(config: any, region: SlaRegion = SlaRegion.BANGKOK_METRO) {
    if (region === SlaRegion.PROVINCIAL) {
      return {
        responseTime: config.responseTimeProvincial ?? config.responseTimeMinutes,
        resolutionTime: config.resolutionTimeProvincial ?? config.resolutionTimeMinutes,
      };
    }
    return {
      responseTime: config.responseTimeMinutes,
      resolutionTime: config.resolutionTimeMinutes,
    };
  }

  /**
   * คำนวณ SLA Deadline จาก Priority และ Region
   * @param priority Priority level
   * @param createdAt Incident creation time
   * @param region SLA Region (BANGKOK_METRO or PROVINCIAL)
   * @returns SLA deadline date
   */
  async calculateSlaDeadline(
    priority: Priority,
    createdAt: Date = new Date(),
    region: SlaRegion = SlaRegion.BANGKOK_METRO
  ): Promise<Date> {
    const config = await this.prisma.slaConfig.findUnique({
      where: { priority },
    });

    if (!config || !config.isActive) {
      // Fallback to default values if no config
      const defaultMinutes = this.getDefaultResolutionMinutes(priority, region);
      return new Date(createdAt.getTime() + defaultMinutes * 60 * 1000);
    }

    const { resolutionTime } = this.getSlaTimesForRegion(config, region);
    return new Date(createdAt.getTime() + resolutionTime * 60 * 1000);
  }

  /**
   * คำนวณ Response Deadline จาก Priority และ Region
   */
  async calculateResponseDeadline(
    priority: Priority,
    createdAt: Date = new Date(),
    region: SlaRegion = SlaRegion.BANGKOK_METRO
  ): Promise<Date> {
    const config = await this.prisma.slaConfig.findUnique({
      where: { priority },
    });

    if (!config || !config.isActive) {
      const defaultMinutes = this.getDefaultResponseMinutes(priority, region);
      return new Date(createdAt.getTime() + defaultMinutes * 60 * 1000);
    }

    const { responseTime } = this.getSlaTimesForRegion(config, region);
    return new Date(createdAt.getTime() + responseTime * 60 * 1000);
  }

  /**
   * ตรวจสอบสถานะ SLA ของ Incident
   */
  async checkSlaStatus(
    priority: Priority,
    createdAt: Date,
    resolvedAt?: Date | null,
    region: SlaRegion = SlaRegion.BANGKOK_METRO
  ): Promise<{
    status: 'ON_TIME' | 'WARNING' | 'BREACHED';
    remainingMinutes: number;
    percentUsed: number;
  }> {
    const config = await this.prisma.slaConfig.findUnique({
      where: { priority },
    });

    let resolutionMinutes: number;
    if (config) {
      const { resolutionTime } = this.getSlaTimesForRegion(config, region);
      resolutionMinutes = resolutionTime;
    } else {
      resolutionMinutes = this.getDefaultResolutionMinutes(priority, region);
    }
    const warningThreshold = config?.warningThreshold || 80;

    const now = resolvedAt || new Date();
    const elapsedMinutes = (now.getTime() - createdAt.getTime()) / (60 * 1000);
    const remainingMinutes = resolutionMinutes - elapsedMinutes;
    const percentUsed = (elapsedMinutes / resolutionMinutes) * 100;

    let status: 'ON_TIME' | 'WARNING' | 'BREACHED';
    if (percentUsed >= 100) {
      status = 'BREACHED';
    } else if (percentUsed >= warningThreshold) {
      status = 'WARNING';
    } else {
      status = 'ON_TIME';
    }

    return {
      status,
      remainingMinutes: Math.round(remainingMinutes),
      percentUsed: Math.round(percentUsed),
    };
  }

  /**
   * Default resolution times (fallback)
   * Provincial areas get 1.5x more time than Bangkok/Metro
   */
  private getDefaultResolutionMinutes(priority: Priority, region: SlaRegion = SlaRegion.BANGKOK_METRO): number {
    const multiplier = region === SlaRegion.PROVINCIAL ? 1.5 : 1;
    switch (priority) {
      case Priority.CRITICAL:
        return Math.round(4 * 60 * multiplier); // 4h Bangkok, 6h Provincial
      case Priority.HIGH:
        return Math.round(8 * 60 * multiplier); // 8h Bangkok, 12h Provincial
      case Priority.MEDIUM:
        return Math.round(24 * 60 * multiplier); // 24h Bangkok, 36h Provincial
      case Priority.LOW:
        return Math.round(72 * 60 * multiplier); // 72h Bangkok, 108h Provincial
      default:
        return Math.round(24 * 60 * multiplier);
    }
  }

  /**
   * Default response times (fallback)
   * Provincial areas get 1.5x more time than Bangkok/Metro
   */
  private getDefaultResponseMinutes(priority: Priority, region: SlaRegion = SlaRegion.BANGKOK_METRO): number {
    const multiplier = region === SlaRegion.PROVINCIAL ? 1.5 : 1;
    switch (priority) {
      case Priority.CRITICAL:
        return Math.round(15 * multiplier); // 15m Bangkok, 22m Provincial
      case Priority.HIGH:
        return Math.round(30 * multiplier); // 30m Bangkok, 45m Provincial
      case Priority.MEDIUM:
        return Math.round(60 * multiplier); // 1h Bangkok, 1.5h Provincial
      case Priority.LOW:
        return Math.round(120 * multiplier); // 2h Bangkok, 3h Provincial
      default:
        return Math.round(60 * multiplier);
    }
  }

  // ========================================
  // SEED DEFAULT SLA CONFIGS
  // ========================================

  async seedDefaults() {
    const defaultConfigs = [
      {
        priority: Priority.CRITICAL,
        name: 'Critical',
        description: 'ปัญหาร้ายแรง ส่งผลกระทบต่อการทำงานทั้งหมด',
        responseTimeMinutes: 15,
        resolutionTimeMinutes: 4 * 60, // 4 hours Bangkok/Metro
        responseTimeProvincial: 30, // 30 minutes Provincial
        resolutionTimeProvincial: 6 * 60, // 6 hours Provincial
        escalationEnabled: true,
        escalationAfterMinutes: 60,
        warningThreshold: 70,
        color: '#EF4444', // Red
      },
      {
        priority: Priority.HIGH,
        name: 'High',
        description: 'ปัญหาสำคัญ ส่งผลกระทบต่อการทำงานบางส่วน',
        responseTimeMinutes: 30,
        resolutionTimeMinutes: 8 * 60, // 8 hours Bangkok/Metro
        responseTimeProvincial: 45, // 45 minutes Provincial
        resolutionTimeProvincial: 12 * 60, // 12 hours Provincial
        escalationEnabled: true,
        escalationAfterMinutes: 2 * 60,
        warningThreshold: 75,
        color: '#F59E0B', // Orange
      },
      {
        priority: Priority.MEDIUM,
        name: 'Medium',
        description: 'ปัญหาทั่วไป ยังสามารถทำงานได้',
        responseTimeMinutes: 60,
        resolutionTimeMinutes: 24 * 60, // 24 hours Bangkok/Metro
        responseTimeProvincial: 90, // 1.5 hours Provincial
        resolutionTimeProvincial: 36 * 60, // 36 hours Provincial
        escalationEnabled: true,
        escalationAfterMinutes: 4 * 60,
        warningThreshold: 80,
        color: '#3B82F6', // Blue
      },
      {
        priority: Priority.LOW,
        name: 'Low',
        description: 'ปัญหาเล็กน้อย ไม่เร่งด่วน',
        responseTimeMinutes: 120,
        resolutionTimeMinutes: 72 * 60, // 72 hours Bangkok/Metro
        responseTimeProvincial: 180, // 3 hours Provincial
        resolutionTimeProvincial: 96 * 60, // 96 hours (4 days) Provincial
        escalationEnabled: false,
        escalationAfterMinutes: null,
        warningThreshold: 85,
        color: '#10B981', // Green
      },
    ];

    for (const config of defaultConfigs) {
      await this.prisma.slaConfig.upsert({
        where: { priority: config.priority },
        update: {},
        create: config,
      });
    }

    return this.findAll(true);
  }

  // ========================================
  // FORMAT HELPERS
  // ========================================

  /**
   * แปลงนาทีเป็นรูปแบบที่อ่านง่าย
   */
  formatMinutes(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} นาที`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
      return mins > 0 ? `${hours} ชม. ${mins} นาที` : `${hours} ชั่วโมง`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days} วัน ${remainingHours} ชม.`;
    }
    return `${days} วัน`;
  }
}
