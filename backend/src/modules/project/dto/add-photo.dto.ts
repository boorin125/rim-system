import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class AddPhotoDto {
  @IsString()
  @IsNotEmpty()
  photoPath: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsInt()
  @IsOptional()
  sortOrder?: number;
}
