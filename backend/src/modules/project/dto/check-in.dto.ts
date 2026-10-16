import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckInDto {
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  lng: number;

  @IsString()
  @IsOptional()
  checkInPhotoPath?: string;
}
