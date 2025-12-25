// src/app.module.ts

import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StoresModule } from './modules/stores/stores.module';
import { IncidentsModule } from './incidents/incidents.module';
import { PrismaModule } from './prisma/prisma.module';
import { EquipmentModule } from './equipment/equipment.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    StoresModule,
    IncidentsModule,
    EquipmentModule,
  ],
})
export class AppModule {}