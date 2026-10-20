// src/modules/provinces/provinces.service.ts
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { THAI_PROVINCES, isCanonicalProvince, matchProvince } from '../../utils/thai-provinces';

export interface UnknownProvince {
  value: string;
  stores: number;
  userAddress: number;
  responsible: number;
}

/**
 * Keeps every stored province on the canonical UPPERCASE English name.
 * - On startup: rewrites any recognisable spelling (spaces, case, Thai name, common variants)
 * - Values that can't be recognised stay as-is and are listed by audit() for an admin to remap
 */
@Injectable()
export class ProvincesService implements OnModuleInit {
  private readonly logger = new Logger(ProvincesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const r = await this.normalizeAll();
      const total = r.stores + r.userAddress + r.responsible;
      if (total > 0 || r.unknown.length > 0) {
        this.logger.log(
          `Province normalize: stores ${r.stores}, user address ${r.userAddress}, responsible ${r.responsible} row(s) fixed; ` +
            `${r.unknown.length} unknown value(s)${r.unknown.length ? ': ' + r.unknown.map((u) => u.value).join(', ') : ''}`,
        );
      }
    } catch (err) {
      this.logger.error('Province normalize failed', err as any);
    }
  }

  list() {
    return THAI_PROVINCES.map(({ en, th }) => ({ en, th }));
  }

  /** Rewrite every recognisable province value to its canonical name. Idempotent. */
  async normalizeAll() {
    const fixScalar = async (table: 'stores' | 'users') => {
      const rows = await this.prisma.$queryRawUnsafe<{ province: string }[]>(
        `SELECT DISTINCT province FROM "${table}" WHERE province IS NOT NULL`,
      );
      let changed = 0;
      for (const { province } of rows) {
        const canonical = province.trim() === '' ? null : matchProvince(province);
        if (province.trim() !== '' && (!canonical || canonical === province)) continue;
        changed += await this.prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET province = $1 WHERE province = $2`,
          canonical,
          province,
        );
      }
      return changed;
    };

    const stores = await fixScalar('stores');
    const userAddress = await fixScalar('users');

    let responsible = 0;
    const users = await this.prisma.user.findMany({
      where: { NOT: { responsibleProvinces: { isEmpty: true } } },
      select: { id: true, responsibleProvinces: true },
    });
    for (const u of users) {
      const next = [...new Set(u.responsibleProvinces.map((p) => matchProvince(p) ?? p.trim()).filter(Boolean))];
      if (next.length !== u.responsibleProvinces.length || next.some((p, i) => p !== u.responsibleProvinces[i])) {
        await this.prisma.user.update({ where: { id: u.id }, data: { responsibleProvinces: next } });
        responsible++;
      }
    }

    return { stores, userAddress, responsible, unknown: await this.audit() };
  }

  /** Stored values that are not one of the 77 canonical names, with where they are used */
  async audit(): Promise<UnknownProvince[]> {
    const [storeRows, userRows, respRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ value: string; n: number }[]>(
        `SELECT province AS value, COUNT(*)::int AS n FROM stores WHERE province IS NOT NULL GROUP BY province`,
      ),
      this.prisma.$queryRawUnsafe<{ value: string; n: number }[]>(
        `SELECT province AS value, COUNT(*)::int AS n FROM users WHERE province IS NOT NULL GROUP BY province`,
      ),
      this.prisma.$queryRawUnsafe<{ value: string; n: number }[]>(
        `SELECT p AS value, COUNT(*)::int AS n FROM users, unnest(responsible_provinces) AS p GROUP BY p`,
      ),
    ]);

    const map = new Map<string, UnknownProvince>();
    const add = (rows: { value: string; n: number }[], field: 'stores' | 'userAddress' | 'responsible') => {
      for (const { value, n } of rows) {
        if (isCanonicalProvince(value)) continue;
        const entry = map.get(value) ?? { value, stores: 0, userAddress: 0, responsible: 0 };
        entry[field] += n;
        map.set(value, entry);
      }
    };
    add(storeRows, 'stores');
    add(userRows, 'userAddress');
    add(respRows, 'responsible');
    return [...map.values()].sort((a, b) => a.value.localeCompare(b.value));
  }

  /** Replace an unknown stored value with a canonical province everywhere */
  async remap(from: string, to: string) {
    if (!from) throw new BadRequestException('ระบุค่าเดิมที่ต้องการแก้');
    if (!isCanonicalProvince(to)) throw new BadRequestException(`"${to}" ไม่ใช่ชื่อจังหวัดมาตรฐาน`);

    const stores = await this.prisma.store.updateMany({ where: { province: from }, data: { province: to } });
    const userAddress = await this.prisma.user.updateMany({ where: { province: from }, data: { province: to } });

    let responsible = 0;
    const users = await this.prisma.user.findMany({
      where: { responsibleProvinces: { has: from } },
      select: { id: true, responsibleProvinces: true },
    });
    for (const u of users) {
      const next = [...new Set(u.responsibleProvinces.map((p) => (p === from ? to : p)))];
      await this.prisma.user.update({ where: { id: u.id }, data: { responsibleProvinces: next } });
      responsible++;
    }

    this.logger.log(`Province remap "${from}" → ${to}: stores ${stores.count}, user address ${userAddress.count}, responsible ${responsible}`);
    return { stores: stores.count, userAddress: userAddress.count, responsible };
  }
}
