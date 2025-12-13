// src/prisma/prisma.module.ts
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // ทำให้ module นี้ใช้ได้ทั้ง app โดยไม่ต้อง import ซ้ำ
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // export เพื่อให้ modules อื่นใช้ได้
})
export class PrismaModule {}