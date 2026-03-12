// TODO: Before this endpoint is fully active, add the pushToken field to the
// Prisma User model in schema.prisma and run a migration:
//
//   pushToken   String?   @map("push_token") @db.Text
//
// Then remove this comment.

import { IsString, IsNotEmpty } from 'class-validator'

export class PushTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string
}
