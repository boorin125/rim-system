// backend/src/comments/dto/create-comment.dto.ts

import { IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: 'Comment content cannot be empty' })
  content: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
