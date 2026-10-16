// src/modules/job-number/job-number.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

type Db = PrismaService | Prisma.TransactionClient;

/**
 * Central atomic running-number generator.
 *
 * Each series/period has one row in `number_sequences`, incremented with a single
 * INSERT ... ON CONFLICT DO UPDATE ... RETURNING — concurrent callers serialize on
 * the row lock, so two requests can never receive the same number.
 *
 * The counter self-heals from the highest number already stored in the target
 * table (GREATEST), so no manual seeding is needed on deploy and a restore/import
 * that brings back higher numbers cannot cause a duplicate.
 *
 * Numbers are committed immediately unless a transaction client is passed;
 * a failed create afterwards leaves a gap (never a duplicate).
 */
@Injectable()
export class JobNumberService {
  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {}

  /**
   * Ticket number: [PREFIX][YY][MM][XXXX] — e.g. WAT26100001
   * Prefix comes from Settings (organization_prefix, default INC); resets monthly.
   * Shared by every job type that uses the organization ticket series.
   */
  async nextTicketNumber(tx?: Prisma.TransactionClient): Promise<string> {
    const prefix = await this.settingsService.getIncidentPrefix();
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const key = `${prefix}${yy}${mm}`;

    const value = await this.next(tx ?? this.prisma, key, 'incidents', 'ticket_number');
    return `${key}${value.toString().padStart(4, '0')}`;
  }

  /**
   * Outsource job code: OUT-YYYYMMDD-XXXX (date in UTC, as before); resets daily.
   */
  async nextOutsourceJobCode(tx?: Prisma.TransactionClient): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const key = `OUT-${dateStr}-`;

    const value = await this.next(tx ?? this.prisma, key, 'outsource_jobs', 'job_code');
    return `${key}${value.toString().padStart(4, '0')}`;
  }

  /**
   * Increment and return the counter for `key`.
   * Existing codes in `table.column` are expected to be `key` + digits.
   */
  private async next(db: Db, key: string, table: string, column: string): Promise<number> {
    const likePattern = key.replace(/[\\%_]/g, '\\$&') + '%';
    const suffixStart = key.length + 1;
    const tbl = Prisma.raw(`"${table}"`);
    const col = Prisma.raw(`"${column}"`);

    const rows = await db.$queryRaw<{ last_value: number }[]>`
      INSERT INTO number_sequences (key, last_value, updated_at)
      VALUES (
        ${key},
        COALESCE((
          SELECT MAX(CAST(SUBSTRING(${col} FROM ${suffixStart}::int) AS INTEGER))
          FROM ${tbl}
          WHERE ${col} LIKE ${likePattern}
            AND SUBSTRING(${col} FROM ${suffixStart}::int) ~ '^[0-9]{1,9}$'
        ), 0) + 1,
        NOW()
      )
      ON CONFLICT (key) DO UPDATE
        SET last_value = GREATEST(number_sequences.last_value + 1, EXCLUDED.last_value),
            updated_at = NOW()
      RETURNING last_value
    `;
    return Number(rows[0].last_value);
  }
}
