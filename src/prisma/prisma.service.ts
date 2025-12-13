// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  
  async onModuleInit() {
    // เชื่อมต่อ database เมื่อ module เริ่มต้น
    await this.$connect();
    console.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    // ตัดการเชื่อมต่อเมื่อ module shutdown
    await this.$disconnect();
    console.log('❌ Database disconnected');
  }

  // Helper method สำหรับ clean database (ใช้ใน testing)
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production!');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => key[0] !== '_' && typeof this[key] === 'object',
    );

    return Promise.all(
      models.map((modelKey) => this[modelKey].deleteMany()),
    );
  }
}