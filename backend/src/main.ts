// PATH: backend/src/main.ts
// Backend runs on Port 3000 (Standard)

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Enable CORS for frontend (must be before static assets so CORS headers apply to /uploads/)
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  });

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global prefix — exclude /health so health check works without auth
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Listen on PORT 3000 (STANDARD!)
  const port = 3000;
  await app.listen(port);

  console.log('✅ Database connected');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}

bootstrap();
