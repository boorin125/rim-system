import { Module } from '@nestjs/common';
import { AppMobileController } from './app-mobile.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppMobileController],
})
export class AppMobileModule {}
