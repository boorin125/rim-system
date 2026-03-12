// backend/src/comments/dto/update-comment.dto.ts

import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Comment content cannot be empty' })
  content?: string;
}
