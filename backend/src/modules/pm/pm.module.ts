import { Module } from '@nestjs/common';
import { PmController, PmPublicController } from './pm.controller';
import { PmService } from './pm.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PmController, PmPublicController],
  providers: [PmService],
  exports: [PmService],
})
export class PmModule {}
