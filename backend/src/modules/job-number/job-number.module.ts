// src/modules/job-number/job-number.module.ts
import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../../settings/settings.module';
import { JobNumberService } from './job-number.service';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [JobNumberService],
  exports: [JobNumberService],
})
export class JobNumberModule {}
