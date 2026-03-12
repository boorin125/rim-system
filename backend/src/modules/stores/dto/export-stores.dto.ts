// src/modules/stores/dto/export-stores.dto.ts

import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ExportStoresDto {
  /**
   * Filter by store status
   */
  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE'], {
    message: 'Status must be ACTIVE or INACTIVE'
  })
  status?: 'ACTIVE' | 'INACTIVE';

  /**
   * Filter by province
   */
  @IsOptional()
  @IsString()
  province?: string;

  /**
   * Filter by company
   */
  @IsOptional()
  @IsString()
  company?: string;

  /**
   * Filter by store type
   */
  @IsOptional()
  @IsEnum(['PERMANENT', 'POP_UP', 'SEASONAL'], {
    message: 'Store type must be PERMANENT, POP_UP, or SEASONAL'
  })
  storeType?: 'PERMANENT' | 'POP_UP' | 'SEASONAL';
}