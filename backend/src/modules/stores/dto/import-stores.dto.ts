// src/modules/stores/dto/import-stores.dto.ts

import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ImportStoresDto {
  /**
   * Skip duplicate store codes (ACTIVE stores only)
   * Default: true
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return true; // default
  })
  skipDuplicates?: boolean = true;

  /**
   * Update existing stores if duplicate found
   * Only applies when skipDuplicates is true
   * Default: false
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return false; // default
  })
  updateExisting?: boolean = false;
}