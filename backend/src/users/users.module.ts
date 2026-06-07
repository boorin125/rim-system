import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LicenseModule } from '../modules/license/license.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [EmailModule, PrismaModule, LicenseModule, AuthModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
