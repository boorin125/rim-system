import { IsNotEmpty, IsOptional, IsString, IsIn, IsInt, IsDateString, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * New store created from a project — saved with storeStatus OPENING.
 * - PERMANENT: a new branch
 * - POP_UP: temporary store; closeDate required, closed automatically after it
 * - EVENT: vendor event in an existing branch's space; takes the host's code, name = "<host name> (<eventName>)"
 */
export class CreateProjectStoreDto {
  @IsIn(['PERMANENT', 'POP_UP', 'EVENT'])
  @IsOptional()
  kind?: 'PERMANENT' | 'POP_UP' | 'EVENT';

  @ValidateIf((o) => o.kind !== 'EVENT')
  @IsString()
  @IsNotEmpty()
  storeCode?: string;

  @ValidateIf((o) => o.kind !== 'EVENT')
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((o) => o.kind !== 'EVENT')
  @IsString()
  @IsNotEmpty()
  company?: string;

  // EVENT only
  @ValidateIf((o) => o.kind === 'EVENT')
  @Type(() => Number)
  @IsInt()
  hostStoreId?: number;

  @ValidateIf((o) => o.kind === 'EVENT')
  @IsString()
  @IsNotEmpty()
  eventName?: string;

  // Required for POP_UP / EVENT
  @ValidateIf((o) => o.kind === 'POP_UP' || o.kind === 'EVENT')
  @IsDateString()
  openDate?: string;

  @ValidateIf((o) => o.kind === 'POP_UP' || o.kind === 'EVENT')
  @IsDateString()
  closeDate?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
