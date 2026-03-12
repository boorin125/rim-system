# 📋 RIM - Rubjobb Incident Management System
## Software Requirements Specification (SRS)

**Version:** 3.10.1 - License & Activation System
**Last Updated:** December 15, 2025
**Document Type:** Complete System Specification  
**Target Audience:** Non-Technical Stakeholders, Developers, Project Managers

---

## 🎯 DOCUMENT STRUCTURE

**โครงสร้างเอกสารนี้:**
- แบ่งตาม **Features** (ฟีเจอร์) แทนที่จะแบ่งตาม Technical Sections
- แต่ละ Feature จะมีครบ: Database, API, UI, Workflows
- สามารถ Review และ Approve ทีละ Feature ได้
- แก้ไขส่วนใดส่วนหนึ่งโดยไม่กระทบส่วนอื่น

---

## 📑 TABLE OF CONTENTS

### PART 1: OVERVIEW
1. [Project Introduction](#1-project-introduction)
2. [Technology Stack](#2-technology-stack)
3. [User Roles Summary](#3-user-roles-summary)
4. [System Architecture](#4-system-architecture)

### PART 2: CORE FEATURES (ฟีเจอร์หลัก)
5. [Feature 1: Authentication & User Management](#5-feature-1-authentication--user-management)
6. [Feature 2: Incident Management](#6-feature-2-incident-management)
7. [Feature 3: Store Management](#7-feature-3-store-management)
8. [Feature 4: Equipment Management](#8-feature-4-equipment-management)
9. [Feature 5: Category Management](#9-feature-5-category-management)
10. [Feature 6: File Upload System](#10-feature-6-file-upload-system)

### PART 3: ADVANCED FEATURES (ฟีเจอร์ขั้นสูง)
11. [Feature 7: Outsource Marketplace](#11-feature-7-outsource-marketplace)
12. [Feature 8: Rating System (Public Link)](#12-feature-8-rating-system-public-link)
13. [Feature 9: Email Notification System](#13-feature-9-email-notification-system)
14. [Feature 10: Dashboard & Analytics](#14-feature-10-dashboard--analytics)
15. [Feature 11: SLA Management](#15-feature-11-sla-management)
16. [Feature 12: Knowledge Base & Incident Intelligence](#16-feature-12-knowledge-base--incident-intelligence)
17. [Feature 13: Backup & Restore System](#17-feature-13-backup--restore-system)
18. [Feature 14: Technician Performance Grading System](#18-feature-14-technician-performance-grading-system)
19. [Feature 15: Reassignment System](#19-feature-15-reassignment-system)
20. [Feature 16: Priority Level Configuration](#20-feature-16-priority-level-configuration)
21. [Feature 17: License & Activation System](#21-feature-17-license--activation-system)

### PART 4: SYSTEM COMPONENTS
22. [System Settings & Configuration](#22-system-settings--configuration)
23. [Activity Logs & Audit Trail](#23-activity-logs--audit-trail)
24. [Notifications](#24-notifications)
25. [Reports & Data Export](#25-reports--data-export)

### PART 5: DEPLOYMENT & SUPPORT
26. [Security Requirements](#26-security-requirements)
27. [Deployment Model](#27-deployment-model)
28. [Training & Documentation](#28-training--documentation)
29. [Support & Maintenance](#29-support--maintenance)

### APPENDIX
- [A. Complete Database Schema](#appendix-a-complete-database-schema)
- [B. Complete API Reference](#appendix-b-complete-api-reference)
- [C. Glossary](#appendix-c-glossary)
- [D. Change Log](#appendix-d-change-log)

---

# PART 1: OVERVIEW

## 1. PROJECT INTRODUCTION

### 1.1 What is RIM?
**RIM (Rubjobb Incident Management)** คือระบบจัดการงานซ่อมบำรุง IT แบบครบวงจร สำหรับบริษัทที่มีสาขาหลายแห่งทั่วประเทศ

### 1.2 ใช้ทำอะไรได้บ้าง?
✅ **รับเรื่องแจ้งซ่อม** - ลูกค้า/สาขาแจ้งปัญหา IT  
✅ **มอบหมายงาน** - ส่งงานให้ช่างเทคนิค (ในบริษัท หรือ จ้างภายนอก)  
✅ **ติดตามสถานะ** - ดูว่างานไปถึงไหนแล้ว  
✅ **ควบคุมคุณภาพ** - Help Desk ตรวจสอบก่อนปิดงาน  
✅ **ประเมินผล** - ลูกค้าให้คะแนนช่างหลังเสร็จงาน  
✅ **รายงานสถิติ** - ดูข้อมูลการทำงาน, SLA, ประสิทธิภาพ

### 1.3 ใครใช้ระบบนี้?

| กลุ่มผู้ใช้ | จำนวน | ใช้ทำอะไร |
|------------|-------|----------|
| **Super Admin** | 1-2 คน | ตั้งค่าระบบทั้งหมด |
| **IT Manager** | 3-5 คน | ดูรายงานทั้งหมด |
| **Finance Admin** | 2-3 คน | อนุมัติจ่ายเงินช่าง Outsource |
| **Help Desk** | 5-10 คน | ตรวจสอบและปิดงาน, ยกเลิกงาน |
| **Supervisor** | 5-10 คน | หัวหน้าทีมช่าง, มอบหมายงาน |
| **Technician** | 50-200 คน | ช่างออกซ่อม (ในบริษัท + ภายนอก) |
| **End User** | ไม่จำกัด | แจ้งซ่อม, ติดตามสถานะ |
| **Read Only** | 5-10 คน | ดูรายงานบางส่วนเดียว |

### 1.4 Deployment Model
**Single-tenant Installation** = ติดตั้งแยกให้ลูกค้าแต่ละรายนำไปใช้เอง

ตัวอย่าง:
- ติดตั้งให้ **Watsons** → มีแต่ข้อมูล Watsons
- ติดตั้งให้ **KFC** → มีแต่ข้อมูล KFC
- ไม่ได้ share database กัน

สามารถตั้งค่า:
- ชื่อบริษัท, โลโก้
- Ticket Prefix (เช่น WAT, KFC, NTT)
  - รูปแบบ Ticket: **Prefix + YYMM + 0001** (4 หลักเสมอ)
  - ตัวอย่าง: **WAT25110001** = Watsons, Nov 2025, ลำดับที่ 1
  - เดือนใหม่ = เริ่มนับใหม่จาก 0001
- SLA, Email Settings

### 1.5 Default Super Admin Account
**ระบบมี Super Admin Account เริ่มต้นที่สร้างไว้ให้แล้ว:**

```yaml
Email: admin@rub-jobb.com
Password: Password@1
Role: Super Admin
```

**ข้อกำหนดสำคัญ:**
- ⚠️ **ไม่สามารถลบ Account นี้ได้** - Protected at system level
- ⚠️ **ไม่สามารถเปลี่ยน Role ของ Account นี้ได้** - Always Super Admin
- ⚠️ **ไม่สามารถ Disable Account นี้ได้** - Always Active
- ✅ **สามารถเปลี่ยน Password ได้** - แนะนำให้เปลี่ยนทันทีหลังติดตั้งระบบ
- ✅ **สามารถแก้ไขข้อมูลส่วนตัวได้** - First Name, Last Name, Phone
- 🔒 **ใช้สำหรับ:** การตั้งค่าระบบครั้งแรก, สร้าง IT Manager คนแรก

**หมายเหตุ:**
- หลังจากสร้าง IT Manager แล้ว สามารถใช้ IT Manager ในการจัดการ Users ต่อไปได้
- Super Admin Account นี้ควรใช้เฉพาะงานที่ต้องการสิทธิ์สูงสุดเท่านั้น
- แนะนำให้เปลี่ยน Password จาก Default ทันทีหลังติดตั้ง

---

## 2. TECHNOLOGY STACK

### 2.1 Frontend (หน้าบ้าน - ที่ผู้ใช้เห็น)
```yaml
Framework: Next.js 14 (App Router)
Language: TypeScript
Styling: Tailwind CSS (Dark Theme)
Components: shadcn/ui (Radix UI)
Icons: Lucide React
```

### 2.2 Backend (หลังบ้าน - API Server)
```yaml
Framework: NestJS
Language: TypeScript
API: RESTful API
Auth: JWT (JSON Web Tokens)
Email: Nodemailer (SMTP)
UUID: uuid (v4) สำหรับ Rating Links
```

### 2.3 Database
```yaml
Database: PostgreSQL 14+
ORM: TypeORM / Prisma
Database Name: rim_db
```

### 2.4 Development Tools
```yaml
Package Manager: npm
Version Control: Git
Code Editor: VS Code
API Testing: Postman / Thunder Client / Swagger UI
Database Tool: pgAdmin 4 / DBeaver
```

---

### 2.5 API Documentation (Swagger)

#### 2.5.1 What is Swagger?

**Swagger (OpenAPI 3.0)** = มาตรฐานสากลสำหรับ API Documentation + Interactive Testing

**จุดเด่น:**
- 📖 **Auto-generated Documentation** - สร้าง Docs จาก Code โดยอัตโนมัติ
- 🧪 **Interactive Testing** - ทดสอบ API ได้ทันทีใน Browser (Try it out)
- 🎯 **Single Source of Truth** - Code = Documentation (ไม่เคย outdated)
- 🤝 **Team Collaboration** - Frontend/Mobile Team ดู API Spec ได้ชัดเจน
- 🌐 **Standard Format** - ใช้ได้กับทุกภาษา (มาตรฐาน OpenAPI)

**สำหรับ RIM Project:**
- URL: `http://localhost:3000/api-docs` (Development)
- URL: `https://rim.yourdomain.com/api-docs` (Production)

---

#### 2.5.2 Installation & Setup

**Step 1: Install Dependencies**
```bash
npm install --save @nestjs/swagger swagger-ui-express
```

**Step 2: Setup in main.ts**
```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // ========================================
  // Swagger Configuration
  // ========================================
  const config = new DocumentBuilder()
    .setTitle('RIM API Documentation')
    .setDescription('Rubjobb Incident Management System - Complete API Reference')
    .setVersion('3.9')
    .setContact(
      'RIM Support Team',
      'https://rim.yourdomain.com',
      'support@rim.com'
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controllers!
    )
    .addTag('Authentication', 'User login, registration, password management')
    .addTag('Users', 'User management (CRUD, roles, permissions)')
    .addTag('Incidents', 'Incident management (create, assign, update, close)')
    .addTag('Reassignments', '🆕 Reassign incidents to different technicians')
    .addTag('Stores', 'Store management and analytics')
    .addTag('Equipment', 'Equipment/Asset management')
    .addTag('Categories', 'Incident category management')
    .addTag('Knowledge Base', 'KB articles and incident intelligence')
    .addTag('Ratings', 'Customer satisfaction ratings (public link)')
    .addTag('Outsource', 'Job marketplace and outsource technicians')
    .addTag('Dashboard', 'Analytics and statistics')
    .addTag('SLA', 'SLA policies and tracking')
    .addTag('Backup', 'Backup and restore operations')
    .addTag('Performance', 'Technician performance grading')
    .addTag('Reports', 'Reports and data export')
    .addTag('Settings', 'System settings and configuration')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    customSiteTitle: 'RIM API Documentation',
    customfavIcon: 'https://rim.yourdomain.com/favicon.ico',
    customCss: '.swagger-ui .topbar { display: none }', // Hide Swagger topbar
    swaggerOptions: {
      persistAuthorization: true, // Keep JWT token after refresh
      docExpansion: 'none', // Collapse all endpoints by default
      filter: true, // Enable search
      tagsSorter: 'alpha', // Sort tags alphabetically
    },
  });

  await app.listen(3000);
  console.log(`🚀 Application is running on: http://localhost:3000`);
  console.log(`📖 Swagger Docs: http://localhost:3000/api-docs`);
}
bootstrap();
```

---

#### 2.5.3 DTOs with Validation

**สร้าง DTO พร้อม Swagger Decorators:**

```typescript
// src/incidents/dto/create-incident.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, MinLength } from 'class-validator';

export enum IncidentPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export class CreateIncidentDto {
  @ApiProperty({
    description: 'Incident title/summary',
    example: 'เครื่อง POS ไม่สามารถเปิดเครื่องได้',
    minLength: 5,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  title: string;

  @ApiProperty({
    description: 'Detailed description of the problem',
    example: 'เครื่อง POS สาขาสีลม ไม่สามารถเปิดเครื่องได้ตั้งแต่เช้า มีไฟสีแดงกระพริบ',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Priority level',
    enum: IncidentPriority,
    example: IncidentPriority.HIGH,
  })
  @IsEnum(IncidentPriority)
  priority: IncidentPriority;

  @ApiProperty({
    description: 'Store ID where the incident occurred',
    example: 5,
  })
  @IsNumber()
  storeId: number;

  @ApiProperty({
    description: 'Category ID',
    example: 3,
  })
  @IsNumber()
  categoryId: number;

  @ApiPropertyOptional({
    description: 'Equipment ID (optional)',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  equipmentId?: number;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'ลูกค้ารอใช้งานด่วน',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
```

**Response DTO:**
```typescript
// src/incidents/dto/incident-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IncidentResponseDto {
  @ApiProperty({ example: 123 })
  id: number;

  @ApiProperty({ example: 'WAT25110123' })
  ticketNumber: string;

  @ApiProperty({ example: 'เครื่อง POS ไม่สามารถเปิดเครื่องได้' })
  title: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiProperty({ example: 'high' })
  priority: string;

  @ApiProperty({ example: 5 })
  storeId: number;

  @ApiPropertyOptional({ example: 12 })
  equipmentId?: number;

  @ApiProperty({ example: '2025-11-18T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-18T10:35:00Z' })
  updatedAt: Date;
}
```

---

#### 2.5.4 Controller Decorators

**Example: Incidents Controller**

```typescript
// src/incidents/incidents.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentResponseDto } from './dto/incident-response.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('Incidents')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // ========================================
  // GET ALL INCIDENTS
  // ========================================
  @Get()
  @ApiOperation({ 
    summary: 'Get all incidents',
    description: 'Retrieve all incidents with optional filters (status, priority, store, technician)',
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    description: 'Filter by status',
  })
  @ApiQuery({ 
    name: 'priority', 
    required: false, 
    enum: ['low', 'medium', 'high', 'critical'],
    description: 'Filter by priority',
  })
  @ApiQuery({ 
    name: 'storeId', 
    required: false, 
    type: Number,
    description: 'Filter by store ID',
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number,
    example: 20,
    description: 'Items per page (default: 20)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of incidents retrieved successfully',
    type: [IncidentResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('storeId') storeId?: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.incidentsService.findAll({ status, priority, storeId, page, limit });
  }

  // ========================================
  // GET INCIDENT BY ID
  // ========================================
  @Get(':id')
  @ApiOperation({ summary: 'Get incident by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID', example: 123 })
  @ApiResponse({ 
    status: 200, 
    description: 'Incident found',
    type: IncidentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async findOne(@Param('id') id: number) {
    return this.incidentsService.findOne(id);
  }

  // ========================================
  // CREATE INCIDENT (Help Desk, End User)
  // ========================================
  @Post()
  @Roles('Help Desk', 'End User')
  @ApiOperation({ 
    summary: 'Create new incident',
    description: '**Permission:** Help Desk, End User only. Super Admin cannot create incidents.',
  })
  @ApiBody({ type: CreateIncidentDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Incident created successfully',
    type: IncidentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid input' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin cannot perform operational tasks' })
  async create(@Body() createDto: CreateIncidentDto, @Request() req) {
    return this.incidentsService.create(createDto, req.user);
  }

  // ========================================
  // UPDATE INCIDENT
  // ========================================
  @Put(':id')
  @ApiOperation({ summary: 'Update incident details' })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID' })
  @ApiBody({ type: UpdateIncidentDto })
  @ApiResponse({ status: 200, description: 'Incident updated successfully' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async update(
    @Param('id') id: number,
    @Body() updateDto: UpdateIncidentDto,
  ) {
    return this.incidentsService.update(id, updateDto);
  }

  // ========================================
  // CLOSE INCIDENT (Help Desk only)
  // ========================================
  @Post(':id/close')
  @Roles('Help Desk')
  @ApiOperation({ 
    summary: 'Close incident',
    description: '**Permission:** Help Desk only. Must attach photos as evidence.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        resolutionNote: { type: 'string', example: 'แก้ไขเรียบร้อย เปลี่ยน motherboard ใหม่' },
        photos: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['photo1.jpg', 'photo2.jpg'],
        },
      },
      required: ['resolutionNote', 'photos'],
    },
  })
  @ApiResponse({ status: 200, description: 'Incident closed successfully' })
  @ApiResponse({ status: 403, description: 'Only Help Desk can close incidents' })
  @ApiResponse({ status: 400, description: 'Photos required' })
  async closeIncident(
    @Param('id') id: number,
    @Body() closeDto: { resolutionNote: string; photos: string[] },
  ) {
    return this.incidentsService.closeIncident(id, closeDto);
  }

  // ========================================
  // CANCEL INCIDENT (Help Desk only)
  // ========================================
  @Post(':id/cancel')
  @Roles('Help Desk')
  @ApiOperation({ 
    summary: 'Cancel incident',
    description: '**Permission:** Help Desk only. Must provide cancellation reason and photos.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        cancellationReason: { type: 'string', example: 'ผู้แจ้งขอยกเลิก - ซื้ออุปกรณ์ใหม่แล้ว' },
        photos: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['evidence1.jpg'],
        },
      },
      required: ['cancellationReason', 'photos'],
    },
  })
  @ApiResponse({ status: 200, description: 'Incident cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Only Help Desk can cancel incidents' })
  async cancelIncident(
    @Param('id') id: number,
    @Body() cancelDto: { cancellationReason: string; photos: string[] },
  ) {
    return this.incidentsService.cancelIncident(id, cancelDto);
  }

  // ========================================
  // DELETE INCIDENT
  // ========================================
  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ 
    summary: 'Delete incident (DANGER)',
    description: '**Permission:** Super Admin only. This is a destructive operation.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Incident deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only Super Admin can delete incidents' })
  async delete(@Param('id') id: number) {
    return this.incidentsService.delete(id);
  }
}
```

---

#### 2.5.5 Reassignment Controller Example

**New Feature: Reassignment System (v3.9)**

```typescript
// src/reassignments/reassignments.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReassignIncidentDto } from './dto/reassign-incident.dto';
import { RespondReassignmentDto } from './dto/respond-reassignment.dto';
import { ReassignmentsService } from './reassignments.service';

@ApiTags('Reassignments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api')
export class ReassignmentsController {
  constructor(private readonly reassignmentsService: ReassignmentsService) {}

  // ========================================
  // REASSIGN INCIDENT
  // ========================================
  @Post('incidents/:id/reassign')
  @Roles('IT Manager', 'Help Desk', 'Supervisor')
  @ApiOperation({ 
    summary: '🔄 Reassign incident to another technician',
    description: `
**Permission:** IT Manager, Help Desk, Supervisor only.
**Super Admin:** ❌ Cannot reassign (no operational tasks).

**Use Cases:**
- Technician is sick/on leave
- Technician doesn't have required skills
- Technician is overloaded
- Technician is too far from location
    `,
  })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID', example: 123 })
  @ApiBody({ type: ReassignIncidentDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Incident reassigned successfully',
    schema: {
      example: {
        success: true,
        message: 'Reassigned successfully',
        data: {
          reassignmentId: 789,
          incidentId: 123,
          incidentTicketNumber: 'WAT25110123',
          fromTechnician: {
            id: 32,
            firstName: 'สมชาย',
            lastName: 'ใจดี',
          },
          toTechnician: {
            id: 45,
            firstName: 'วิชัย',
            lastName: 'มั่นคง',
          },
          reason: 'ช่างคนเดิมลาป่วยฉุกเฉิน',
          reassignedBy: {
            id: 12,
            firstName: 'สุดา',
            lastName: 'ศรีสุข',
            role: 'Help Desk',
          },
          reassignedAt: '2025-11-18T14:30:00Z',
          status: 'pending',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Bad Request - Invalid status or technician',
    schema: {
      example: {
        success: false,
        error: 'INVALID_STATUS',
        message: 'Cannot reassign incident with status "completed"',
      },
    },
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Super Admin cannot perform operational tasks',
    schema: {
      example: {
        success: false,
        error: 'PERMISSION_DENIED',
        message: 'Super Admin cannot perform operational tasks',
      },
    },
  })
  async reassign(
    @Param('id') id: number,
    @Body() reassignDto: ReassignIncidentDto,
    @Request() req,
  ) {
    return this.reassignmentsService.reassign(id, reassignDto, req.user);
  }

  // ========================================
  // GET REASSIGNMENT HISTORY
  // ========================================
  @Get('incidents/:id/reassignments')
  @ApiOperation({ 
    summary: 'View reassignment history for incident',
    description: 'Shows complete timeline of all reassignments for this incident.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Incident ID' })
  @ApiResponse({ status: 200, description: 'Reassignment history retrieved' })
  async getHistory(@Param('id') id: number) {
    return this.reassignmentsService.getHistory(id);
  }

  // ========================================
  // GET MY REASSIGNED JOBS (Technician)
  // ========================================
  @Get('reassignments/my-reassigned')
  @Roles('Technician')
  @ApiOperation({ 
    summary: '📋 View jobs reassigned to me',
    description: 'Technicians can view all jobs that have been reassigned to them.',
  })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['pending', 'accepted', 'rejected', 'all'],
    description: 'Filter by status (default: all)',
  })
  @ApiResponse({ status: 200, description: 'List of reassigned jobs' })
  async getMyReassignedJobs(
    @Query('status') status: string = 'all',
    @Request() req,
  ) {
    return this.reassignmentsService.getMyReassignedJobs(req.user.id, status);
  }

  // ========================================
  // RESPOND TO REASSIGNMENT (Technician)
  // ========================================
  @Post('reassignments/:id/respond')
  @Roles('Technician')
  @ApiOperation({ 
    summary: '✅ Accept or ❌ Reject reassigned job',
    description: `
Technicians can accept or reject jobs that have been reassigned to them.

**Rules:**
- Accept: Response note is optional
- Reject: Response note is **required** (min 10 characters)
    `,
  })
  @ApiParam({ name: 'id', type: Number, description: 'Reassignment ID' })
  @ApiBody({ type: RespondReassignmentDto })
  @ApiResponse({ status: 200, description: 'Response recorded successfully' })
  @ApiResponse({ status: 400, description: 'Rejection reason required' })
  async respond(
    @Param('id') id: number,
    @Body() respondDto: RespondReassignmentDto,
    @Request() req,
  ) {
    return this.reassignmentsService.respond(id, respondDto, req.user);
  }

  // ========================================
  // GET REASSIGNMENT STATS
  // ========================================
  @Get('reassignments/stats')
  @Roles('IT Manager', 'Supervisor')
  @ApiOperation({ 
    summary: '📊 Get reassignment statistics',
    description: 'Dashboard metrics for reassignments (last 30 days by default).',
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    type: Number,
    example: 30,
    description: 'Number of days to look back (default: 30)',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStats(@Query('period') period: number = 30) {
    return this.reassignmentsService.getStats(period);
  }
}
```

**DTOs:**
```typescript
// src/reassignments/dto/reassign-incident.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MinLength } from 'class-validator';

export class ReassignIncidentDto {
  @ApiProperty({
    description: 'New technician ID',
    example: 45,
  })
  @IsNumber()
  toTechnicianId: number;

  @ApiProperty({
    description: 'Reason for reassignment (minimum 10 characters)',
    example: 'ช่างคนเดิมลาป่วยฉุกเฉิน ไม่สามารถออกสถานที่ได้',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  reason: string;
}

// src/reassignments/dto/respond-reassignment.dto.ts
export class RespondReassignmentDto {
  @ApiProperty({
    description: 'Accept or reject',
    enum: ['accepted', 'rejected'],
    example: 'accepted',
  })
  @IsEnum(['accepted', 'rejected'])
  status: string;

  @ApiProperty({
    description: 'Response note (required for rejection)',
    example: 'รับทราบครับ จะไปให้ทันครับ',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  responseNote?: string;
}
```

---

#### 2.5.6 Authentication Controller

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 12,
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
          roles: ['Help Desk', 'Read Only'],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @ApiOperation({ 
    summary: 'User registration',
    description: 'Register new user (End User role by default)',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
```

---

#### 2.5.7 Accessing Swagger UI

**Development:**
1. Start the application: `npm run start:dev`
2. Open browser: `http://localhost:3000/api-docs`

**Swagger UI Features:**
```
┌────────────────────────────────────────────────────────┐
│  RIM API Documentation                    v3.9         │
├────────────────────────────────────────────────────────┤
│  [🔒 Authorize]                    [Search filter...]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Authentication ▼                                      │
│    POST /api/auth/login          [Try it out]         │
│    POST /api/auth/register       [Try it out]         │
│                                                        │
│  Incidents ▼                                           │
│    GET    /api/incidents         [Try it out]         │
│    POST   /api/incidents         [Try it out] 🔒      │
│    GET    /api/incidents/{id}    [Try it out]         │
│    PUT    /api/incidents/{id}    [Try it out] 🔒      │
│    POST   /api/incidents/{id}/close   [Try it out] 🔒 │
│    POST   /api/incidents/{id}/cancel  [Try it out] 🔒 │
│                                                        │
│  Reassignments 🆕 ▼                                    │
│    POST   /api/incidents/{id}/reassign   [Try] 🔒     │
│    GET    /api/incidents/{id}/reassignments  [Try]    │
│    GET    /api/reassignments/my-reassigned   [Try] 🔒 │
│    POST   /api/reassignments/{id}/respond    [Try] 🔒 │
│    GET    /api/reassignments/stats           [Try] 🔒 │
│                                                        │
│  Users ▼                                               │
│  Stores ▼                                              │
│  Equipment ▼                                           │
│  ... (more tags)                                       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

**How to Test API:**
1. Click **[🔒 Authorize]** button
2. Get JWT token from `POST /api/auth/login`
3. Paste token in format: `Bearer eyJhbGc...`
4. Click **Authorize**
5. Now you can test protected endpoints!

**Testing Example:**
```
1. Click "Incidents" section → Expand
2. Click "POST /api/incidents" → [Try it out]
3. Edit Request Body:
   {
     "title": "เครื่อง POS ไม่ทำงาน",
     "description": "เครื่อง POS สาขาสีลม ไม่สามารถเปิดเครื่องได้",
     "priority": "high",
     "storeId": 5,
     "categoryId": 3
   }
4. Click [Execute]
5. See Response:
   - Status: 201 Created
   - Body: { "success": true, "data": {...} }
```

---

#### 2.5.8 Best Practices

**1. Use DTOs for All Inputs/Outputs**
```typescript
// ✅ Good
@ApiResponse({ type: IncidentResponseDto })

// ❌ Bad
@ApiResponse({ description: 'Returns incident object' })
```

**2. Add Examples**
```typescript
@ApiProperty({ 
  example: 'WAT25110123',
  description: 'Ticket number in format: PREFIX + YYMM + 0001'
})
ticketNumber: string;
```

**3. Document Permissions**
```typescript
@ApiOperation({ 
  summary: 'Close incident',
  description: '**Permission:** Help Desk only. Super Admin cannot close incidents.',
})
```

**4. Use Enums**
```typescript
@ApiProperty({
  enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
  example: 'pending',
})
status: string;
```

**5. Document Error Responses**
```typescript
@ApiResponse({ 
  status: 403, 
  description: 'Super Admin cannot perform operational tasks',
  schema: {
    example: {
      success: false,
      error: 'PERMISSION_DENIED',
      message: 'Super Admin cannot perform operational tasks',
    },
  },
})
```

**6. Group by Tags**
```typescript
@ApiTags('Incidents')  // Group all incident endpoints together
```

**7. Add Bearer Auth**
```typescript
@ApiBearerAuth('JWT-auth')  // Show 🔒 icon
```

---

#### 2.5.9 Production Considerations

**Security:**
```typescript
// ❌ DON'T expose Swagger in production without authentication
// ✅ DO protect Swagger docs with Basic Auth or IP whitelist

// Example: Protect Swagger with Basic Auth
import * as basicAuth from 'express-basic-auth';

// In main.ts
app.use('/api-docs', basicAuth({
  users: { 'admin': 'supersecretpassword' },
  challenge: true,
}));

SwaggerModule.setup('api-docs', app, document);
```

**Performance:**
```typescript
// Cache Swagger document
const document = SwaggerModule.createDocument(app, config);

// Write to file (optional - for static hosting)
import { writeFileSync } from 'fs';
writeFileSync('./swagger.json', JSON.stringify(document));
```

**Environment-based Setup:**
```typescript
// Only enable Swagger in development/staging
if (process.env.NODE_ENV !== 'production') {
  SwaggerModule.setup('api-docs', app, document);
}
```

---

#### 2.5.10 Summary

**Swagger Benefits for RIM:**
- ✅ **Zero Documentation Overhead** - Docs auto-generated from code
- ✅ **Always Up-to-date** - Can't be outdated (code = docs)
- ✅ **Interactive Testing** - Try APIs directly in browser
- ✅ **Team Collaboration** - Frontend sees exact API specs
- ✅ **Onboarding** - New devs understand APIs immediately
- ✅ **Standard Format** - OpenAPI 3.0 compatible

**Access Points:**
- Development: `http://localhost:3000/api-docs`
- Staging: `https://staging.rim.com/api-docs`
- Production: `https://rim.com/api-docs` (protected)

**Remember:**
- Add `@ApiTags()` to group endpoints
- Use DTOs with `@ApiProperty()` for all inputs/outputs
- Add `@ApiBearerAuth()` for protected routes
- Document permissions in `@ApiOperation()`
- Add examples to all properties
- Test in Swagger UI before QA

---

## 3. USER ROLES SUMMARY

### 3.1 Role-Based Access Control (RBAC)
ระบบใช้ **Multi-role System** = 1 คนสามารถมีหลาย Roles ได้

#### 3.1.1 ตัวอย่างการใช้งาน Multi-role:

**Case 1: Super Admin (Standalone)**
- ตัวอย่าง: System Administrator  
- สิทธิ์: **ตั้งค่าระบบ + ดูรายงานทั้งหมด เท่านั้น**
- **หมายเหตุ:** ไม่ทำงานปฏิบัติการ (ไม่สร้างงาน, ไม่มอบหมาย, ไม่ปิดงาน)
- **ถ้าต้องการทำงานปฏิบัติการ** → ต้องเพิ่ม role อื่นๆ

**Case 2: IT Manager + Help Desk**
- ตัวอย่าง: ผู้จัดการ IT ที่ยังรับเรื่องและเปิดงานเอง
- สิทธิ์: ดูรายงานทั้งหมด, จัดการ Users + **สร้าง Incident, ปิดงาน, ยกเลิกงาน**

**Case 3: IT Manager + Supervisor**
- ตัวอย่าง: ผู้จัดการที่ยังมอบหมายงานเอง
- สิทธิ์: ดูรายงานทั้งหมด, จัดการ Users + **มอบหมายงานได้**

**Case 4: Supervisor (Standalone)**
- ตัวอย่าง: หัวหน้าทีมช่าง ที่**ไม่ลงมือซ่อมเอง**
- สิทธิ์: **มอบหมายงาน + ดูรายงานทีม**
- **หมายเหตุ:** ไม่รับงาน/ซ่อม (ป้องกันทุจริต + แยกบทบาท)

**Case 5: Supervisor + Technician**  
- ตัวอย่าง: หัวหน้าทีมที่**ยังลงมือซ่อมเอง**
- สิทธิ์: มอบหมายงาน + **รับงานออกสถานที่ด้วยตัวเอง** + ดูรายงานของตัวเอง

**Case 6: Finance Admin + Read Only**
- ตัวอย่าง: เจ้าหน้าที่การเงินที่ต้องดูรายงาน
- สิทธิ์: จัดการการเงิน + ดูรายงานบางส่วนที่กำหนดให้

**Case 7: Help Desk + Read Only**
- ตัวอย่าง: พนักงาน Help Desk ที่ดูแลรายงาน
- สิทธิ์: สร้างงาน, ปิดงาน, ยกเลิกงาน + ดูรายงานบางส่วนที่กำหนดให้

**Case 8: Technician (Standalone)**
- ตัวอย่าง: ช่างปฏิบัติการ
- สิทธิ์: รับงาน/ซ่อม + **ดูรายงานของตัวเอง** (Performance, งานที่รับผิดชอบ, คะแนนประเมิน)

### 3.2 Permission Matrix (สิทธิ์แต่ละ Role)

| Feature | Super Admin | IT Manager | Finance Admin | Help Desk | Supervisor | Technician | End User | Read Only |
|---------|:-----------:|:----------:|:-------------:|:---------:|:----------:|:----------:|:--------:|:---------:|
| ตั้งค่าระบบ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| จัดการ User | **❌** | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **สร้าง Incident** | **❌** | ❌ | ❌ | **✅** | ❌ | ❌ | ✅ | ❌ |
| **มอบหมายงาน** | **❌** | ❌ | ❌ | ❌ | **✅** | ❌ | ❌ | ❌ |
| **Reassign งาน** | **❌** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| รับงาน/ซ่อม | ❌ | ❌ | ❌ | ❌ | **❌** | ✅ | ❌ | ❌ |
| ปิดงาน | **❌** | **❌** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **ยกเลิกงาน** | **❌** | ❌ | ❌ | **✅** | ❌ | ❌ | ❌ | ❌ |
| อนุมัติจ่ายเงิน | **❌** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **ประเมินงาน** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **ดูรายงานทั้งหมด** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **ดูรายงานบางส่วน** | - | - | ✅ | ✅ | - | **✅** | - | ✅ |

**หมายเหตุ:**
- **Super Admin**: **ตั้งค่าระบบ + ดูรายงานทั้งหมด เท่านั้น** (ไม่ทำงานปฏิบัติการ, ไม่ Reassign)
- **IT Manager ✅***: แค่ Add/Remove Roles + Enable/Disable User (ไม่ Create, ไม่ Delete, ไม่ปิดงาน) + **Reassign งาน**
- **Help Desk**: Gate Keeper - **สร้างงาน, ปิดงาน, ยกเลิกงาน, Reassign งาน** (ต้องแนบรูปหลักฐาน)
- **Supervisor**: **มอบหมายงาน + Reassign งาน** (ไม่รับงาน/ซ่อมเอง)
- **Technician**: รับงาน/ซ่อม + **ดูรายงานของตัวเอง**
- **Finance Admin + Help Desk + Technician + Read Only**: ดูเฉพาะรายงานที่กำหนดให้ (ใช้ user_report_permissions)

---

## 4. SYSTEM ARCHITECTURE

### 4.1 High-Level Architecture
```
┌──────────────────────────────────────────────────┐
│         👥 End Users (Web Browser)               │
│    Desktop / Tablet / Mobile (Responsive)        │
└───────────────────┬──────────────────────────────┘
                    │ HTTPS
                    ▼
┌──────────────────────────────────────────────────┐
│         🎨 Frontend (Next.js 14)                 │
│  ┌────────────────────────────────────────────┐  │
│  │ Pages  │  Components  │  Services  │ API   │  │
│  │ Public Rating Page (No Auth Required)      │  │
│  └────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────┘
                    │ REST API (JSON)
                    │ JWT Token / Public UUID
                    ▼
┌──────────────────────────────────────────────────┐
│         ⚙️  Backend API (NestJS)                 │
│  ┌────────────────────────────────────────────┐  │
│  │ Controllers → Services → Repositories      │  │
│  │ Email Service (Nodemailer - SMTP)          │  │
│  │ File Service (Local / S3)                  │  │
│  │ Public Endpoints (UUID validation)         │  │
│  └────────────────────────────────────────────┘  │
└───────────────────┬──────────────────────────────┘
                    │ TypeORM / Prisma
                    ▼
┌──────────────────────────────────────────────────┐
│         💾 Database (PostgreSQL)                 │
│  ┌────────────────────────────────────────────┐  │
│  │ 22 Tables Total:                           │  │
│  │                                            │  │
│  │ Core (6):                                  │  │
│  │ - users, roles, user_roles                 │  │
│  │ - companies, stores, categories            │  │
│  │                                            │  │
│  │ Incidents (7):                             │  │
│  │ - incidents, incident_comments             │  │
│  │ - incident_files, incident_status_history  │  │
│  │ - incident_ratings, incident_job_offers    │  │
│  │ - incident_checkins (🆕 GPS + Photos)      │  │
│  │                                            │  │
│  │ Outsource (1):                             │  │
│  │ - outsource_technician_profiles            │  │
│  │                                            │  │
│  │ SLA (2):                                   │  │
│  │ - sla_policies (customizable labels)       │  │
│  │ - holidays (🆕 business hours)             │  │
│  │                                            │  │
│  │ Notifications & Logs (3):                  │  │
│  │ - notifications, activity_logs, email_logs │  │
│  │                                            │  │
│  │ Settings & Permissions (3):                │  │
│  │ - settings, user_report_permissions (🆕)   │  │
│  │ - password_reset_tokens (🆕)               │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 4.2 Data Flow Example
```
1. End User แจ้งซ่อม (หรือแจ้งผ่าน Help Desk)
   → Frontend: Create Incident Form
   → API: POST /api/incidents
   → Database: INSERT INTO incidents
   → Auto-generate Ticket: WAT25110456
   → Email: แจ้ง Supervisor
   → Notification: แจ้งเตือนใน App
   
2. Supervisor มอบหมายงาน
   → Frontend: Assign Dialog
   → API: POST /api/incidents/:id/assign
   → Database: UPDATE incidents SET assignedTo
   → Email: แจ้ง Technician
   → Notification: แจ้งเตือนใน App
   
3. Technician แก้ไข → 2 กรณี:
   
   📌 กรณีที่ 1: งานสำเร็จ
   → Frontend: Mark as Resolved
   → API: PUT /api/incidents/:id/status (to 'resolved')
   → Database: UPDATE incidents SET status = 'resolved'
   → Email: แจ้ง Help Desk
   → Notification: แจ้งเตือนใน App
   
   📌 กรณีที่ 2: งานไม่สำเร็จ (รออะไรบางอย่าง)
   → Frontend: Update Status to Pending + Add Comment
   → API: PUT /api/incidents/:id/status (to 'pending')
   → Database: 
      - UPDATE incidents SET status = 'pending'
      - INSERT INTO incident_comments (log รายละเอียด)
   → Email: แจ้ง Supervisor + Help Desk
   → Notification: แจ้งเตือนใน App
   
4. Help Desk ตรวจสอบและตัดสินใจ:
   
   📌 กรณีที่ 1: งานสำเร็จ (จาก Technician Resolved)
   → Help Desk กด "Close Incident"
   → API: PUT /api/incidents/:id/status (to 'closed')
   → Database: 
      - UPDATE incidents SET status = 'closed'
      - Generate Rating Token (UUID)
   → Email: ส่งลิงก์ประเมินให้ End User (เฉพาะ status = 'closed')
   → Notification: แจ้งเตือนใน App
   
   📌 กรณีที่ 2: งานไม่สำเร็จ (จาก Technician Pending)
   → Help Desk Review Comment/Log
   → ตัดสินใจ:
      - ถ้า OK → รอต่อ (ยังเป็น Pending)
      - ถ้าไม่ OK → Reopen / Reassign
   → ไม่ส่ง Rating Email
   
5. End User ประเมิน (ผ่าน Email Link)
   → Public Page: /rate/{uuid}
   → API: POST /api/public/ratings/:token
   → Database: INSERT INTO incident_ratings
   → Email: แจ้ง Technician ว่าได้คะแนน
   → Notification: แจ้งเตือนใน App
```
   → Frontend: Close Incident
   → API: PUT /api/incidents/:id/status (to 'closed')
   → Database: 
       - UPDATE incidents SET status = 'closed'
       - Generate ratingToken (UUID)
   → Email: ส่งลิงก์ประเมินให้ End User
   
5. End User ประเมิน (ผ่าน Email Link)
   → Public Page: /rate/{uuid}
   → API: POST /api/public/ratings/:token
   → Database: INSERT INTO incident_ratings
   → Email: แจ้ง Technician ว่าได้คะแนน
```

---

# PART 2: CORE FEATURES

## 5. FEATURE 1: Authentication & User Management

### 5.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- เข้าสู่ระบบ (Login/Logout)
- **Self-Registration (สมัครสมาชิกเอง)**
- จัดการผู้ใช้ (Add Roles, Enable/Disable)
- จัดการ Roles และ Permissions
- **Password Reset (ลืมรหัสผ่าน)**
- Multi-role Support (1 คนมีหลาย Roles ได้)

**ใครใช้?**
- ทุกคนต้อง Login ก่อนใช้งาน (ยกเว้น Public Rating Page)
- **IT Manager** จัดการ Users และ Roles (ไม่สร้าง, ไม่ลบ)
- **Super Admin** ลบ Users ได้เท่านั้น

**Key Changes (v3.3):**
- ❌ ยกเลิกการสร้าง User โดย Admin
- ✅ User ต้อง **Register เอง** ผ่านหน้า Login
- ✅ IT Manager **Approve** และ **Add Roles** ให้
- ✅ Password Reset ผ่าน Email Link (ไม่ใช่ Admin reset)

### 5.2 💾 Database Tables

#### **Table: users**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL, -- bcrypt hashed
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  
  -- สำหรับ Technician เท่านั้น
  technicianType VARCHAR(20), -- 'insource' | 'outsource'
  
  -- สำหรับป้องกัน Default Super Admin
  isProtected BOOLEAN DEFAULT false, -- true = ห้ามลบ, ห้ามเปลี่ยน role
  
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_isActive ON users(isActive);
CREATE INDEX idx_users_isProtected ON users(isProtected);

-- Seed Data: Default Super Admin Account
-- Password: Password@1 (hashed with bcrypt)
INSERT INTO users (
  username, 
  email, 
  password, 
  firstName, 
  lastName, 
  isProtected, 
  isActive
) VALUES (
  'admin',
  'admin@rub-jobb.com',
  '$2b$10$...',  -- bcrypt hash of 'Password@1'
  'System',
  'Administrator',
  true,  -- Protected - ห้ามลบ/เปลี่ยน role
  true
);

-- Seed Data: Assign Super Admin role to default admin
INSERT INTO user_roles (userId, roleId) 
SELECT u.id, r.id 
FROM users u, roles r 
WHERE u.email = 'admin@rub-jobb.com' 
  AND r.name = 'super_admin';
```

**Field Explanations:**
- `technicianType`: ใช้เฉพาะ user ที่มี role 'technician'
  - `insource` = พนักงานในบริษัท (Login ปกติ)
  - `outsource` = ช่างภายนอก (ใช้งานผ่าน Mobile App)

#### **Table: roles**
```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL, -- 'super_admin', 'technician', etc.
  displayName VARCHAR(100) NOT NULL, -- 'Super Admin', 'Technician'
  description TEXT,
  permissions TEXT, -- JSON array of permissions
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data (ข้อมูลเริ่มต้น)
INSERT INTO roles (name, displayName, description) VALUES
('super_admin', 'Super Admin', 'System Admin - ตั้งค่าระบบ + ดูรายงานทั้งหมด (ไม่ทำงานปฏิบัติการ)'),
('it_manager', 'IT Manager', 'ผู้จัดการ IT - จัดการ Users + ดูรายงานทั้งหมด (ไม่สร้างงาน, ไม่มอบหมาย, ไม่ปิดงาน)'),
('finance_admin', 'Finance Admin', 'เจ้าหน้าที่การเงิน - อนุมัติจ่าย Outsource (ดูรายงานบางส่วน)'),
('help_desk', 'Help Desk', 'Help Desk - Gate Keeper: สร้างงาน, ปิดงาน, ยกเลิกงาน (ควบคุมคุณภาพ)'),
('supervisor', 'Supervisor', 'หัวหน้าทีมช่าง - มอบหมายงาน, ดูรายงานทีม (ไม่รับงาน/ซ่อม)'),
('technician', 'Technician', 'ช่างเทคนิค - รับงานและแก้ไข + ดูรายงานของตัวเอง'),
('end_user', 'End User', 'ผู้ใช้ทั่วไป - แจ้งปัญหา ติดตามสถานะ ประเมินงาน'),
('read_only', 'Read Only', 'ดูรายงานเฉพาะที่กำหนดให้ (แยก Permission รายรายงาน)');
```

#### **Table: user_roles (Many-to-Many)**
```sql
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  roleId INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assignedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assignedBy INTEGER REFERENCES users(id), -- ใครเป็นคนกำหนด role นี้ให้
  
  UNIQUE(userId, roleId) -- ห้าม role ซ้ำใน 1 user
);

-- Indexes
CREATE INDEX idx_user_roles_userId ON user_roles(userId);
CREATE INDEX idx_user_roles_roleId ON user_roles(roleId);
```

**Business Rules:**
- ✅ 1 User ต้องมีอย่างน้อย 1 Role
- ✅ 1 User มีได้สูงสุด 5 Roles
- ❌ ห้ามมี Role ที่ขัดแย้งกัน (เช่น Super Admin + End User)

#### **Table: password_reset_tokens** (🆕 v3.3)
```sql
CREATE TABLE password_reset_tokens (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(36) UNIQUE NOT NULL, -- UUID
  expiresAt TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  usedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_userId ON password_reset_tokens(userId);
```

**Business Rules:**
- ✅ Token หมดอายุภายใน 1 ชั่วโมง
- ✅ Token ใช้ได้ครั้งเดียว (used = true หลังใช้)
- ✅ ส่งอีเมลแจ้งเตือนทุกครั้งที่เปลี่ยนรหัสผ่าน
- ✅ Rate Limiting: 5 ครั้ง/ชม./IP

### 5.3 🔌 API Endpoints

```typescript
// Authentication & Registration
POST   /api/auth/register                  // 🆕 สมัครสมาชิกเอง (Public)
POST   /api/auth/login                     // เข้าสู่ระบบ
POST   /api/auth/logout                    // ออกจากระบบ
POST   /api/auth/refresh                   // ต่ออายุ token
GET    /api/auth/profile                   // ดูข้อมูลตัวเอง
PUT    /api/auth/profile                   // แก้ไขข้อมูลตัวเอง
PUT    /api/auth/change-password           // เปลี่ยนรหัสผ่าน (Login แล้ว)

// Password Reset (Public)
POST   /api/auth/forgot-password           // 🆕 ขอ Reset Password Link
POST   /api/auth/reset-password/:token     // 🆕 Reset Password ด้วย Token
GET    /api/auth/reset-password/:token     // 🆕 ตรวจสอบ Token

// User Management (IT Manager, Super Admin)
GET    /api/users                          // ดูรายชื่อ users (มี filters)
GET    /api/users/pending                  // 🆕 ดู Pending Users (รอ Approve)
GET    /api/users/:id                      // ดูข้อมูล user 1 คน
POST   /api/users/:id/approve              // 🆕 Approve User (IT Manager)
POST   /api/users/:id/enable               // 🆕 Enable User (IT Manager)
POST   /api/users/:id/disable              // 🆕 Disable User (IT Manager)
PUT    /api/users/:id                      // แก้ไข user (IT Manager)
DELETE /api/users/:id                      // ❌ ลบ user (Super Admin only)
```

**Permission Summary:**
- **Public (ไม่ต้อง Login):** register, login, forgot-password, reset-password
- **All Authenticated Users:** profile, change-password
- **IT Manager:** 
  - ✅ View users, approve, enable/disable
  - ✅ Add/Remove roles (ยกเว้น Super Admin role)
  - ❌ Cannot add/remove Super Admin role
  - ❌ Cannot modify Protected Users (admin@rub-jobb.com)
- **Super Admin:** 
  - ✅ All IT Manager permissions
  - ✅ Add/Remove Super Admin role
  - ✅ Delete users
  - ✅ System settings
  - ❌ Cannot delete Protected Users (admin@rub-jobb.com)

```typescript
// Role Assignment (IT Manager only - with restrictions)
POST   /api/users/:id/roles               // กำหนด roles ให้ user
                                           // ❌ ห้าม: Add 'super_admin' role (Super Admin only)
                                           // ❌ ห้าม: Modify Protected Users (isProtected = true)
DELETE /api/users/:id/roles/:roleId       // เอา role ออกจาก user
                                           // ❌ ห้าม: Remove 'super_admin' role (Super Admin only)
                                           // ❌ ห้าม: Modify Protected Users (isProtected = true)
GET    /api/users/:id/roles               // ดู roles ของ user

// Role Management (IT Manager only)
GET    /api/roles                         // ดูรายชื่อ roles ทั้งหมด
                                           // IT Manager: ไม่แสดง 'super_admin' ใน available list
                                           // Super Admin: แสดงทุก role
GET    /api/roles/:id                     // ดูข้อมูล role 1 ตัว
POST   /api/roles                         // สร้าง custom role (Super Admin only)
PUT    /api/roles/:id                     // แก้ไข role (Super Admin only)
DELETE /api/roles/:id                     // ลบ role (Super Admin only)
```

**Request/Response Examples:**

**Login:**
```json
// POST /api/auth/login
Request:
{
  "username": "john.doe",
  "password": "P@ssw0rd"
}

Response:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "john.doe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["technician", "supervisor"]
  }
}
```

**Register (Self-Registration):**
```json
// POST /api/auth/register
Request:
{
  "username": "jane.smith",
  "email": "jane@example.com",
  "password": "P@ssw0rd123",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "081-234-5678",
  "department": "IT Support"
}

Response:
{
  "success": true,
  "message": "Registration successful! Please wait for admin approval.",
  "user": {
    "id": 2,
    "username": "jane.smith",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "isActive": false,
    "roles": []  // ว่างเปล่า - รอ IT Manager เพิ่ม Role
  }
}
```

**Get Profile:**
```json
// GET /api/auth/profile
// Authorization: Bearer {token}

Response:
{
  "id": 1,
  "username": "john.doe",
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "081-234-5678",
  "department": "IT Support",
  "isActive": true,
  "roles": [
    {
      "id": 6,
      "name": "technician",
      "displayName": "Technician"
    },
    {
      "id": 5,
      "name": "supervisor",
      "displayName": "Supervisor"
    }
  ],
  "createdAt": "2025-11-15T10:00:00Z",
  "updatedAt": "2025-11-16T14:30:00Z"
}
```

**Update Profile:**
```json
// PUT /api/auth/profile
// Authorization: Bearer {token}

Request:
{
  "firstName": "Johnny",
  "lastName": "Doe Jr.",
  "phone": "089-999-8888",
  "department": "IT Operations"
}

Response:
{
  "success": true,
  "message": "Profile updated successfully",
  "user": {
    "id": 1,
    "username": "john.doe",  // ไม่สามารถเปลี่ยนได้
    "email": "john@example.com",  // ไม่สามารถเปลี่ยนได้
    "firstName": "Johnny",
    "lastName": "Doe Jr.",
    "phone": "089-999-8888",
    "department": "IT Operations"
  }
}
```

**Change Password (While Logged In):**
```json
// PUT /api/auth/change-password
// Authorization: Bearer {token}

Request:
{
  "currentPassword": "P@ssw0rd",
  "newPassword": "NewP@ssw0rd123"
}

Response:
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Add Role to User (IT Manager):**
```json
// POST /api/users/:id/roles
// Authorization: Bearer {token} (IT Manager)

Request:
{
  "roleId": 5  // IT Manager role
}

Response (Success):
{
  "success": true,
  "message": "Role added successfully",
  "user": {
    "id": 10,
    "email": "john@example.com",
    "roles": ["help_desk", "read_only", "it_manager"]
  }
}

Response (Error - Trying to add Super Admin role):
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "IT Manager cannot assign Super Admin role. Only Super Admin can assign this role.",
  "statusCode": 403
}

Response (Error - Trying to modify Protected User):
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Cannot modify protected user account (admin@rub-jobb.com). This account is system-protected.",
  "statusCode": 403
}
```

**Get Available Roles (IT Manager vs Super Admin):**
```json
// GET /api/roles
// Authorization: Bearer {token}

Response (IT Manager):
{
  "roles": [
    { "id": 2, "name": "it_manager", "displayName": "IT Manager" },
    { "id": 3, "name": "finance_admin", "displayName": "Finance Admin" },
    { "id": 4, "name": "help_desk", "displayName": "Help Desk" },
    { "id": 5, "name": "supervisor", "displayName": "Supervisor" },
    { "id": 6, "name": "technician", "displayName": "Technician" },
    { "id": 7, "name": "end_user", "displayName": "End User" },
    { "id": 8, "name": "read_only", "displayName": "Read Only" }
    // ❌ Super Admin role NOT included
  ]
}

Response (Super Admin):
{
  "roles": [
    { "id": 1, "name": "super_admin", "displayName": "Super Admin" },  // ✅ Included
    { "id": 2, "name": "it_manager", "displayName": "IT Manager" },
    { "id": 3, "name": "finance_admin", "displayName": "Finance Admin" },
    { "id": 4, "name": "help_desk", "displayName": "Help Desk" },
    { "id": 5, "name": "supervisor", "displayName": "Supervisor" },
    { "id": 6, "name": "technician", "displayName": "Technician" },
    { "id": 7, "name": "end_user", "displayName": "End User" },
    { "id": 8, "name": "read_only", "displayName": "Read Only" }
  ]
}
```

**Disable User (IT Manager):**
```json
// POST /api/users/:id/disable
// Authorization: Bearer {token} (IT Manager)

Response (Success):
{
  "success": true,
  "message": "User disabled successfully"
}

Response (Error - Trying to disable Protected User):
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Cannot disable protected user account (admin@rub-jobb.com). This account must remain active.",
  "statusCode": 403
}
```

**Delete User (Super Admin):**
```json
// DELETE /api/users/:id
// Authorization: Bearer {token} (Super Admin)

Response (Success):
{
  "success": true,
  "message": "User deleted successfully"
}

Response (Error - Trying to delete Protected User):
{
  "success": false,
  "error": "FORBIDDEN",
  "message": "Cannot delete protected user account (admin@rub-jobb.com). This account is system-protected and cannot be removed.",
  "statusCode": 403
}
```
```

### 5.4 🎨 UI Layouts

#### **Page 1: Login Page**
```
┌──────────────────────────────────────────────────┐
│                                                  │
│                   [Logo] RIM                     │
│                                                  │
│    ┌──────────────────────────────────────┐     │
│    │           Login                      │     │
│    │  ────────────────────────────────    │     │
│    │                                      │     │
│    │  📧 Email                            │     │
│    │  [____________________________]      │     │
│    │                                      │     │
│    │  🔒 Password                         │     │
│    │  [____________________________]      │     │
│    │                                      │     │
│    │  ☐ Remember me    Forgot Password?  │     │
│    │                                      │     │
│    │  ┌────────────────────────────────┐ │     │
│    │  │          Login                 │ │     │
│    │  └────────────────────────────────┘ │     │
│    │                                      │     │
│    │  Don't have an account? Register    │     │
│    │                                      │     │
│    └──────────────────────────────────────┘     │
│                                                  │
└──────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- ใช้ **Email** แทน Username (ตาม SRS v3.3)
- มี **Remember me** checkbox
- มี **Forgot Password?** link (ทางขวา)
- มี **Register** link ด้านล่าง (Self-Registration)
- Design ตามรูปที่ให้มา (สีเข้ม, Modern UI)

#### **Page 1.1: Registration Page** (Public - ไม่ต้อง Login)
```
┌──────────────────────────────────────────────────┐
│                                                  │
│                   [Logo] RIM                     │
│                                                  │
│    ┌──────────────────────────────────────┐     │
│    │         Registration                 │     │
│    │  ────────────────────────────────    │     │
│    │                                      │     │
│    │  👤 Username                         │     │
│    │  [____________________________]      │     │
│    │                                      │     │
│    │  📧 Email                            │     │
│    │  [____________________________]      │     │
│    │                                      │     │
│    │  🔒 Password                         │     │
│    │  [____________________________]      │     │
│    │                                      │     │
│    │  ☐ I agree to the terms & conditions│     │
│    │                                      │     │
│    │  ┌────────────────────────────────┐ │     │
│    │  │          Register              │ │     │
│    │  └────────────────────────────────┘ │     │
│    │                                      │     │
│    │  Already have an account? Login     │     │
│    │                                      │     │
│    └──────────────────────────────────────┘     │
│                                                  │
└──────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- **Username** - ต้องไม่ซ้ำในระบบ
- **Email** - ต้องไม่ซ้ำในระบบ (ใช้สำหรับ Login)
- **Password** - ต้องมีความปลอดภัย (8+ ตัวอักษร)
- **Terms & Conditions** - ต้องติ๊กถูกก่อน Register
- หลัง Register แล้ว → สถานะ: **Pending Approval** (รอ IT Manager เพิ่ม Role)
- Design ตามรูปที่ให้มา (สีเข้ม, Modern UI)

#### **Page 2: User List Page** (IT Manager only)
```
┌──────────────────────────────────────────────────────────────┐
│ 👥 Users Management                                          │
├──────────────────────────────────────────────────────────────┤
│ [Search: ______] [Role: All ▼] [Status: All ▼]              │
│ Tabs: [All Users] [Pending Approval] [Active] [Disabled]    │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Name          │ Email         │ Roles      │ Status  │ Actions ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ John Doe      │ john@co.com   │ Help Desk  │ ✅ Active│ [Manage]││
│ │               │               │ Read Only  │         │         ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ Jane Smith    │ jane@co.com   │ Technician │ ✅ Active│ [Manage]││
│ │               │               │            │         │         ││
│ ├──────────────────────────────────────────────────────────┤│
│ │ Mike New      │ mike@co.com   │ (No Roles) │ ⏳ Pending│[Assign]││
│ │               │               │            │         │         ││
│ └──────────────────────────────────────────────────────────┘│
│ Showing 1-10 of 45 users                    [1] 2 3 ... 5   │
└──────────────────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- **ไม่มี [+ New User]** - เพราะ User ต้อง Register เอง
- **Pending Approval Tab** - แสดง User ที่ยังไม่มี Role
- **IT Manager** จัดการได้เฉพาะ: Add/Remove Roles, Enable/Disable
- **[Manage]** - เปิด Modal จัดการ Roles และ Status
- **[Assign]** - สำหรับ Pending User (เพิ่ม Role ครั้งแรก)

#### **Page 3: Manage User Modal** (IT Manager only)
```
┌──────────────────────────────────────────────────┐
│ Manage User: John Doe                  [X]       │
├──────────────────────────────────────────────────┤
│                                                  │
│ User Information (Read-only)                     │
│ ┌──────────────────────────────────────────────┐│
│ │ Email:      john@company.com                 ││
│ │ Name:       John Doe                         ││
│ │ Phone:      081-234-5678                     ││
│ │ Department: IT Support                       ││
│ │ Registered: 15 Nov 2025 14:30                ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Account Status                                   │
│ ┌──────────────────────────────────────────────┐│
│ │ ⚫ Active    ⚪ Disabled                      ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Assigned Roles                                   │
│ ┌──────────────────────────────────────────────┐│
│ │ ☑ Help Desk                     [Remove]     ││
│ │ ☑ Read Only                     [Remove]     ││
│ │                                              ││
│ │ Available Roles to Add:                      ││
│ │ ☐ IT Manager                    [Add]        ││
│ │ ☐ Finance Admin                 [Add]        ││
│ │ ☐ Supervisor                    [Add]        ││
│ │ ☐ Technician                    [Add]        ││
│ │ ☐ End User                      [Add]        ││
│ │                                              ││
│ │ ⚠️ Super Admin role can only be assigned     ││
│ │    by existing Super Admin                   ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ ⚠️ IT Manager Permissions:                       │
│ • Add/Remove Roles (except Super Admin)          │
│ • Enable/Disable User Account                    │
│ • Cannot: Create, Delete, or Edit User Info     │
│ • Cannot: Modify Default Super Admin Account    │
│                                                  │
│               [Close]        [Save Changes]      │
└──────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- **Read-only User Info** - IT Manager ไม่สามารถแก้ไขข้อมูล User ได้
- **Add/Remove Roles** - จัดการ Roles ได้เท่านั้น
- **Enable/Disable Status** - สามารถปิดการใช้งาน User ได้
- **ไม่มี Delete** - ไม่สามารถลบ User ได้

#### **Page 4: My Profile Page** (All Authenticated Users)
```
┌──────────────────────────────────────────────────────────────┐
│ 👤 My Profile                                    [Edit Mode] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Account Information (Read-only)                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Username:    john.doe                                    ││
│ │ Email:       john@company.com                            ││
│ │ Account Status: ✅ Active                                 ││
│ │ Registered:  15 Nov 2025 14:30                           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Personal Information (Editable)                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ First Name: * [Johnny________________]                   ││
│ │ Last Name:  * [Doe Jr._______________ ]                  ││
│ │ Phone:        [089-999-8888__________]                   ││
│ │ Department:   [IT Operations_________]                   ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Assigned Roles (Read-only)                                   │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ • Help Desk                                              ││
│ │ • Read Only                                              ││
│ │                                                          ││
│ │ ℹ️ Contact IT Manager to change roles                    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ Change Password                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Current Password:  [___________________]                 ││
│ │ New Password:      [___________________]                 ││
│ │ Confirm Password:  [___________________]                 ││
│ │                                           [Change]        ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                            [Cancel]    [Save Changes]        │
└──────────────────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- **User สามารถแก้ไขได้:**
  - ✅ First Name, Last Name
  - ✅ Phone, Department
  - ✅ Password (ต้องใส่ Current Password ด้วย)

- **User ไม่สามารถแก้ไขได้:**
  - ❌ Username (ใช้สำหรับ Login)
  - ❌ Email (ใช้สำหรับ Login และ Notifications)
  - ❌ Roles (ต้องให้ IT Manager จัดการ)
  - ❌ Account Status (ต้องให้ IT Manager จัดการ)

- **การเปลี่ยนรหัสผ่าน:**
  - ต้องใส่ **Current Password** เพื่อยืนยันตัวตน
  - **New Password** ต้องมีความปลอดภัย (8+ ตัวอักษร, ตัวพิมพ์ใหญ่+เล็ก, ตัวเลข)
  - ส่งอีเมลแจ้งเตือนเมื่อเปลี่ยนรหัสผ่านสำเร็จ

### 5.5 🔄 Workflows

#### **Workflow 1: User Login**
```
User เข้า Login Page
  ↓
กรอก Username + Password
  ↓
คลิก Login
  ↓
System ตรวจสอบ credentials
  ├─ ✅ ถูกต้อง
  │   ↓
  │   สร้าง JWT Token
  │   ↓
  │   เก็บ Token ใน localStorage
  │   ↓
  │   Redirect ไป Dashboard
  │
  └─ ❌ ผิด
      ↓
      แสดง Error: "Invalid username or password"
```

#### **Workflow 2: Self-Registration** (🆕 v3.3)
```
User เข้าหน้า Login
  ↓
คลิก [Register] หรือ "Don't have an account? Sign up"
  ↓
เปิดหน้า Registration
  ↓
กรอกข้อมูล:
  - Username
  - Email
  - Password
  - Confirm Password
  - First Name
  - Last Name
  - Phone
  - Department
  ↓
คลิก [Register]
  ↓
System Validation:
  ├─ ✅ Valid
  │   ↓
  │   Hash password (bcrypt)
  │   ↓
  │   INSERT INTO users (isActive = false, default role = null)
  │   ↓
  │   ส่งอีเมลยืนยัน (optional)
  │   ↓
  │   แจ้งเตือน IT Manager (มี User รอ Approve)
  │   ↓
  │   แสดง "Registration successful! Waiting for admin approval"
  │
  └─ ❌ Invalid
      ↓
      แสดง Validation Errors:
      - "Email already exists"
      - "Username already taken"
      - "Password too weak"
      - "Passwords don't match"
```

#### **Workflow 3: IT Manager Approve User** (🆕 v3.3)
```
IT Manager เข้า Users Page
  ↓
เห็นแท็บ "Pending Users" (มี badge จำนวน)
  ↓
คลิกดู Pending Users List
  ↓
เลือก User → คลิก [Review]
  ↓
ตรวจสอบข้อมูล User
  ↓
เลือก Roles ให้ User (อย่างน้อย 1 role)
  ├─ Help Desk
  ├─ End User
  ├─ Technician (เลือก Type: Insource/Outsource)
  └─ อื่นๆ
  ↓
คลิก [Approve & Enable User]
  ↓
System:
  - UPDATE users SET isActive = true
  - INSERT INTO user_roles (roles ที่เลือก)
  - ส่งอีเมลแจ้ง User ว่า Account พร้อมใช้งาน
  ↓
แสดง Success Message
  ↓
User สามารถ Login ได้แล้ว
```

#### **Workflow 4: Password Reset (Forgot Password)** (🆕 v3.3)
```
User คลิก "Forgot Password?" ในหน้า Login
  ↓
เปิดหน้า "Reset Password Request"
  ↓
กรอก Email ที่ลงทะเบียน
  ↓
คลิก "Send Reset Link"
  ↓
System:
  ├─ ✅ Email มีในระบบ
  │   ↓
  │   สร้าง Reset Token (UUID + Expiry 1 hour)
  │   ↓
  │   INSERT INTO password_reset_tokens
  │   ↓
  │   ส่งอีเมลพร้อม Reset Link:
  │   https://rim.example.com/reset-password/{token}
  │   ↓
  │   แสดง "Check your email for reset instructions"
  │
  └─ ❌ Email ไม่มีในระบบ
      ↓
      แสดง "Check your email..." (ไม่บอกว่าไม่เจอ - security)

User คลิก Reset Link จากอีเมล
  ↓
System ตรวจสอบ Token:
  ├─ ✅ Valid + ไม่หมดอายุ
  │   ↓
  │   แสดงฟอร์ม:
  │   - New Password
  │   - Confirm Password
  │   ↓
  │   กด "Reset Password"
  │   ↓
  │   Hash password ใหม่
  │   ↓
  │   UPDATE users SET password = newHash
  │   ↓
  │   DELETE FROM password_reset_tokens WHERE token = ...
  │   ↓
  │   ส่งอีเมลแจ้งเตือนว่ารหัสถูกเปลี่ยนแล้ว
  │   ↓
  │   Redirect → Login Page
  │   ↓
  │   แสดง "Password reset successful - Please login"
  │
  └─ ❌ Token หมดอายุ หรือ ใช้ไปแล้ว
      ↓
      แสดง "Reset link expired - Please request a new one"
```

#### **Workflow 5: Update Profile** (🆕)
```
User Login เข้าระบบแล้ว
  ↓
คลิก "My Profile" (จาก Menu หรือ Avatar)
  ↓
System แสดงหน้า My Profile
  ├─ GET /api/auth/profile
  ↓
แสดงข้อมูล:
  - Username (Read-only)
  - Email (Read-only)
  - First Name, Last Name (Editable)
  - Phone, Department (Editable)
  - Roles (Read-only - แสดงเป็น badges)
  ↓
User แก้ไขข้อมูล:
  - First Name: "John" → "Johnny"
  - Last Name: "Doe" → "Doe Jr."
  - Phone: "081-234-5678" → "089-999-8888"
  - Department: "IT Support" → "IT Operations"
  ↓
คลิก [Save Changes]
  ↓
System Validation:
  ├─ ✅ Valid
  │   ↓
  │   PUT /api/auth/profile
  │   ↓
  │   UPDATE users SET 
  │     firstName = 'Johnny',
  │     lastName = 'Doe Jr.',
  │     phone = '089-999-8888',
  │     department = 'IT Operations'
  │   WHERE id = currentUserId
  │   ↓
  │   แสดง Success: "Profile updated successfully"
  │   ↓
  │   Reload Profile Data
  │
  └─ ❌ Invalid
      ↓
      แสดง Validation Errors:
      - "First Name is required"
      - "Last Name is required"
      - "Invalid phone number format"
```

#### **Workflow 6: Change Password (While Logged In)** (🆕)
```
User อยู่ในหน้า My Profile
  ↓
Scroll ลงไปที่ Section "Change Password"
  ↓
กรอกข้อมูล:
  - Current Password: "OldPassword123"
  - New Password: "NewPassword456!"
  - Confirm Password: "NewPassword456!"
  ↓
คลิก [Change Password]
  ↓
System Validation:
  ├─ ✅ Valid
  │   ↓
  │   ตรวจสอบ Current Password:
  │   ├─ ✅ ถูกต้อง
  │   │   ↓
  │   │   Hash New Password (bcrypt)
  │   │   ↓
  │   │   UPDATE users SET password = newHash
  │   │   ↓
  │   │   ส่งอีเมลแจ้งเตือน: "Your password was changed"
  │   │   ↓
  │   │   แสดง Success: "Password changed successfully"
  │   │   ↓
  │   │   Clear form
  │   │
  │   └─ ❌ Current Password ผิด
  │       ↓
  │       แสดง Error: "Current password is incorrect"
  │
  └─ ❌ Invalid
      ↓
      แสดง Validation Errors:
      - "New password must be at least 8 characters"
      - "New password must contain uppercase, lowercase, and number"
      - "Passwords don't match"
      - "New password cannot be the same as current password"
```

#### **Workflow 7: Multi-role Permission Check**
```
User พยายามเข้าถึง Feature X
  ↓
System ดึง Roles ของ User
  ↓
ตรวจสอบ Permissions:
  - User มี roles: ['supervisor', 'technician']
  - Feature X ต้องการ permission: 'assign_incident'
  - Role 'supervisor' มี permission นี้ ✅
  ↓
อนุญาตให้เข้าถึง Feature X
```

### 5.6 ✅ Validation Rules

1. **Username:**
   - ห้ามซ้ำ
   - 3-50 ตัวอักษร
   - ใช้ได้แค่ a-z, 0-9, underscore, dot

2. **Email:**
   - ห้ามซ้ำ
   - รูปแบบ email ที่ถูกต้อง

3. **Password:**
   - ยาวอย่างน้อย 8 ตัวอักษร
   - ต้องมี: ตัวพิมพ์ใหญ่, ตัวพิมพ์เล็ก, ตัวเลข

4. **Roles:**
   - ต้องเลือกอย่างน้อย 1 role
   - สูงสุด 5 roles
   - ห้ามมี role ที่ขัดแย้ง

5. **Technician Type:**
   - ต้องระบุเฉพาะถ้ามี role 'technician'

6. **Profile Update (My Profile):**
   - **First Name:** Required, 1-50 ตัวอักษร
   - **Last Name:** Required, 1-50 ตัวอักษร
   - **Phone:** Optional, รูปแบบเบอร์โทรที่ถูกต้อง (081-234-5678 หรือ 0812345678)
   - **Department:** Optional, 1-100 ตัวอักษร
   - **Username & Email:** ไม่สามารถแก้ไขได้ (Read-only)
   - **Roles:** ไม่สามารถแก้ไขได้ (ต้องให้ IT Manager จัดการ)

7. **Change Password (While Logged In):**
   - **Current Password:** Required - ต้องถูกต้องเพื่อยืนยันตัวตน
   - **New Password:** 
     - Required, ยาวอย่างน้อย 8 ตัวอักษร
     - ต้องมี: ตัวพิมพ์ใหญ่, ตัวพิมพ์เล็ก, ตัวเลข
     - ต้องไม่เหมือน Current Password
   - **Confirm Password:** Required - ต้องตรงกับ New Password
   - ส่งอีเมลแจ้งเตือนทุกครั้งที่เปลี่ยนรหัสผ่านสำเร็จ

8. **IT Manager Permissions (🆕):**
   - ✅ **Can Do:**
     - Add/Remove Roles (ยกเว้น Super Admin role)
     - Enable/Disable User Account (ยกเว้น Protected Users)
     - View all users and their information
   - ❌ **Cannot Do:**
     - Add Super Admin role to any user
     - Remove Super Admin role from any user
     - Delete any user (only Super Admin can delete)
     - Edit user personal information (users edit their own)
     - Modify Protected Users (isProtected = true)
     - Disable Protected Users

9. **Protected Users (🆕):**
   - **Default Protected User:** admin@rub-jobb.com
   - **Characteristics:**
     - `isProtected = true` in database
     - Cannot be deleted (system-level protection)
     - Cannot have roles modified (always Super Admin)
     - Cannot be disabled (always isActive = true)
     - Can change own password (recommended immediately)
     - Can edit own profile (firstName, lastName, phone)
   - **API Validation:**
     - DELETE /api/users/:id → Check isProtected, reject if true
     - POST/DELETE /api/users/:id/roles → Check isProtected, reject if true
     - POST /api/users/:id/disable → Check isProtected, reject if true

10. **Super Admin Role Assignment (🆕):**
    - Only existing Super Admin can assign Super Admin role to others
    - IT Manager role cannot see "Super Admin" in available roles list
    - Backend validation: If role = 'super_admin', check requester has Super Admin role

---

## 6. FEATURE 2: Incident Management

### 6.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- แจ้งปัญหา IT (สร้าง Incident)
- มอบหมายงานให้ช่าง
- ติดตามสถานะงาน
- อัพเดทความคืบหน้า
- แนบไฟล์ก่อน-หลังซ่อม
- ปิดงานและประเมินผล

**ใครใช้?**
- **End User:** แจ้งปัญหา, ดูสถานะ
- **IT Manager/Supervisor:** มอบหมายงาน
- **Technician:** รับงาน, อัพเดทสถานะ, แนบไฟล์
- **Help Desk:** ตรวจสอบและปิดงาน

### 6.2 💾 Database Tables

#### **Table: incidents**
```sql
CREATE TABLE incidents (
  id SERIAL PRIMARY KEY,
  ticketNumber VARCHAR(50) UNIQUE NOT NULL, -- Auto: WATYYMM0001 (เช่น WAT25110001)
  
  -- Basic Information
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  categoryId INTEGER REFERENCES categories(id),
  storeId INTEGER REFERENCES stores(id),
  
  -- Priority & Status
  priority VARCHAR(20) NOT NULL DEFAULT 'medium', 
  -- 'low', 'medium', 'high', 'critical'
  
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  -- 'open', 'assigned', 'in_progress', 'pending', 
  -- 'resolved', 'closed', 'cancelled'
  
  -- People
  reporterId INTEGER NOT NULL REFERENCES users(id), -- ผู้แจ้ง
  assignedTo INTEGER REFERENCES users(id),          -- ช่างที่รับผิดชอบ
  supervisorId INTEGER REFERENCES users(id),        -- Supervisor
  
  -- Outsource Management
  isOutsource BOOLEAN DEFAULT false,
  outsourceType VARCHAR(20), 
  -- 'general', 'specialist', 'emergency', 'contractor'
  jobOfferId INTEGER REFERENCES incident_job_offers(id),
  
  -- Incident Type & Relations (🆕 v3.4)
  incidentType VARCHAR(30) DEFAULT 'normal',
  -- 'normal', 'return_equipment', 'follow_up'
  relatedIncidentId INTEGER REFERENCES incidents(id),
  -- อ้างอิงถึง Incident อื่น (เช่น Return Job อ้างอิง Original Job)
  
  -- Reopen Tracking (🆕 v3.4)
  reopenCount INTEGER DEFAULT 0,
  lastReopenedAt TIMESTAMP,
  lastReopenedBy INTEGER REFERENCES users(id),
  reopenReason TEXT,
  
  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assignedAt TIMESTAMP,
  startedAt TIMESTAMP,
  resolvedAt TIMESTAMP,
  closedAt TIMESTAMP,
  
  -- SLA
  dueDate TIMESTAMP,
  slaStatus VARCHAR(20) DEFAULT 'on_time', 
  -- 'on_time', 'warning', 'overdue'
  responseTime INTEGER, -- minutes
  resolutionTime INTEGER, -- minutes
  
  -- Additional Info
  location TEXT,
  contactPerson VARCHAR(100),
  contactPhone VARCHAR(20),
  equipmentInfo TEXT,
  resolutionNotes TEXT,
  
  -- Rating Token (สำหรับ Public Rating Link)
  ratingToken VARCHAR(36) UNIQUE, -- UUID v4
  ratingTokenCreatedAt TIMESTAMP,
  ratingTokenExpiresAt TIMESTAMP, -- หมดอายุ 30 วัน
  emailSentAt TIMESTAMP,
  
  -- Audit
  createdBy INTEGER REFERENCES users(id),
  updatedBy INTEGER REFERENCES users(id),
  closedBy INTEGER REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_incidents_ticketNumber ON incidents(ticketNumber);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_priority ON incidents(priority);
CREATE INDEX idx_incidents_storeId ON incidents(storeId);
CREATE INDEX idx_incidents_assignedTo ON incidents(assignedTo);
CREATE INDEX idx_incidents_reporterId ON incidents(reporterId);
CREATE INDEX idx_incidents_ratingToken ON incidents(ratingToken);
CREATE INDEX idx_incidents_createdAt ON incidents(createdAt);
CREATE INDEX idx_incidents_incidentType ON incidents(incidentType); -- 🆕
CREATE INDEX idx_incidents_relatedIncidentId ON incidents(relatedIncidentId); -- 🆕
```

#### **Table: incident_comments**
```sql
CREATE TABLE incident_comments (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  userId INTEGER NOT NULL REFERENCES users(id),
  comment TEXT NOT NULL,
  isInternal BOOLEAN DEFAULT false, -- true = เฉพาะทีมเห็น, false = ลูกค้าเห็นด้วย
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incident_comments_incidentId ON incident_comments(incidentId);
```

#### **Table: incident_status_history**
```sql
CREATE TABLE incident_status_history (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  fromStatus VARCHAR(20),
  toStatus VARCHAR(20) NOT NULL,
  changedBy INTEGER REFERENCES users(id),
  reason TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incident_status_history_incidentId ON incident_status_history(incidentId);
```

**Ticket Number Auto-Generation Logic:**

รูปแบบ: **`[PREFIX][YY][MM][XXXX]`**

| ส่วนประกอบ | คำอธิบาย | ตัวอย่าง |
|------------|---------|----------|
| PREFIX | รหัสบริษัท (จาก settings.ticket_prefix) | WAT |
| YY | ปี (2 หลักสุดท้าย) | 25 (= 2025) |
| MM | เดือน (01-12) | 11 (= November) |
| XXXX | ลำดับในเดือนนั้น (4 หลัก, เริ่ม 0001) | 0456 |

**ตัวอย่าง:**
- `WAT25110001` = Watsons, November 2025, งานแรกของเดือน
- `WAT25110456` = Watsons, November 2025, งานที่ 456
- `WAT2512001` = Watsons, December 2025, งานแรกของเดือน (เริ่มนับใหม่)
- `KFC25110123` = KFC, November 2025, งานที่ 123

**Business Rules:**
1. ✅ เดือนใหม่ = เริ่มนับใหม่จาก 0001
2. ✅ แต่ละบริษัทมี Prefix ของตัวเอง (ถ้า multi-company)
3. ✅ ปีเปลี่ยน = ยังนับต่อเนื่อง (เช่น ธันวา 2025 → มกรา 2026 = เริ่ม 0001)
4. ✅ สามารถมีงานได้สูงสุด 9,999 งานต่อเดือน

**Edge Cases:**
- **ถ้ามีงานเกิน 9,999 ในเดือนเดียว:** ระบบจะใช้ 5 หลัก (เช่น WAT25110010000)
- **วันที่ 1 ของเดือนใหม่:** ระบบเช็คเดือนอัตโนมัติและ reset เป็น 0001
- **Concurrent Requests:** ใช้ Database Transaction + Lock เพื่อป้องกัน Ticket ซ้ำ

**ตัวอย่างการเปลี่ยนเดือน:**
```
31 Oct 2025 23:59 → WAT2510999 (งานสุดท้ายเดือน ต.ค.)
01 Nov 2025 00:01 → WAT25110001 (งานแรกเดือน พ.ย. - เริ่มนับใหม่)
```

**SQL Query สำหรับหา Running Number:**
```sql
-- หาเลขลำดับถัดไปในเดือนปัจจุบัน
SELECT COALESCE(MAX(
  CAST(SUBSTRING(ticketNumber FROM 8 FOR 4) AS INTEGER)
), 0) + 1 AS nextNumber
FROM incidents
WHERE ticketNumber LIKE 'WAT25 11%'; -- PREFIX + YY + MM

-- ตัวอย่างผลลัพธ์: 457
-- Ticket Number ถัดไป: WAT25110457
```

**Implementation Steps:**
```typescript
// Pseudocode
async function generateTicketNumber(companyPrefix: string): Promise<string> {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // "25"
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // "11"
  
  // หา running number
  const lastTicket = await db.query(`
    SELECT ticketNumber 
    FROM incidents 
    WHERE ticketNumber LIKE '${companyPrefix}${year}${month}%'
    ORDER BY ticketNumber DESC 
    LIMIT 1
  `);
  
  let runningNumber = 1;
  if (lastTicket) {
    const lastNumber = parseInt(lastTicket.substring(7)); // เอาเฉพาะ XXXX
    runningNumber = lastNumber + 1;
  }
  
  const paddedNumber = runningNumber.toString().padStart(4, '0');
  
  return `${companyPrefix}${year}${month}${paddedNumber}`;
}

// ตัวอย่างการใช้งาน:
const ticketNumber = await generateTicketNumber('WAT');
// Result: "WAT25110457"
```

### 6.3 🔌 API Endpoints

```typescript
// Incident CRUD
GET    /api/incidents                     // ดูรายการ incidents (มี filters)
GET    /api/incidents/:id                 // ดูข้อมูล 1 incident
POST   /api/incidents                     // สร้าง incident ใหม่
PUT    /api/incidents/:id                 // แก้ไข incident
DELETE /api/incidents/:id                 // ลบ incident (soft delete)

// Incident Assignment (Super Admin, Supervisor only)
POST   /api/incidents/:id/assign          // มอบหมายให้ช่าง
PUT    /api/incidents/:id/reassign        // มอบหมายใหม่
// ❌ IT Manager ไม่มีสิทธิ์ใช้ endpoints เหล่านี้
// ✅ ถ้า IT Manager ต้องการมอบหมายงาน → เพิ่ม role Supervisor

// Status Updates
PUT    /api/incidents/:id/status          // เปลี่ยนสถานะ
GET    /api/incidents/:id/history         // ดูประวัติการเปลี่ยนสถานะ
GET    /api/incidents/:id/timeline        // ดู timeline ทั้งหมด

// Reopen & Return Equipment (🆕 v3.4 - Help Desk only)
POST   /api/incidents/:id/reopen          // 🆕 Reopen incident ที่ปิดไปแล้ว
POST   /api/incidents/:id/create-return-job // 🆕 สร้างงาน Return อุปกรณ์
GET    /api/incidents/:id/related         // 🆕 ดู incidents ที่เกี่ยวข้อง

// Comments
POST   /api/incidents/:id/comments        // เพิ่ม comment
GET    /api/incidents/:id/comments        // ดู comments
PUT    /api/incidents/:id/comments/:cid   // แก้ไข comment
DELETE /api/incidents/:id/comments/:cid   // ลบ comment

// My Incidents (ตาม role)
GET    /api/incidents/my/assigned         // งานที่ถูก assign ให้ตัวเอง
GET    /api/incidents/my/created          // งานที่ตัวเองสร้าง
GET    /api/incidents/my/team             // งานของทีม (Supervisor)
```

**Query Filters:**
```typescript
GET /api/incidents?status=open&priority=high&storeId=5
GET /api/incidents?assignedTo=me&dateFrom=2025-11-01
GET /api/incidents?search=POS&category=hardware
```

**Request/Response Examples:**

**Create Incident:**
```json
// POST /api/incidents
Request:
{
  "title": "POS System Error at Siam Paragon",
  "description": "POS terminal 3 showing error message and won't process payments",
  "categoryId": 5, // POS System
  "storeId": 123, // Siam Paragon
  "priority": "high",
  "location": "Cashier Zone 3, Ground Floor",
  "contactPerson": "Store Manager - Somchai",
  "contactPhone": "081-234-5678",
  "equipmentInfo": "POS Model: XYZ-2000, Serial: ABC123"
}

Response:
{
  "id": 456,
  "ticketNumber": "WAT25110456",
  "title": "POS System Error at Siam Paragon",
  "status": "open",
  "priority": "high",
  "reporter": {
    "id": 1,
    "name": "John Doe"
  },
  "store": {
    "id": 123,
    "name": "Watsons Siam Paragon"
  },
  "createdAt": "2025-11-16T10:30:00Z",
  "dueDate": "2025-11-16T14:30:00Z" // High priority = 4hr SLA
}
```

**Assign Incident:**
```json
// POST /api/incidents/456/assign
Request:
{
  "assignedTo": 25, // userId ของช่าง
  "supervisorId": 10, // userId ของ supervisor (optional)
  "notes": "Assigned to senior technician due to complexity"
}

Response:
{
  "id": 456,
  "ticketNumber": "WAT25110456",
  "status": "assigned", // เปลี่ยนจาก 'open' เป็น 'assigned'
  "assignedTo": {
    "id": 25,
    "name": "Jane Smith",
    "technicianType": "insource"
  },
  "assignedAt": "2025-11-16T10:35:00Z"
}
```

**Reopen Incident:** (🆕 v3.4)
```json
// POST /api/incidents/456/reopen
// Authorization: Help Desk only
Request:
{
  "reason": "Customer reported issue not fully resolved",
  "assignTo": 25, // userId ของช่าง (optional - ถ้าไม่ใส่ = assign คนเดิม)
  "notes": "Customer still experiencing intermittent errors"
}

Response:
{
  "success": true,
  "message": "Incident reopened successfully",
  "incident": {
    "id": 456,
    "ticketNumber": "WAT25110456",
    "status": "in_progress", // เปลี่ยนจาก 'closed' เป็น 'in_progress'
    "reopenCount": 1,
    "lastReopenedAt": "2025-11-17T09:00:00Z",
    "lastReopenedBy": {
      "id": 3,
      "name": "Mike Help Desk"
    },
    "assignedTo": {
      "id": 25,
      "name": "Jane Smith"
    }
  }
}

// Business Rules:
// ✅ เฉพาะ Help Desk เท่านั้น
// ✅ Reopen ได้เฉพาะ status = 'closed'
// ✅ ต้องระบุเหตุผล (reason)
// ✅ สามารถ assign ให้ช่างคนเดิมหรือคนใหม่ก็ได้
// ✅ บันทึก reopenCount, lastReopenedAt, lastReopenedBy
```

**Create Return Equipment Job:** (🆕 v3.4)
```json
// POST /api/incidents/456/create-return-job
// Authorization: Help Desk only
Request:
{
  "title": "Return POS Terminal - Serial ABC123",
  "description": "Return replaced POS terminal to warehouse",
  "dueDate": "2025-11-20T17:00:00Z", // กำหนดวันคืน
  "assignTo": 25, // userId ของช่าง (optional)
  "notes": "Equipment to be tested before returning"
}

Response:
{
  "success": true,
  "message": "Return job created successfully",
  "returnJob": {
    "id": 789,
    "ticketNumber": "WAT25110789",
    "title": "Return POS Terminal - Serial ABC123",
    "status": "open",
    "incidentType": "return_equipment",
    "relatedIncidentId": 456, // อ้างอิง Incident ต้นทาง
    "relatedIncident": {
      "ticketNumber": "WAT25110456",
      "title": "POS System Error at Siam Paragon",
      "equipmentReplaced": {
        "serialNumber": "ABC123",
        "barcode": "POS-2024-001",
        "replacementNote": "Replaced with new terminal XYZ-2000"
      }
    },
    "store": {
      "id": 123,
      "name": "Watsons Siam Paragon"
    },
    "createdAt": "2025-11-17T09:15:00Z",
    "dueDate": "2025-11-20T17:00:00Z"
  }
}

// Business Rules:
// ✅ เฉพาะ Help Desk เท่านั้น
// ✅ สร้างได้เฉพาะ Incident ที่มีการเปลี่ยนอุปกรณ์ (isEquipmentReplaced = true)
// ✅ ดึงข้อมูลอุปกรณ์จาก Incident ต้นทาง (Serial Number, Barcode)
// ✅ เชื่อมโยงกับ Incident ต้นทาง (relatedIncidentId)
// ✅ incidentType = 'return_equipment'
// ✅ ใช้ Store เดียวกันกับ Incident ต้นทาง
```

**Get Related Incidents:** (🆕 v3.4)
```json
// GET /api/incidents/456/related
Response:
{
  "originalIncident": {
    "id": 456,
    "ticketNumber": "WAT25110456",
    "title": "POS System Error at Siam Paragon",
    "status": "closed"
  },
  "relatedIncidents": [
    {
      "id": 789,
      "ticketNumber": "WAT25110789",
      "title": "Return POS Terminal - Serial ABC123",
      "incidentType": "return_equipment",
      "status": "open",
      "createdAt": "2025-11-17T09:15:00Z"
    }
  ],
  "reopenHistory": [
    {
      "reopenedAt": "2025-11-17T09:00:00Z",
      "reopenedBy": {
        "id": 3,
        "name": "Mike Help Desk"
      },
      "reason": "Customer reported issue not fully resolved"
    }
  ]
}
```

### 6.4 🎨 UI Layouts

#### **Page 1: Incident List**
```
┌──────────────────────────────────────────────────────────────┐
│ 🎫 Incidents                               [+ New Incident]  │
├──────────────────────────────────────────────────────────────┤
│ Filters:                                                     │
│ [Status: All ▼] [Priority: All ▼] [Category: All ▼]         │
│ [Store: All ▼] [Assigned: All ▼] [Date: Last 30 days ▼]     │
│ [Search: ____________________] [🔍 Search]  [Clear Filters]  │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Ticket #      │ Title          │ Store    │ Status │ ... │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT25110456    │ POS Error      │ Siam     │ 🟢 Open│ ... │ │
│ │ 🔴 High       │ Terminal 3...  │ Paragon  │ 2h ago │View │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT25110455    │ Network Down   │ Central  │ 🟡 Prog│ ... │ │
│ │ ⚡ Critical   │ No internet... │ World    │ 5h ago │View │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT25110454    │ Printer Jam    │ Mega     │ 🔵 Assi│ ... │ │
│ │ 🟢 Low        │ Laser printer..│ Bangna   │ 1d ago │View │ │
│ └──────────────────────────────────────────────────────────┘ │
│ Showing 1-10 of 245        [< Prev] [1] 2 3 ... 25 [Next >] │
└──────────────────────────────────────────────────────────────┘
```

**Status Colors:**
- 🟢 Green = Open
- 🔵 Blue = Assigned
- 🟡 Yellow = In Progress
- 🟠 Orange = Pending
- ✅ Green = Resolved
- ⚫ Gray = Closed

#### **Page 2: Incident Detail**
```
┌──────────────────────────────────────────────────────────────┐
│ [← Back] WAT25110456          [Edit] [Assign] [Close]     │
├──────────────────────────────────────────────────────────────┤
│ ┌─ Basic Info ──────────────┐ ┌─ Status & Progress ───────┐ │
│ │ Title:                    │ │ Status: 🟡 In Progress   │ │
│ │ POS System Error          │ │ Priority: 🔴 High        │ │
│ │                           │ │ SLA: ⏱️  On Time         │ │
│ │ Category: 💳 POS System   │ │ Due: 2h 25m remaining    │ │
│ │ Store: Watsons Siam       │ │                          │ │
│ │        Paragon            │ │ Created: 2h ago          │ │
│ │                           │ │ Assigned: 1h 30m ago     │ │
│ │ Reporter: John Doe        │ │ Started: 45m ago         │ │
│ │ Assigned: Jane Smith      │ │                          │ │
│ └───────────────────────────┘ └──────────────────────────┘ │
│                                                              │
│ ┌─ Description ────────────────────────────────────────────┐ │
│ │ POS terminal 3 showing error message "Connection Lost" │ │
│ │ and won't process payments. Customers are waiting.     │ │
│ │                                                        │ │
│ │ Location: Cashier Zone 3, Ground Floor                │ │
│ │ Contact: Store Manager - Somchai (081-234-5678)       │ │
│ │ Equipment: POS Model XYZ-2000, Serial ABC123          │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ Files (Before/After) ───────────────────────────────────┐ │
│ │ Before Photos:                                          │ │
│ │ [📷 error_screen.jpg] [📷 terminal_3.jpg]              │ │
│ │                                                         │ │
│ │ After Photos: (Not uploaded yet)                       │ │
│ │ [+ Upload Photos]                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                              │
│ ┌─ Timeline & Comments ────────────────────────────────────┐ │
│ │ 🕐 10:30 - Created by John Doe                          │ │
│ │ 🕑 11:00 - Assigned to Jane Smith                       │ │
│ │ 💬 11:05 - Jane: "On my way to location"               │ │
│ │ 🕒 11:45 - Status changed to In Progress                │ │
│ │ 💬 11:50 - Jane: "Found the issue - network cable"     │ │
│ │                                                         │ │
│ │ [Add Comment: ________________________] [Post]          │ │
│ └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### **Page 3: Create Incident Form**
```
┌──────────────────────────────────────────────────────────────┐
│ Create New Incident                                     [X]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Basic Information                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Title: *                                                 │ │
│ │ [_________________________________________________]      │ │
│ │                                                          │ │
│ │ Description: *                                           │ │
│ │ ┌──────────────────────────────────────────────────────┐ │ │
│ │ │                                                      │ │ │
│ │ │                                                      │ │ │
│ │ └──────────────────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Classification                                               │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Category: *     [Select Category ▼]                     │ │
│ │ Store: *        [Select Store ▼]                        │ │
│ │ Priority: *     [○ Low ○ Medium ◉ High ○ Critical]      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Additional Details                                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Location:       [_________________________]              │ │
│ │ Contact Person: [_________________________]              │ │
│ │ Contact Phone:  [_________________________]              │ │
│ │ Equipment Info: [_________________________]              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Attachments (Optional)                                       │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [📁 Choose Files] or Drag & Drop                        │ │
│ │                                                          │ │
│ │ Accepted: JPG, PNG, PDF (Max 10MB each)                 │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│              [Cancel]           [Create Incident]            │
└──────────────────────────────────────────────────────────────┘
```

#### **Page 4: Incident Detail - Closed (with Reopen & Return Equipment)** (🆕 v3.4)
```
┌──────────────────────────────────────────────────────────────┐
│ [← Back] WAT25110456    [Reopen] [Create Return Job]      │
│                                              Status: ⚫ Closed│
├──────────────────────────────────────────────────────────────┤
│ ┌─ Basic Info ──────────────┐ ┌─ Equipment Replaced ──────┐ │
│ │ Title:                    │ │ ✅ Equipment Changed       │ │
│ │ POS System Error          │ │                            │ │
│ │                           │ │ Serial: ABC123            │ │
│ │ Category: 💳 POS System   │ │ Barcode: POS-2024-001     │ │
│ │ Store: Siam Paragon       │ │ Note: Replaced terminal   │ │
│ │                           │ │                            │ │
│ │ Assigned: Jane Smith      │ │ [Create Return Job]       │ │
│ │ Closed by: Mike (HD)      │ │                            │ │
│ └───────────────────────────┘ └────────────────────────────┘ │
│                                                              │
│ ┌─ Related Incidents ──────────────────────────────────────┐ │
│ │ 🔗 Return Jobs:                                          │ │
│ │ • WAT25110789 - Return POS Terminal (🟢 Open)           │ │
│ │                                                          │ │
│ │ 🔄 Reopen History:                                       │ │
│ │ • Nov 17, 09:00 - Reopened by Mike (Issue not resolved) │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [View Timeline] [View Files] [Download Report]              │
└──────────────────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- ✅ ปุ่ม **[Reopen]** แสดงเฉพาะ incidents ที่ status = closed
- ✅ ปุ่ม **[Create Return Job]** แสดงเฉพาะ incidents ที่มี isEquipmentReplaced = true
- ✅ แสดง **Related Incidents** - Return Jobs และ Reopen History
- ✅ เฉพาะ **Help Desk** เท่านั้นที่เห็นปุ่มเหล่านี้

#### **Dialog 1: Reopen Incident** (🆕 v3.4)
```
┌──────────────────────────────────────────────────┐
│ Reopen Incident: WAT25110456           [X]       │
├──────────────────────────────────────────────────┤
│                                                  │
│ ⚠️  This incident will be reopened              │
│                                                  │
│ Incident Details:                                │
│ ┌──────────────────────────────────────────────┐│
│ │ Ticket: WAT25110456                          ││
│ │ Title: POS System Error at Siam Paragon      ││
│ │ Store: Watsons Siam Paragon                  ││
│ │ Closed: Nov 16, 2025 17:00                   ││
│ │ Closed by: Mike (Help Desk)                  ││
│ │                                              ││
│ │ Original Technician: Jane Smith              ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Reason for Reopening: *                          │
│ ┌──────────────────────────────────────────────┐│
│ │                                              ││
│ │ Customer reported issue not fully resolved  ││
│ │                                              ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Assign To:                                       │
│ ┌──────────────────────────────────────────────┐│
│ │ ⚫ Same Technician (Jane Smith)              ││
│ │ ⚪ Different Technician: [Select ▼]          ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Additional Notes (Optional):                     │
│ ┌──────────────────────────────────────────────┐│
│ │                                              ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│                    [Cancel]      [Reopen Incident]│
└──────────────────────────────────────────────────┘
```

#### **Dialog 2: Create Return Equipment Job** (🆕 v3.4)
```
┌──────────────────────────────────────────────────┐
│ Create Return Equipment Job            [X]       │
├──────────────────────────────────────────────────┤
│                                                  │
│ Based on Incident: WAT25110456                   │
│ ┌──────────────────────────────────────────────┐│
│ │ Original Incident:                           ││
│ │ • Title: POS System Error                    ││
│ │ • Store: Watsons Siam Paragon                ││
│ │ • Technician: Jane Smith                     ││
│ │ • Closed: Nov 16, 2025 17:00                 ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Equipment Information (Auto-filled):             │
│ ┌──────────────────────────────────────────────┐│
│ │ Serial Number: ABC123                        ││
│ │ Barcode: POS-2024-001                        ││
│ │ Original Note: Replaced with new terminal    ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Return Job Details:                              │
│ ┌──────────────────────────────────────────────┐│
│ │ Title: *                                     ││
│ │ [Return POS Terminal - Serial ABC123_____]  ││
│ │                                              ││
│ │ Description: *                               ││
│ │ ┌──────────────────────────────────────────┐││
│ │ │ Return replaced POS terminal to warehouse│││
│ │ └──────────────────────────────────────────┘││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Assignment & Due Date:                           │
│ ┌──────────────────────────────────────────────┐│
│ │ Assign To:      [Same Technician ▼]         ││
│ │ Due Date:       [📅 Nov 20, 2025 17:00]     ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│ Additional Notes (Optional):                     │
│ ┌──────────────────────────────────────────────┐│
│ │ Equipment to be tested before returning     ││
│ └──────────────────────────────────────────────┘│
│                                                  │
│             [Cancel]       [Create Return Job]   │
└──────────────────────────────────────────────────┘
```

**หมายเหตุ:**
- **Auto-fill ข้อมูล:** Serial Number, Barcode, Store จาก Incident ต้นทาง
- **Title:** แนะนำเป็น "Return [Equipment] - Serial [Number]"
- **Default Technician:** ช่างคนเดิม (สามารถเปลี่ยนได้)
- **Incident Type:** ระบบจะ set เป็น 'return_equipment' อัตโนมัติ
- **Related Link:** เชื่อมโยงกับ Incident ต้นทาง

### 6.5 🔄 Workflows

#### **Workflow 1: Incident Lifecycle (แบบสมบูรณ์)**
```
1. CREATE (End User แจ้งปัญหา)
   - End User กรอกฟอร์มแจ้งซ่อม
   - System สร้าง Ticket Number อัตโนมัติ (เช่น WAT25110456)
     * Format: [Prefix][YY][MM][XXXX]
     * WAT = Company Prefix
     * 25 = ปี 2025
     * 11 = เดือน November
     * 456 = ลำดับที่ 456 ในเดือนนี้
   - Status = 'open'
   - คำนวณ SLA due date ตาม priority
   - ส่งอีเมลแจ้ง IT Manager
   ↓
   
2. ASSIGN (IT Manager/Supervisor มอบหมายงาน)
   - เลือกช่าง (Insource หรือ Outsource)
   - Status เปลี่ยนเป็น 'assigned'
   - บันทึก assignedAt timestamp
   - ส่งอีเมลแจ้งช่างที่ได้รับมอบหมาย
   ↓
   
3. IN_PROGRESS (Technician เริ่มทำงาน)
   - Technician กด "Start Work"
   - Status เปลี่ยนเป็น 'in_progress'
   - บันทึก startedAt timestamp
   - Technician สามารถ:
     * เพิ่ม comments
     * อัพโหลดรูปก่อนซ่อม
   ↓
   
4. PENDING (Optional - รอ parts/ลูกค้า)
   - Status เปลี่ยนเป็น 'pending'
   - ระบุเหตุผล (waiting for parts, customer unavailable, etc.)
   - SLA timer หยุดชั่วคราว
   - สามารถกลับไป in_progress ได้
   ↓
   
5. RESOLVED (Technician ทำเสร็จ)
   - Technician กด "Mark as Resolved"
   - ต้องกรอก:
     * Resolution notes (อธิบายว่าแก้อย่างไร)
     * อัพโหลดรูปหลังซ่อม
   - Status เปลี่ยนเป็น 'resolved'
   - บันทึก resolvedAt timestamp
   - คำนวณ resolutionTime
   - ส่งอีเมลแจ้ง Help Desk
   ↓
   
6. CLOSED (Help Desk ตรวจสอบและปิดงาน)
   - Help Desk ตรวจสอบคุณภาพงาน:
     * ตรวจสอบ resolution notes
     * ดูรูปก่อน-หลังซ่อม
     * ตรวจสอบว่าแก้ปัญหาได้จริง
   - ถ้า OK → กด "Close Incident"
   - ถ้าไม่ OK → Reopen (กลับไป in_progress)
   - เมื่อปิดงาน:
     * Status เปลี่ยนเป็น 'closed'
     * บันทึก closedAt timestamp
     * Generate Rating Token (UUID)
     * ส่งอีเมล Rating Request ให้ End User
   ↓
   
7. RATED (Optional - End User ประเมิน)
   - End User คลิกลิงก์จากอีเมล
   - ให้คะแนน 1-5 ดาว
   - เขียน comment (optional)
   - บันทึกลง incident_ratings table
   - ส่งอีเมลแจ้ง Technician ว่าได้คะแนน

Alternative Paths:
- CANCELLED: ยกเลิกงานได้ทุก stage (ก่อน resolved)
- REOPENED: Help Desk สามารถ reopen จาก closed ได้
```

#### **Workflow 2: Status Transition Rules**

| From Status | To Status | Who Can | Requirements |
|-------------|-----------|---------|--------------|
| **open** | assigned | Manager, Supervisor | ต้องเลือกช่าง |
| **assigned** | in_progress | Technician (assigned) | - |
| **assigned** | cancelled | Manager, Super Admin | ต้องระบุเหตุผล |
| **in_progress** | pending | Technician (assigned) | ต้องระบุเหตุผล |
| **in_progress** | resolved | Technician (assigned) | ต้องมี resolution notes + รูปหลังซ่อม |
| **pending** | in_progress | Technician (assigned) | - |
| **pending** | cancelled | Manager, Super Admin | ต้องระบุเหตุผล |
| **resolved** | closed | Help Desk, Manager | Help Desk ตรวจสอบแล้ว OK |
| **resolved** | in_progress | Help Desk, Manager | Reopen (ไม่ผ่านการตรวจ) |
| **closed** | in_progress | **Help Desk only** | 🆕 Reopen - ต้องระบุเหตุผล |

**หมายเหตุ (🆕 v3.4):**
- ✅ **Reopen**: Help Desk สามารถเปิดงานที่ปิดไปแล้วใหม่ได้
- ✅ เมื่อ Reopen: status เปลี่ยนจาก 'closed' → 'in_progress'
- ✅ บันทึก reopenCount, lastReopenedAt, lastReopenedBy, reopenReason
- ✅ สามารถ assign ให้ช่างคนเดิมหรือคนใหม่ก็ได้

#### **Workflow 3: Priority & SLA Calculation**

```
เมื่อสร้าง Incident:
  ↓
ดู Priority ที่เลือก
  ├─ Critical → SLA = 1hr response, 4hr resolution
  ├─ High     → SLA = 2hr response, 8hr resolution
  ├─ Medium   → SLA = 4hr response, 24hr resolution
  └─ Low      → SLA = 8hr response, 48hr resolution
  ↓
คำนวณ dueDate = createdAt + resolutionTime
  ↓
ตั้ง slaStatus = 'on_time'
  ↓
Background Job ทุกๆ 15 นาที:
  ├─ ถ้า (now > dueDate - 30min) AND status != 'closed'
  │   → slaStatus = 'warning' (เหลือเวลา < 30 นาที)
  │   → ส่งอีเมลเตือน
  ├─ ถ้า (now > dueDate) AND status != 'closed'
  │   → slaStatus = 'overdue' (เลยเวลาแล้ว)
  │   → ส่งอีเมลแจ้ง Manager
  └─ ถ้า status = 'closed' AND closedAt <= dueDate
      → slaStatus = 'on_time' (ทันเวลา)
```

#### **Workflow 4: Reopen Incident** (🆕 v3.4)
```
Help Desk เข้าหน้า Incident Detail (status = closed)
  ↓
เห็นปุ่ม [Reopen]
  ↓
คลิก [Reopen]
  ↓
System แสดง Reopen Dialog:
  - แสดงข้อมูล Incident
  - แสดง Original Technician
  - ฟอร์มกรอก Reason (required)
  - เลือก Assign To: Same/Different Technician
  ↓
Help Desk กรอกข้อมูล:
  - Reason: "Customer reported issue not fully resolved"
  - Assign To: Same Technician (Jane Smith)
  - Notes: "Customer experiencing intermittent errors"
  ↓
คลิก [Reopen Incident]
  ↓
System Validation:
  ├─ ✅ Valid
  │   ↓
  │   POST /api/incidents/:id/reopen
  │   ↓
  │   UPDATE incidents SET
  │     status = 'in_progress',
  │     reopenCount = reopenCount + 1,
  │     lastReopenedAt = NOW(),
  │     lastReopenedBy = currentUserId,
  │     reopenReason = 'Customer reported...',
  │     assignedTo = selectedTechnicianId,
  │     closedAt = NULL
  │   ↓
  │   INSERT INTO incident_status_history
  │     (incidentId, previousStatus, newStatus, changedBy, note)
  │   VALUES
  │     (:id, 'closed', 'in_progress', :userId, 'Reopened: ' + reason)
  │   ↓
  │   INSERT INTO activity_logs
  │     (action = 'incident_reopened', ...)
  │   ↓
  │   ส่งอีเมลแจ้ง Technician ที่ได้รับมอบหมาย
  │   ↓
  │   ส่ง Notification ให้ Technician
  │   ↓
  │   แสดง Success: "Incident reopened successfully"
  │   ↓
  │   Redirect → Incident Detail Page
  │
  └─ ❌ Invalid
      ↓
      แสดง Error:
      - "Reason is required"
      - "Can only reopen closed incidents"
      - "Must select a technician"
```

#### **Workflow 5: Create Return Equipment Job** (🆕 v3.4)
```
Help Desk เข้าหน้า Incident Detail (status = closed + has equipment replaced)
  ↓
เห็นปุ่ม [Create Return Job]
  ↓
คลิก [Create Return Job]
  ↓
System ตรวจสอบ:
  ├─ ✅ isEquipmentReplaced = true
  │   ↓
  │   System แสดง Create Return Job Dialog:
  │   - Auto-fill ข้อมูล:
  │     * Original Incident: WAT25110456
  │     * Store: Siam Paragon (same as original)
  │     * Serial Number: ABC123 (from check-in data)
  │     * Barcode: POS-2024-001
  │     * Default Title: "Return POS Terminal - Serial ABC123"
  │     * Default Description: "Return replaced equipment"
  │     * Default Technician: Jane Smith (same as original)
  │
  └─ ❌ isEquipmentReplaced = false
      ↓
      แสดง Error: "This incident has no equipment replacement"
      
Help Desk แก้ไขข้อมูล:
  - Title: "Return POS Terminal - Serial ABC123"
  - Description: "Return replaced POS terminal to warehouse"
  - Due Date: Nov 20, 2025 17:00
  - Assign To: Same Technician (Jane Smith)
  - Notes: "Equipment to be tested before returning"
  ↓
คลิก [Create Return Job]
  ↓
System Validation:
  ├─ ✅ Valid
  │   ↓
  │   POST /api/incidents/:id/create-return-job
  │   ↓
  │   สร้าง Ticket Number ใหม่ (เช่น WAT25110789)
  │   ↓
  │   INSERT INTO incidents
  │     ticketNumber = 'WAT25110789',
  │     title = 'Return POS Terminal - Serial ABC123',
  │     description = 'Return replaced...',
  │     incidentType = 'return_equipment', -- 🔑 Key field
  │     relatedIncidentId = 456, -- อ้างอิง Incident ต้นทาง
  │     storeId = :sameStoreId,
  │     categoryId = :sameCategoryId,
  │     assignedTo = :technicianId,
  │     status = 'assigned', -- เริ่มที่ assigned เลย
  │     dueDate = '2025-11-20 17:00:00',
  │     reporterId = :currentHelpDeskUserId,
  │     createdBy = :currentHelpDeskUserId
  │   ↓
  │   INSERT INTO incident_comments
  │     (incidentId, userId, comment)
  │   VALUES
  │     (:newId, :userId, 'Auto: Related to WAT25110456 - Original equipment: Serial ABC123')
  │   ↓
  │   INSERT INTO activity_logs
  │     (action = 'return_job_created', relatedIncidentId = 456)
  │   ↓
  │   ส่งอีเมลแจ้ง Technician
  │   ↓
  │   ส่ง Notification ให้ Technician
  │   ↓
  │   แสดง Success + ลิงก์ไป Return Job: WAT25110789
  │   ↓
  │   อัปเดตหน้า Original Incident → แสดง Related Incidents
  │
  └─ ❌ Invalid
      ↓
      แสดง Validation Errors:
      - "Title is required"
      - "Description is required"
      - "Due date is required"
      - "Must select a technician"
```

**Business Logic สำหรับ Return Job:**
1. ✅ **Incident Type**: set เป็น 'return_equipment'
2. ✅ **Related Incident**: เชื่อมโยงกับ Incident ต้นทาง (relatedIncidentId)
3. ✅ **Auto-fill Data**: Serial Number, Barcode, Store, Category จาก Original
4. ✅ **Default Status**: 'assigned' (ไม่ต้องผ่าน 'open')
5. ✅ **Technician**: Default = Original Technician (สามารถเปลี่ยนได้)
6. ✅ **SLA**: คำนวณตาม Due Date ที่กำหนด
7. ✅ **Display**: Original Incident แสดง Return Jobs ใน "Related Incidents"

### 6.6 ✅ Validation Rules

**Note:** Ticket Number จะถูกสร้างอัตโนมัติโดยระบบ ไม่ต้อง validate จาก user

1. **Title:** 
   - Required, 5-255 ตัวอักษร

2. **Description:** 
   - Required, อย่างน้อย 20 ตัวอักษร

3. **Category:** 
   - Required, ต้องเลือก

4. **Store:** 
   - Required, ต้องเลือก

5. **Priority:** 
   - Required, เลือก 1 ใน 4: low, medium, high, critical

6. **Status Transition:**
   - ต้องเป็นไปตาม Workflow ที่กำหนด
   - ต้องมี Permission ที่เหมาะสม

7. **Resolution Notes:**
   - Required เมื่อเปลี่ยนเป็น 'resolved'
   - อย่างน้อย 20 ตัวอักษร

8. **After Photos:**
   - Required อย่างน้อย 1 รูป เมื่อเปลี่ยนเป็น 'resolved'

9. **Reopen Incident (🆕 v3.4):**
   - **Permission**: เฉพาะ Help Desk เท่านั้น
   - **Condition**: เฉพาะ incidents ที่ status = 'closed'
   - **Required Fields**:
     * Reason (required) - อย่างน้อย 10 ตัวอักษร
     * Assign To - ต้องเลือก Technician
   - **System Actions**:
     * UPDATE status จาก 'closed' → 'in_progress'
     * INCREMENT reopenCount
     * SET lastReopenedAt = NOW()
     * SET lastReopenedBy = current user
     * CLEAR closedAt, closedBy
     * INSERT incident_status_history
     * SEND notification to assigned technician
   - **Limit**: ไม่จำกัดจำนวนครั้งที่ reopen ได้

10. **Create Return Equipment Job (🆕 v3.4):**
    - **Permission**: เฉพาะ Help Desk เท่านั้น
    - **Condition**: เฉพาะ incidents ที่มี isEquipmentReplaced = true
    - **Required Fields**:
      * Title (required) - 10-255 ตัวอักษร
      * Description (required) - 20+ ตัวอักษร
      * Due Date (required) - ต้องเป็นวันในอนาคต
      * Assign To (required) - ต้องเลือก Technician
    - **Auto-filled Fields** (from original incident):
      * Store (same as original)
      * Category (same as original or use default "Equipment Return")
      * Serial Number (from check-in data)
      * Barcode (from check-in data)
      * Replacement Note (from check-in data)
    - **System Actions**:
      * สร้าง Ticket Number ใหม่
      * SET incidentType = 'return_equipment'
      * SET relatedIncidentId = original incident ID
      * SET status = 'assigned' (skip 'open')
      * INSERT incident with all data
      * INSERT activity_log
      * SEND notification to assigned technician
    - **Validation**:
      * Due Date > NOW()
      * Assigned Technician must be active
      * Original Incident must have equipment replacement data

11. **Incident Type:**
    - **normal**: งานซ่อมทั่วไป (default)
    - **return_equipment**: งานคืนอุปกรณ์ที่เปลี่ยนไปแล้ว
    - **follow_up**: งานติดตามเพิ่มเติม (future use)

12. **Related Incidents:**
    - 1 Original Incident สามารถมีได้หลาย Return Jobs
    - แสดง Related Incidents ในหน้า Incident Detail
    - เชื่อมโยงผ่าน relatedIncidentId field

---

## 7. FEATURE 3: Store Management

### 7.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- จัดการข้อมูลสาขา/ร้าน (CRUD)
- Import ข้อมูลจาก Excel (หลายร้านพร้อมกัน)
- Export ข้อมูลเป็น Excel
- รองรับ Pop-up Stores (เปิด-ปิด-เปิดใหม่)
- เก็บข้อมูล IP Addresses ของอุปกรณ์ทั้งหมด
- กำหนดเวลาเปิด-ปิดแต่ละวัน

**ใครใช้?**
- **Super Admin, IT Manager:** จัดการข้อมูลร้าน
- **Technician:** ดูข้อมูลเทคนิคของร้าน (IPs, อุปกรณ์)
- **Read Only:** ดูข้อมูลร้าน

### 7.2 💾 Database Tables

#### **Table: stores**
```sql
CREATE TABLE stores (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL, -- ไม่ UNIQUE - เพราะ code เดียวกันอาจมีหลาย location/time
  name VARCHAR(255) NOT NULL,
  company VARCHAR(100) NOT NULL, -- 'Watsons', 'KFC', 'NTT'
  
  -- Address Information
  address TEXT,
  district VARCHAR(100),
  province VARCHAR(100),
  postalCode VARCHAR(10),
  area VARCHAR(100), -- พื้นที่ (เช่น "Bangkok Central")
  serviceCenter VARCHAR(100), -- ศูนย์บริการที่รับผิดชอบ
  
  -- Contact Information
  phone VARCHAR(20),
  email VARCHAR(255),
  googleMapLink TEXT,
  
  -- Network Information
  circuitId VARCHAR(100), -- รหัสวงจร
  routerIp VARCHAR(50),
  switchIp VARCHAR(50),
  accessPointIp VARCHAR(50),
  
  -- Servers & Computers
  pcServerIp VARCHAR(50),
  pcPrinterIp VARCHAR(50),
  pmcComputerIp VARCHAR(50),
  sbsComputerIp VARCHAR(50),
  vatComputerIp VARCHAR(50),
  
  -- POS & Payment
  posIp VARCHAR(50),
  edcIp VARCHAR(50),
  scoIp VARCHAR(50),
  
  -- Other Devices
  peopleCounterIp VARCHAR(50),
  digitalTvIp VARCHAR(50),
  timeAttendanceIp VARCHAR(50),
  cctvIp VARCHAR(50),
  
  -- Working Hours (รายวัน)
  mondayOpen TIME,
  mondayClose TIME,
  tuesdayOpen TIME,
  tuesdayClose TIME,
  wednesdayOpen TIME,
  wednesdayClose TIME,
  thursdayOpen TIME,
  thursdayClose TIME,
  fridayOpen TIME,
  fridayClose TIME,
  saturdayOpen TIME,
  saturdayClose TIME,
  sundayOpen TIME,
  sundayClose TIME,
  holidayOpen TIME,
  holidayClose TIME,
  
  -- Store Lifecycle
  storeType ENUM('permanent', 'pop_up', 'seasonal') DEFAULT 'permanent',
  openDate DATE, -- วันที่เปิดร้านนี้
  closeDate DATE, -- วันที่ปิด (NULL ถ้ายังเปิดอยู่)
  storeStatus VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive'
  
  -- Metadata
  notes TEXT, -- หมายเหตุ (เช่น "Relocated from The Sky Ayutthaya")
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_stores_code ON stores(code); -- NON-UNIQUE
CREATE INDEX idx_stores_company ON stores(company);
CREATE INDEX idx_stores_status ON stores(storeStatus);
CREATE INDEX idx_stores_active_code ON stores(code, storeStatus);
CREATE INDEX idx_stores_province ON stores(province);

-- Unique Constraint: ห้ามมี Store code ซ้ำที่ Active ในเวลาเดียวกัน
CREATE UNIQUE INDEX idx_unique_active_store 
ON stores(code) WHERE storeStatus = 'active';
```

**Business Logic - Pop-up Store Reuse:**

ตัวอย่างการใช้งาน code ซ้ำได้:
```
Timeline:
- Jan-Mar 2025: Store "POP001" เปิดที่ Siam Paragon 
  → storeStatus = 'active'
  
- Apr 2025: ปิดร้าน
  → storeStatus = 'inactive'
  → closeDate = '2025-04-01'
  
- May-Jul 2025: Store "POP001" เปิดใหม่ที่ Central World
  → storeStatus = 'active'
  → openDate = '2025-05-01'
  → ✅ OK เพราะ code เดิม inactive แล้ว
```

### 7.3 🔌 API Endpoints

```typescript
// Store CRUD
GET    /api/stores                        // ดูรายการร้าน (มี filters)
GET    /api/stores/:id                    // ดูข้อมูล 1 ร้าน
POST   /api/stores                        // สร้างร้านใหม่
PUT    /api/stores/:id                    // แก้ไขข้อมูลร้าน
DELETE /api/stores/:id                    // ลบร้าน (soft delete)

// Excel Import/Export
POST   /api/stores/import                 // Import จาก Excel
GET    /api/stores/export                 // Export เป็น Excel
GET    /api/stores/template               // ดาวน์โหลด Excel Template

// Bulk Operations
PUT    /api/stores/bulk/status            // เปลี่ยนสถานะหลายร้านพร้อมกัน
DELETE /api/stores/bulk                   // ลบหลายร้านพร้อมกัน

// Store Incidents & Statistics (🆕)
GET    /api/stores/:id/incidents          // ดู Incidents ทั้งหมดของสาขานี้
GET    /api/stores/:id/incidents/summary  // สรุปสถิติ Incidents (30 วัน)
GET    /api/stores/:id/statistics         // สถิติโดยรวม (Incidents, SLA, Ratings)
GET    /api/stores/:id/equipment          // ดูอุปกรณ์ทั้งหมดในสาขา
GET    /api/stores/:id/top-issues         // ปัญหาที่พบบ่อยในสาขานี้
```

**Query Filters:**
```typescript
GET /api/stores?status=active&province=Bangkok
GET /api/stores?storeType=pop_up&company=Watsons
GET /api/stores?search=Siam&area=Central
```

**Request/Response Examples:**

**Create Store:**
```json
// POST /api/stores
Request:
{
  "code": "WAT-BKK-001",
  "name": "Watsons Siam Paragon",
  "company": "Watsons",
  "address": "991 Rama 1 Road, Pathumwan",
  "district": "Pathumwan",
  "province": "Bangkok",
  "postalCode": "10330",
  "area": "Bangkok Central",
  "serviceCenter": "Bangkok Service Center",
  "phone": "02-123-4567",
  "email": "siam@watsons.co.th",
  "googleMapLink": "https://maps.google.com/...",
  
  "routerIp": "192.168.1.1",
  "switchIp": "192.168.1.2",
  "accessPointIp": "192.168.1.3",
  
  "mondayOpen": "10:00",
  "mondayClose": "22:00",
  "tuesdayOpen": "10:00",
  "tuesdayClose": "22:00",
  // ... other days
  
  "storeType": "permanent",
  "openDate": "2020-01-15",
  "storeStatus": "active"
}

Response:
{
  "id": 123,
  "code": "WAT-BKK-001",
  "name": "Watsons Siam Paragon",
  "company": "Watsons",
  "province": "Bangkok",
  "storeStatus": "active",
  "createdAt": "2025-11-16T10:00:00Z"
}
```

**Import from Excel:**
```json
// POST /api/stores/import
Request: (multipart/form-data)
{
  "file": <Excel file>,
  "skipDuplicates": true, // ข้ามร้านซ้ำ
  "updateExisting": false // อัพเดทถ้าเจอซ้ำ
}

Response:
{
  "success": true,
  "imported": 50,
  "skipped": 5,
  "errors": [
    {
      "row": 10,
      "error": "Invalid IP address format: routerIp"
    },
    {
      "row": 25,
      "error": "Duplicate active store code: POP001"
    }
  ]
}
```

**Get Store Incidents:**
```json
// GET /api/stores/:id/incidents?period=30&status=all&page=1&limit=10
Response:
{
  "storeId": 123,
  "storeCode": "WAT-BKK-001",
  "storeName": "Watsons Siam Paragon",
  "period": "Last 30 days",
  "summary": {
    "total": 45,
    "open": 3,
    "inProgress": 5,
    "resolved": 37,
    "avgResolutionTime": "4h 35m",
    "slaCompliance": 95.6
  },
  "incidents": [
    {
      "id": 250,
      "ticketNumber": "WAT25110025",
      "title": "POS System Down",
      "priority": "URGENT",
      "status": "OPEN",
      "createdAt": "2025-11-16T14:30:00Z",
      "equipment": {
        "id": 89,
        "name": "NCR POS Terminal #1",
        "serialNumber": "NCR555666"
      },
      "category": "POS System",
      "location": "Floor 1 - Cashier Area"
    },
    {
      "id": 248,
      "ticketNumber": "WAT25110020",
      "title": "Printer Jam",
      "priority": "HIGH",
      "status": "IN_PROGRESS",
      "createdAt": "2025-11-16T10:15:00Z",
      "assignedTo": {
        "id": 45,
        "name": "Somchai (Technician)"
      },
      "equipment": {
        "id": 102,
        "name": "HP LaserJet Pro",
        "serialNumber": "HP987654"
      },
      "category": "Printer"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 45,
    "totalPages": 5
  }
}
```

**Get Store Statistics:**
```json
// GET /api/stores/:id/statistics?period=30
Response:
{
  "storeId": 123,
  "storeCode": "WAT-BKK-001",
  "storeName": "Watsons Siam Paragon",
  "period": "Last 30 days",
  
  "incidentStats": {
    "total": 45,
    "byStatus": {
      "open": 3,
      "inProgress": 5,
      "resolved": 37
    },
    "byPriority": {
      "urgent": 8,
      "high": 15,
      "medium": 18,
      "low": 4
    },
    "avgResponseTime": "1h 25m",
    "avgResolutionTime": "4h 35m",
    "slaCompliance": 95.6
  },
  
  "topIssues": [
    {
      "category": "Printer",
      "count": 15,
      "percentage": 33.3
    },
    {
      "category": "POS System",
      "count": 12,
      "percentage": 26.7
    },
    {
      "category": "Network",
      "count": 10,
      "percentage": 22.2
    }
  ],
  
  "problematicEquipment": [
    {
      "equipmentId": 102,
      "name": "HP LaserJet Pro #1",
      "serialNumber": "HP987654",
      "issueCount": 8,
      "totalDowntime": "12h",
      "lastIssue": "2 days ago"
    },
    {
      "equipmentId": 89,
      "name": "NCR POS Terminal #2",
      "serialNumber": "NCR555777",
      "issueCount": 6,
      "totalDowntime": "8h",
      "lastIssue": "Active now"
    }
  ],
  
  "customerSatisfaction": {
    "avgRating": 4.7,
    "totalRatings": 35,
    "distribution": {
      "5star": 25,
      "4star": 8,
      "3star": 2,
      "2star": 0,
      "1star": 0
    }
  },
  
  "costAnalysis": {
    "totalCost": 45500,
    "insourceCost": 32000,
    "outsourceCost": 13500,
    "partsCost": 18200
  }
}
```

### 7.4 🎨 UI Layouts

#### **Page 1: Store List**
```
┌──────────────────────────────────────────────────────────────┐
│ 🏪 Stores                                  [+ New Store]     │
│                              [⬇️ Import Excel] [⬆️ Export]    │
├──────────────────────────────────────────────────────────────┤
│ Filters:                                                     │
│ [Status: All ▼] [Province: All ▼] [Type: All ▼]             │
│ [Search: ____________________] [🔍 Search]  [Clear]          │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Code        │ Name            │ Province │ Status │ ...  │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT-BKK-001 │ Siam Paragon    │ Bangkok  │ ✅ Active│... │ │
│ │             │ 📍 Pathumwan    │          │         │Edit│ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT-BKK-002 │ Central World   │ Bangkok  │ ✅ Active│... │ │
│ │             │ 📍 Pathumwan    │          │         │Edit│ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ POP-001     │ Pop-up Siam     │ Bangkok  │ ⛔ Closed│... │ │
│ │ 🎪 Pop-up   │ 📍 Pathumwan    │          │ Apr 2025│Edit│ │
│ └──────────────────────────────────────────────────────────┘ │
│ Showing 1-10 of 785                   [< Prev] 1 2 ... [>]  │
└──────────────────────────────────────────────────────────────┘
```

#### **Page 2: Store Detail/Edit**
```
┌──────────────────────────────────────────────────────────────┐
│ [← Back] Store: WAT-BKK-001                    [Edit] [Save] │
├──────────────────────────────────────────────────────────────┤
│ 📑 Tabs: [Basic Info] [Network & IPs] [Working Hours]       │
│         [Incidents] [Equipment] [Statistics]  (🆕)           │
├──────────────────────────────────────────────────────────────┤
│ Tab 1: Basic Information                                     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Store Code: *     [WAT-BKK-001_____________]             │ │
│ │ Store Name: *     [Watsons Siam Paragon____]             │ │
│ │ Company:          [Watsons_________________]             │ │
│ │ Store Type:       [○ Permanent ○ Pop-up ○ Seasonal]     │ │
│ │                                                          │ │
│ │ Address:          [991 Rama 1 Road_________]             │ │
│ │ District:         [Pathumwan_______________]             │ │
│ │ Province:         [Bangkok_________________]             │ │
│ │ Postal Code:      [10330___________________]             │ │
│ │ Area:             [Bangkok Central_________]             │ │
│ │ Service Center:   [Bangkok Service Center__]             │ │
│ │                                                          │ │
│ │ Phone:            [02-123-4567_____________]             │ │
│ │ Email:            [siam@watsons.co.th______]             │ │
│ │ Google Maps:      [https://maps.google...  ]             │ │
│ │                                                          │ │
│ │ Open Date:        [📅 2020-01-15]                       │ │
│ │ Close Date:       [📅 (Still open)  ]                   │ │
│ │ Status:           [✅ Active ▼]                          │ │
│ │                                                          │ │
│ │ Notes:                                                   │ │
│ │ ┌────────────────────────────────────────────────────┐   │ │
│ │ │                                                    │   │ │
│ │ └────────────────────────────────────────────────────┘   │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Tab 2: Network & IP Addresses                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Network Infrastructure:                                  │ │
│ │ Circuit ID:       [CIR-12345_______________]             │ │
│ │ Router IP:        [192.168.1.1____________]             │ │
│ │ Switch IP:        [192.168.1.2____________]             │ │
│ │ Access Point IP:  [192.168.1.3____________]             │ │
│ │                                                          │ │
│ │ Servers & Computers:                                     │ │
│ │ PC Server IP:     [192.168.10.1___________]             │ │
│ │ PC Printer IP:    [192.168.10.2___________]             │ │
│ │ PMC Computer IP:  [192.168.10.3___________]             │ │
│ │ SBS Computer IP:  [192.168.10.4___________]             │ │
│ │ VAT Computer IP:  [192.168.10.5___________]             │ │
│ │                                                          │ │
│ │ POS & Payment:                                           │ │
│ │ POS IP:           [192.168.20.1___________]             │ │
│ │ EDC IP:           [192.168.20.2___________]             │ │
│ │ SCO IP:           [192.168.20.3___________]             │ │
│ │                                                          │ │
│ │ Other Devices:                                           │ │
│ │ People Counter:   [192.168.30.1___________]             │ │
│ │ Digital TV:       [192.168.30.2___________]             │ │
│ │ Time Attendance:  [192.168.30.3___________]             │ │
│ │ CCTV:             [192.168.30.4___________]             │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Tab 3: Working Hours                                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Day         │ Open Time  │ Close Time │ Status          │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ Monday      │ [10:00]    │ [22:00]    │ ✅ Open        │ │
│ │ Tuesday     │ [10:00]    │ [22:00]    │ ✅ Open        │ │
│ │ Wednesday   │ [10:00]    │ [22:00]    │ ✅ Open        │ │
│ │ Thursday    │ [10:00]    │ [22:00]    │ ✅ Open        │ │
│ │ Friday      │ [10:00]    │ [22:00]    │ ✅ Open        │ │
│ │ Saturday    │ [10:00]    │ [23:00]    │ ✅ Open        │ │
│ │ Sunday      │ [10:00]    │ [23:00]    │ ✅ Open        │ │
│ │ Holiday     │ [10:00]    │ [20:00]    │ ✅ Open        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│                        [Cancel]            [Save Changes]    │
└──────────────────────────────────────────────────────────────┘

Tab 4: Incidents (🆕)
┌──────────────────────────────────────────────────────────────┐
│ 📊 Incident Summary (Last 30 Days)                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Total: 45  Open: 3  In Progress: 5  Resolved: 37        │ │
│ │ Avg Resolution: 4h 35m    SLA Compliance: 95.6% ✅      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Filter: [Last 7 days ▼] [Status: All ▼] [Priority: All ▼]  │
│                                                              │
│ Recent Incidents:                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Ticket       Date/Time      Issue           Status       │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT25110025  16 Nov 14:30   POS Down        🔴 OPEN     │ │
│ │ 🔴 Urgent    Created: 2h    Equipment:                  │ │
│ │              ago            NCR POS #1                   │ │
│ │              [View Details]                              │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT25110020  16 Nov 10:15   Printer Jam     🟡 PROGRESS │ │
│ │ 🟡 High      Assigned:      Equipment:                  │ │
│ │              Somchai        HP LaserJet                  │ │
│ │              [View Details]                              │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT25110018  15 Nov 16:45   WiFi Slow       ✅ CLOSED   │ │
│ │ 🟢 Medium    Resolved:      Rating: ⭐⭐⭐⭐⭐        │ │
│ │              3h 15m                                      │ │
│ │              [View Details]                              │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [1] 2 3 4 5 [>]    [📥 Export] [📊 View Full Statistics]   │
└──────────────────────────────────────────────────────────────┘

Tab 5: Statistics (🆕)
┌──────────────────────────────────────────────────────────────┐
│ 📈 Store Statistics & Analytics                              │
│ Period: [Last 30 days ▼]                                     │
│                                                              │
│ 📊 Incident Trends                                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │     ^                                                    │ │
│ │  15 │     ●                                              │ │
│ │  10 │   ●   ●     ●                                      │ │
│ │   5 │ ●       ● ●   ● ●                                  │ │
│ │   0 └─────────────────────────────────────>              │ │
│ │     1  5  10  15  20  25  30 (days)                     │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ 🔥 Top Issues (Last 30 Days)                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 1. Printer Issues          15 incidents (33.3%)         │ │
│ │ 2. POS System Problems     12 incidents (26.7%)         │ │
│ │ 3. Network Issues          10 incidents (22.2%)         │ │
│ │ 4. CCTV Offline             5 incidents (11.1%)         │ │
│ │ 5. Other                    3 incidents (6.7%)          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ⚡ Most Problematic Equipment                                │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Equipment          Issues  Downtime  Last Issue         │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ HP LaserJet #1     8×      12h       2 days ago        │ │
│ │ NCR POS Term #2    6×      8h        Active now        │ │
│ │ Cisco Router       4×      3h        5 days ago        │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ ⏱️ Performance Metrics                                        │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Average Response Time:     1h 25m                       │ │
│ │ Average Resolution Time:   4h 35m                       │ │
│ │ SLA Compliance Rate:       95.6% ✅                     │ │
│ │ Customer Satisfaction:     4.7/5.0 ⭐⭐⭐⭐            │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ 💰 Cost Analysis                                             │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Total Maintenance Cost:    ฿45,500                      │ │
│ │ - Insource Technicians:    ฿32,000 (70.3%)             │ │
│ │ - Outsource Technicians:   ฿13,500 (29.7%)             │ │
│ │ Parts Replacement:         ฿18,200                      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ [📥 Export Full Report] [📧 Email to Manager]                │
└──────────────────────────────────────────────────────────────┘
```

#### **Page 3: Excel Import**
```
┌──────────────────────────────────────────────────────────────┐
│ Import Stores from Excel                               [X]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Step 1: Download Template                                    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Download the Excel template with all required fields    │ │
│ │                                                          │ │
│ │ [📥 Download Excel Template]                            │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Step 2: Upload Filled Excel File                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ [📁 Choose File] or Drag & Drop Excel here              │ │
│ │                                                          │ │
│ │ Selected: stores_import_20251116.xlsx (245 KB)          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Options:                                                     │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ☑ Skip duplicate stores (by code)                       │ │
│ │ ☐ Update existing stores if code matches                │ │
│ │ ☑ Validate all IP addresses                             │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Preview (First 5 rows):                                      │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Code        │ Name            │ Province │ Status        │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ WAT-BKK-001 │ Siam Paragon    │ Bangkok  │ ✅ Valid     │ │
│ │ WAT-BKK-002 │ Central World   │ Bangkok  │ ✅ Valid     │ │
│ │ WAT-AYT-001 │ The Sky         │ Ayutthaya│ ⚠️  Duplicate│ │
│ │ WAT-CMI-001 │ Maya Lifestyle  │ ChiangMai│ ✅ Valid     │ │
│ │ POP-001     │ Pop-up Siam     │ Bangkok  │ ❌ Invalid IP│ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Summary:                                                     │
│ - Total rows: 50                                             │
│ - Valid: 47                                                  │
│ - Warnings: 1 (duplicates)                                   │
│ - Errors: 2 (invalid data)                                   │
│                                                              │
│              [Cancel]                  [Import (47 stores)]  │
└──────────────────────────────────────────────────────────────┘
```

### 7.5 🔄 Workflows

#### **Workflow 1: Create New Store**
```
Admin เข้า Stores Page
  ↓
คลิก [+ New Store]
  ↓
กรอกข้อมูลใน 3 Tabs:
  1. Basic Info (code, name, address)
  2. Network & IPs (อุปกรณ์ทั้งหมด)
  3. Working Hours (เวลาเปิด-ปิดแต่ละวัน)
  ↓
คลิก [Save]
  ↓
System Validation:
  ├─ ✅ Valid
  │   ├─ Check: code ซ้ำกับ active store อื่นไหม?
  │   │   ├─ ไม่ซ้ำ → OK
  │   │   └─ ซ้ำ → Error: "Active store with this code already exists"
  │   ├─ Validate IP addresses (รูปแบบถูกต้องไหม)
  │   ├─ INSERT INTO stores
  │   ├─ Log activity
  │   └─ แสดง Success + Redirect to Store List
  │
  └─ ❌ Invalid
      └─ แสดง Validation Errors
```

#### **Workflow 2: Excel Import (Bulk Create)**
```
Admin เข้า Stores Page
  ↓
คลิก [Import Excel]
  ↓
เปิด Import Dialog
  ↓
Step 1: ดาวน์โหลด Template
  - คลิก [Download Template]
  - ได้ Excel file พร้อม headers ครบ (52 columns)
  - Fill ข้อมูลใน Excel
  ↓
Step 2: Upload Excel
  - เลือกไฟล์ Excel
  - System อ่านไฟล์และ Preview
  - แสดง Summary: Valid/Warning/Error
  ↓
Step 3: Review & Import
  - ตรวจสอบข้อมูล Preview
  - ถ้ามี Errors → แก้ไขใน Excel แล้ว upload ใหม่
  - ถ้า OK → คลิก [Import]
  ↓
System Processing:
  - Loop ผ่านแต่ละ row
  - Validate ข้อมูล
  - Check duplicate (ตาม options ที่เลือก)
  - INSERT INTO stores (ทีละ row)
  - Track success/skip/error count
  ↓
แสดงผลลัพธ์:
  - "Imported 47 stores successfully"
  - "Skipped 1 duplicate"
  - "2 errors (see log)"
  ↓
Refresh Store List
```

#### **Workflow 3: Pop-up Store Lifecycle**
```
Scenario: Pop-up Store "POP001" เปิดที่หลายที่

Timeline 1: Jan-Mar 2025 (Siam Paragon)
  ↓
Create Store:
  - code = "POP001"
  - name = "Pop-up Siam"
  - storeType = 'pop_up'
  - openDate = 2025-01-01
  - storeStatus = 'active'
  ↓
System Check:
  - Query: SELECT * FROM stores 
           WHERE code = 'POP001' AND storeStatus = 'active'
  - Result: ไม่เจอ (OK ✅)
  - INSERT success
  ↓
ใช้งานปกติ (Jan-Mar)
  - มี Incidents ที่ storeId นี้
  - Technicians ออกซ่อมที่ร้านนี้
  ↓
ปิดร้าน (Apr 2025)
  - Admin เข้าแก้ไข Store
  - Set: storeStatus = 'inactive'
  - Set: closeDate = 2025-04-01
  - UPDATE stores
  ↓
Timeline 2: May-Jul 2025 (Central World)
  ↓
Create New Store (แต่ใช้ code เดิม):
  - code = "POP001" (เดิม!)
  - name = "Pop-up Central"
  - storeType = 'pop_up'
  - openDate = 2025-05-01
  - storeStatus = 'active'
  - notes = "Relocated from Siam Paragon"
  ↓
System Check:
  - Query: SELECT * FROM stores 
           WHERE code = 'POP001' AND storeStatus = 'active'
  - Result: ไม่เจอ (เพราะของเดิม inactive แล้ว)
  - OK ✅ → INSERT success
  ↓
ผลลัพธ์ในฐานข้อมูล:
  stores table มี 2 records ของ "POP001":
  
  id | code   | name           | status   | openDate   | closeDate
  ---|--------|----------------|----------|------------|------------
  10 | POP001 | Pop-up Siam    | inactive | 2025-01-01 | 2025-04-01
  25 | POP001 | Pop-up Central | active   | 2025-05-01 | NULL
  
  ✅ ไม่มีปัญหา เพราะ Unique Constraint 
     คือ (code + WHERE storeStatus = 'active')
```

### 7.6 ✅ Validation Rules

1. **Store Code:**
   - Required, 3-50 ตัวอักษร
   - ห้ามมี code ซ้ำที่ storeStatus = 'active'
   - อนุญาตให้ซ้ำถ้า status = 'inactive'

2. **Store Name:**
   - Required, 3-255 ตัวอักษร

3. **Company:**
   - Required

4. **IP Addresses:**
   - รูปแบบ IPv4 ที่ถูกต้อง (xxx.xxx.xxx.xxx)
   - ไม่บังคับ (optional)

5. **Working Hours:**
   - Open time ต้องน้อยกว่า Close time
   - รูปแบบ HH:MM (24-hour format)

6. **Dates:**
   - openDate ต้องน้อยกว่า closeDate (ถ้ามี)
   - closeDate = NULL ถ้าร้านยังเปิด

7. **Store Status:**
   - ถ้า status = 'inactive' ต้องมี closeDate

---

## 8. FEATURE 4: Equipment Management

### 8.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- จัดการรายการอุปกรณ์ IT ทั้งหมด (Asset Management)
- ติดตาม Serial Number, Barcode ของอุปกรณ์
- เชื่อมโยงกับสาขาและ IP Address
- บันทึกการรับประกัน และวันหมดประกัน
- ติดตามประวัติการซ่อม (เชื่อมกับ Incidents)
- Import/Export ข้อมูลจาก Excel

**ใครใช้?**
- **Super Admin, IT Manager:** จัดการข้อมูลอุปกรณ์ทั้งหมด
- **Technician:** ดูข้อมูลอุปกรณ์ก่อนออกซ่อม, สแกน Barcode
- **Help Desk:** เลือกอุปกรณ์เมื่อสร้าง Incident
- **Read Only:** ดูรายการอุปกรณ์

### 8.2 💾 Database Tables

#### **Table: equipment**
```sql
CREATE TABLE equipment (
  id SERIAL PRIMARY KEY,
  
  -- Asset Information
  assetTag VARCHAR(100) UNIQUE NOT NULL,  -- รหัสทรัพย์สิน (WAT-PC-001)
  barcode VARCHAR(100) UNIQUE,            -- Barcode สำหรับสแกน
  equipmentType VARCHAR(100) NOT NULL,    -- 'PC Server', 'Printer', 'Router', 'POS', etc.
  equipmentName VARCHAR(255) NOT NULL,    -- ชื่อเรียก
  
  -- Manufacturer Information
  brand VARCHAR(100),                     -- Dell, HP, Cisco, Canon, NCR
  model VARCHAR(255),                     -- Optiplex 7020, LaserJet Pro M404
  serialNumber VARCHAR(255) UNIQUE,       -- Serial Number จากโรงงาน
  partNumber VARCHAR(255),                -- Part Number
  
  -- Location
  storeId INT REFERENCES stores(id),      -- สาขาที่ติดตั้ง
  location VARCHAR(255),                  -- ตำแหน่งเฉพาะ (Floor 2 - Server Room)
  ipAddress VARCHAR(50),                  -- IP Address
  macAddress VARCHAR(50),                 -- MAC Address
  
  -- Purchase & Warranty
  purchaseDate DATE,                      -- วันที่ซื้อ
  installDate DATE,                       -- วันที่ติดตั้ง
  warrantyExpiry DATE,                    -- วันหมดประกัน
  supplier VARCHAR(255),                  -- ผู้จัดจำหน่าย
  purchasePrice DECIMAL(12,2),            -- ราคาซื้อ
  
  -- Status
  status VARCHAR(50) DEFAULT 'active',    -- 'active', 'under_maintenance', 'broken', 'in_storage', 'retired'
  
  -- Maintenance
  lastMaintenanceDate DATE,               -- วันซ่อมล่าสุด
  nextMaintenanceDate DATE,               -- วันที่ต้องบำรุงครั้งถัดไป
  maintenanceCount INT DEFAULT 0,         -- จำนวนครั้งที่ซ่อม
  
  -- Additional Information
  notes TEXT,                             -- หมายเหตุ
  imageUrl VARCHAR(500),                  -- รูปภาพอุปกรณ์
  
  -- Metadata
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  createdBy INT REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_equipment_asset ON equipment(assetTag);
CREATE INDEX idx_equipment_barcode ON equipment(barcode);
CREATE INDEX idx_equipment_serial ON equipment(serialNumber);
CREATE INDEX idx_equipment_store ON equipment(storeId);
CREATE INDEX idx_equipment_status ON equipment(status);
CREATE INDEX idx_equipment_type ON equipment(equipmentType);
CREATE INDEX idx_equipment_warranty ON equipment(warrantyExpiry);
```

#### **Modification to incidents table (เพิ่ม field)**
```sql
-- เพิ่ม column ใน incidents table
ALTER TABLE incidents ADD COLUMN equipmentId INT REFERENCES equipment(id);
CREATE INDEX idx_incidents_equipment ON incidents(equipmentId);
```

### 8.3 🔌 API Endpoints

```typescript
// Equipment CRUD
GET    /api/equipment                     // ดูรายการอุปกรณ์ (มี filters)
GET    /api/equipment/:id                 // ดูข้อมูล 1 อุปกรณ์
POST   /api/equipment                     // สร้างอุปกรณ์ใหม่
PUT    /api/equipment/:id                 // แก้ไขข้อมูลอุปกรณ์
DELETE /api/equipment/:id                 // ลบอุปกรณ์ (soft delete)

// Equipment by Store
GET    /api/stores/:storeId/equipment     // ดูอุปกรณ์ทั้งหมดในสาขานี้
GET    /api/equipment/by-barcode/:barcode // ค้นหาจาก Barcode (สำหรับสแกน)

// Maintenance & History
GET    /api/equipment/:id/incidents       // ประวัติการซ่อมทั้งหมด
GET    /api/equipment/:id/maintenance     // ประวัติการบำรุงรักษา
POST   /api/equipment/:id/maintenance     // บันทึกการบำรุงรักษา

// Warranty Management
GET    /api/equipment/warranty/expiring   // อุปกรณ์ที่ใกล้หมดประกัน
GET    /api/equipment/warranty/expired    // อุปกรณ์ที่หมดประกันแล้ว

// Excel Import/Export
POST   /api/equipment/import              // Import จาก Excel
GET    /api/equipment/export              // Export เป็น Excel
GET    /api/equipment/template            // ดาวน์โหลด Excel Template

// Statistics
GET    /api/equipment/statistics          // สถิติอุปกรณ์โดยรวม
GET    /api/equipment/statistics/by-type  // สถิติแยกตามประเภท
GET    /api/equipment/problematic         // อุปกรณ์ที่มีปัญหาบ่อย
```

**Query Filters:**
```typescript
GET /api/equipment?storeId=5&status=active&type=Printer
GET /api/equipment?brand=Dell&warrantyStatus=expiring
GET /api/equipment?search=LaserJet&location=Floor%202
```

**Request/Response Examples:**

**Create Equipment:**
```json
// POST /api/equipment
Request:
{
  "assetTag": "WAT-PC-001",
  "barcode": "8851234567890",
  "equipmentType": "PC Server",
  "equipmentName": "PC Server - Siam Paragon",
  "brand": "Dell",
  "model": "Optiplex 7020",
  "serialNumber": "DL234567890",
  "partNumber": "OP-7020-001",
  "storeId": 123,
  "location": "Floor 2 - Server Room",
  "ipAddress": "192.168.10.1",
  "macAddress": "00:1A:2B:3C:4D:5E",
  "purchaseDate": "2023-01-15",
  "installDate": "2023-01-20",
  "warrantyExpiry": "2026-01-15",
  "supplier": "Dell Thailand",
  "purchasePrice": 35000,
  "status": "active"
}

Response:
{
  "id": 450,
  "assetTag": "WAT-PC-001",
  "equipmentType": "PC Server",
  "brand": "Dell",
  "model": "Optiplex 7020",
  "serialNumber": "DL234567890",
  "store": {
    "id": 123,
    "code": "WAT-BKK-001",
    "name": "Watsons Siam Paragon"
  },
  "status": "active",
  "warrantyStatus": "active",
  "daysUntilWarrantyExpiry": 65,
  "createdAt": "2025-11-16T10:00:00Z"
}
```

**Get Equipment with Incidents:**
```json
// GET /api/equipment/:id
Response:
{
  "id": 450,
  "assetTag": "WAT-PC-001",
  "barcode": "8851234567890",
  "equipmentType": "PC Server",
  "equipmentName": "PC Server - Siam Paragon",
  "brand": "Dell",
  "model": "Optiplex 7020",
  "serialNumber": "DL234567890",
  
  "store": {
    "id": 123,
    "code": "WAT-BKK-001",
    "name": "Watsons Siam Paragon",
    "province": "Bangkok"
  },
  
  "location": "Floor 2 - Server Room",
  "ipAddress": "192.168.10.1",
  "macAddress": "00:1A:2B:3C:4D:5E",
  
  "purchaseDate": "2023-01-15",
  "installDate": "2023-01-20",
  "warrantyExpiry": "2026-01-15",
  "warrantyStatus": "active",
  "daysUntilWarrantyExpiry": 65,
  
  "status": "active",
  "maintenanceCount": 3,
  "lastMaintenanceDate": "2025-10-10",
  "nextMaintenanceDate": "2025-12-15",
  
  "recentIncidents": [
    {
      "id": 248,
      "ticketNumber": "WAT25110020",
      "title": "RAM Upgrade",
      "status": "CLOSED",
      "resolvedAt": "2025-10-10T15:30:00Z"
    },
    {
      "id": 195,
      "ticketNumber": "WAT25070815",
      "title": "Fan Replacement",
      "status": "CLOSED",
      "resolvedAt": "2025-07-15T11:00:00Z"
    }
  ],
  
  "totalIncidents": 3,
  "createdAt": "2025-01-20T09:00:00Z",
  "updatedAt": "2025-10-10T15:30:00Z"
}
```

**Scan Barcode:**
```json
// GET /api/equipment/by-barcode/8851234567890
Response:
{
  "id": 450,
  "assetTag": "WAT-PC-001",
  "equipmentName": "PC Server - Siam Paragon",
  "brand": "Dell",
  "model": "Optiplex 7020",
  "serialNumber": "DL234567890",
  "status": "active",
  "store": {
    "code": "WAT-BKK-001",
    "name": "Watsons Siam Paragon"
  }
}
```

### 8.4 🎨 UI Layouts

#### **Page 1: Equipment List**
```
┌────────────────────────────────────────────────────────────┐
│ 📦 Equipment Management              [+ Add Equipment]     │
│                         [⬇️ Import Excel] [⬆️ Export]       │
├────────────────────────────────────────────────────────────┤
│ Filters:                                                   │
│ [Store: All ▼] [Type: All ▼] [Status: All ▼]              │
│ [Brand: All ▼] [Warranty: All ▼]                           │
│ [Search: __________] [🔍] [📷 Scan Barcode] [Clear]       │
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Asset Tag  │ Name/Type  │ Brand │ Serial │ Store      │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ WAT-PC-001 │ PC Server  │ Dell  │ DL2345 │ Siam      │ │
│ │            │ Optiplex   │ 7020  │        │ ✅ Active │ │
│ │            │ 📍 Floor 2 │       │        │ [Details] │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ WAT-PRT-025│ Printer    │ HP    │ HP9876 │ Siam      │ │
│ │            │ LaserJet   │ M404  │        │ ⚠️ Repair │ │
│ │            │ 📍 Floor 2 │       │        │ [Details] │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ WAT-POS-010│ POS        │ NCR   │ NCR555 │ Central   │ │
│ │            │ Terminal   │ P1515 │        │ ✅ Active │ │
│ │            │ 📍 Floor 1 │       │        │ [Details] │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Statistics:                                                │
│ Total: 450  Active: 425  Under Maintenance: 15  Broken: 5 │
│ ⚠️ Warranty Expiring Soon (30 days): 12 items             │
│                                                            │
│ [1] 2 3 ... 45 [>]                                        │
└────────────────────────────────────────────────────────────┘
```

#### **Page 2: Equipment Detail**
```
┌────────────────────────────────────────────────────────────┐
│ [← Back] Equipment: WAT-PC-001              [Edit] [Print] │
├────────────────────────────────────────────────────────────┤
│ 📑 Tabs: [Basic Info] [Location] [Warranty] [History]     │
├────────────────────────────────────────────────────────────┤
│ Tab 1: Basic Information                                   │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Asset Tag:     WAT-PC-001                              │ │
│ │ Barcode:       8851234567890     [🖼️ View QR]         │ │
│ │ Type:          PC Server                               │ │
│ │ Name:          PC Server - Siam Paragon                │ │
│ │                                                        │ │
│ │ Manufacturer:                                          │ │
│ │   Brand:       Dell                                    │ │
│ │   Model:       Optiplex 7020                           │ │
│ │   Serial:      DL234567890                             │ │
│ │   Part #:      OP-7020-001                             │ │
│ │                                                        │ │
│ │ Status:        ✅ Active                               │ │
│ │                                                        │ │
│ │ [📸 View Photo] [🔗 Copy Asset Tag]                   │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Tab 2: Location & Network                                  │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Store:         Watsons Siam Paragon (WAT-BKK-001)      │ │
│ │ Location:      Floor 2 - Server Room                   │ │
│ │                                                        │ │
│ │ IP Address:    192.168.10.1                            │ │
│ │ MAC Address:   00:1A:2B:3C:4D:5E                       │ │
│ │                                                        │ │
│ │ [📌 View on Store Map] [🔗 Link to Store Details]     │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Tab 3: Warranty & Purchase                                 │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Purchase Date:   15 Jan 2023                           │ │
│ │ Install Date:    20 Jan 2023                           │ │
│ │ Warranty Expiry: 15 Jan 2026                           │ │
│ │                                                        │ │
│ │ Warranty Status: ✅ Active (65 days remaining)        │ │
│ │ ⚠️ Warranty will expire in 2 months!                   │ │
│ │                                                        │ │
│ │ Purchase Price:  ฿35,000                               │ │
│ │ Supplier:        Dell Thailand                         │ │
│ │                                                        │ │
│ │ [🔔 Set Expiry Reminder] [📧 Email to Procurement]    │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Tab 4: Maintenance History                                 │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Total Repairs:      3 times                            │ │
│ │ Last Maintenance:   10 Oct 2025 (RAM Upgrade)         │ │
│ │ Next Maintenance:   15 Dec 2025                        │ │
│ │                                                        │ │
│ │ Incident History:                                      │ │
│ │ ┌──────────────────────────────────────────────────┐   │ │
│ │ │ Date       Ticket      Issue          Status    │   │ │
│ │ ├──────────────────────────────────────────────────┤   │ │
│ │ │ 10 Oct 25  WAT251010   RAM Upgrade    CLOSED   │   │ │
│ │ │ 15 Jul 25  WAT250715   Fan Replace    CLOSED   │   │ │
│ │ │ 20 Mar 25  WAT250320   HDD Replace    CLOSED   │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ │                                                        │ │
│ │ [View All Incidents (3)] [Add Maintenance Note]        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Notes:                                                     │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ - RAM upgraded from 8GB to 16GB (Oct 2025)            │ │
│ │ - Original HDD replaced with SSD (Mar 2025)            │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│                  [Delete Equipment] [Edit] [Save Changes]  │
└────────────────────────────────────────────────────────────┘
```

#### **Page 3: Create Incident - Select Equipment**
```
┌────────────────────────────────────────────────────────────┐
│ 🎫 Create New Incident                                     │
├────────────────────────────────────────────────────────────┤
│ Title: *         [_______________________________]         │
│ Description:     [_______________________________]         │
│                  [_______________________________]         │
│                                                            │
│ Store: *         [Watsons Siam Paragon ▼]                  │
│                                                            │
│ Equipment: (Optional but recommended)                      │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ [🔍 Search] [📷 Scan Barcode]                          │ │
│ │                                                        │ │
│ │ Available Equipment at Siam Paragon:                   │ │
│ │ ┌──────────────────────────────────────────────────┐   │ │
│ │ │ ☐ WAT-PC-001 | Dell Optiplex 7020 | Floor 2    │   │ │
│ │ │ ☐ WAT-PRT-025 | HP LaserJet Pro | Floor 2      │   │ │
│ │ │ ☐ WAT-POS-010 | NCR Terminal | Floor 1         │   │ │
│ │ │ ... (showing 10 of 25)                         │   │ │
│ │ └──────────────────────────────────────────────────┘   │ │
│ │                                                        │ │
│ │ Selected: None                                         │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ Category: *      [Select Category ▼]                       │
│ Priority:        ○ Low ○ Medium ● High ○ Urgent            │
│                                                            │
│                           [Cancel]  [Create Incident]      │
└────────────────────────────────────────────────────────────┘

หมายเหตุ: เมื่อเลือกอุปกรณ์แล้ว
- ระบบจะเปลี่ยนสถานะอุปกรณ์ → "Under Maintenance" อัตโนมัติ
- เมื่อปิดงาน → กลับเป็น "Active" อัตโนมัติ
```

### 8.5 🔄 Workflows

#### **Workflow 1: เชื่อมโยงอุปกรณ์กับ Incident**
```
Help Desk สร้าง Incident
  ↓
เลือกสาขา: Watsons Siam Paragon
  ↓
เลือกอุปกรณ์:
  - ระบบแสดงอุปกรณ์ทั้งหมดในสาขานี้
  - สามารถค้นหาหรือสแกน Barcode
  ↓
เลือก: HP LaserJet Pro (WAT-PRT-025)
  ↓
บันทึก Incident
  ↓
ระบบอัตโนมัติ:
  1. เปลี่ยนสถานะอุปกรณ์ → "Under Maintenance"
  2. เพิ่ม maintenanceCount +1
  3. บันทึก lastMaintenanceDate
  4. เชื่อมโยง Incident กับ Equipment
  ↓
Technician ซ่อมเสร็จ + Help Desk ปิดงาน
  ↓
ระบบอัตโนมัติ:
  1. เปลี่ยนสถานะอุปกรณ์กลับเป็น "Active"
  2. บันทึกประวัติการซ่อมใน Equipment
```

#### **Workflow 2: Technician สแกน Barcode เมื่อ Check-out**
```
Technician เช็คเอาท์
  ↓
สแกน Barcode ของอุปกรณ์: 8851234567890
  ↓
ระบบดึงข้อมูล:
  "HP LaserJet Pro - SN: HP987654321"
  ↓
Technician เลือก:
  ☐ ซ่อมอุปกรณ์เดิม
  ☑ เปลี่ยนอุปกรณ์ใหม่
  ↓
กรอก Serial Number ใหม่: HP777888999
  ↓
อัพโหลด Before/After Photos
  ↓
ระบบอัพเดท:
  - อุปกรณ์เดิม (HP987654321):
    * สถานะ → "Retired"
    * เก็บไว้ในประวัติ
  - สร้างอุปกรณ์ใหม่ (HP777888999):
    * สถานะ → "Active"
    * เชื่อมกับสาขาเดียวกัน
    * คัดลอกข้อมูลจากเดิม (Brand, Model, Location)
```

### 8.6 ✅ Validation Rules

1. **Asset Tag:**
   - Required, unique
   - รูปแบบ: XXX-YYY-NNN (เช่น WAT-PC-001)

2. **Barcode:**
   - Optional, แต่ถ้ามีต้อง unique
   - ใช้สำหรับสแกนอุปกรณ์ง่ายๆ

3. **Serial Number:**
   - Required, unique
   - ใช้ตรวจสอบของแท้และการรับประกัน

4. **Warranty Expiry:**
   - ต้องมากกว่า Purchase Date
   - แจ้งเตือนก่อนหมด 30, 60, 90 วัน

5. **IP Address:**
   - Optional
   - ถ้ามีต้องเป็นรูปแบบ IPv4 ที่ถูกต้อง

6. **Status:**
   - เปลี่ยนเป็น "Under Maintenance" อัตโนมัติเมื่อมี Incident
   - กลับเป็น "Active" เมื่อปิด Incident

---

## 9. FEATURE 5: Category Management

### 9.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- จัดหมวดหมู่ของปัญหา IT (Category)
- ช่วยให้แจ้งซ่อมได้เฉพาะเจาะจง
- ใช้สำหรับ Filter และ Report

**ใครใช้?**
- **Super Admin:** สร้าง/แก้ไข Categories
- **ทุกคน:** เลือก Category เมื่อแจ้งซ่อม

### 9.2 💾 Database Tables

#### **Table: categories**
```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50), -- lucide icon name
  color VARCHAR(20), -- hex color code
  parentId INTEGER REFERENCES categories(id), -- สำหรับ sub-categories
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data Examples
INSERT INTO categories (name, description, icon, color) VALUES
('Hardware', 'อุปกรณ์ Hardware', 'HardDrive', '#3b82f6'),
('Software', 'ซอฟต์แวร์และระบบ', 'Code', '#10b981'),
('Network', 'เครือข่ายและอินเทอร์เน็ต', 'Wifi', '#f59e0b'),
('Security', 'ระบบรักษาความปลอดภัย', 'Shield', '#ef4444'),
('POS System', 'ระบบขายหน้าร้าน', 'ShoppingCart', '#8b5cf6'),
('Printer', 'เครื่องพิมพ์', 'Printer', '#6366f1'),
('CCTV', 'กล้องวงจรปิด', 'Camera', '#ec4899'),
('Other', 'อื่นๆ', 'Package', '#6b7280');
```

### 9.3 🔌 API Endpoints

```typescript
GET    /api/categories                    // ดูรายการ categories
GET    /api/categories/:id                // ดูข้อมูล 1 category
POST   /api/categories                    // สร้าง category ใหม่
PUT    /api/categories/:id                // แก้ไข category
DELETE /api/categories/:id                // ลบ category
GET    /api/categories/tree               // ดู categories แบบ tree (มี sub-categories)
```

### 9.4 🎨 UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 📂 Categories                            [+ New Category]    │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Icon │ Name        │ Description        │ Incidents│ ... │ │
│ ├──────────────────────────────────────────────────────────┤ │
│ │ 💻   │ Hardware    │ อุปกรณ์ Hardware   │ 45       │Edit │ │
│ │ 💿   │ Software    │ ซอฟต์แวร์และระบบ   │ 32       │Edit │ │
│ │ 📡   │ Network     │ เครือข่ายฯ         │ 28       │Edit │ │
│ │ 🛡️   │ Security    │ รักษาความปลอดภัย   │ 15       │Edit │ │
│ │ 🛒   │ POS System  │ ระบบขายหน้าร้าน    │ 67       │Edit │ │
│ │ 🖨️   │ Printer     │ เครื่องพิมพ์        │ 22       │Edit │ │
│ │ 📷   │ CCTV        │ กล้องวงจรปิด        │ 18       │Edit │ │
│ │ 📦   │ Other       │ อื่นๆ              │ 9        │Edit │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. FEATURE 6: File Upload System

### 10.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- อัพโหลดไฟล์แนบ Incident (รูปภาพ, PDF)
- แบ่งเป็น "ก่อนซ่อม" และ "หลังซ่อม"
- บันทึก GPS metadata (ถ้ามี)

**ใครใช้?**
- **End User:** อัพโหลดรูปเมื่อแจ้งซ่อม
- **Technician:** อัพโหลดรูปก่อน-หลังซ่อม

### 10.2 💾 Database Tables

#### **Table: incident_files**
```sql
CREATE TABLE incident_files (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  fileName VARCHAR(255) NOT NULL,
  filePath VARCHAR(500) NOT NULL,
  fileType VARCHAR(50), -- 'image/jpeg', 'image/png', 'application/pdf'
  fileSize INTEGER, -- bytes
  fileCategory VARCHAR(20), -- 'before', 'after', 'document', 'other'
  uploadedBy INTEGER REFERENCES users(id),
  
  -- GPS/Metadata
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  capturedAt TIMESTAMP,
  deviceInfo TEXT,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_incident_files_incidentId ON incident_files(incidentId);
CREATE INDEX idx_incident_files_category ON incident_files(fileCategory);
```

### 10.3 🔌 API Endpoints

```typescript
POST   /api/incidents/:id/files           // Upload file
GET    /api/incidents/:id/files           // List files
GET    /api/files/:fileId                 // Download file
DELETE /api/files/:fileId                 // Delete file
```

**Upload Example:**
```typescript
// POST /api/incidents/456/files
Request: (multipart/form-data)
{
  "file": <File>,
  "category": "before", // 'before' | 'after' | 'document'
  "latitude": 13.746045,
  "longitude": 100.534758,
  "capturedAt": "2025-11-16T11:00:00Z"
}

Response:
{
  "id": 789,
  "fileName": "pos_error_screen.jpg",
  "fileSize": 245678,
  "fileCategory": "before",
  "uploadedBy": {
    "id": 1,
    "name": "John Doe"
  },
  "createdAt": "2025-11-16T11:05:00Z"
}
```

### 10.4 ✅ Validation Rules

1. **File Types:** 
   - Images: jpg, jpeg, png, gif
   - Documents: pdf
   
2. **File Size:**
   - Max 10MB per file
   
3. **Required for Status = 'resolved':**
   - อย่างน้อย 1 file ที่ fileCategory = 'after'

---

# PART 3: ADVANCED FEATURES

## 11. FEATURE 7: Outsource Marketplace

### 11.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- จัดการช่างภายนอก (Outsource Technicians)
- สร้าง Job Offers สำหรับช่าง Outsource
- อนุมัติและจ่ายเงินค่าจ้าง
- ประเมินผลงานช่าง Outsource

**ใครใช้?**
- **Supervisor:** สร้าง Job Offers
- **Outsource Technician:** รับ/ปฏิเสธงาน
- **Finance Admin:** อนุมัติจ่ายเงิน
- **Help Desk:** ประเมินคุณภาพงาน

### 11.2 💾 Database Tables

#### **Table: outsource_technician_profiles**
```sql
CREATE TABLE outsource_technician_profiles (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Profile
  displayName VARCHAR(100),
  bio TEXT,
  photo VARCHAR(255),
  
  -- Skills
  skills TEXT, -- JSON: ['network', 'hardware', 'pos']
  certifications TEXT, -- JSON array
  experience INTEGER, -- years
  
  -- Service Areas
  serviceProvinces TEXT, -- JSON: ['Bangkok', 'Nonthaburi']
  maxDistance INTEGER, -- kilometers
  
  -- Availability
  isAvailable BOOLEAN DEFAULT true,
  availableHours VARCHAR(100),
  availableDays VARCHAR(100),
  
  -- Performance
  completedJobs INTEGER DEFAULT 0,
  averageRating DECIMAL(3, 2),
  responseRate DECIMAL(5, 2),
  
  -- Payment
  hourlyRate DECIMAL(10, 2),
  bankName VARCHAR(100),
  bankAccount VARCHAR(50),
  taxId VARCHAR(20),
  
  -- Status
  verificationStatus VARCHAR(20) DEFAULT 'pending',
  verifiedBy INTEGER REFERENCES users(id),
  verifiedAt TIMESTAMP,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **Table: incident_job_offers**
```sql
CREATE TABLE incident_job_offers (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  
  -- Offer Details
  outsourceType VARCHAR(20) NOT NULL, 
  -- 'general', 'specialist', 'emergency', 'contractor'
  offerPrice DECIMAL(10, 2),
  description TEXT,
  requirements TEXT,
  
  -- Assignment
  assignedTechnicianId INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'accepted', 'rejected', 'completed', 'cancelled'
  
  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acceptedAt TIMESTAMP,
  completedAt TIMESTAMP,
  cancelledAt TIMESTAMP,
  
  -- Payment
  paymentStatus VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'approved', 'paid', 'rejected'
  paymentAmount DECIMAL(10, 2),
  approvedBy INTEGER REFERENCES users(id),
  approvedAt TIMESTAMP,
  paidAt TIMESTAMP,
  
  createdBy INTEGER REFERENCES users(id),
  updatedBy INTEGER REFERENCES users(id)
);
```

### 11.3 🔌 API Endpoints

```typescript
// Job Offers
GET    /api/job-offers                    // List job offers
POST   /api/job-offers                    // Create job offer
POST   /api/job-offers/:id/accept         // Accept (outsource tech)
POST   /api/job-offers/:id/reject         // Reject (outsource tech)
POST   /api/job-offers/:id/complete       // Mark completed

// Payment Management
GET    /api/payments                      // List payments (Finance)
POST   /api/payments/:id/approve          // Approve payment
POST   /api/payments/:id/reject           // Reject payment
POST   /api/payments/:id/pay              // Mark as paid

// Technician Profiles
GET    /api/outsource-technicians         // List profiles
GET    /api/outsource-technicians/:id     // Get profile
PUT    /api/outsource-technicians/:id     // Update profile
POST   /api/outsource-technicians/:id/verify // Verify (admin)
```

### 11.4 🔄 Workflow

```
Supervisor สร้าง Job Offer
  ↓
System แจ้งช่าง Outsource ที่เหมาะสม
  ↓
Outsource Tech รับงาน
  ↓
Incident status → 'assigned'
  ↓
Outsource Tech ทำงานเสร็จ → 'resolved'
  ↓
Help Desk ปิดงาน → 'closed'
  ↓
System สร้าง Payment Request
  ↓
Finance Admin อนุมัติจ่ายเงิน
  ↓
Finance Admin กด "Mark as Paid"
  ↓
End User ประเมินงาน (Rating)
```

---

## 12. FEATURE 8: Rating System (Public Link)

### 12.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- ลูกค้าประเมินช่างหลังปิดงาน
- ใช้ Public Link (ไม่ต้อง Login)
- ให้คะแนน 1-5 ดาว + Comment
- ส่งลิงก์ผ่านอีเมลอัตโนมัติ

**ใครใช้?**
- **End User:** ประเมินผ่าน Email Link
- **Technician:** ดูคะแนนของตัวเอง
- **Manager:** ดูสถิติ Rating ทั้งหมด

### 12.2 💾 Database Tables

#### **Table: incident_ratings**
```sql
CREATE TABLE incident_ratings (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  
  -- Rating Details
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  
  -- Rater Information
  ratedBy INTEGER REFERENCES users(id), -- NULL if anonymous
  raterName VARCHAR(100),
  raterEmail VARCHAR(255),
  
  -- Rating Categories
  qualityRating INTEGER CHECK (qualityRating >= 1 AND qualityRating <= 5),
  timelinessRating INTEGER CHECK (timelinessRating >= 1 AND timelinessRating <= 5),
  professionalismRating INTEGER CHECK (professionalismRating >= 1 AND professionalismRating <= 5),
  
  -- Technical Details
  raterIp VARCHAR(45),
  userAgent TEXT,
  isPublic BOOLEAN DEFAULT false,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(incidentId) -- 1 incident = 1 rating
);
```

### 12.3 🔌 API Endpoints

```typescript
// Public Endpoints (No Auth)
GET    /api/public/ratings/:token         // Get incident info
POST   /api/public/ratings/:token         // Submit rating
GET    /api/public/ratings/:token/status  // Check if rated

// Protected Endpoints
GET    /api/ratings                       // List all ratings (admin)
GET    /api/ratings/stats                 // Rating statistics
GET    /api/incidents/:id/rating          // Get rating for incident
```

### 12.4 🎨 UI Layouts

#### **Public Rating Page** (ไม่ต้อง Login)
```
┌──────────────────────────────────────────────────────────────┐
│                 [Logo] RIM System                            │
│              🌟 Rate Your Service Experience                 │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Ticket: WAT25110456                                    │ │
│ │ Title: POS System Error                                  │ │
│ │ Store: Watsons Siam Paragon                              │ │
│ │ Technician: Jane Smith                                   │ │
│ │ Completed: November 16, 2025                             │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Overall Rating:                                              │
│ ⭐ ⭐ ⭐ ⭐ ⭐  (Click to rate)                                │
│                                                              │
│ Detailed Ratings (Optional):                                 │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ 📦 Quality of Work:        ⭐⭐⭐⭐⭐                      │ │
│ │ ⚡ Timeliness:             ⭐⭐⭐⭐⭐                      │ │
│ │ 💼 Professionalism:        ⭐⭐⭐⭐⭐                      │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Comments (Optional):                                         │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │                                                          │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│ Your Name (Optional):    [__________________]               │
│ Your Email (Optional):   [__________________]               │
│                                                              │
│                  [Submit Rating]                             │
│                                                              │
│ Your feedback helps us improve. Thank you! 🙏               │
└──────────────────────────────────────────────────────────────┘
```

### 12.5 🔄 Workflow

```
Incident Status → Closed
  ↓
System Generate UUID Token
  ↓
Save to incidents.ratingToken
  ↓
Send Email with Rating Link
  ↓
User Click Link → Open Public Rating Page
  ↓
Validate Token (not expired, not rated)
  ↓
User Submit Rating
  ↓
Save to incident_ratings
  ↓
Send Notification to Technician
  ↓
Update Technician Average Rating
```

---

## 13. FEATURE 9: Email Notification System

### 13.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- ส่งอีเมลแจ้งเตือนอัตโนมัติ
- ส่ง Rating Link เมื่อปิดงาน
- บันทึก Log การส่งทุกครั้ง

**Email Types:**
- Incident Created
- Incident Assigned
- Status Changed
- **Incident Closed + Rating Link**
- SLA Warning/Breach

### 13.2 💾 Database Tables

#### **Table: email_logs**
```sql
CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER REFERENCES incidents(id) ON DELETE SET NULL,
  userId INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Email Details
  emailTo VARCHAR(255) NOT NULL,
  emailCc VARCHAR(500),
  emailSubject VARCHAR(500) NOT NULL,
  emailBody TEXT NOT NULL,
  emailType VARCHAR(50),
  -- 'incident_closed', 'rating_request', 'assignment_notification'
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',
  -- 'pending', 'sent', 'failed'
  sentAt TIMESTAMP,
  failedAt TIMESTAMP,
  errorMessage TEXT,
  
  -- Retry
  retryCount INTEGER DEFAULT 0,
  lastRetryAt TIMESTAMP,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 13.3 🔌 API Endpoints

```typescript
POST   /api/emails/send-rating-request/:incidentId
GET    /api/email-logs                    // List email logs (admin)
POST   /api/email-logs/:id/retry          // Retry failed email
POST   /api/emails/test                   // Send test email
```

### 13.4 Email Template (Rating Request)

```html
Subject: 🌟 Please Rate Your Service - WAT25110456

Dear John Doe,

Thank you for using our IT support service!

Your incident has been resolved:
────────────────────────────────────
📋 Ticket: WAT25110456
📝 Title: POS System Error
🏪 Store: Watsons Siam Paragon
👨‍🔧 Technician: Jane Smith
✅ Resolved: November 16, 2025
────────────────────────────────────

We value your feedback! Please rate the service:

⭐ RATE NOW ⭐
https://rim.example.com/rate/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d

This link expires in 30 days.

Thank you!
────────────────────────────────────
RIM Support Team
Rubjobb Co., Ltd.
```

---

## 14. FEATURE 10: Dashboard & Analytics

### 14.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- แสดงสถิติภาพรวม
- Charts & Graphs
- KPI Monitoring
- Rating Analytics

### 14.2 🔌 API Endpoints

```typescript
GET    /api/dashboard/stats               // Overview statistics
GET    /api/dashboard/charts              // Chart data
GET    /api/dashboard/recent-incidents    // Recent incidents
GET    /api/dashboard/rating-analytics    // Rating stats
```

### 14.3 🎨 UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Dashboard                                   [Filter: ... ]│
├──────────────────────────────────────────────────────────────┤
│ Stats Cards:                                                 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                    │
│ │ 45  │ │ 32  │ │ 28  │ │ 5   │ │4.2⭐│                    │
│ │Open │ │Prog │ │Res  │ │Late │ │Rate │                    │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘                    │
│                                                              │
│ ┌─ Incidents by Status ────────┐ ┌─ Rating Distribution ─┐ │
│ │ 📊 Bar Chart                 │ │ 5⭐: ████████ 45%     │ │
│ │                              │ │ 4⭐: ████████ 35%     │ │
│ │                              │ │ 3⭐: ███ 15%          │ │
│ └──────────────────────────────┘ │ 2⭐: █ 3%             │ │
│                                   │ 1⭐: █ 2%             │ │
│ ┌─ SLA Compliance ─────────────┐ └───────────────────────┘ │
│ │ 📈 Line Chart                │                            │
│ │                              │                            │
│ └──────────────────────────────┘                            │
│                                                              │
│ ┌─ Recent Incidents ──────────────────────────────────────┐ │
│ │ WAT25110456 │ POS Error  │ Siam    │ 🟡 Prog │ View  │ │
│ │ WAT25110455 │ Network... │ Central │ ✅ Done │ View  │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 15. FEATURE 11: SLA Management

### 15.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- กำหนดเป้าหมายเวลาตาม Priority
- ติดตาม SLA อัตโนมัติ
- แจ้งเตือนเมื่อใกล้เกินเวลา

### 15.2 💾 Database Tables

#### **Table: sla_policies**
```sql
CREATE TABLE sla_policies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  priority VARCHAR(20) NOT NULL,
  responseTime INTEGER NOT NULL, -- minutes
  resolutionTime INTEGER NOT NULL, -- minutes
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data
INSERT INTO sla_policies (name, priority, responseTime, resolutionTime) VALUES
('Critical Issues', 'critical', 60, 240),
('High Priority', 'high', 120, 480),
('Medium Priority', 'medium', 240, 1440),
('Low Priority', 'low', 480, 2880);
```

### 15.3 SLA Status Logic

```
on_time:   closedAt <= dueDate
warning:   (dueDate - now) < 30 minutes
overdue:   now > dueDate AND status != 'closed'
```

---

## 16. FEATURE 12: Knowledge Base & Incident Intelligence

### 16.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- เก็บรวบรวมคู่มือการแก้ปัญหาออนไลน์
- แนะนำคู่มือที่เกี่ยวข้องอัตโนมัติเมื่อสร้าง Incident
- แสดงประวัติการซ่อมงานลักษณะเดียวกัน
- ช่วยให้ Technician แก้ปัญหาได้เร็วและถูกต้อง

**ใครใช้?**
- **Super Admin:** จัดการ KB Articles, Categories
- **IT Manager:** Approve articles, View analytics
- **Help Desk:** Create/Update articles, Link to incidents
- **Technician:** อ่านคู่มือก่อนออกซ่อม, Update articles หลังซ่อม
- **End User:** ค้นหาคู่มือแก้ปัญหาเบื้องต้น (optional)

**Benefits:**
- ⚡ ลดเวลาแก้ปัญหา (First-Time Fix Rate เพิ่มขึ้น 20-30%)
- 📚 สะสม Knowledge จากการซ่อมทุกครั้ง
- 🎯 Technician มีข้อมูลครบก่อนออกงาน
- 💡 เรียนรู้จากปัญหาที่ผ่านมา

### 16.2 💾 Database Tables

#### **Table: knowledge_articles**
```sql
CREATE TABLE knowledge_articles (
  id SERIAL PRIMARY KEY,
  
  -- Article Info
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  
  -- Categorization
  categoryId INTEGER REFERENCES categories(id),
  equipmentType VARCHAR(100), -- 'Printer', 'POS', 'CCTV', 'Network', etc.
  tags TEXT, -- JSON array: ['paper-jam', 'hp-printer', 'troubleshooting']
  
  -- Related Info
  relatedIncidentIds TEXT, -- JSON array of incident IDs
  difficulty VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'
  estimatedTime INTEGER, -- minutes
  
  -- Content
  steps TEXT, -- JSON array of steps with images
  images TEXT, -- JSON array of image URLs
  videoUrl VARCHAR(500),
  attachments TEXT, -- JSON array: [{name, url, size}]
  
  -- SEO & Search
  keywords TEXT,
  searchVector TSVECTOR, -- Full-text search
  
  -- Metadata
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'archived'
  viewCount INTEGER DEFAULT 0,
  helpfulCount INTEGER DEFAULT 0,
  notHelpfulCount INTEGER DEFAULT 0,
  
  -- Audit
  createdBy INTEGER REFERENCES users(id),
  approvedBy INTEGER REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  publishedAt TIMESTAMP,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  previousVersionId INTEGER REFERENCES knowledge_articles(id)
);

CREATE INDEX idx_kb_category ON knowledge_articles(categoryId);
CREATE INDEX idx_kb_equipment ON knowledge_articles(equipmentType);
CREATE INDEX idx_kb_status ON knowledge_articles(status);
CREATE INDEX idx_kb_search ON knowledge_articles USING GIN(searchVector);
```

#### **Table: knowledge_article_feedback**
```sql
CREATE TABLE knowledge_article_feedback (
  id SERIAL PRIMARY KEY,
  articleId INTEGER NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  userId INTEGER REFERENCES users(id),
  
  -- Feedback
  isHelpful BOOLEAN NOT NULL,
  comment TEXT,
  
  -- Context
  incidentId INTEGER REFERENCES incidents(id),
  readTime INTEGER, -- seconds
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_feedback_article ON knowledge_article_feedback(articleId);
```

#### **Table: incident_knowledge_links**
```sql
CREATE TABLE incident_knowledge_links (
  id SERIAL PRIMARY KEY,
  incidentId INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  articleId INTEGER NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  
  -- Link Info
  linkType VARCHAR(20) NOT NULL, 
  -- 'auto-suggested', 'manual-added', 'created-from-incident'
  
  addedBy INTEGER REFERENCES users(id),
  wasHelpful BOOLEAN,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(incidentId, articleId)
);

CREATE INDEX idx_incident_kb_incident ON incident_knowledge_links(incidentId);
CREATE INDEX idx_incident_kb_article ON incident_knowledge_links(articleId);
```

### 16.3 🔌 API Endpoints

#### **Knowledge Base Management**

```typescript
// List all KB articles (with filters)
GET /api/knowledge/articles
Query: status, categoryId, equipmentType, search, tags, sortBy, page, limit

Response:
{
  "articles": [
    {
      "id": 1,
      "title": "How to Fix HP Printer Paper Jam",
      "summary": "Step-by-step guide to resolve paper jam issues",
      "categoryName": "Printer",
      "equipmentType": "Printer",
      "tags": ["paper-jam", "hp-printer"],
      "difficulty": "beginner",
      "estimatedTime": 10,
      "viewCount": 245,
      "helpfulCount": 189,
      "helpfulRate": 94.0,
      "publishedAt": "2025-11-01T10:00:00Z"
    }
  ],
  "total": 156,
  "page": 1
}

// Get single KB article
GET /api/knowledge/articles/:id

// Create new KB article
POST /api/knowledge/articles
Body: { title, content, summary, categoryId, equipmentType, tags, ... }

// Update KB article
PUT /api/knowledge/articles/:id

// Delete KB article
DELETE /api/knowledge/articles/:id

// Publish/Archive article
PATCH /api/knowledge/articles/:id/status
Body: { "status": "published" | "archived" }

// Submit feedback
POST /api/knowledge/articles/:id/feedback
Body: { isHelpful, comment, incidentId, readTime }
```

#### **Incident Integration**

```typescript
// Get suggested KB articles for an incident
GET /api/incidents/:id/suggested-articles

Response:
{
  "suggestedArticles": [
    {
      "id": 1,
      "title": "How to Fix HP Printer Paper Jam",
      "relevanceScore": 95.5,
      "reason": "Matches category: Printer, Equipment: HP LaserJet Pro",
      "helpfulRate": 94.0
    }
  ]
}

// Link KB article to incident
POST /api/incidents/:id/knowledge-links
Body: { articleId, linkType }

// Get linked KB articles
GET /api/incidents/:id/knowledge-links

// Mark as helpful/not helpful
PATCH /api/incidents/:incidentId/knowledge-links/:articleId
Body: { wasHelpful: true }
```

#### **Similar Incidents**

```typescript
// Get similar past incidents
GET /api/incidents/:id/similar
Query: limit, status

Response:
{
  "similarIncidents": [
    {
      "id": 123,
      "ticketNumber": "WAT25110123",
      "title": "HP Printer Paper Jam",
      "similarityScore": 92.5,
      "matchingFactors": [
        "Same equipment model",
        "Same category",
        "Same store"
      ],
      "resolution": {
        "status": "closed",
        "resolutionTime": 45,
        "technicianName": "John Smith",
        "description": "Removed paper, cleaned roller, tested OK",
        "usedKBArticles": [...]
      },
      "rating": { "score": 5, "comment": "..." },
      "resolvedAt": "2025-10-15T11:30:00Z"
    }
  ]
}
```

#### **Analytics**

```typescript
// Get KB statistics
GET /api/knowledge/statistics

Response:
{
  "totalArticles": 156,
  "publishedArticles": 142,
  "totalViews": 45678,
  "averageHelpfulRate": 87.5,
  "topArticles": [...],
  "topCategories": [...],
  "needsUpdate": [...]
}

// Get article performance
GET /api/knowledge/articles/:id/analytics

Response:
{
  "views": { total, last7Days, last30Days, trend },
  "feedback": { helpfulCount, notHelpfulCount, helpfulRate },
  "linkedIncidents": { total, resolved, successRate },
  "topUsers": [...]
}
```

### 16.4 🎨 UI Layouts

#### **Knowledge Base Home Page**
```
┌──────────────────────────────────────────────────────────────────┐
│ 📚 Knowledge Base                [+ New Article]  [⚙️ Settings]   │
├──────────────────────────────────────────────────────────────────┤
│ 🔍 Search: [________________________________] [Search]           │
│                                                                   │
│ 📊 Quick Stats:                                                   │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                │
│ │ 156     │ │ 45,678  │ │ 87.5%   │ │ 23      │                │
│ │Articles │ │Views    │ │Helpful  │ │Authors  │                │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
│                                                                   │
│ 📁 Browse by Category:                                            │
│ 🖨️ Printer (22) | 🛒 POS (67) | 📡 Network (28) | 📷 CCTV (18) │
│                                                                   │
│ ⭐ Most Helpful Articles:                                         │
│ 1. How to Fix HP Printer Paper Jam      245 views  94% 👍       │
│ 2. POS System Not Responding             198 views  91% 👍       │
│ 3. CCTV Camera Offline Troubleshooting  167 views  89% 👍       │
└──────────────────────────────────────────────────────────────────┘
```

#### **Incident Detail WITH KB Integration**
```
┌──────────────────────────────────────────────────────────────────┐
│ 🎫 Incident: WAT25110456 - HP Printer Not Working                │
│ [Details] [Comments] [Files] [📚 Knowledge Base] [History]      │
├──────────────────────────────────────────────────────────────────┤
│ 💡 Suggested Knowledge Base Articles:                            │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ 🎯 High Match (95.5%)                                      │   │
│ │ 📄 How to Fix HP Printer Paper Jam                        │   │
│ │    Matches: Equipment (HP LaserJet), Category (Printer)   │   │
│ │    👍 94% helpful | 10 mins | Beginner                     │   │
│ │    [View Article] [Link to Incident]                      │   │
│ └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ 📊 Similar Past Incidents (15 found):                            │
│                                                                   │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ 🔥 Highly Similar (92.5%)                                  │   │
│ │ 🎫 WAT25110123 - HP Printer Paper Jam                     │   │
│ │    Same Equipment: HP LaserJet Pro (WAT-PRT-025)          │   │
│ │    Same Store: Watsons Siam Paragon                       │   │
│ │    Resolved in: 45 mins | Rating: 5⭐                      │   │
│ │                                                            │   │
│ │    Resolution: "Removed paper, cleaned roller, tested OK" │   │
│ │    Technician: John Smith                                  │   │
│ │    Used KB: How to Fix HP Printer Paper Jam               │   │
│ │    [View Details]                                          │   │
│ └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 16.5 🔄 Workflows

#### **Workflow 1: Auto-suggest when Creating Incident**
```
User creates new incident
  ↓
Fills: Category, Equipment, Description
  ↓
System analyzes & suggests KB articles (real-time)
  ↓
User can view articles & try self-fix
  OR
  Proceed to create incident (articles auto-linked)
```

#### **Workflow 2: Technician Prepares Before On-site**
```
Technician receives assignment
  ↓
Opens incident → Sees:
  • Linked KB articles
  • Similar past incidents
  ↓
Reviews guides, manuals, videos
  ↓
Arrives prepared → Fixes efficiently!
  ↓
Marks article helpful/not helpful
```

#### **Workflow 3: Create KB from Resolved Incident**
```
Incident resolved
  ↓
Help Desk: "Common issue, create KB article"
  ↓
Click [Create KB Article from Incident]
  ↓
System pre-fills with incident data
  ↓
Enhance with steps, photos, videos
  ↓
IT Manager approves → Publish
  ↓
Available for future similar incidents!
```

### 16.6 ✅ Validation Rules

1. **Article Creation:**
   - Title: Required, 10-255 characters
   - Content: Required, minimum 100 characters
   - Category: Required
   - Status: 'draft' or 'published'

2. **Publishing:**
   - Only IT Manager/Super Admin can publish
   - Must have: title, content, category

3. **Feedback:**
   - One feedback per user per article
   - Comment: max 500 characters

4. **Search:**
   - Minimum 3 characters
   - Support Thai + English
   - Full-text search

### 16.7 🎯 Integration Points

**With Existing Features:**
- **Categories (Feature 5):** Use existing categories, add kbArticleCount
- **Incidents (Feature 2):** Auto-suggest articles, link articles, track effectiveness
- **Equipment (Feature 4):** Link to equipment types, show guides on equipment page
- **Dashboard (Feature 10):** Add KB metrics, top articles, usage trends

---

## 17. FEATURE 13: Backup & Restore System

### 17.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- สำรองข้อมูลระบบอัตโนมัติทุกเดือน
- สำรองข้อมูลด้วยตนเอง (Manual Backup) ได้ทุกเมื่อ
- กู้คืนข้อมูลเมื่อ Server พัง (Disaster Recovery)
- เก็บประวัติ Backup และจัดการ Backup Files
- รองรับ Multi-location Storage (Local, Network Drive, Cloud)

**ใครใช้?**
- **Super Admin ONLY:** ทุกการทำงานในฟีเจอร์นี้
  - ตั้งค่า Auto Backup
  - Manual Backup
  - Restore
  - จัดการ Backup Files
  - ดู Backup Logs

**Components ที่ Backup:**
1. 💾 **Database** - PostgreSQL dump (all tables, data, schema)
2. 📁 **File Storage** - Uploaded files (images, PDFs, attachments, equipment photos)
3. ⚙️ **Configuration** - System settings, environment variables

**Benefits:**
- 🔒 **Data Protection** - ป้องกันข้อมูลสูญหาย
- 💪 **Disaster Recovery** - กู้คืนได้เมื่อ server พัง
- 📅 **Automated** - Backup อัตโนมัติ ไม่ต้องจำ
- 🎯 **Point-in-Time Recovery** - กู้คืนได้ตาม timestamp
- ✅ **Compliance** - ตอบโจทย์ข้อกำหนด data retention

### 17.2 💾 Database Tables

#### **Table: backup_configs**
```sql
CREATE TABLE backup_configs (
  id SERIAL PRIMARY KEY,
  
  -- Auto Backup Settings
  autoBackupEnabled BOOLEAN DEFAULT true,
  autoBackupSchedule VARCHAR(50) DEFAULT 'monthly', -- 'daily', 'weekly', 'monthly'
  autoBackupDay INTEGER, -- Day of month (1-31) for monthly, day of week (0-6) for weekly
  autoBackupTime VARCHAR(5) DEFAULT '02:00', -- HH:mm format
  
  -- Storage Settings
  backupPath VARCHAR(500) NOT NULL, -- Primary backup location
  secondaryBackupPath VARCHAR(500), -- Optional secondary location (e.g., network drive)
  cloudBackupEnabled BOOLEAN DEFAULT false,
  cloudProvider VARCHAR(50), -- 'aws-s3', 'google-cloud', 'azure'
  cloudBucket VARCHAR(255),
  cloudCredentials TEXT, -- Encrypted JSON
  
  -- Retention Policy
  retentionDays INTEGER DEFAULT 90, -- Keep backups for 90 days
  maxBackupCount INTEGER DEFAULT 12, -- Keep max 12 backups
  
  -- Backup Options
  compressBackup BOOLEAN DEFAULT true,
  encryptBackup BOOLEAN DEFAULT false,
  encryptionKey TEXT, -- Encrypted
  includeFiles BOOLEAN DEFAULT true,
  
  -- Notifications
  notifyOnSuccess BOOLEAN DEFAULT true,
  notifyOnFailure BOOLEAN DEFAULT true,
  notificationEmails TEXT, -- JSON array of emails
  
  -- Metadata
  createdBy INTEGER REFERENCES users(id),
  updatedBy INTEGER REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Only one config record should exist
CREATE UNIQUE INDEX idx_backup_config_singleton ON backup_configs ((id IS NOT NULL));
```

#### **Table: backup_history**
```sql
CREATE TABLE backup_history (
  id SERIAL PRIMARY KEY,
  
  -- Backup Info
  backupType VARCHAR(20) NOT NULL, -- 'auto', 'manual', 'pre-update'
  backupName VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'in-progress', 'completed', 'failed'
  
  -- Content
  includesDatabase BOOLEAN DEFAULT true,
  includesFiles BOOLEAN DEFAULT true,
  includesConfig BOOLEAN DEFAULT true,
  
  -- File Details
  backupFilePath VARCHAR(500),
  backupFileName VARCHAR(255),
  backupFileSize BIGINT, -- bytes
  compressedSize BIGINT, -- bytes
  
  -- Storage Locations
  storedLocally BOOLEAN DEFAULT true,
  localPath VARCHAR(500),
  storedInCloud BOOLEAN DEFAULT false,
  cloudUrl VARCHAR(500),
  
  -- Checksums for verification
  databaseChecksum VARCHAR(64), -- SHA256
  filesChecksum VARCHAR(64),
  
  -- Statistics
  databaseSize BIGINT,
  filesSize BIGINT,
  totalRecords INTEGER,
  tablesBackedUp INTEGER,
  filesBackedUp INTEGER,
  
  -- Timing
  startedAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  duration INTEGER, -- seconds
  
  -- Error Handling
  errorMessage TEXT,
  errorDetails TEXT,
  
  -- Metadata
  createdBy INTEGER REFERENCES users(id),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Restoration Info
  restoredAt TIMESTAMP,
  restoredBy INTEGER REFERENCES users(id)
);

CREATE INDEX idx_backup_history_type ON backup_history(backupType);
CREATE INDEX idx_backup_history_status ON backup_history(status);
CREATE INDEX idx_backup_history_date ON backup_history(startedAt);
```

#### **Table: restore_history**
```sql
CREATE TABLE restore_history (
  id SERIAL PRIMARY KEY,
  
  -- Source Backup
  backupHistoryId INTEGER REFERENCES backup_history(id),
  backupName VARCHAR(255) NOT NULL,
  backupDate TIMESTAMP NOT NULL,
  
  -- Restore Details
  restoreType VARCHAR(20) NOT NULL, -- 'full', 'database-only', 'files-only'
  status VARCHAR(20) NOT NULL, -- 'in-progress', 'completed', 'failed'
  
  -- Components Restored
  databaseRestored BOOLEAN DEFAULT false,
  filesRestored BOOLEAN DEFAULT false,
  configRestored BOOLEAN DEFAULT false,
  
  -- Statistics
  recordsRestored INTEGER,
  tablesRestored INTEGER,
  filesRestoredCount INTEGER,
  
  -- Timing
  startedAt TIMESTAMP NOT NULL,
  completedAt TIMESTAMP,
  duration INTEGER,
  
  -- Pre-Restore Backup
  preRestoreBackupId INTEGER REFERENCES backup_history(id),
  
  -- Error Handling
  errorMessage TEXT,
  errorDetails TEXT,
  
  -- Metadata
  restoredBy INTEGER REFERENCES users(id),
  restoredFrom VARCHAR(20), -- 'local', 'cloud'
  ipAddress VARCHAR(45),
  userAgent TEXT,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_restore_history_status ON restore_history(status);
CREATE INDEX idx_restore_history_date ON restore_history(startedAt);
```

#### **Table: backup_logs**
```sql
CREATE TABLE backup_logs (
  id SERIAL PRIMARY KEY,
  backupHistoryId INTEGER REFERENCES backup_history(id),
  
  -- Log Entry
  logLevel VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'debug'
  message TEXT NOT NULL,
  details TEXT, -- JSON with additional context
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_logs_backup ON backup_logs(backupHistoryId);
CREATE INDEX idx_backup_logs_level ON backup_logs(logLevel);
```

### 17.3 🔌 API Endpoints

#### **Backup Configuration**

```typescript
// Get current backup configuration
GET /api/backup/config

Response:
{
  "config": {
    "autoBackupEnabled": true,
    "autoBackupSchedule": "monthly",
    "autoBackupDay": 1,
    "autoBackupTime": "02:00",
    "backupPath": "/var/backups/rim",
    "secondaryBackupPath": "/mnt/network-backup/rim",
    "cloudBackupEnabled": false,
    "retentionDays": 90,
    "maxBackupCount": 12,
    "compressBackup": true,
    "encryptBackup": false,
    "includeFiles": true,
    "notifyOnSuccess": true,
    "notificationEmails": ["admin@company.com"]
  }
}

// Update backup configuration
PUT /api/backup/config
Body: { autoBackupEnabled, autoBackupSchedule, backupPath, ... }

// Test backup path
POST /api/backup/config/test-path
Body: { "path": "/var/backups/rim" }
Response: { "success": true, "writable": true, "freeSpace": "150 GB" }
```

#### **Manual Backup**

```typescript
// Create manual backup
POST /api/backup/create
Body:
{
  "backupName": "pre-upgrade-backup",
  "includeDatabase": true,
  "includeFiles": true,
  "includeConfig": true,
  "customPath": "/custom/path",
  "uploadToCloud": false
}

Response: { "success": true, "backupId": 45, "estimatedTime": "5-10 minutes" }

// Get backup status
GET /api/backup/:id/status
Response: { "backupId": 45, "status": "in-progress", "progress": 65 }
```

#### **Backup Management**

```typescript
// List all backups
GET /api/backup/list
Query: page, limit, type, status

// Get backup details
GET /api/backup/:id

// Download backup file
GET /api/backup/:id/download

// Delete backup
DELETE /api/backup/:id
Body: { "deleteFiles": true }

// Verify backup integrity
POST /api/backup/:id/verify
Response: { "valid": true, "checksumMatch": true }
```

#### **Restore**

```typescript
// List available backups for restore
GET /api/backup/restore/available

// Restore from backup (CRITICAL)
POST /api/backup/restore
Body:
{
  "backupId": 45,
  "restoreType": "full",
  "createPreRestoreBackup": true,
  "confirmationCode": "RESTORE-2025-11-18",
  "overwriteExisting": true
}

Response: { "success": true, "restoreId": 12, "estimatedTime": "10-15 minutes" }

// Get restore status
GET /api/backup/restore/:id/status

// Get restore history
GET /api/backup/restore/history
```

#### **Backup Logs**

```typescript
// Get logs for specific backup
GET /api/backup/:id/logs
Query: level, limit

// Get system-wide backup activity
GET /api/backup/activity-log
Query: startDate, endDate, type, status
```

### 17.4 🎨 UI Layouts

#### **Backup Settings Page**
```
┌──────────────────────────────────────────────────────────────┐
│ ⚙️ Backup Settings                               [Save]      │
├──────────────────────────────────────────────────────────────┤
│ 📅 Automatic Backup Schedule:                                │
│ ☑ Enable automatic backup                                   │
│ Schedule: [Monthly ▼] | Day: [1st ▼] | Time: [02:00]       │
│ Next backup: December 1, 2025 at 02:00 AM                   │
│                                                               │
│ 💾 Backup Storage:                                            │
│ Primary: [/var/backups/rim__________] [Test Path]           │
│ Secondary: [/mnt/network-backup/rim_] [Test Path]           │
│                                                               │
│ 🗂️ Retention Policy:                                         │
│ Keep backups for: [90] days                                  │
│ Maximum backups: [12]                                        │
│                                                               │
│ ⚙️ Options:                                                   │
│ ☑ Compress | ☐ Encrypt | ☑ Include files                   │
│                                                               │
│ 📧 Notifications: admin@company.com                          │
└──────────────────────────────────────────────────────────────┘
```

#### **Backup Management Page**
```
┌──────────────────────────────────────────────────────────────┐
│ 💾 Backup Management              [⚙️ Settings]              │
│ [🔄 Create Manual Backup] [📥 Restore from Backup]          │
├──────────────────────────────────────────────────────────────┤
│ 📊 Statistics: 12 Backups | 856 MB Last Size | 100% Success │
│                                                               │
│ ✅ backup_2025-11-18_02-00-00                    Auto        │
│    Nov 18, 02:00 AM | 856 MB | 8m 45s                       │
│    [Details] [Download] [Verify] [Restore] [Delete]         │
│                                                               │
│ ✅ backup_2025-10-18_02-00-00                    Auto        │
│    Oct 18, 02:00 AM | 812 MB | 8m 18s                       │
│    [Details] [Download] [Verify] [Restore] [Delete]         │
└──────────────────────────────────────────────────────────────┘
```

### 17.5 🔄 Workflows

#### **Workflow 1: Automatic Monthly Backup**
```
System Scheduler (Cron) → Check config → On 1st at 02:00
  ↓
Backup Database (pg_dump) → Save + Checksum
  ↓
Backup Files (copy all uploads) → Preserve structure
  ↓
Backup Configuration → Export settings
  ↓
Compress (tar.gz) → Calculate size
  ↓
Store: Primary + Secondary + Cloud (if enabled)
  ↓
Verify: Checksums + Integrity
  ↓
Cleanup: Delete old backups per retention policy
  ↓
Send notification email → Done! ✅
```

#### **Workflow 2: Manual Backup**
```
Admin → "Create Manual Backup"
  ↓
Fill options: Name, Components, Path
  ↓
Validate: Path writable, Disk space
  ↓
Execute backup (same as auto)
  ↓
Show progress modal with live logs
  ↓
Complete → Notification + Download link
```

#### **Workflow 3: Restore from Backup**
```
Admin → Select backup → Click "Restore"
  ↓
Show WARNING modal → Require confirmation code
  ↓
Create pre-restore backup (if enabled)
  ↓
Stop services → Extract backup
  ↓
Restore Database (drop + create + pg_restore)
  ↓
Restore Files (delete + copy)
  ↓
Restore Configuration
  ↓
Verify restoration → Restart services
  ↓
Force logout all users → Redirect to login
```

### 17.6 ✅ Validation Rules

**Configuration:**
- backupPath: Required, absolute path, writable, >5GB free
- autoBackupSchedule: 'daily' | 'weekly' | 'monthly'
- retentionDays: 1-365
- maxBackupCount: 1-100
- notificationEmails: Valid format, max 10 emails

**Manual Backup:**
- backupName: Optional, 3-100 chars, alphanumeric + hyphens
- At least one component selected (database/files/config)
- Custom path must be writable if provided

**Restore:**
- Confirmation code must match: RESTORE-YYYY-MM-DD
- Backup must be verified and status 'completed'
- restoreType: 'full' | 'database-only' | 'files-only'

### 17.7 🔒 Security & Best Practices

**Security:**
- ✅ Super Admin Only access
- ✅ All actions logged in activity_logs
- ✅ Optional encryption (AES-256)
- ✅ Path validation (prevent directory traversal)
- ✅ SHA-256 checksums for integrity
- ✅ Pre-restore backup for safety

**Best Practices:**
- ✅ **3-2-1 Rule:** 3 copies, 2 storage types, 1 off-site
- ✅ Test restore quarterly
- ✅ Verify backups monthly
- ✅ Keep at least 3 monthly backups
- ✅ Monitor disk space and success rate

### 17.8 🎯 Integration Points

**With Existing Features:**
- **Settings (Feature 16):** Backup config in settings
- **Activity Logs (Feature 17):** All actions logged
- **Email Notifications (Feature 9):** Backup status emails
- **Dashboard (Feature 10):** Backup status widget

---

## 18. FEATURE 14: Technician Performance Grading System

### 18.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- ประเมินผลการทำงานของช่างเทคนิคอัตโนมัติ
- คำนวณคะแนนจากหลายตัวชี้วัด (Multi-dimensional KPIs)
- จัดอันดับและเปรียบเทียบกับทีม
- แสดง Dashboard ผลการทำงานส่วนตัว
- ให้คำแนะนำในการปรับปรุง

**ใครใช้?**
- **Technician:** ดู performance ของตัวเอง, ดูคำแนะนำปรับปรุง
- **Supervisor/IT Manager:** ดู performance ทีม, leaderboard, comparison
- **Super Admin:** ตั้งค่า weights, targets, calculate scores

**Benefits:**
- 📊 **Objective Evaluation** - ประเมินด้วยข้อมูลจริง ไม่ใช่ subjective
- 🎯 **Clear Targets** - ช่างรู้ว่าต้องปรับปรุงตรงไหน
- 🏆 **Motivation** - Gamification ด้วย grades, rankings, achievements
- 📈 **Performance Improvement** - ติดตามแนวโน้มการพัฒนา
- 💰 **Fair Compensation** - ใช้เป็นฐานในการพิจารณา bonus/incentive

### 18.2 📊 ตัวชี้วัดและน้ำหนักคะแนน (KPIs)

#### **Core Metrics (Total: 100%)**

**1. SLA Compliance (น้ำหนัก 20%)**
```
คำนวณ: (จำนวนงานทัน SLA / งานทั้งหมด) × 100

เกณฑ์:
≥ 95%  = 100 คะแนน (Excellent)
90-94% = 90 คะแนน (Very Good)
85-89% = 80 คะแนน (Good)
80-84% = 70 คะแนน (Fair)
75-79% = 60 คะแนน (Poor)
< 75%  = 50 คะแนน (Very Poor)
```

**2. Work Volume - ปริมาณงาน (น้ำหนัก 15%)**
```
คำนวณ: (จำนวนงานจริง / เป้าหมายต่อเดือน) × 100
เป้าหมาย: 60 jobs/month (configurable)

เกณฑ์:
≥ 120% = 100 คะแนน
100-119% = 90 คะแนน
80-99% = 70 คะแนน
60-79% = 50 คะแนน
< 60% = 30 คะแนน
```

**3. Resolution Time - ระยะเวลาแก้ไข (น้ำหนัก 15%)**
```
คำนวณ: (เวลามาตรฐาน / เวลาจริงเฉลี่ย) × 100

มาตรฐาน:
- Critical: ≤ 4 ชม.
- High: ≤ 8 ชม.
- Medium: ≤ 24 ชม.
- Low: ≤ 48 ชม.

เกณฑ์:
เร็วกว่า 30%+ = 100 คะแนน
เร็วกว่า 10-29% = 90 คะแนน
ตามมาตรฐาน = 80 คะแนน
ช้ากว่า 10-29% = 60 คะแนน
ช้ากว่า 30%+ = 40 คะแนน
```

**4. Response Time - เวลาเข้าถึงหน้างาน (น้ำหนัก 10%)**
```
คำนวณ: เวลาตั้งแต่ accept job จนถึง check-in

มาตรฐาน:
- Critical: ≤ 30 นาที
- High: ≤ 1 ชม.
- Medium: ≤ 2 ชม.
- Low: ≤ 4 ชม.
```

**5. First-Time Fix Rate (น้ำหนัก 15%)**
```
คำนวณ: (งานแก้สำเร็จครั้งแรก / งานทั้งหมด) × 100

เกณฑ์:
≥ 90% = 100 คะแนน
85-89% = 90 คะแนน
80-84% = 80 คะแนน
75-79% = 70 คะแนน
< 75% = 60 คะแนน
```

**6. Reopen Rate - งานถูกเปิดซ้ำ (น้ำหนัก 10%)**
```
คำนวณ: % งานที่ถูก reopen ภายใน 7 วัน
คะแนน: (100 - Reopen Rate) × 1

เกณฑ์:
≤ 3% = 100 คะแนน
4-5% = 90 คะแนน
6-7% = 80 คะแนน
8-10% = 70 คะแนน
> 10% = 60 คะแนน
```

**7. Customer Satisfaction (น้ำหนัก 15%)**
```
คำนวณ: (Rating เฉลี่ย / 5) × 100

เกณฑ์:
4.8-5.0 = 100 คะแนน
4.5-4.7 = 90 คะแนน
4.0-4.4 = 80 คะแนน
3.5-3.9 = 70 คะแนน
< 3.5 = 60 คะแนน
```

#### **Bonus Points (สูงสุด +15%)**

**8. KB Article Usage (Bonus +5%)**
```
≥ 70% งานที่ใช้ KB = +5 คะแนน
50-69% = +3 คะแนน
30-49% = +1 คะแนน
< 30% = 0 คะแนน
```

**9. Equipment Handling (Bonus/Penalty ±5%)**
```
ไม่มีอุปกรณ์เสียหาย = +5 คะแนน
เสียหาย 1 ครั้ง = 0 คะแนน
เสียหาย 2+ ครั้ง = -5 คะแนน
```

**10. Availability - เวลาออนไลน์ (Bonus +3%)**
```
≥ 95% = +3 คะแนน
90-94% = +2 คะแนน
85-89% = +1 คะแนน
< 85% = 0 คะแนน
```

**11. Documentation Quality (Bonus +2%)**
```
ครบถ้วน 100% = +2 คะแนน
ครบถ้วน 80-99% = +1 คะแนน
< 80% = 0 คะแนน
```

### 18.3 🏅 ระบบเกรด (Grading Scale)

```
A+ (95-100)  = 🌟 OUTSTANDING      - ยอดเยี่ยม
A  (90-94)   = ⭐ EXCELLENT        - ดีเยี่ยม
B+ (85-89)   = 🟢 VERY GOOD       - ดีมาก
B  (80-84)   = 🟢 GOOD            - ดี
C+ (75-79)   = 🟡 ABOVE AVERAGE   - ค่อนข้างดี
C  (70-74)   = 🟡 AVERAGE         - ปานกลาง
D  (60-69)   = 🟠 BELOW AVERAGE   - ต้องปรับปรุง
F  (< 60)    = 🔴 NEEDS IMPROVEMENT - ต้องปรับปรุงเร่งด่วน
```

### 18.4 💾 Database Tables

#### **Table: technician_performance_scores**
```sql
CREATE TABLE technician_performance_scores (
  id SERIAL PRIMARY KEY,
  technicianId INTEGER NOT NULL REFERENCES users(id),
  
  -- Period
  period VARCHAR(7) NOT NULL, -- 'YYYY-MM' format
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  
  -- Core Metrics (raw data + score)
  slaCompliance DECIMAL(5,2), -- percentage
  slaScore DECIMAL(5,2),
  
  workVolume INTEGER, -- number of jobs
  workVolumeTarget INTEGER,
  workVolumeScore DECIMAL(5,2),
  
  avgResolutionTime DECIMAL(8,2), -- hours
  resolutionTimeStandard DECIMAL(8,2),
  resolutionTimeScore DECIMAL(5,2),
  
  avgResponseTime DECIMAL(8,2), -- minutes
  responseTimeStandard DECIMAL(8,2),
  responseTimeScore DECIMAL(5,2),
  
  firstTimeFixRate DECIMAL(5,2), -- percentage
  firstTimeFixScore DECIMAL(5,2),
  
  reopenRate DECIMAL(5,2), -- percentage
  reopenScore DECIMAL(5,2),
  
  avgCustomerRating DECIMAL(3,2), -- 1.00 to 5.00
  totalRatings INTEGER,
  customerSatisfactionScore DECIMAL(5,2),
  
  -- Bonus/Penalty
  kbUsageRate DECIMAL(5,2),
  kbUsageBonus DECIMAL(5,2),
  
  equipmentDamageCount INTEGER,
  equipmentHandlingBonus DECIMAL(5,2),
  
  availabilityRate DECIMAL(5,2),
  availabilityBonus DECIMAL(5,2),
  
  documentationQualityRate DECIMAL(5,2),
  documentationBonus DECIMAL(5,2),
  
  totalBonusPoints DECIMAL(5,2),
  
  -- Final Score & Grade
  totalScore DECIMAL(5,2), -- 0-100+
  grade VARCHAR(2), -- 'A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'
  gradeDescription VARCHAR(50), -- 'OUTSTANDING', 'EXCELLENT', etc.
  
  -- Ranking
  teamRanking INTEGER,
  totalTechnicians INTEGER,
  
  -- Comparison
  teamAvgScore DECIMAL(5,2),
  topPerformerScore DECIMAL(5,2),
  
  -- Metadata
  isCalculated BOOLEAN DEFAULT false,
  calculatedAt TIMESTAMP,
  calculatedBy INTEGER REFERENCES users(id),
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(technicianId, period)
);

CREATE INDEX idx_perf_tech_period ON technician_performance_scores(technicianId, period);
CREATE INDEX idx_perf_period ON technician_performance_scores(period);
CREATE INDEX idx_perf_grade ON technician_performance_scores(grade);
CREATE INDEX idx_perf_ranking ON technician_performance_scores(teamRanking);
CREATE INDEX idx_perf_score ON technician_performance_scores(totalScore DESC);
```

### 18.5 🔌 API Endpoints

#### **Performance Metrics**

```typescript
// Get current month performance for technician
GET /api/technicians/:id/performance/current

Response:
{
  "technicianId": 15,
  "technicianName": "John Smith",
  "period": "2025-11",
  "overallScore": 92.5,
  "grade": "A",
  "gradeDescription": "EXCELLENT",
  "ranking": 3,
  "totalTechnicians": 45,
  "trend": {
    "change": 3.5,
    "direction": "up"
  },
  "metrics": {
    "slaCompliance": {
      "value": 95.5,
      "score": 95,
      "weight": 20,
      "target": 95,
      "teamAvg": 89.2,
      "status": "exceeds"
    },
    "workVolume": {
      "value": 72,
      "target": 60,
      "percentage": 120,
      "score": 100,
      "weight": 15,
      "teamAvg": 58
    },
    "resolutionTime": {
      "value": 2.1,
      "standard": 2.5,
      "score": 92,
      "weight": 15,
      "improvement": "16% faster"
    },
    "responseTime": {
      "value": 45,
      "standard": 50,
      "score": 88,
      "weight": 10
    },
    "firstTimeFixRate": {
      "value": 88.5,
      "score": 90,
      "weight": 15,
      "target": 90
    },
    "reopenRate": {
      "value": 5.0,
      "score": 95,
      "weight": 10,
      "target": 5
    },
    "customerSatisfaction": {
      "rating": 4.7,
      "totalRatings": 156,
      "score": 94,
      "weight": 15,
      "distribution": {
        "5": 78,
        "4": 62,
        "3": 12,
        "2": 3,
        "1": 1
      }
    }
  },
  "bonusPoints": {
    "kbUsage": 5,
    "equipmentHandling": 5,
    "availability": 3,
    "documentation": 2,
    "total": 15
  },
  "improvements": [
    {
      "metric": "firstTimeFixRate",
      "current": 88.5,
      "target": 90,
      "gap": 1.5,
      "priority": "high",
      "recommendation": "Focus on Network troubleshooting"
    }
  ],
  "achievements": [
    "Volume Champion",
    "Speed Demon",
    "KB Master"
  ]
}

// Get performance history (multiple months)
GET /api/technicians/:id/performance/history
Query: months=6

Response:
{
  "technicianId": 15,
  "history": [
    {
      "period": "2025-11",
      "score": 92.5,
      "grade": "A",
      "ranking": 3
    },
    {
      "period": "2025-10",
      "score": 89.0,
      "grade": "B+",
      "ranking": 5
    }
  ],
  "trend": {
    "improvement": 3.5,
    "direction": "improving"
  }
}

// Get metric details
GET /api/technicians/:id/performance/metrics/:metricName
Query: period=2025-11

Response:
{
  "metricName": "slaCompliance",
  "period": "2025-11",
  "value": 95.5,
  "score": 95,
  "breakdown": {
    "metSLA": 191,
    "missedSLA": 9,
    "total": 200
  },
  "byPriority": {
    "critical": { "met": 48, "total": 50, "rate": 96.0 },
    "high": { "met": 58, "total": 60, "rate": 96.7 },
    "medium": { "met": 65, "total": 70, "rate": 92.9 },
    "low": { "met": 20, "total": 20, "rate": 100.0 }
  },
  "teamAvg": 89.2,
  "topPerformer": 98.1
}

// Get comparison with team
GET /api/technicians/:id/performance/comparison
Query: period=2025-11

Response:
{
  "technician": {
    "id": 15,
    "name": "John Smith",
    "score": 92.5,
    "grade": "A"
  },
  "teamAverage": {
    "score": 85.3,
    "grade": "B+"
  },
  "topPerformer": {
    "id": 23,
    "name": "Mike Johnson",
    "score": 96.2,
    "grade": "A+"
  },
  "comparison": {
    "slaCompliance": { "you": 95.5, "team": 89.2, "top": 98.1 },
    "workVolume": { "you": 72, "team": 58, "top": 78 },
    "resolutionTime": { "you": 2.1, "team": 2.8, "top": 1.8 },
    "customerRating": { "you": 4.7, "team": 4.3, "top": 4.9 }
  }
}
```

#### **Team Performance & Leaderboard**

```typescript
// Get team leaderboard
GET /api/technicians/performance/leaderboard
Query: period=2025-11, limit=10, offset=0

Response:
{
  "period": "2025-11",
  "leaderboard": [
    {
      "rank": 1,
      "technicianId": 23,
      "name": "Mike Johnson",
      "score": 96.2,
      "grade": "A+",
      "change": "+1.2",
      "avatar": "/avatars/tech-23.jpg"
    },
    {
      "rank": 2,
      "technicianId": 8,
      "name": "Sarah Williams",
      "score": 94.8,
      "grade": "A+",
      "change": "+0.5"
    },
    {
      "rank": 3,
      "technicianId": 15,
      "name": "John Smith",
      "score": 92.5,
      "grade": "A",
      "change": "+3.5"
    }
  ],
  "total": 45
}

// Get team statistics
GET /api/technicians/performance/team-stats
Query: period=2025-11

Response:
{
  "period": "2025-11",
  "totalTechnicians": 45,
  "averageScore": 85.3,
  "gradeDistribution": {
    "A+": 2,
    "A": 8,
    "B+": 12,
    "B": 15,
    "C+": 5,
    "C": 2,
    "D": 1,
    "F": 0
  },
  "topMetrics": {
    "highestSLA": { "techId": 23, "value": 98.1 },
    "highestVolume": { "techId": 8, "value": 78 },
    "fastestResolution": { "techId": 23, "value": 1.8 },
    "highestRating": { "techId": 8, "value": 4.9 }
  }
}
```

#### **Admin - Score Calculation**

```typescript
// Calculate performance for specific period (Admin only)
POST /api/technicians/performance/calculate
Body: { period: "2025-11", technicianIds: [1,2,3] } // or null for all

Response:
{
  "success": true,
  "period": "2025-11",
  "calculated": 45,
  "failed": 0,
  "message": "Performance scores calculated successfully"
}

// Get calculation settings (weights, targets)
GET /api/technicians/performance/settings

Response:
{
  "weights": {
    "slaCompliance": 20,
    "workVolume": 15,
    "resolutionTime": 15,
    "responseTime": 10,
    "firstTimeFixRate": 15,
    "reopenRate": 10,
    "customerSatisfaction": 15
  },
  "targets": {
    "workVolumeMonthly": 60,
    "slaComplianceMin": 95,
    "firstTimeFixMin": 90,
    "reopenRateMax": 5,
    "resolutionTimeStandards": {
      "critical": 4,
      "high": 8,
      "medium": 24,
      "low": 48
    }
  },
  "bonusSettings": {
    "kbUsageMin": 70,
    "availabilityMin": 95
  }
}

// Update calculation settings (Super Admin only)
PUT /api/technicians/performance/settings
Body: { weights: {...}, targets: {...} }
```

### 18.6 🎨 UI Layouts

#### **Technician Performance Dashboard**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 👤 John Smith - Performance Dashboard    [This Month ▼]            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 🏆 OVERALL GRADE                                                    │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │          ⭐ GRADE: A (EXCELLENT)                             │   │
│ │          Score: 92.5 / 100                                   │   │
│ │          [███████████████████░░] 92.5%                      │   │
│ │                                                              │   │
│ │  📈 +3.5 pts from last month                                │   │
│ │  🏆 Rank: #3 / 45 technicians                               │   │
│ │  🎯 To A+: Need +2.5 points                                 │   │
│ └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│ 📊 PERFORMANCE BREAKDOWN                                            │
│                                                                      │
│ 🎯 SLA Compliance (20%)        Score: 95/100  [███████████████░]  │
│    Your: 95.5% | Team: 89.2% | Target: 95% ✅                     │
│                                                                      │
│ 📦 Work Volume (15%)           Score: 100/100 [████████████████]   │
│    Your: 72 jobs (120%) | Target: 60 jobs 🔥                       │
│                                                                      │
│ ⏱️ Resolution Time (15%)       Score: 92/100  [██████████████░░]  │
│    Your: 2.1 hrs | Standard: 2.5 hrs (16% faster) ⚡              │
│                                                                      │
│ 🚗 Response Time (10%)         Score: 88/100  [█████████████░░░]  │
│    Your: 45 mins | Standard: 50 mins                               │
│                                                                      │
│ 🔧 First-Time Fix (15%)        Score: 90/100  [██████████████░░]  │
│    Your: 88.5% | Target: 90% (Need +1.5%)                          │
│                                                                      │
│ 🔄 Reopen Rate (10%)           Score: 95/100  [███████████████░]  │
│    Your: 5.0% | Target: ≤5% ✅                                     │
│                                                                      │
│ ⭐ Customer Rating (15%)       Score: 94/100  [██████████████░░]  │
│    Your: 4.7/5 (156 ratings) | Team: 4.3/5                         │
│                                                                      │
│ 🎁 BONUS POINTS: +15                                                │
│ • KB Usage: +5 | Equipment: +5 | Availability: +3 | Docs: +2       │
│                                                                      │
│ 🎯 IMPROVEMENT OPPORTUNITIES                                        │
│ • First-Time Fix: 88.5% → 90% (Focus: Network troubleshooting)     │
│ • Response Time: Critical jobs (38 mins → 30 mins)                 │
│                                                                      │
│ 🏆 ACHIEVEMENTS THIS MONTH                                          │
│ 🥇 Volume Champion | ⚡ Speed Demon | 📚 KB Master                  │
│                                                                      │
│ [View Detailed History] [Compare with Team] [View Leaderboard]     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 18.7 🔄 Workflows

#### **Workflow 1: Monthly Score Calculation (Automated)**
```
End of month (1st of next month at 02:00 AM):
  ↓
Cron job triggers score calculation
  ↓
For each technician:
  ↓
  Collect data from past month:
    - Count incidents by status
    - Calculate SLA compliance
    - Calculate avg resolution/response time
    - Count first-time fixes
    - Count reopened incidents
    - Get average rating
    - Check KB usage rate
    - Check equipment damage records
    - Calculate availability
    - Check documentation quality
  ↓
  Calculate scores for each metric:
    - Apply formulas
    - Compare with standards/targets
    - Calculate weighted scores
  ↓
  Calculate bonus points
  ↓
  Calculate total score (0-115)
  ↓
  Assign grade (A+, A, B+, etc.)
  ↓
  Calculate team ranking
  ↓
  Save to technician_performance_scores table
  ↓
Send notification email to technician:
  - Your grade: A
  - Your score: 92.5
  - Ranking: #3 / 45
  - View detailed report
  ↓
Done! ✅
```

#### **Workflow 2: Technician Views Performance**
```
Technician logs in
  ↓
Dashboard shows performance widget:
  - Current grade
  - Score
  - Ranking
  ↓
Click "View Performance"
  ↓
Shows detailed breakdown:
  - Each metric with score
  - Comparison with team
  - Trend graph (6 months)
  - Improvement suggestions
  - Achievements
  ↓
Can drill down into specific metric:
  - See detailed breakdown
  - See incidents that affected score
  - See recommendations
```

#### **Workflow 3: Manager Reviews Team Performance**
```
Manager/Supervisor logs in
  ↓
Views leaderboard:
  - Top 10 performers
  - Grade distribution
  - Team average
  ↓
Can filter/sort:
  - By grade
  - By specific metric
  - By improvement trend
  ↓
Click on individual technician:
  - See detailed performance
  - See comparison with team
  - See historical trend
  ↓
Can export report (PDF/Excel)
```

### 18.8 ✅ Validation Rules

**Score Calculation:**
- Period must be valid YYYY-MM format
- All metrics must be calculated before assigning grade
- Scores must be 0-100 (bonus can exceed 100)
- Grade must match score range

**Data Requirements:**
- Minimum 10 completed jobs to calculate performance
- At least 5 ratings for customer satisfaction score
- If insufficient data, mark as "Insufficient Data" instead of grade

**Access Control:**
- Technicians can only view their own performance
- Supervisors can view team performance
- Only Super Admin can modify settings/weights

### 18.9 🎯 Integration Points

**With Existing Features:**
- **Incidents (Feature 2):** Source data for all metrics
- **SLA Management (Feature 11):** SLA compliance calculation
- **Rating System (Feature 8):** Customer satisfaction scores
- **Knowledge Base (Feature 12):** KB usage tracking
- **Dashboard (Feature 10):** Performance widgets
- **Equipment (Feature 4):** Equipment damage tracking
- **Activity Logs:** Availability/online time tracking

---

## 19. FEATURE 15: Reassignment System

### 19.1 📋 Overview & Objectives

**Purpose:**  
ระบบ Reassignment ช่วยให้สามารถมอบหมายงาน (Incident) ที่กำลังดำเนินการอยู่ให้กับช่างคนใหม่ได้ เมื่อช่างคนเดิมไม่สามารถทำงานต่อได้ด้วยเหตุผลต่างๆ

**เมื่อไหร่ต้องใช้ Reassignment?**
- 🔄 ช่างลาป่วย/ลาฉุกเฉิน
- 🔄 ช่างไม่สามารถแก้ปัญหาได้ (ต้องการความเชี่ยวชาญเฉพาะ)
- 🔄 ช่างมีงานล้น/ไม่มีเวลา
- 🔄 ช่างอยู่ไกลจากสถานที่เกินไป
- 🔄 ปัญหาเปลี่ยนแปลง ต้องการช่างที่มีทักษะอื่น

**เป้าหมาย:**
- ✅ ลดเวลาในการแก้ปัญหา (Minimize downtime)
- ✅ ป้องกัน Incident ค้างนาน
- ✅ เพิ่มความยืดหยุ่นในการจัดการทีม
- ✅ มี Audit Trail ที่ชัดเจน (ใครทำอะไร เมื่อไหร่ ทำไม)

**สิทธิ์การใช้งาน (Permission):**
| Role | Reassign ได้? | เหตุผล |
|------|:-------------:|--------|
| **Super Admin** | ❌ | ไม่ทำงานปฏิบัติการ (ตามนโยบาย) |
| **IT Manager** | ✅ | จัดการทรัพยากรทั้งหมด |
| **Help Desk** | ✅ | Coordinate งานทั้งหมด |
| **Supervisor** | ✅ | จัดการทีมช่างของตัวเอง |
| **Finance Admin** | ❌ | ไม่เกี่ยวข้องกับ operation |
| **Technician** | ❌ | ไม่สามารถส่งต่องานเองได้ (ป้องกันทุจริต) |
| **End User** | ❌ | ไม่มีสิทธิ์จัดการช่าง |
| **Read Only** | ❌ | ดูอย่างเดียว |

---

### 19.2 🗄️ Database Schema

#### Table: `incident_reassignments`

**Purpose:** บันทึกประวัติการ Reassign งานทั้งหมด

```sql
CREATE TABLE incident_reassignments (
  id SERIAL PRIMARY KEY,
  
  -- Incident Information
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  
  -- Technician Changes
  from_technician_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  to_technician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Reassignment Details
  reason TEXT NOT NULL,                          -- เหตุผลในการ Reassign (required)
  reassigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reassigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Status Tracking
  status VARCHAR(20) DEFAULT 'pending',          -- pending, accepted, rejected
  response_note TEXT,                            -- คำตอบจากช่างคนใหม่ (ถ้ามี)
  responded_at TIMESTAMP,                        -- เวลาที่ช่างตอบรับ/ปฏิเสธ
  
  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_incident_reassignments_incident (incident_id),
  INDEX idx_incident_reassignments_from_tech (from_technician_id),
  INDEX idx_incident_reassignments_to_tech (to_technician_id),
  INDEX idx_incident_reassignments_date (reassigned_at)
);
```

**Field Descriptions:**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| `incident_id` | INTEGER | Incident ที่ต้องการ Reassign | NOT NULL, FK |
| `from_technician_id` | INTEGER | ช่างคนเดิม (อาจเป็น NULL ถ้ายังไม่เคยมีช่าง) | NULL OK, FK |
| `to_technician_id` | INTEGER | ช่างคนใหม่ | NOT NULL, FK |
| `reason` | TEXT | เหตุผลที่ Reassign | NOT NULL, ต้องระบุ |
| `reassigned_by` | INTEGER | ใครเป็นคน Reassign | NOT NULL, FK |
| `status` | VARCHAR(20) | สถานะ: pending, accepted, rejected | Default: pending |
| `response_note` | TEXT | หมายเหตุจากช่างคนใหม่ | Optional |
| `responded_at` | TIMESTAMP | เวลาที่ช่างตอบรับ/ปฏิเสธ | Auto-set |

**Business Rules:**
1. ✅ **Incident ต้องอยู่ในสถานะ `assigned` หรือ `in_progress` เท่านั้น**
   - ไม่สามารถ Reassign งานที่ `pending`, `completed`, `cancelled`
   
2. ✅ **ช่างคนใหม่ต้องมี Role เป็น `Technician`**
   - ไม่สามารถ Reassign ให้ Help Desk, Supervisor, End User
   
3. ✅ **ช่างคนใหม่ต้อง Active**
   - ไม่สามารถ Reassign ให้ช่างที่ถูก Disabled
   
4. ✅ **ไม่สามารถ Reassign ให้ช่างคนเดิม**
   - `to_technician_id` ต้องไม่เท่ากับ `from_technician_id`
   
5. ✅ **เหตุผล (reason) ต้องระบุเสมอ**
   - ความยาวอย่างน้อย 10 ตัวอักษร
   
6. ✅ **Auto-update Incident Status**
   - เมื่อ Reassign → Incident.status = 'assigned'
   - เมื่อ Reassign → Incident.technician_id = to_technician_id
   - เมื่อ Reassign → Incident.assigned_at = CURRENT_TIMESTAMP

---

### 19.3 🔌 API Endpoints

#### 1. **POST /api/incidents/:id/reassign**
**Purpose:** Reassign Incident ให้ช่างคนใหม่

**Permission:** IT Manager, Help Desk, Supervisor

**Request:**
```typescript
POST /api/incidents/123/reassign
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "toTechnicianId": 45,
  "reason": "ช่างคนเดิมลาป่วยฉุกเฉิน ไม่สามารถออกสถานที่ได้"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Reassigned successfully",
  "data": {
    "reassignmentId": 789,
    "incidentId": 123,
    "incidentTicketNumber": "WAT25110123",
    "fromTechnician": {
      "id": 32,
      "firstName": "สมชาย",
      "lastName": "ใจดี",
      "email": "somchai@example.com"
    },
    "toTechnician": {
      "id": 45,
      "firstName": "วิชัย",
      "lastName": "มั่นคง",
      "email": "wichai@example.com"
    },
    "reason": "ช่างคนเดิมลาป่วยฉุกเฉิน ไม่สามารถออกสถานที่ได้",
    "reassignedBy": {
      "id": 12,
      "firstName": "สุดา",
      "lastName": "ศรีสุข",
      "role": "Help Desk"
    },
    "reassignedAt": "2025-11-18T14:30:00Z",
    "status": "pending"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "INVALID_STATUS",
  "message": "Cannot reassign incident with status 'completed'"
}
```

**Response (Error - 403):**
```json
{
  "success": false,
  "error": "PERMISSION_DENIED",
  "message": "Super Admin cannot perform operational tasks"
}
```

**Validation Rules:**
- ✅ Incident must exist
- ✅ Incident status must be `assigned` or `in_progress`
- ✅ `toTechnicianId` must exist and be active Technician
- ✅ `toTechnicianId` must not equal current technician
- ✅ `reason` must be at least 10 characters
- ✅ User must have permission (IT Manager, Help Desk, Supervisor)

**Side Effects:**
1. Insert record to `incident_reassignments`
2. Update `incidents.technician_id` = toTechnicianId
3. Update `incidents.status` = 'assigned'
4. Update `incidents.assigned_at` = CURRENT_TIMESTAMP
5. Create activity log entry
6. Send email notification to new technician
7. Send email notification to old technician (if exists)

---

#### 2. **GET /api/incidents/:id/reassignments**
**Purpose:** ดูประวัติการ Reassign ของ Incident

**Permission:** IT Manager, Help Desk, Supervisor, Technician (ถ้าเป็นงานของตัวเอง)

**Request:**
```typescript
GET /api/incidents/123/reassignments
Authorization: Bearer <jwt_token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "incidentId": 123,
    "ticketNumber": "WAT25110123",
    "totalReassignments": 2,
    "reassignments": [
      {
        "id": 789,
        "fromTechnician": {
          "id": 32,
          "firstName": "สมชาย",
          "lastName": "ใจดี",
          "profileImage": "/uploads/profiles/32.jpg"
        },
        "toTechnician": {
          "id": 45,
          "firstName": "วิชัย",
          "lastName": "มั่นคง",
          "profileImage": "/uploads/profiles/45.jpg"
        },
        "reason": "ช่างคนเดิมลาป่วยฉุกเฉิน",
        "reassignedBy": {
          "id": 12,
          "firstName": "สุดา",
          "lastName": "ศรีสุข",
          "role": "Help Desk"
        },
        "reassignedAt": "2025-11-18T14:30:00Z",
        "status": "accepted",
        "responseNote": "รับทราบครับ จะไปให้ทันครับ",
        "respondedAt": "2025-11-18T14:35:00Z"
      },
      {
        "id": 788,
        "fromTechnician": null,
        "toTechnician": {
          "id": 32,
          "firstName": "สมชาย",
          "lastName": "ใจดี"
        },
        "reason": "มอบหมายงานครั้งแรก",
        "reassignedBy": {
          "id": 8,
          "firstName": "นภา",
          "lastName": "วงศ์ดี",
          "role": "Supervisor"
        },
        "reassignedAt": "2025-11-18T09:00:00Z",
        "status": "accepted",
        "responseNote": null,
        "respondedAt": "2025-11-18T09:05:00Z"
      }
    ]
  }
}
```

---

#### 3. **GET /api/reassignments/my-reassigned**
**Purpose:** Technician ดูงานที่ถูก Reassign ให้ตัวเอง (งานใหม่ที่ได้รับ)

**Permission:** Technician only

**Request:**
```typescript
GET /api/reassignments/my-reassigned?status=pending&limit=20
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `status` (optional): pending, accepted, rejected, all (default: all)
- `limit` (optional): จำนวน records (default: 20)
- `offset` (optional): pagination offset (default: 0)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "limit": 20,
    "offset": 0,
    "reassignments": [
      {
        "id": 789,
        "incident": {
          "id": 123,
          "ticketNumber": "WAT25110123",
          "title": "เครื่อง POS ไม่ทำงาน",
          "description": "เครื่อง POS สาขาสีลม ไม่สามารถเปิดเครื่องได้",
          "priority": "high",
          "status": "assigned",
          "store": {
            "id": 5,
            "storeCode": "BKK-001",
            "storeName": "วัตสัน สีลม"
          }
        },
        "fromTechnician": {
          "id": 32,
          "firstName": "สมชาย",
          "lastName": "ใจดี"
        },
        "reason": "ช่างคนเดิมลาป่วยฉุกเฉิน",
        "reassignedBy": {
          "id": 12,
          "firstName": "สุดา",
          "lastName": "ศรีสุข",
          "role": "Help Desk"
        },
        "reassignedAt": "2025-11-18T14:30:00Z",
        "status": "pending",
        "responseNote": null,
        "respondedAt": null
      }
    ]
  }
}
```

---

#### 4. **POST /api/reassignments/:id/respond**
**Purpose:** Technician ตอบรับ/ปฏิเสธ งานที่ถูก Reassign มา

**Permission:** Technician only (และต้องเป็นงานที่ Reassign ให้ตัวเอง)

**Request:**
```typescript
POST /api/reassignments/789/respond
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "status": "accepted",
  "responseNote": "รับทราบครับ จะไปให้ทันครับ"
}
```

**Request Body:**
- `status`: "accepted" หรือ "rejected" (required)
- `responseNote`: ข้อความตอบกลับ (optional, แต่ recommended)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Response recorded successfully",
  "data": {
    "reassignmentId": 789,
    "status": "accepted",
    "responseNote": "รับทราบครับ จะไปให้ทันครับ",
    "respondedAt": "2025-11-18T14:35:00Z"
  }
}
```

**Business Rules:**
- ✅ เฉพาะช่างที่ถูก Reassign มาเท่านั้นที่ตอบได้
- ✅ ตอบได้เฉพาะ status = "pending" เท่านั้น
- ✅ ถ้าปฏิเสธ (rejected) ต้องระบุ `responseNote` บอกเหตุผล

---

#### 5. **GET /api/reassignments/stats**
**Purpose:** สถิติการ Reassign (สำหรับ Dashboard)

**Permission:** IT Manager, Supervisor

**Request:**
```typescript
GET /api/reassignments/stats?period=30
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `period` (optional): จำนวนวันย้อนหลัง (default: 30)

**Response (Success - 200):**
```json
{
  "success": true,
  "data": {
    "period": 30,
    "totalReassignments": 45,
    "avgReassignmentsPerIncident": 1.2,
    "byStatus": {
      "pending": 5,
      "accepted": 38,
      "rejected": 2
    },
    "topReasons": [
      {
        "reason": "ช่างลาป่วย",
        "count": 12
      },
      {
        "reason": "ช่างไม่มีเวลา",
        "count": 8
      },
      {
        "reason": "ต้องการความเชี่ยวชาญเฉพาะ",
        "count": 6
      }
    ],
    "topReassignedTechnicians": [
      {
        "technicianId": 45,
        "technicianName": "วิชัย มั่นคง",
        "receivedCount": 8
      }
    ],
    "avgResponseTime": "00:15:30"
  }
}
```

---

### 19.4 🎨 UI Components

#### 1. **Reassignment Button (Incident Detail Page)**

**Location:** Incident Detail Page → Actions Panel

**Visibility Rules:**
- Show only if user has permission (IT Manager, Help Desk, Supervisor)
- Show only if incident status = `assigned` or `in_progress`
- Hide if user is Super Admin

**UI Mockup:**
```
┌─────────────────────────────────────────────────────┐
│ Incident #WAT25110123                               │
│ Status: [Assigned]    Priority: [High]              │
├─────────────────────────────────────────────────────┤
│ Current Technician: สมชาย ใจดี                      │
│                                                     │
│ [Reassign Incident] [View History] [Close Incident]│
└─────────────────────────────────────────────────────┘
```

---

#### 2. **Reassignment Modal**

**Trigger:** Click "Reassign Incident" button

**UI Mockup:**
```
┌──────────────────────────────────────────────────────┐
│  🔄 Reassign Incident                        [X]     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Current Technician:                                 │
│  ┌──────────────────────────────────────────────┐   │
│  │ 👤 สมชาย ใจดี                               │   │
│  │    somchai@example.com                       │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Select New Technician: *                            │
│  ┌────────────────────────────────────────────▼─┐   │
│  │ Search technician...                         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  📋 Technician List:                                 │
│  ┌──────────────────────────────────────────────┐   │
│  │ ○ วิชัย มั่นคง                              │   │
│  │   Available | 5 active jobs | Rating: 4.5★  │   │
│  ├──────────────────────────────────────────────┤   │
│  │ ○ สมหญิง รุ่งเรือง                           │   │
│  │   Available | 3 active jobs | Rating: 4.8★  │   │
│  ├──────────────────────────────────────────────┤   │
│  │ ○ ประวิทย์ เก่งกาจ                          │   │
│  │   Busy | 12 active jobs | Rating: 4.2★      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Reason for Reassignment: *                          │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  │                                              │   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│  (Minimum 10 characters)                             │
│                                                      │
│  ⚠️ Warning:                                         │
│  - Incident status will be changed to "Assigned"    │
│  - Old technician will be notified                  │
│  - New technician will receive notification         │
│                                                      │
│        [Cancel]              [Confirm Reassign]     │
└──────────────────────────────────────────────────────┘
```

**Form Fields:**
1. **Current Technician** (Display only)
   - Show name, email, profile image
   
2. **Select New Technician** (Required)
   - Searchable dropdown
   - Show technician info:
     - Name
     - Availability status (Available, Busy, Offline)
     - Active job count
     - Rating score
   - Sort by: Available first, then by active job count (ascending)
   
3. **Reason** (Required)
   - Text area
   - Min: 10 characters
   - Max: 500 characters
   - Placeholder: "เช่น: ช่างลาป่วย, ต้องการความเชี่ยวชาญเฉพาะด้าน"

**Validation:**
- ✅ New technician must be selected
- ✅ Reason must be at least 10 characters
- ✅ Cannot select same technician as current

---

#### 3. **Reassignment History Timeline**

**Location:** Incident Detail Page → "History" Tab

**UI Mockup:**
```
┌──────────────────────────────────────────────────────┐
│  📜 Reassignment History                             │
├──────────────────────────────────────────────────────┤
│                                                      │
│  🔵────────────────────────────────────────────────  │
│   │                                                  │
│   │ 18 Nov 2025, 14:30                              │
│   │ Reassigned by: สุดา ศรีสุข (Help Desk)         │
│   │                                                  │
│   │ From: สมชาย ใจดี                                │
│   │ To:   วิชัย มั่นคง                              │
│   │                                                  │
│   │ Reason: ช่างคนเดิมลาป่วยฉุกเฉิน               │
│   │                                                  │
│   │ Status: ✅ Accepted (14:35)                     │
│   │ Response: "รับทราบครับ จะไปให้ทันครับ"         │
│   │                                                  │
│  🔵────────────────────────────────────────────────  │
│   │                                                  │
│   │ 18 Nov 2025, 09:00                              │
│   │ Assigned by: นภา วงศ์ดี (Supervisor)           │
│   │                                                  │
│   │ To: สมชาย ใจดี                                  │
│   │                                                  │
│   │ Reason: มอบหมายงานครั้งแรก                     │
│   │                                                  │
│   │ Status: ✅ Accepted (09:05)                     │
│   │                                                  │
│  🔵────────────────────────────────────────────────  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Display Rules:**
- Show latest on top (reverse chronological)
- Color code status:
  - 🟢 Green = Accepted
  - 🟡 Yellow = Pending
  - 🔴 Red = Rejected
- Show response note if available

---

#### 4. **Technician Dashboard - Reassigned Jobs Widget**

**Location:** Technician Dashboard (Main Page)

**UI Mockup:**
```
┌──────────────────────────────────────────────────────┐
│  🔔 งานที่ถูก Reassign ให้คุณ               [View All]│
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🔴 WAT25110123 - เครื่อง POS ไม่ทำงาน        │ │
│  │    Reassigned from: สมชาย ใจดี                │ │
│  │    Reason: ช่างลาป่วยฉุกเฉิน                 │ │
│  │    By: สุดา ศรีสุข (Help Desk)                │ │
│  │    14:30 Today                                 │ │
│  │                                                │ │
│  │    [Accept] [Reject]                           │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ 🟡 WAT25110089 - Router ไม่มี Internet       │ │
│  │    Reassigned from: ประวิทย์ เก่งกาจ          │ │
│  │    Reason: ต้องการช่างเชี่ยวชาญ Network      │ │
│  │    By: นภา วงศ์ดี (Supervisor)                │ │
│  │    11:20 Today                                 │ │
│  │                                                │ │
│  │    [Accept] [Reject]                           │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Features:**
- Show pending reassignments only
- Sort by: Latest first
- Click [Accept]/[Reject] → Show response modal
- Badge count on widget header

---

#### 5. **Response Modal (Technician)**

**Trigger:** Click "Accept" or "Reject" button

**UI Mockup:**
```
┌──────────────────────────────────────────────────────┐
│  ✅ Accept Reassigned Job?                   [X]     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Job: #WAT25110123 - เครื่อง POS ไม่ทำงาน          │
│  Store: วัตสัน สีลม                                 │
│  Priority: High                                      │
│                                                      │
│  Original Technician: สมชาย ใจดี                    │
│  Reason: ช่างคนเดิมลาป่วยฉุกเฉิน                   │
│                                                      │
│  Your Response (Optional):                           │
│  ┌──────────────────────────────────────────────┐   │
│  │ รับทราบครับ จะไปให้ทันครับ                 │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│        [Cancel]                  [Confirm Accept]   │
└──────────────────────────────────────────────────────┘

หรือถ้า Reject:

┌──────────────────────────────────────────────────────┐
│  ❌ Reject Reassigned Job?                   [X]     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Job: #WAT25110123 - เครื่อง POS ไม่ทำงาน          │
│  Store: วัตสัน สีลม                                 │
│  Priority: High                                      │
│                                                      │
│  Please provide reason for rejection: *              │
│  ┌──────────────────────────────────────────────┐   │
│  │ ขณะนี้มีงานล้น ไม่สามารถรับงานเพิ่มได้     │   │
│  └──────────────────────────────────────────────┘   │
│  (Required for rejection)                            │
│                                                      │
│  ⚠️ This job will need to be reassigned to another  │
│     technician.                                      │
│                                                      │
│        [Cancel]                  [Confirm Reject]   │
└──────────────────────────────────────────────────────┘
```

**Validation:**
- ✅ Accept: Response note is optional
- ✅ Reject: Response note is **required** (min 10 characters)

---

### 19.5 📋 Workflows

#### Workflow 1: Reassign Incident (Supervisor/Help Desk)

```
1. Supervisor เข้าหน้า Incident Detail
   ├─ เห็นว่า Incident status = "assigned" 
   └─ Current technician = "สมชาย ใจดี"

2. Click [Reassign Incident] button
   └─ Open Reassignment Modal

3. Fill form:
   ├─ เลือกช่างคนใหม่: "วิชัย มั่นคง"
   ├─ พิมพ์เหตุผล: "ช่างคนเดิมลาป่วยฉุกเฉิน ไม่สามารถออกสถานที่ได้"
   └─ Click [Confirm Reassign]

4. System validates:
   ├─ ✅ ช่างใหม่ต้องเป็น Technician (active)
   ├─ ✅ ช่างใหม่ ≠ ช่างเดิม
   ├─ ✅ Incident status = assigned/in_progress
   └─ ✅ เหตุผล >= 10 characters

5. System updates:
   ├─ INSERT INTO incident_reassignments
   ├─ UPDATE incidents SET technician_id = 45, status = 'assigned', assigned_at = NOW()
   ├─ INSERT INTO activity_logs (reassignment event)
   └─ Return success response

6. System notifications:
   ├─ Send email to "วิชัย มั่นคง" (ช่างคนใหม่)
   │   Subject: "คุณได้รับมอบหมายงานใหม่ #WAT25110123"
   │   Body: รายละเอียดงาน + เหตุผล + Link
   │
   └─ Send email to "สมชาย ใจดี" (ช่างเดิม)
       Subject: "งาน #WAT25110123 ถูก Reassign"
       Body: แจ้งว่างานถูกส่งต่อ + เหตุผล

7. UI updates:
   ├─ Close modal
   ├─ Refresh incident detail page
   ├─ Show success toast: "Reassigned successfully"
   └─ Update technician info on page
```

---

#### Workflow 2: Technician รับงานที่ถูก Reassign

```
1. ช่าง "วิชัย มั่นคง" เปิด Dashboard
   └─ เห็น Widget "งานที่ถูก Reassign ให้คุณ"
   └─ มี Badge สีแดง: "1"

2. เห็นรายการ:
   ┌─────────────────────────────────────────┐
   │ WAT25110123 - เครื่อง POS ไม่ทำงาน     │
   │ From: สมชาย ใจดี                        │
   │ Reason: ช่างลาป่วยฉุกเฉิน              │
   │ [Accept] [Reject]                       │
   └─────────────────────────────────────────┘

3. Click [Accept]
   └─ Open Response Modal

4. พิมพ์หมายเหตุ: "รับทราบครับ จะไปให้ทันครับ"
   └─ Click [Confirm Accept]

5. System updates:
   ├─ UPDATE incident_reassignments 
   │   SET status = 'accepted', 
   │       response_note = '...', 
   │       responded_at = NOW()
   │
   └─ INSERT INTO activity_logs

6. System notifications:
   └─ Send email to Supervisor (ผู้ Reassign)
       Subject: "ช่าง วิชัย มั่นคง ตอบรับงาน #WAT25110123"
       Body: รายละเอียด + คำตอบ

7. UI updates:
   ├─ Remove from pending list
   ├─ Show success toast: "Job accepted"
   └─ Add to "My Active Jobs" list
```

---

#### Workflow 3: Technician ปฏิเสธงานที่ถูก Reassign

```
1. ช่าง "วิชัย มั่นคง" Click [Reject]
   └─ Open Response Modal (Reject mode)

2. ต้องระบุเหตุผล:
   "ขณะนี้มีงานล้น ไม่สามารถรับงานเพิ่มได้"
   └─ Click [Confirm Reject]

3. System validates:
   └─ ✅ response_note required (min 10 chars)

4. System updates:
   ├─ UPDATE incident_reassignments 
   │   SET status = 'rejected', 
   │       response_note = '...', 
   │       responded_at = NOW()
   │
   └─ INSERT INTO activity_logs

5. System notifications:
   └─ Send email to Supervisor (ผู้ Reassign)
       Subject: "⚠️ ช่าง วิชัย มั่นคง ปฏิเสธงาน #WAT25110123"
       Body: เหตุผล + ต้อง Reassign ใหม่

6. UI updates:
   ├─ Remove from pending list
   ├─ Show warning toast: "Job rejected - supervisor will be notified"
   └─ Return to dashboard

7. Supervisor ต้องทำอะไร:
   └─ ได้รับ notification
   └─ ต้อง Reassign ใหม่ให้ช่างคนอื่น
```

---

### 19.6 ✅ Validation & Business Rules

#### Rule 1: Incident Status Validation
```typescript
// ต้องอยู่ในสถานะที่ Reassign ได้เท่านั้น
const REASSIGNABLE_STATUSES = ['assigned', 'in_progress'];

if (!REASSIGNABLE_STATUSES.includes(incident.status)) {
  throw new Error('Cannot reassign incident with status: ' + incident.status);
}
```

**เหตุผล:**
- `pending` = ยังไม่มีช่าง → ใช้ Assignment แทน
- `completed` = เสร็จแล้ว → ไม่ต้อง Reassign
- `cancelled` = ยกเลิกแล้ว → ไม่ต้อง Reassign

---

#### Rule 2: Technician Validation
```typescript
// ช่างคนใหม่ต้องผ่านเงื่อนไขทั้งหมด
const validations = [
  toTechnician.roles.includes('Technician'),     // ต้องมี role Technician
  toTechnician.isActive === true,                 // ต้อง active
  toTechnician.id !== fromTechnician.id,          // ห้าม reassign ให้คนเดิม
];

if (!validations.every(v => v === true)) {
  throw new Error('Invalid technician for reassignment');
}
```

---

#### Rule 3: Reason Validation
```typescript
// เหตุผลต้องมีความยาวเพียงพอ
if (!reason || reason.trim().length < 10) {
  throw new Error('Reason must be at least 10 characters');
}

if (reason.length > 500) {
  throw new Error('Reason must not exceed 500 characters');
}
```

**Best Practices:**
- ควรระบุเหตุผลที่ชัดเจนและเป็นประโยชน์
- ตัวอย่างที่ดี:
  - ✅ "ช่างคนเดิมลาป่วยฉุกเฉิน ไม่สามารถออกสถานที่ได้"
  - ✅ "ปัญหาซับซ้อนกว่าที่คิด ต้องการช่างเชี่ยวชาญ Network"
  - ✅ "ช่างอยู่ไกลจากสถานที่เกินไป จะไปไม่ทันตาม SLA"
- ตัวอย่างที่ไม่ดี:
  - ❌ "Reassign" (สั้นเกินไป, ไม่มีข้อมูล)
  - ❌ "..." (ไม่ใช่เหตุผล)

---

#### Rule 4: Permission Check
```typescript
// ตรวจสอบสิทธิ์
const ALLOWED_ROLES = ['IT Manager', 'Help Desk', 'Supervisor'];

if (user.roles.includes('Super Admin')) {
  throw new Error('Super Admin cannot perform operational tasks');
}

if (!user.roles.some(role => ALLOWED_ROLES.includes(role))) {
  throw new Error('You do not have permission to reassign incidents');
}
```

---

#### Rule 5: Response Validation (Technician)
```typescript
// ตอบรับ = optional note
if (status === 'accepted') {
  // responseNote is optional
}

// ปฏิเสธ = required note
if (status === 'rejected') {
  if (!responseNote || responseNote.trim().length < 10) {
    throw new Error('Rejection reason is required (min 10 characters)');
  }
}
```

---

#### Rule 6: Auto-status Update
```typescript
// เมื่อ Reassign สำเร็จ → อัพเดท Incident
await incidentRepository.update(incidentId, {
  technician_id: toTechnicianId,
  status: 'assigned',                    // Reset to assigned
  assigned_at: new Date(),                // Reset timestamp
  updated_at: new Date()
});
```

**เหตุผล:**
- Reset status เป็น `assigned` เพื่อให้ช่างคนใหม่รับงาน
- Reset `assigned_at` เพื่อคำนวณ SLA ใหม่

---

### 19.7 🔗 Integration Points

**With Existing Features:**

1. **Incident Management (Feature 2)**
   - Use: ดึงข้อมูล Incident, update status
   - Link: `incidents.id` → `incident_reassignments.incident_id`

2. **User Management (Feature 1)**
   - Use: ดึงรายชื่อ Technicians, ตรวจสอบ roles/permissions
   - Link: `users.id` → `incident_reassignments.from_technician_id, to_technician_id`

3. **Activity Logs (Feature 17)**
   - Use: บันทึกทุก Reassignment action
   - Events: `reassignment_created`, `reassignment_accepted`, `reassignment_rejected`

4. **Email Notifications (Feature 9)**
   - Use: แจ้งเตือนช่างคนใหม่, ช่างเดิม, Supervisor
   - Templates:
     - `technician_reassigned_to` (ช่างคนใหม่)
     - `technician_reassigned_from` (ช่างเดิม)
     - `reassignment_response` (Supervisor)

5. **Dashboard & Analytics (Feature 10)**
   - Use: แสดงสถิติ Reassignment
   - Metrics:
     - Total reassignments (last 30 days)
     - Avg reassignments per incident
     - Top reasons for reassignment
     - Response time (pending → accepted/rejected)

6. **SLA Management (Feature 11)**
   - Impact: Reassignment resets `assigned_at` → SLA timer restarts
   - Note: ควรมี grace period หรือไม่? (ต้องพิจารณา business rules)

---

### 19.8 📊 Database Impact

**New Tables:** 1
- `incident_reassignments`

**Modified Tables:** None (ใช้ existing Incident table)

**New Indexes:** 4
- `idx_incident_reassignments_incident`
- `idx_incident_reassignments_from_tech`
- `idx_incident_reassignments_to_tech`
- `idx_incident_reassignments_date`

**Estimated Storage:**
- Per record: ~200 bytes
- Expected volume: 100 reassignments/month = 1200/year
- 5 years: ~6000 records × 200 bytes = ~1.2 MB (negligible)

**Total Tables:** 31 → 32 tables (+1)

---

### 19.9 🎯 Success Metrics

**Key Performance Indicators (KPIs):**

1. **Reassignment Rate**
   - Target: < 15% of total incidents
   - Measure: (Total Reassignments / Total Incidents) × 100

2. **Response Time**
   - Target: < 30 minutes average
   - Measure: Time from reassignment to acceptance/rejection

3. **Acceptance Rate**
   - Target: > 90%
   - Measure: (Accepted / Total) × 100

4. **Incident Resolution Time**
   - Target: No increase after reassignment
   - Measure: Compare average resolution time before/after reassignment feature

5. **SLA Compliance**
   - Target: Maintain current levels
   - Measure: SLA breaches per month

---

### 19.10 ✅ Testing Checklist

**Functional Testing:**
- [ ] Reassign incident successfully (happy path)
- [ ] Prevent reassign to same technician
- [ ] Prevent reassign on completed/cancelled incidents
- [ ] Validate reason field (min 10 chars)
- [ ] Technician can accept reassigned job
- [ ] Technician can reject reassigned job (must provide reason)
- [ ] Rejection reason validation (required, min 10 chars)
- [ ] View reassignment history for incident
- [ ] Technician can only respond to their own reassignments
- [ ] Cannot respond twice to same reassignment

**Permission Testing:**
- [ ] Super Admin cannot reassign (403 error)
- [ ] IT Manager can reassign
- [ ] Help Desk can reassign
- [ ] Supervisor can reassign
- [ ] Technician cannot reassign (403 error)
- [ ] End User cannot reassign (403 error)
- [ ] Read Only cannot reassign (403 error)

**Email Testing:**
- [ ] New technician receives notification
- [ ] Old technician receives notification
- [ ] Supervisor receives notification on accept
- [ ] Supervisor receives notification on reject

**UI Testing:**
- [ ] Reassign button visible only when allowed
- [ ] Reassign button hidden for Super Admin
- [ ] Reassignment modal displays correctly
- [ ] Technician list shows availability status
- [ ] Response modal validation works
- [ ] History timeline displays correctly
- [ ] Dashboard widget shows pending reassignments
- [ ] Badge count updates correctly

**Integration Testing:**
- [ ] Incident status updates correctly
- [ ] Activity logs created properly
- [ ] Email notifications sent successfully
- [ ] Dashboard stats calculate correctly
- [ ] SLA timer resets appropriately

**Performance Testing:**
- [ ] Reassignment API responds < 500ms
- [ ] History query returns < 1 second (100 records)
- [ ] Technician list loads < 1 second

---

## 🎯 Feature Summary

**Feature 15: Reassignment System** is now fully documented with:
- ✅ 1 database table with complete schema
- ✅ 5 API endpoints with request/response examples
- ✅ 5 detailed UI components with mockups
- ✅ 3 step-by-step workflows
- ✅ 6 validation rules clearly defined
- ✅ Permission matrix updated (Super Admin ❌)
- ✅ Integration points with 6 existing features
- ✅ Testing checklist (30+ test cases)
- ✅ Success metrics and KPIs

**No ambiguity. No guesswork. Production-ready specification.**

---

**พร้อมพัฒนาได้เลย!** 🚀

---

## 20. FEATURE 16: Priority Level Configuration

### 20.1 📋 Overview & Objectives

**Purpose:**  
ระบบ Priority Level Configuration ช่วยให้ Super Admin สามารถกำหนดและปรับแต่งระดับความสำคัญ (Priority Levels) ของ Incident ให้เหมาะสมกับความต้องการของแต่ละบริษัท

**ทำไมต้อง Configurable?**
- 🏢 แต่ละบริษัทมี SLA และนโยบายที่แตกต่างกัน
- 🌐 รองรับหลายภาษา (TH/EN) และ Terminology ที่เหมาะกับธุรกิจ
- 🎨 ปรับสีและรูปแบบให้สอดคล้องกับ Brand
- ⏱️ กำหนด Response Time ที่แตกต่างกันตาม Priority
- 📊 รองรับอุตสาหกรรมต่างๆ (โรงพยาบาล, โรงงาน, ร้านค้าปลีก)

**ตัวอย่างการใช้งาน:**

**Company A: โรงพยาบาล (4 Levels)**
```
1. Critical (ฉุกเฉิน)    - SLA: 5 minutes  - สีแดงเข้ม
2. High (ด่วน)          - SLA: 30 minutes - สีแดง
3. Medium (ปานกลาง)     - SLA: 2 hours    - สีเหลือง
4. Low (ต่ำ)            - SLA: 24 hours   - สีเขียว
```

**Company B: ห้างสรรพสินค้า (3 Levels)**
```
1. High (สูง)           - SLA: 1 hour     - สีแดง
2. Medium (กลาง)        - SLA: 4 hours    - สีส้ม
3. Low (ต่ำ)            - SLA: 24 hours   - สีเขียว
```

**Company C: โรงงาน (5 Levels - P1-P5)**
```
1. P1 - Critical        - SLA: 15 minutes - สีแดงเข้ม
2. P2 - High            - SLA: 1 hour     - สีแดง
3. P3 - Medium          - SLA: 4 hours    - สีส้ม
4. P4 - Low             - SLA: 8 hours    - สีเหลือง
5. P5 - Minimal         - SLA: 48 hours   - สีเขียว
```

**เป้าหมาย:**
- ✅ ให้ระบบยืดหยุ่นตามความต้องการของแต่ละบริษัท
- ✅ รองรับการเปลี่ยนแปลง Priority Levels ได้ทุกเวลา
- ✅ มี SLA Management ที่ชัดเจนตาม Priority แต่ละระดับ
- ✅ User Experience ที่ดีขึ้น (ใช้ภาษาและสีที่เหมาะสม)

**สิทธิ์การใช้งาน (Permission):**
| Role | Configure Priority? | View Priority? | เหตุผล |
|------|:-------------------:|:--------------:|--------|
| **Super Admin** | ✅ | ✅ | จัดการ System Configuration ทั้งหมด |
| **IT Manager** | ❌ | ✅ | ดูได้ แต่แก้ไม่ได้ (ป้องกันความสับสน) |
| **Help Desk** | ❌ | ✅ | ใช้ตอนสร้าง Incident เท่านั้น |
| **Supervisor** | ❌ | ✅ | ใช้ตอนสร้าง Incident เท่านั้น |
| **Finance Admin** | ❌ | ✅ | ดูได้เท่านั้น |
| **Technician** | ❌ | ✅ | ดูได้เท่านั้น |
| **End User** | ❌ | ✅ | ดูได้เท่านั้น (ในฟอร์มสร้าง Incident) |
| **Read Only** | ❌ | ✅ | ดูได้เท่านั้น |

---

### 20.2 🗄️ Database Schema

#### Table: `priority_levels`

**Purpose:** เก็บการตั้งค่าระดับความสำคัญที่ปรับแต่งได้สำหรับแต่ละบริษัท

```sql
CREATE TABLE priority_levels (
  id SERIAL PRIMARY KEY,
  
  -- Priority Configuration
  level_order INTEGER NOT NULL,              -- ลำดับความสำคัญ 1-5 (1 = สูงสุด)
  name_th VARCHAR(100) NOT NULL,             -- ชื่อภาษาไทย (เช่น "ด่วนมาก", "สูง")
  name_en VARCHAR(100) NOT NULL,             -- ชื่อภาษาอังกฤษ (เช่น "Critical", "High")
  
  -- Visual Configuration
  color_hex VARCHAR(7) NOT NULL,             -- สีที่แสดง (เช่น "#ef4444" สีแดง)
  icon_name VARCHAR(50),                     -- ชื่อ Icon (optional, เช่น "alert-triangle")
  
  -- SLA Configuration
  sla_response_minutes INTEGER NOT NULL,     -- เวลาตอบสนองเป้าหมาย (นาที)
  
  -- Status
  is_active BOOLEAN DEFAULT true,            -- เปิด/ปิดใช้งาน
  is_default BOOLEAN DEFAULT false,          -- เป็น Default selection ในฟอร์มหรือไม่
  
  -- Display Order
  display_order INTEGER,                     -- ลำดับการแสดงใน UI (1, 2, 3...)
  
  -- Description
  description_th TEXT,                       -- คำอธิบาย (TH)
  description_en TEXT,                       -- คำอธิบาย (EN)
  
  -- Audit Trail
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  
  -- Constraints
  UNIQUE(level_order),
  UNIQUE(name_en),
  CHECK (level_order >= 1 AND level_order <= 5),
  CHECK (sla_response_minutes > 0),
  CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$'),  -- Validate hex color format
  
  -- Indexes
  INDEX idx_priority_levels_order (level_order),
  INDEX idx_priority_levels_active (is_active),
  INDEX idx_priority_levels_default (is_default)
);
```

**Field Descriptions:**

| Field | Type | Description | Rules | Example |
|-------|------|-------------|-------|---------|
| `level_order` | INTEGER | ลำดับความสำคัญ (1 = สูงสุด) | 1-5, UNIQUE | 1, 2, 3 |
| `name_th` | VARCHAR(100) | ชื่อภาษาไทย | NOT NULL, Max 100 | "ด่วนมาก", "สูง", "ปานกลาง" |
| `name_en` | VARCHAR(100) | ชื่อภาษาอังกฤษ | NOT NULL, UNIQUE | "Critical", "High", "Medium" |
| `color_hex` | VARCHAR(7) | รหัสสี Hex | Must start with #, 6 digits | "#ef4444", "#f97316" |
| `icon_name` | VARCHAR(50) | ชื่อ Icon (Lucide) | Optional | "alert-triangle", "alert-circle" |
| `sla_response_minutes` | INTEGER | SLA Response Time (นาที) | > 0 | 15, 60, 240 |
| `is_active` | BOOLEAN | เปิดใช้งาน | Default: true | true, false |
| `is_default` | BOOLEAN | เป็น Default Selection | Default: false | true, false |
| `display_order` | INTEGER | ลำดับการแสดง | Optional | 1, 2, 3 |
| `description_th` | TEXT | คำอธิบาย (TH) | Optional | "สำหรับปัญหาฉุกเฉิน" |
| `description_en` | TEXT | คำอธิบาย (EN) | Optional | "For critical issues" |

**Default Priority Levels (Initial Data):**

```sql
-- Default 3 Priority Levels
INSERT INTO priority_levels (level_order, name_th, name_en, color_hex, icon_name, sla_response_minutes, is_active, is_default, display_order, description_th, description_en) VALUES
(1, 'สูง', 'High', '#ef4444', 'alert-triangle', 60, true, true, 1, 'ปัญหาเร่งด่วนที่ส่งผลกระทบสูง', 'Urgent issues with high impact'),
(2, 'ปานกลาง', 'Medium', '#f97316', 'alert-circle', 240, true, false, 2, 'ปัญหาทั่วไปที่ต้องแก้ไข', 'Regular issues that need fixing'),
(3, 'ต่ำ', 'Low', '#22c55e', 'info', 1440, true, false, 3, 'ปัญหาเล็กน้อยที่ไม่เร่งด่วน', 'Minor issues, not urgent');
```

**Business Rules:**

1. ✅ **ต้องมีอย่างน้อย 2 Priority Levels**
   - ไม่สามารถลบจนเหลือน้อยกว่า 2 levels

2. ✅ **สูงสุดไม่เกิน 5 Priority Levels**
   - เพื่อไม่ให้ซับซ้อนเกินไป

3. ✅ **level_order ต้อง UNIQUE**
   - ไม่มีสอง Priority ที่มี level_order เดียวกัน

4. ✅ **name_en ต้อง UNIQUE**
   - ป้องกันความสับสนในระบบ

5. ✅ **ต้องมี is_default = true อย่างน้อย 1 รายการ**
   - สำหรับ Auto-select ในฟอร์มสร้าง Incident

6. ✅ **ไม่สามารถลบ Priority ที่มี Incident อยู่**
   - ต้อง Deactivate (is_active = false) แทน

7. ✅ **SLA Response Time ต้องมากกว่า 0**
   - ระบุเป็นนาที (minutes)

8. ✅ **color_hex ต้องเป็น Hex Color ที่ถูกต้อง**
   - Format: #RRGGBB (เช่น #ef4444)

---

### 20.3 🔌 API Endpoints

#### 1. **GET /api/admin/priority-levels**
**Purpose:** ดึงรายการ Priority Levels ทั้งหมด (Super Admin)

**Permission:** Super Admin only

**Request:**
```typescript
GET /api/admin/priority-levels
Authorization: Bearer <jwt_token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "levelOrder": 1,
      "nameTh": "ด่วนมาก",
      "nameEn": "Critical",
      "colorHex": "#dc2626",
      "iconName": "alert-triangle",
      "slaResponseMinutes": 15,
      "isActive": true,
      "isDefault": false,
      "displayOrder": 1,
      "descriptionTh": "ปัญหาวิกฤติที่ต้องแก้ไขทันที",
      "descriptionEn": "Critical issues requiring immediate action",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    },
    {
      "id": 2,
      "levelOrder": 2,
      "nameTh": "สูง",
      "nameEn": "High",
      "colorHex": "#ef4444",
      "iconName": "alert-circle",
      "slaResponseMinutes": 60,
      "isActive": true,
      "isDefault": true,
      "displayOrder": 2,
      "descriptionTh": "ปัญหาเร่งด่วนที่ส่งผลกระทบสูง",
      "descriptionEn": "Urgent issues with high impact",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    },
    {
      "id": 3,
      "levelOrder": 3,
      "nameTh": "ปานกลาง",
      "nameEn": "Medium",
      "colorHex": "#f97316",
      "iconName": "alert-circle",
      "slaResponseMinutes": 240,
      "isActive": true,
      "isDefault": false,
      "displayOrder": 3,
      "descriptionTh": "ปัญหาทั่วไปที่ต้องแก้ไข",
      "descriptionEn": "Regular issues that need fixing",
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-01-15T10:00:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "activeCount": 3,
    "defaultId": 2
  }
}
```

---

#### 2. **GET /api/priority-levels**
**Purpose:** ดึงรายการ Priority Levels ที่ Active (สำหรับทุก Role)

**Permission:** All authenticated users

**Request:**
```typescript
GET /api/priority-levels
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `activeOnly` (boolean, default: true) - แสดงเฉพาะ Active
- `lang` (string, default: "th") - ภาษา: "th" หรือ "en"

**Response (Success - 200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "levelOrder": 2,
      "name": "สูง",
      "color": "#ef4444",
      "icon": "alert-circle",
      "slaMinutes": 60,
      "isDefault": true
    },
    {
      "id": 3,
      "levelOrder": 3,
      "name": "ปานกลาง",
      "color": "#f97316",
      "icon": "alert-circle",
      "slaMinutes": 240,
      "isDefault": false
    },
    {
      "id": 4,
      "levelOrder": 4,
      "name": "ต่ำ",
      "color": "#22c55e",
      "icon": "info",
      "slaMinutes": 1440,
      "isDefault": false
    }
  ]
}
```

---

#### 3. **POST /api/admin/priority-levels**
**Purpose:** สร้าง Priority Level ใหม่

**Permission:** Super Admin only

**Request:**
```typescript
POST /api/admin/priority-levels
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "levelOrder": 1,
  "nameTh": "ด่วนมาก",
  "nameEn": "Critical",
  "colorHex": "#dc2626",
  "iconName": "alert-triangle",
  "slaResponseMinutes": 15,
  "isActive": true,
  "isDefault": false,
  "displayOrder": 1,
  "descriptionTh": "ปัญหาวิกฤติที่ต้องแก้ไขทันที",
  "descriptionEn": "Critical issues requiring immediate action"
}
```

**Validation Rules:**
- `levelOrder`: Required, 1-5, must be unique
- `nameTh`: Required, max 100 characters
- `nameEn`: Required, max 100 characters, must be unique
- `colorHex`: Required, must be valid hex color (#RRGGBB)
- `slaResponseMinutes`: Required, must be > 0
- Total Priority Levels ≤ 5

**Response (Success - 201):**
```json
{
  "success": true,
  "message": "Priority level created successfully",
  "data": {
    "id": 5,
    "levelOrder": 1,
    "nameTh": "ด่วนมาก",
    "nameEn": "Critical",
    "colorHex": "#dc2626",
    "iconName": "alert-triangle",
    "slaResponseMinutes": 15,
    "isActive": true,
    "isDefault": false,
    "createdAt": "2025-12-11T10:30:00Z"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "levelOrder must be unique",
  "details": {
    "field": "levelOrder",
    "value": 1,
    "constraint": "unique"
  }
}
```

---

#### 4. **PUT /api/admin/priority-levels/:id**
**Purpose:** แก้ไข Priority Level

**Permission:** Super Admin only

**Request:**
```typescript
PUT /api/admin/priority-levels/2
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "nameTh": "สูงมาก",
  "nameEn": "Very High",
  "colorHex": "#f97316",
  "slaResponseMinutes": 45,
  "isDefault": true
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Priority level updated successfully",
  "data": {
    "id": 2,
    "levelOrder": 2,
    "nameTh": "สูงมาก",
    "nameEn": "Very High",
    "colorHex": "#f97316",
    "slaResponseMinutes": 45,
    "isDefault": true,
    "updatedAt": "2025-12-11T10:35:00Z"
  }
}
```

---

#### 5. **DELETE /api/admin/priority-levels/:id**
**Purpose:** ลบ Priority Level (ถ้าไม่มี Incident ใช้งาน)

**Permission:** Super Admin only

**Request:**
```typescript
DELETE /api/admin/priority-levels/5
Authorization: Bearer <jwt_token>
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Priority level deleted successfully"
}
```

**Response (Error - 400 - Cannot Delete):**
```json
{
  "success": false,
  "error": "CANNOT_DELETE",
  "message": "Cannot delete priority level with existing incidents",
  "details": {
    "priorityId": 2,
    "incidentCount": 157,
    "suggestion": "Deactivate instead by setting isActive to false"
  }
}
```

**Response (Error - 400 - Minimum Required):**
```json
{
  "success": false,
  "error": "MINIMUM_REQUIRED",
  "message": "Cannot delete. System requires at least 2 priority levels",
  "details": {
    "currentCount": 2,
    "minimumRequired": 2
  }
}
```

---

#### 6. **PATCH /api/admin/priority-levels/:id/activate**
**Purpose:** เปิด/ปิดใช้งาน Priority Level

**Permission:** Super Admin only

**Request:**
```typescript
PATCH /api/admin/priority-levels/3/activate
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "isActive": false
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Priority level deactivated successfully",
  "data": {
    "id": 3,
    "isActive": false,
    "updatedAt": "2025-12-11T10:40:00Z"
  }
}
```

---

#### 7. **PATCH /api/admin/priority-levels/:id/set-default**
**Purpose:** ตั้งเป็น Default Priority

**Permission:** Super Admin only

**Request:**
```typescript
PATCH /api/admin/priority-levels/2/set-default
Authorization: Bearer <jwt_token>
```

**Business Logic:**
- ตั้ง `isDefault = true` สำหรับ Priority นี้
- ตั้ง `isDefault = false` สำหรับ Priority อื่นทั้งหมด (เพราะมีได้แค่ 1 Default)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Default priority updated successfully",
  "data": {
    "id": 2,
    "nameEn": "High",
    "isDefault": true
  }
}
```

---

### 20.4 🎨 UI Components

#### 1. **Priority Configuration Page (Super Admin)**

**Page:** `/admin/settings/priorities`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚙️ Settings > Priority Levels                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ จำนวน Priority Levels: 3/5                             │
│ [+ เพิ่ม Priority Level]                               │
│                                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Priority 1 (สูงสุด)                    [⚙️] [🗑️] │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ Level Order: 1                                    │ │
│ │ ชื่อ (TH):   [สูง                    ]            │ │
│ │ ชื่อ (EN):   [High                   ]            │ │
│ │ สี:          [🔴 #ef4444              ] 🎨        │ │
│ │ Icon:        [alert-triangle          ] 🔍        │ │
│ │ SLA:         [60        ] นาที (1 ชั่วโมง)        │ │
│ │ Default:     [✓] ตั้งเป็น Default                 │ │
│ │ Active:      [✓] เปิดใช้งาน                       │ │
│ │                                                    │ │
│ │ คำอธิบาย (TH): [ปัญหาเร่งด่วน...]                │ │
│ │ คำอธิบาย (EN): [Urgent issues...]                 │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Priority 2                             [⚙️] [🗑️] │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ Level Order: 2                                    │ │
│ │ ชื่อ (TH):   [ปานกลาง                ]            │ │
│ │ ชื่อ (EN):   [Medium                 ]            │ │
│ │ สี:          [🟠 #f97316              ]           │ │
│ │ SLA:         [240       ] นาที (4 ชั่วโมง)        │ │
│ │ Default:     [ ] ตั้งเป็น Default                 │ │
│ │ Active:      [✓] เปิดใช้งาน                       │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Priority 3 (ต่ำสุด)                    [⚙️] [🗑️] │ │
│ ├───────────────────────────────────────────────────┤ │
│ │ Level Order: 3                                    │ │
│ │ ชื่อ (TH):   [ต่ำ                    ]            │ │
│ │ ชื่อ (EN):   [Low                    ]            │ │
│ │ สี:          [🟢 #22c55e              ]           │ │
│ │ SLA:         [1440      ] นาที (1 วัน)            │ │
│ │ Default:     [ ] ตั้งเป็น Default                 │ │
│ │ Active:      [✓] เปิดใช้งาน                       │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│                        [ยกเลิก] [บันทึกการตั้งค่า]   │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- ✅ Drag & Drop เพื่อเรียงลำดับ Priority
- ✅ Color Picker สำหรับเลือกสี
- ✅ Icon Picker (Lucide Icons)
- ✅ SLA Presets: 15min, 30min, 1hr, 2hr, 4hr, 8hr, 24hr, Custom
- ✅ Real-time validation
- ✅ Preview Priority แบบ Live
- ✅ ไม่สามารถลบถ้ามี Incident อยู่ (แสดงจำนวน Incidents)
- ✅ Confirm dialog ก่อนลบ

---

#### 2. **Priority Selection in Create Incident Form**

**Dynamic Priority Buttons (ใช้ข้อมูลจาก API /api/priority-levels):**

```html
<!-- Priority Selection - Dynamic from API -->
<div class="priority-selection">
  <label>Priority <span class="required">*</span></label>
  
  <div class="priority-buttons">
    <!-- Loop through priorities from API -->
    <label v-for="priority in priorities" :key="priority.id">
      <input 
        type="radio" 
        name="priority" 
        :value="priority.id"
        :checked="priority.isDefault"
      >
      <div 
        class="priority-button" 
        :style="{
          borderColor: priority.color,
          backgroundColor: priority.color + '20'
        }"
      >
        <i :data-lucide="priority.icon"></i>
        <span>{{ priority.name }}</span>
      </div>
    </label>
  </div>
</div>
```

**Example Result (3 Priorities):**
```
[⚠️ สูง]  [⚪ ปานกลาง]  [ℹ️ ต่ำ]
  Red       Orange        Green
```

**Example Result (4 Priorities):**
```
[❗ ด่วนมาก]  [⚠️ สูง]  [⚪ ปานกลาง]  [ℹ️ ต่ำ]
   Dark Red      Red       Orange        Green
```

---

#### 3. **Priority Badge Display**

**ในทุกที่ที่แสดง Priority (List, Detail, Dashboard):**

```javascript
// Dynamic Priority Badge Component
function PriorityBadge({ priority }) {
  return (
    <span 
      className="priority-badge"
      style={{
        color: priority.color,
        backgroundColor: `${priority.color}20`,
        borderColor: priority.color
      }}
    >
      <i data-lucide={priority.icon}></i>
      {priority.name}
    </span>
  );
}
```

---

### 20.5 📋 Workflows

#### Workflow 1: Super Admin กำหนด Priority Levels ครั้งแรก

```
1. Super Admin Login
   ↓
2. ไปที่ Settings > Priority Levels
   ↓
3. ดูค่า Default (3 levels: High, Medium, Low)
   ↓
4. ตัดสินใจว่าต้องการปรับแต่งหรือไม่
   ├─→ ถ้าพอใจ → ใช้ค่า Default
   └─→ ถ้าต้องการปรับ → ไป Step 5
   ↓
5. คลิก [+ เพิ่ม Priority Level] (ถ้าต้องการเพิ่ม)
   ↓
6. กรอกข้อมูล:
   - Level Order: เลือก 1-5
   - ชื่อ TH/EN
   - เลือกสี (Color Picker)
   - เลือก Icon
   - ระบุ SLA (นาที)
   - ตั้งเป็น Default หรือไม่
   ↓
7. บันทึก
   ↓
8. ระบบ Validate:
   ✓ level_order ไม่ซ้ำ
   ✓ name_en ไม่ซ้ำ
   ✓ color_hex ถูกต้อง
   ✓ SLA > 0
   ✓ Priority ไม่เกิน 5 levels
   ↓
9. บันทึกลง Database
   ↓
10. แสดงผลทันทีในฟอร์มสร้าง Incident
```

---

#### Workflow 2: แก้ไข Priority Levels

```
1. Super Admin ไปที่ Settings > Priority Levels
   ↓
2. คลิก [⚙️] ที่ Priority ที่ต้องการแก้
   ↓
3. แก้ไขข้อมูล (ชื่อ, สี, SLA, etc.)
   ↓
4. บันทึก
   ↓
5. ระบบตรวจสอบ:
   - ถ้าเปลี่ยน name_en → ต้องไม่ซ้ำกับอื่น
   - ถ้าเปลี่ยน level_order → ต้องไม่ซ้ำกับอื่น
   ↓
6. อัปเดต Database
   ↓
7. Incidents ที่ใช้ Priority นี้อยู่
   → อัปเดตการแสดงผลทันที (ชื่อ, สี)
   → แต่ SLA ไม่เปลี่ยนย้อนหลัง (ใช้ SLA เดิมที่บันทึกไว้)
```

---

#### Workflow 3: ลบ Priority Level

```
1. Super Admin คลิก [🗑️] Delete
   ↓
2. ระบบตรวจสอบ:
   ├─→ มี Incident ที่ใช้ Priority นี้อยู่?
   │   ├─→ Yes → แสดง Error + จำนวน Incidents
   │   │         + แนะนำให้ Deactivate แทน
   │   └─→ No → ไป Step 3
   │
   └─→ Priority Levels จะเหลือ < 2?
       ├─→ Yes → แสดง Error (ต้องมีอย่างน้อย 2)
       └─→ No → ไป Step 3
   ↓
3. แสดง Confirm Dialog:
   "คุณแน่ใจหรือไม่ว่าต้องการลบ Priority นี้?"
   ↓
4. ถ้า Confirm → DELETE จาก Database
   ↓
5. แสดงผลหน้าจอใหม่ (Priority นี้หายไป)
```

---

#### Workflow 4: Deactivate Priority (แทนการลบ)

```
1. Super Admin ไปที่ Priority ที่ต้องการปิด
   ↓
2. เอา ✓ ออกจาก [Active]
   ↓
3. บันทึก
   ↓
4. Priority นี้:
   ✓ ยังอยู่ใน Database
   ✓ Incidents เดิมยังใช้งานได้
   ✗ ไม่แสดงในฟอร์มสร้าง Incident ใหม่
   ✗ ไม่สามารถเลือกใน Filter
```

---

### 20.6 ✅ Validation Rules

**1. Priority Level Count:**
- ✅ Minimum: 2 levels
- ✅ Maximum: 5 levels
- ❌ Cannot delete if count would drop below 2

**2. Level Order:**
- ✅ Must be between 1-5
- ✅ Must be unique
- ✅ Cannot have gaps (ถ้ามี 3 levels ต้องเป็น 1,2,3 ไม่ใช่ 1,3,5)

**3. Names:**
- ✅ `name_th`: Required, 1-100 characters
- ✅ `name_en`: Required, 1-100 characters, UNIQUE, Alphanumeric + space
- ❌ Cannot use special characters in `name_en` (ยกเว้น space, dash, slash)

**4. Color:**
- ✅ Must be valid hex color: `#RRGGBB`
- ✅ Case-insensitive (#ef4444 = #EF4444)
- ❌ Cannot use shorthand (#f00) - must be full 6 digits

**5. Icon:**
- ✅ Optional
- ✅ Must be valid Lucide icon name
- ✅ Examples: "alert-triangle", "alert-circle", "info", "alert-octagon"

**6. SLA Response Time:**
- ✅ Must be > 0
- ✅ Integer only (no decimals)
- ✅ Recommended: 15, 30, 60, 120, 240, 480, 1440, 2880
- ✅ Can use custom value

**7. Default Priority:**
- ✅ Must have exactly 1 priority with `isDefault = true`
- ✅ When setting new default → auto unset old default
- ❌ Cannot have 0 or 2+ defaults

**8. Active Status:**
- ✅ At least 1 priority must be active
- ✅ Can deactivate if other active priorities exist
- ❌ Cannot deactivate all priorities

**9. Cannot Delete if:**
- ❌ Has incidents using this priority
- ❌ Would leave < 2 priority levels
- ✅ Can deactivate instead (recommended)

---

### 20.7 🔗 Integration Points

**1. Incident Management (Feature 2)**
- เมื่อสร้าง Incident → ใช้ Priority Levels จาก `priority_levels` table
- Incident Form → Load priorities จาก `/api/priority-levels`
- แสดง Priority Badge → ใช้ color และ icon จาก Priority config

**2. SLA Management (Feature 11)**
- SLA Timer → ใช้ `sla_response_minutes` จาก Priority Level
- SLA Calculation → Dynamic based on Priority configuration
- SLA Breach Alert → ขึ้นกับ Priority Level ที่ตั้งไว้

**3. Dashboard & Analytics (Feature 10)**
- Incident by Priority Chart → Group by Priority Levels ที่ Active
- Priority Distribution → Show using configured colors
- SLA Compliance → Calculate per Priority Level

**4. Email Notifications (Feature 9)**
- Email Template → ใช้ชื่อและสีจาก Priority config
- Subject Line → แสดง Priority name (TH/EN ตาม locale)
- Priority Icon → ใน Email HTML

**5. Reports & Export (Feature 23)**
- Excel Export → Include Priority name (TH/EN)
- PDF Reports → Use Priority colors
- Filter by Priority → Show only active priorities

**6. Activity Logs (Feature 21)**
- Log Priority Changes:
  ```json
  {
    "action": "priority_level_updated",
    "changes": {
      "nameTh": { "old": "สูง", "new": "สูงมาก" },
      "slaResponseMinutes": { "old": 60, "new": 45 }
    }
  }
  ```

---

### 20.8 🧪 Testing Checklist

**Unit Tests:**
- [ ] Create priority level successfully
- [ ] Update priority level successfully
- [ ] Delete priority level (no incidents)
- [ ] Cannot delete priority with incidents
- [ ] Cannot delete if < 2 priorities remain
- [ ] Validate level_order uniqueness
- [ ] Validate name_en uniqueness
- [ ] Validate color_hex format
- [ ] Validate SLA > 0
- [ ] Cannot exceed 5 priority levels
- [ ] Set default priority (unsets old default)
- [ ] Activate/Deactivate priority
- [ ] Cannot deactivate all priorities
- [ ] Load active priorities only
- [ ] Load all priorities (admin)

**Integration Tests:**
- [ ] Create incident with custom priority
- [ ] Priority changes reflect in incident list
- [ ] Priority changes reflect in dashboard
- [ ] SLA timer uses correct minutes from priority
- [ ] Email shows correct priority name/color
- [ ] Export includes priority information
- [ ] Filter by priority works with custom levels
- [ ] Activity log records priority changes

**UI Tests:**
- [ ] Priority config page loads correctly
- [ ] Can add new priority level
- [ ] Can edit existing priority
- [ ] Can delete priority (if no incidents)
- [ ] Cannot delete (shows error + count)
- [ ] Color picker works
- [ ] Icon picker works
- [ ] SLA presets work
- [ ] Drag & drop to reorder
- [ ] Create incident form shows custom priorities
- [ ] Priority badges display correctly
- [ ] Deactivated priorities don't show in forms

**Data Migration Tests:**
- [ ] Existing incidents map to correct priority
- [ ] Default priorities created on fresh install
- [ ] Upgrade from old system preserves priorities

**Performance Tests:**
- [ ] Load priorities API < 100ms
- [ ] Update priority API < 200ms
- [ ] Create incident with priority < 500ms
- [ ] Dashboard loads with custom priorities < 1s

---

### 20.9 📊 Success Metrics

**Adoption Metrics:**
- 90%+ of companies customize at least 1 priority level
- Average: 3.5 priority levels per company

**Usage Metrics:**
- Priority configuration changes: < 5 times per month (stable)
- Default priority selection rate: 60%+ of incidents

**System Performance:**
- Priority API response time: < 100ms (99th percentile)
- No errors from invalid priority configurations

**User Satisfaction:**
- Super Admins report priority system as "flexible" and "easy to use"
- 0 complaints about limited priority options

---

## 🎯 Feature Summary

**Feature 16: Priority Level Configuration** is now fully documented with:
- ✅ 1 database table (`priority_levels`) with complete schema
- ✅ 7 API endpoints with request/response examples
- ✅ 3 detailed UI components with mockups
- ✅ 4 step-by-step workflows
- ✅ 9 validation rule categories clearly defined
- ✅ Permission matrix updated (Super Admin only for config)
- ✅ Integration points with 6 existing features
- ✅ Testing checklist (40+ test cases)
- ✅ Success metrics and KPIs

**Key Benefits:**
- 🎯 Each company can customize priority levels to match their SLA
- 🌐 Multi-language support (TH/EN)
- 🎨 Brand-aligned colors and terminology
- ⚡ Dynamic form rendering based on configuration
- 🔒 Protected from accidental deletion (if incidents exist)
- 📊 Backward compatible with existing incidents

**No ambiguity. No guesswork. Production-ready specification.**

---

**พร้อมพัฒนาได้เลย!** 🚀

---

# PART 4: SYSTEM COMPONENTS



# 21. FEATURE 17: License & Activation System

## 21.1 📖 Feature Overview

**ฟีเจอร์นี้ทำอะไร?**
- ควบคุมการใช้งานระบบด้วย License Activation
- Trial 30 วัน (ใช้งานได้โดยไม่ต้อง activate)
- Offline License Key System (ไม่ต้องพึ่ง internet)
- Hardware Binding (ป้องกันการ clone ไปใช้เครื่องอื่น)
- Customer Lock with Approval (ตั้งค่า customer ครั้งเดียว)
- Auto-Approve & Auto-Email System
- Active Usage Tracking (รู้ว่า installation ไหนยังใช้งานอยู่)
- One Active Installation Policy (1 license = 1 device active)
- Anti-Piracy Telemetry (ตรวจจับ crack)
- Separate Admin Dashboard (นอก RIM app)

**ใครใช้?**
- **System (Auto):** เช็ค license ทุกครั้งที่ startup และทุก request
- **End User:** ขอ activation code, กรอก license key, release license
- **Admin (Rachaseth):** Approve activation requests, generate license keys, monitor all installations
- **Super Admin:** ดูสถานะ license, ตั้งค่าราคา (ใน RIM app)

**Business Value:**
- 🔒 ควบคุมการใช้งานระบบ
- 💰 Monetization (ขายแบบ subscription)
- 🛡️ ป้องกันการใช้งานโดยไม่ได้รับอนุญาต
- 🚨 ตรวจจับ crack และ piracy ได้ทันที
- 📊 Track การใช้งานของลูกค้า
- ⚖️ เก็บ evidence สำหรับดำเนินการทางกฎหมาย

---

## 21.2 🏗️ System Architecture

### **Two-Tier Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE OVERVIEW                        │
└─────────────────────────────────────────────────────────────────┘

TIER 1: RIM Application (Customer Site)
┌─────────────────────────────────────────────────────────────────┐
│  RIM Application (On-Premise / Customer VPS)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Core Features:                                              │
│  • User Management, Incident Management, Store Management       │
│  • Equipment, Categories, File Upload, etc.                     │
│                                                                 │
│  🔐 License Panel (Limited):                                    │
│  • View own license status                                      │
│  • Activate license with key                                    │
│  • Release license (self-service)                               │
│  • Request transfer                                             │
│  • View own installation details only                           │
│                                                                 │
│  📡 Telemetry Agent (Background):                               │
│  • Send activation events                                       │
│  • Send heartbeat every 1 hour                                  │
│  • Send to Central License Server                               │
│                                                                 │
│  Database (Local):                                              │
│  • licenses (minimal - own license only)                        │
│  • All other RIM tables                                         │
│                                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTPS (Telemetry Data)
                           │ • Activation events
                           │ • Heartbeat (every 1 hour)
                           │ • License releases
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  TIER 2: Central License Management Server                     │
│  (Separate VPS - Admin Access Only)                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🗺️  Monitoring Dashboard (Web UI):                             │
│  URL: https://license-admin.yourdomain.com                      │
│  Access: rachaseth.d@gmail.com only                             │
│                                                                 │
│  Features:                                                      │
│  • Global installations map (all customers)                     │
│  • Active vs Inactive tracking                                  │
│  • Anomaly detection & alerts                                   │
│  • Crack detection dashboard                                    │
│  • License usage analytics                                      │
│  • Approve/Reject activation requests                           │
│  • Generate license keys                                        │
│  • Suspend licenses                                             │
│  • View evidence for legal action                               │
│                                                                 │
│  💾 Database (Central):                                         │
│  • licenses (complete - all customers)                          │
│  • license_installations (all)                                  │
│  • activation_telemetry (all)                                   │
│  • heartbeats (all)                                             │
│  • anomaly_detections                                           │
│  • activation_requests                                          │
│  • customer_change_requests                                     │
│  • license_transfer_requests                                    │
│  • license_pricing (configurable)                               │
│  • admin_users                                                  │
│  • audit_logs                                                   │
│                                                                 │
│  🤖 Background Jobs:                                            │
│  • Anomaly detection (daily)                                    │
│  • Inactivity detection (daily)                                 │
│  • Email notifications                                          │
│  • Reports generation                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ Customer ไม่มีทางเข้าถึง Central License Server
- ✅ Admin Dashboard อยู่นอก RIM application
- ✅ Telemetry data ส่งทางเดียว (RIM → Central)
- ✅ No "god mode" in production app
- ✅ Complete separation of concerns

---

## 21.3 💾 Database Schema

### **21.3.1 Table: licenses (RIM Local Database - Minimal)**

```sql
-- RIM Local Database (Customer Site)
-- เก็บเฉพาะข้อมูล license ของตัวเอง

CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  
  -- License Information
  licenseKey VARCHAR(500) NOT NULL UNIQUE,
  licenseType VARCHAR(20) NOT NULL,
  
  -- Company Information (Locked after first activation)
  companyName VARCHAR(255),
  contactEmail VARCHAR(255),
  
  -- Installation
  installationId VARCHAR(255) UNIQUE,
  
  -- Status
  status VARCHAR(20) DEFAULT 'trial',
  
  -- Dates
  installDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trialEndDate TIMESTAMP,
  activationDate TIMESTAMP,
  expiryDate TIMESTAMP,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### **21.3.2 Central License Server Database**

#### **Table: licenses (Central - Complete)**

```sql
CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  
  -- Hardware Information (ป้องกัน clone)
  hardwareId VARCHAR(255) NOT NULL UNIQUE,
  hardwareDetails JSONB,
  
  -- Company Information
  companyName VARCHAR(255) NOT NULL,
  companyRegistration VARCHAR(100),
  contactEmail VARCHAR(255) NOT NULL,
  contactPhone VARCHAR(50),
  contactPerson VARCHAR(255),
  
  -- Customer Lock System
  isCustomerLocked BOOLEAN DEFAULT false,
  customerChangeRequestId VARCHAR(100),
  customerChangeRequestDate TIMESTAMP,
  customerChangeApproved BOOLEAN,
  customerChangeApprovedBy VARCHAR(255),
  customerChangeApprovalDate TIMESTAMP,
  customerChangeCount INTEGER DEFAULT 0,
  
  -- License Information
  licenseKey VARCHAR(500) NOT NULL UNIQUE,
  licenseType VARCHAR(20) NOT NULL,
  
  -- Activation Status
  status VARCHAR(20) DEFAULT 'trial',
  
  -- Dates
  installDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trialEndDate TIMESTAMP,
  activationDate TIMESTAMP,
  expiryDate TIMESTAMP,
  lastValidationDate TIMESTAMP,
  
  -- Pricing
  pricePaid DECIMAL(10, 2),
  currency VARCHAR(10) DEFAULT 'THB',
  paymentReference VARCHAR(255),
  
  -- Metadata
  activationCount INTEGER DEFAULT 0,
  activationRequestId VARCHAR(100),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_licenses_hardware_id ON licenses(hardwareId);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_company ON licenses(companyName);
CREATE INDEX idx_licenses_expiry ON licenses(expiryDate);
```

---

#### **Table: license_installations**

```sql
CREATE TABLE license_installations (
  id SERIAL PRIMARY KEY,
  
  -- License Reference
  licenseId INTEGER REFERENCES licenses(id),
  licenseKey VARCHAR(500),
  
  -- Installation Identity
  installationId VARCHAR(255) NOT NULL UNIQUE,
  hardwareId VARCHAR(255) NOT NULL,
  hardwareFingerprint JSONB,
  
  -- Installation Info
  hostname VARCHAR(255),
  ipAddress VARCHAR(50),
  
  -- Geolocation (From IP)
  country VARCHAR(100),
  countryCode VARCHAR(10),
  region VARCHAR(100),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone VARCHAR(50),
  isp VARCHAR(255),
  
  -- Activation Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Dates
  firstActivationDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lastActivationDate TIMESTAMP,
  
  -- Activity Tracking (KEY FEATURE!)
  lastActivityDate TIMESTAMP,
  lastHeartbeatDate TIMESTAMP,
  isCurrentlyActive BOOLEAN DEFAULT true,
  
  -- Inactivity Detection
  inactiveDays INTEGER DEFAULT 0,
  inactivityThreshold INTEGER DEFAULT 7,
  
  -- Transfer/Release
  isReleased BOOLEAN DEFAULT false,
  releasedDate TIMESTAMP,
  releaseReason TEXT,
  
  -- Metadata
  operatingSystem VARCHAR(100),
  osVersion VARCHAR(100),
  appVersion VARCHAR(50),
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_installations_license ON license_installations(licenseId);
CREATE INDEX idx_installations_hardware ON license_installations(hardwareId);
CREATE INDEX idx_installations_status ON license_installations(status);
CREATE INDEX idx_installations_active ON license_installations(isCurrentlyActive);
CREATE INDEX idx_installations_installation_id ON license_installations(installationId);

-- Unique constraint: ห้ามมี license + hardware ซ้ำที่ active พร้อมกัน
CREATE UNIQUE INDEX idx_unique_active_installation 
ON license_installations(licenseId, hardwareId) 
WHERE status = 'active' AND isCurrentlyActive = true;
```

---

#### **Table: activation_telemetry**

```sql
CREATE TABLE activation_telemetry (
  id SERIAL PRIMARY KEY,
  
  -- License Information
  licenseId INTEGER REFERENCES licenses(id),
  licenseKey VARCHAR(500),
  licenseType VARCHAR(20),
  
  -- Hardware Information
  hardwareId VARCHAR(255),
  hardwareFingerprint JSONB,
  
  -- Network Information
  ipAddress VARCHAR(50),
  ipType VARCHAR(20),
  
  -- Geolocation (From IP)
  country VARCHAR(100),
  countryCode VARCHAR(10),
  region VARCHAR(100),
  city VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone VARCHAR(50),
  isp VARCHAR(255),
  
  -- System Information
  operatingSystem VARCHAR(100),
  osVersion VARCHAR(100),
  hostname VARCHAR(255),
  
  -- Activation Context
  activationType VARCHAR(20),
  previousHardwareId VARCHAR(255),
  
  -- User Consent (PDPA)
  telemetryConsent BOOLEAN DEFAULT false,
  consentTimestamp TIMESTAMP,
  
  -- Metadata
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Anomaly Detection
  isAnomalous BOOLEAN DEFAULT false,
  anomalyReason TEXT,
  
  -- Admin Review
  reviewed BOOLEAN DEFAULT false,
  reviewedBy VARCHAR(255),
  reviewNotes TEXT
);

CREATE INDEX idx_activation_telemetry_license ON activation_telemetry(licenseId);
CREATE INDEX idx_activation_telemetry_hardware ON activation_telemetry(hardwareId);
CREATE INDEX idx_activation_telemetry_ip ON activation_telemetry(ipAddress);
CREATE INDEX idx_activation_telemetry_anomalous ON activation_telemetry(isAnomalous);
CREATE INDEX idx_activation_telemetry_date ON activation_telemetry(createdAt);
```

---

#### **Table: heartbeats**

```sql
CREATE TABLE heartbeats (
  id SERIAL PRIMARY KEY,
  
  licenseId INTEGER REFERENCES licenses(id),
  installationId VARCHAR(255) REFERENCES license_installations(installationId),
  
  -- Activity Info
  heartbeatType VARCHAR(20),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- System State
  systemUptime BIGINT,
  appVersion VARCHAR(50),
  
  -- Usage Metrics (Optional)
  activeUsers INTEGER,
  incidentsToday INTEGER,
  
  -- Network Info
  ipAddress VARCHAR(50),
  
  -- Metadata
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_heartbeats_installation ON heartbeats(installationId);
CREATE INDEX idx_heartbeats_timestamp ON heartbeats(timestamp);
CREATE INDEX idx_heartbeats_license ON heartbeats(licenseId);
```

---

#### **Table: license_pricing**

```sql
CREATE TABLE license_pricing (
  id SERIAL PRIMARY KEY,
  
  licenseType VARCHAR(20) NOT NULL UNIQUE,
  
  -- Display Information
  displayNameTh VARCHAR(100) NOT NULL,
  displayNameEn VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Pricing
  priceThb DECIMAL(10, 2) NOT NULL,
  priceUsd DECIMAL(10, 2),
  discountPercent DECIMAL(5, 2) DEFAULT 0,
  
  -- Duration
  durationDays INTEGER,
  isLifetime BOOLEAN DEFAULT false,
  
  -- Display Settings
  isActive BOOLEAN DEFAULT true,
  displayOrder INTEGER DEFAULT 0,
  isRecommended BOOLEAN DEFAULT false,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Default pricing
INSERT INTO license_pricing 
  (licenseType, displayNameTh, displayNameEn, priceThb, priceUsd, discountPercent, durationDays, displayOrder) 
VALUES 
  ('1_month', '1 เดือน', '1 Month', 10000.00, 300.00, 0, 30, 1),
  ('3_month', '3 เดือน', '3 Months', 25000.00, 750.00, 17, 90, 2),
  ('6_month', '6 เดือน', '6 Months', 45000.00, 1350.00, 25, 180, 3),
  ('12_month', '12 เดือน', '12 Months', 80000.00, 2400.00, 33, 365, 4),
  ('lifetime', 'ตลอดชีพ', 'Lifetime', 300000.00, 9000.00, 0, NULL, 5);

UPDATE license_pricing SET isRecommended = true WHERE licenseType = '12_month';
```

---

#### **Table: activation_requests**

```sql
CREATE TABLE activation_requests (
  id SERIAL PRIMARY KEY,
  
  requestId VARCHAR(100) NOT NULL UNIQUE,
  
  -- Request Information
  licenseId INTEGER REFERENCES licenses(id),
  requestType VARCHAR(50),
  
  -- Requested License
  requestedLicenseType VARCHAR(20),
  requestedDuration VARCHAR(50),
  
  -- Customer Information
  companyName VARCHAR(255),
  companyRegistration VARCHAR(100),
  contactEmail VARCHAR(255),
  contactPhone VARCHAR(50),
  
  -- Hardware Information
  hardwareId VARCHAR(255),
  hardwareDetails JSONB,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Approval
  approvedBy VARCHAR(255),
  approvalDate TIMESTAMP,
  approvalNotes TEXT,
  rejectionReason TEXT,
  
  -- Generated License
  generatedLicenseKey VARCHAR(500),
  emailSent BOOLEAN DEFAULT false,
  emailSentDate TIMESTAMP,
  
  -- Metadata
  requestNotes TEXT,
  ipAddress VARCHAR(50),
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activation_requests_request_id ON activation_requests(requestId);
CREATE INDEX idx_activation_requests_status ON activation_requests(status);
CREATE INDEX idx_activation_requests_license_id ON activation_requests(licenseId);
```

---

#### **Table: customer_change_requests**

```sql
CREATE TABLE customer_change_requests (
  id SERIAL PRIMARY KEY,
  
  requestId VARCHAR(100) NOT NULL UNIQUE,
  
  -- License Reference
  licenseId INTEGER REFERENCES licenses(id),
  
  -- Old Customer Information
  oldCompanyName VARCHAR(255),
  oldContactEmail VARCHAR(255),
  
  -- New Customer Information
  newCompanyName VARCHAR(255),
  newCompanyRegistration VARCHAR(100),
  newContactEmail VARCHAR(255),
  newContactPhone VARCHAR(50),
  newContactPerson VARCHAR(255),
  
  -- Request Details
  reason TEXT,
  supportingDocuments JSONB,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Approval
  approvedBy VARCHAR(255),
  approvalDate TIMESTAMP,
  approvalNotes TEXT,
  rejectionReason TEXT,
  
  -- Metadata
  requestedBy VARCHAR(255),
  ipAddress VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_change_requests_request_id ON customer_change_requests(requestId);
CREATE INDEX idx_customer_change_requests_license_id ON customer_change_requests(licenseId);
CREATE INDEX idx_customer_change_requests_status ON customer_change_requests(status);
```

---

#### **Table: license_transfer_requests**

```sql
CREATE TABLE license_transfer_requests (
  id SERIAL PRIMARY KEY,
  
  requestId VARCHAR(100) NOT NULL UNIQUE,
  
  -- License Reference
  licenseId INTEGER REFERENCES licenses(id),
  licenseKey VARCHAR(500),
  
  -- Old Installation
  oldInstallationId VARCHAR(255) REFERENCES license_installations(installationId),
  oldHardwareId VARCHAR(255),
  oldLocation VARCHAR(255),
  
  -- New Installation
  newHardwareId VARCHAR(255),
  newHardwareFingerprint JSONB,
  newLocation VARCHAR(255),
  
  -- Request Details
  reason TEXT,
  requestType VARCHAR(50),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Approval
  approvedBy VARCHAR(255),
  approvalDate TIMESTAMP,
  approvalNotes TEXT,
  rejectionReason TEXT,
  
  -- Metadata
  requestedBy VARCHAR(255),
  requestedByEmail VARCHAR(255),
  ipAddress VARCHAR(50),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transfer_requests_request_id ON license_transfer_requests(requestId);
CREATE INDEX idx_transfer_requests_license ON license_transfer_requests(licenseId);
CREATE INDEX idx_transfer_requests_status ON license_transfer_requests(status);
```

---

#### **Table: license_config**

```sql
CREATE TABLE license_config (
  id SERIAL PRIMARY KEY,
  
  -- Trial Settings
  trialDays INTEGER DEFAULT 30,
  warningDays INTEGER DEFAULT 7,
  
  -- Admin Contact
  adminEmail VARCHAR(255) DEFAULT 'rachaseth.d@gmail.com',
  adminPhone VARCHAR(50),
  
  -- Hardware Check Settings
  enableStrictHardwareCheck BOOLEAN DEFAULT true,
  allowedHardwareChanges INTEGER DEFAULT 0,
  
  -- Customer Lock Settings
  requireApprovalForCustomerChange BOOLEAN DEFAULT true,
  
  -- System Settings
  enableAutoEmailNotification BOOLEAN DEFAULT true,
  enableLicenseValidation BOOLEAN DEFAULT true,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO license_config (trialDays, warningDays, adminEmail) 
VALUES (30, 7, 'rachaseth.d@gmail.com');
```

---

#### **Table: anomaly_detections**

```sql
CREATE TABLE anomaly_detections (
  id SERIAL PRIMARY KEY,
  
  -- License Reference
  licenseId INTEGER REFERENCES licenses(id),
  licenseKey VARCHAR(500),
  
  -- Anomaly Type
  ruleId VARCHAR(50),
  ruleName VARCHAR(255),
  severity VARCHAR(20),
  
  -- Detection Details
  description TEXT,
  evidence JSONB,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Review
  reviewed BOOLEAN DEFAULT false,
  reviewedBy VARCHAR(255),
  reviewDate TIMESTAMP,
  reviewNotes TEXT,
  
  -- Actions Taken
  actionTaken VARCHAR(50),
  actionDate TIMESTAMP,
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_anomaly_detections_license ON anomaly_detections(licenseId);
CREATE INDEX idx_anomaly_detections_severity ON anomaly_detections(severity);
CREATE INDEX idx_anomaly_detections_status ON anomaly_detections(status);
```

---

## 21.4 🔌 API Endpoints

### **21.4.1 RIM Application APIs (Customer Site)**

```typescript
// ==================== PUBLIC APIs (No Auth Required) ====================

GET    /api/license/status                  // เช็คสถานะ license
GET    /api/license/info                    // ข้อมูล license ปัจจุบัน
GET    /api/license/pricing                 // ดูราคา license ทั้งหมด

POST   /api/license/request-activation      // ขอ activation code
POST   /api/license/activate                // Activate ด้วย license key
POST   /api/license/release                 // Release license (self-service)
POST   /api/license/request-transfer        // ขอ transfer license

GET    /api/license/active-installations    // Get own installation details

// ==================== SUPER ADMIN APIs ====================

GET    /api/admin/license/config            // ดู config
PUT    /api/admin/license/config            // แก้ไข config
GET    /api/admin/license/pricing           // ดูราคา
PUT    /api/admin/license/pricing/:type     // แก้ไขราคา
```

---

### **21.4.2 Central License Server APIs**

```typescript
// ==================== TELEMETRY RECEIVER ====================

POST   /api/telemetry/receive               // รับ telemetry จาก RIM installations
POST   /api/telemetry/activation            // รับ activation events
POST   /api/telemetry/heartbeat             // รับ heartbeat
POST   /api/telemetry/release               // รับ release events

// ==================== ADMIN APIs ====================

// Dashboard & Monitoring
GET    /api/admin/dashboard                 // Dashboard overview
GET    /api/admin/installations             // All installations
GET    /api/admin/installations/map         // Global map data
GET    /api/admin/installations/:id         // Installation details
GET    /api/admin/anomalies                 // Detected anomalies
GET    /api/admin/analytics                 // Usage analytics

// Activation Management
GET    /api/admin/requests                  // Activation requests
GET    /api/admin/requests/:id              // Request details
POST   /api/admin/requests/approve          // Approve & auto-send key
POST   /api/admin/requests/reject           // Reject request
POST   /api/admin/license/generate          // Generate license key

// Customer Change Management
GET    /api/admin/customer-changes          // Customer change requests
POST   /api/admin/customer-changes/approve  // Approve customer change
POST   /api/admin/customer-changes/reject   // Reject customer change

// Transfer Management
GET    /api/admin/transfers                 // Transfer requests
POST   /api/admin/transfers/approve         // Approve transfer
POST   /api/admin/transfers/reject          // Reject transfer

// License Management
GET    /api/admin/licenses                  // All licenses
GET    /api/admin/licenses/:id              // License details
PUT    /api/admin/licenses/:id/suspend      // Suspend license
PUT    /api/admin/licenses/:id/unsuspend    // Unsuspend license
PUT    /api/admin/licenses/:id/extend       // ต่ออายุ license
DELETE /api/admin/licenses/:id              // ลบ license
POST   /api/admin/installations/:id/deactivate  // Deactivate installation
```

---

## 21.5 📄 Key Request/Response Examples

### **21.5.1 Check License Status**

```typescript
// GET /api/license/status
Response (Active):
{
  "success": true,
  "status": "active",
  "license": {
    "companyName": "ABC Company Ltd.",
    "licenseType": "12_month",
    "licenseKey": "RIM-2025-A3F2D8-12M-20261215-X7Y9Z",
    "activationDate": "2025-12-01T10:30:00Z",
    "expiryDate": "2026-12-01T23:59:59Z",
    "daysRemaining": 365
  },
  "installation": {
    "installationId": "INST-20251201-A3F2D8",
    "location": "Bangkok, Thailand",
    "lastActivity": "2025-12-15T10:30:00Z",
    "isCurrentlyActive": true
  }
}
```

---

### **21.5.2 Activate License (with One Active Installation Check)**

```typescript
// POST /api/license/activate
Request:
{
  "licenseKey": "RIM-2025-A3F2D8-12M-20261215-X7Y9Z"
}

Response (Success):
{
  "success": true,
  "message": "License activated successfully",
  "installation": {
    "installationId": "INST-20251215-A3F2D8",
    "status": "active",
    "location": "Bangkok, Thailand"
  }
}

Response (Error - Already Active Elsewhere):
{
  "success": false,
  "error": "LICENSE_IN_USE",
  "message": "This license is currently active on another device",
  "details": {
    "currentInstallation": {
      "installationId": "INST-20251201-B4E5F9",
      "location": "Bangkok, Thailand",
      "hostname": "ABC-SERVER-01",
      "lastActivity": "2025-12-15T09:00:00Z"
    },
    "transferOptions": [
      {
        "option": "release_from_current",
        "description": "Release license from current device"
      },
      {
        "option": "request_transfer",
        "description": "Request admin approval to transfer"
      },
      {
        "option": "contact_support",
        "description": "Contact: rachaseth.d@gmail.com"
      }
    ]
  }
}
```

---

### **21.5.3 Send Heartbeat**

```typescript
// POST /api/telemetry/heartbeat (to Central Server)
Request:
{
  "installationId": "INST-20251215-A3F2D8",
  "licenseKey": "RIM-2025-A3F2D8-12M-20261215-X7Y9Z",
  "heartbeatType": "periodic",
  "systemUptime": 86400,
  "appVersion": "1.0.0",
  "activeUsers": 5,
  "incidentsToday": 12,
  "ipAddress": "203.154.12.34"
}

Response:
{
  "success": true,
  "message": "Heartbeat recorded"
}
```

---

### **21.5.4 Admin: View Active Installations Map**

```typescript
// GET /api/admin/installations/map
Response:
{
  "success": true,
  "summary": {
    "totalInstallations": 175,
    "activeInstallations": 148,
    "inactiveInstallations": 27
  },
  "installations": [
    {
      "licenseKey": "RIM-2025-A3F2D8-12M-20261215-X7Y9Z",
      "company": "ABC Company Ltd.",
      "installationId": "INST-20251201-A3F2D8",
      "location": {
        "country": "Thailand",
        "city": "Bangkok",
        "latitude": 13.7563,
        "longitude": 100.5018
      },
      "status": "active",
      "isCurrentlyActive": true,
      "lastActivity": "2025-12-15T10:30:00Z",
      "inactiveDays": 0
    }
  ]
}
```

---

## 21.6 🎨 UI Mockups

### **21.6.1 In-App License Panel (RIM Application)**

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚙️  System Settings > License Information                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ License Status: ✅ Active                                          │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ License Information                                            │ │
│ ├────────────────────────────────────────────────────────────────┤ │
│ │ Company:         ABC Company Ltd.                              │ │
│ │ License Type:    12 Months                                     │ │
│ │ License Key:     RIM-2025-A3F2D8-12M-20261215-X7Y9Z            │ │
│ │ Activation Date: December 1, 2025                              │ │
│ │ Expiry Date:     December 1, 2026                              │ │
│ │ Days Remaining:  335 days                                      │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ This Installation                                              │ │
│ ├────────────────────────────────────────────────────────────────┤ │
│ │ Installation ID: INST-20251201-A3F2D8                          │ │
│ │ Location:        Bangkok, Thailand                             │ │
│ │ Hostname:        ABC-SERVER-01                                 │ │
│ │ Last Activity:   December 15, 2025 (5 mins ago)                │ │
│ │ Status:          🟢 Active                                     │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ Actions:                                                           │
│ [Release License]  [Request Transfer]  [Contact Support]          │
│                                                                    │
│ ⚠️  Note: You can only see information about this installation.   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### **21.6.2 License Already Active Error**

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚠️  License Already in Use                                    [X]  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ This license is currently active on another device.               │
│                                                                    │
│ Currently Active On:                                               │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 📍 Location:     Bangkok, Thailand                             │ │
│ │ 💻 Hostname:     ABC-SERVER-01                                 │ │
│ │ ⏰ Last Activity: December 15, 2025 (5 hours ago)              │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ What would you like to do?                                         │
│                                                                    │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ Option 1: Release License from Current Device                 │ │
│ │ This will deactivate the old device and activate here.        │ │
│ │                    [Release & Activate Here]                   │ │
│ ├────────────────────────────────────────────────────────────────┤ │
│ │ Option 2: Request Transfer Approval                           │ │
│ │ Submit a request to admin (24-48 hours).                      │ │
│ │                    [Request Transfer]                          │ │
│ ├────────────────────────────────────────────────────────────────┤ │
│ │ Option 3: Contact Support                                     │ │
│ │ Email: rachaseth.d@gmail.com                                   │ │
│ │                    [Contact Support]                           │ │
│ └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

### **21.6.3 Admin Dashboard (Separate Web App)**

```
┌────────────────────────────────────────────────────────────────────┐
│ 🗺️  RIM License Management - Global Dashboard                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ 👤 Admin: rachaseth.d@gmail.com                  [Logout]          │
│                                                                    │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐     │
│ │ Total        │ Active       │ Inactive     │ Suspicious   │     │
│ │ Installations│ Now          │ (7+ days)    │ Activity     │     │
│ ├──────────────┼──────────────┼──────────────┼──────────────┤     │
│ │     175      │     148      │      27      │       3      │     │
│ └──────────────┴──────────────┴──────────────┴──────────────┘     │
│                                                                    │
│ 🚨 Anomalies Detected:                                             │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ 🔴 License used on 3 different hardware                        │ │
│ │    Company: XYZ Corp | Locations: Bangkok, Singapore, NYC      │ │
│ │    [View Details] [Suspend License] [Contact Customer]        │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ 🗺️  Global Installations Map:                                      │
│ ┌────────────────────────────────────────────────────────────────┐ │
│ │ [Interactive Map]                                              │ │
│ │ 🟢 Bangkok, TH        (120 active)                             │ │
│ │ 🟢 Chiang Mai, TH     (15 active)                              │ │
│ │ 🟡 Phuket, TH         (5 inactive)                             │ │
│ │ 🔴 New York, US       (2 suspicious)                           │ │
│ └────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│ [🏠 Dashboard] [📊 Analytics] [🚨 Anomalies] [⚙️  Settings]       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 21.7 🔄 Key Workflows

### **Workflow 1: First Activation (No Conflicts)**

```
User ติดตั้ง RIM ครั้งแรก
  ↓
System Auto-Initialize:
  - Generate hardware ID (SHA256)
  - Create trial license (30 days)
  - INSERT INTO licenses (status='trial')
  ↓
User ใช้งานได้ทันที (Trial) ✅
  ↓
Day 23: Trial expiring notification
  ↓
User clicks [Activate License]
  ↓
Select package → Fill company info → [Request License Key]
  ↓
System:
  - INSERT INTO activation_requests
  - Send email to rachaseth.d@gmail.com
  ↓
Admin receives email → [Approve]
  ↓
System:
  - Generate license key
  - Send email to customer
  ↓
Customer receives key → [Activate]
  ↓
System:
  - Validate key + hardware
  - UPDATE status='active'
  - Send activation telemetry to Central
  ↓
✅ Activated!
  ↓
Start heartbeat (every 1 hour)
```

---

### **Workflow 2: Activation Conflict (License Already Active)**

```
User ติดตั้ง RIM ที่ Device B
  ↓
พยายาม activate license
  ↓
System checks:
  - Query: SELECT FROM license_installations 
           WHERE licenseKey=? AND isCurrentlyActive=true
  - Result: พบ installation ที่ Device A
  ↓
❌ Block activation:
  "License Already in Use"
  Current: Device A (Bangkok)
  Last Activity: 5 hours ago
  ↓
User เลือก:
  
  Option 1: [Release & Activate Here]
    ↓
    System:
      - UPDATE Device A: status='released', isCurrentlyActive=false
      - Send telemetry to Central
      - Proceed with Device B activation
    ↓
    ✅ Device A released, Device B activated
  
  Option 2: [Request Transfer]
    ↓
    System:
      - INSERT INTO license_transfer_requests
      - Send email to admin
    ↓
    Admin [Approve]
    ↓
    System auto-deactivate Device A
    ↓
    User activate Device B ✅
```

---

### **Workflow 3: Heartbeat & Activity Tracking**

```
Background Job (Every 1 hour):
  ↓
Check internet connection
  ↓
ถ้ามี internet:
  
  POST https://license-server.com/api/telemetry/heartbeat
  {
    "installationId": "INST-20251215-A3F2D8",
    "heartbeatType": "periodic",
    "systemUptime": 3600,
    "activeUsers": 5,
    "incidentsToday": 12
  }
  ↓
  Central Server:
    - UPDATE license_installations
      SET lastActivityDate = now,
          lastHeartbeatDate = now,
          isCurrentlyActive = true,
          inactiveDays = 0
    - INSERT INTO heartbeats
  ↓
  ✅ Installation marked as "active"

ถ้าไม่มี internet:
  - Skip (จะส่งครั้งต่อไปเมื่อมี internet)
```

---

### **Workflow 4: Inactivity Detection (Central Server - Daily)**

```
Cron Job (Every day 00:00):
  ↓
SELECT * FROM license_installations WHERE status='active'
  ↓
Loop each installation:
  
  1. Calculate inactiveDays:
     inactiveDays = (now - lastHeartbeatDate) / 86400
  
  2. Update:
     UPDATE license_installations
     SET inactiveDays = ?
  
  3. Mark inactive:
     IF inactiveDays >= 7:
       UPDATE isCurrentlyActive = false
       (License slot ว่างแล้ว → อนุญาตให้ activate ที่อื่นได้)
  
  4. NO auto-cleanup:
     (เก็บ evidence ไว้ สำหรับดำเนินการทางกฎหมาย)
     ❌ ไม่ลบอัตโนมัติ
     ✅ Admin ตัดสินใจเอง
```

---

### **Workflow 5: Anomaly Detection (Central Server - Daily)**

```
Cron Job (Every day 00:00):
  ↓
Run detection rules:
  
  Rule 1: Multiple Hardware IDs
    - Same licenseKey on 3+ different hardware
    → CRITICAL
    → Send email alert to admin
  
  Rule 2: Geographic Jump
    - Bangkok → New York in < 2 hours
    → CRITICAL
    → Likely crack
  
  Rule 3: Simultaneous Usage
    - 2+ heartbeats from different IPs within 5 mins
    → HIGH
    → Possible license sharing
  
  Rule 4: Lifetime License Abuse
    - Lifetime license activated 5+ times in different countries
    → CRITICAL
    → Crack detected
  ↓
INSERT INTO anomaly_detections
  ↓
Send alert email to rachaseth.d@gmail.com:
  "🚨 License Anomaly Detected"
  - License Key
  - Anomaly Type
  - Evidence (IPs, locations, hardware IDs)
  - Recommended action
  ↓
Admin reviews in dashboard
  ↓
Admin actions:
  - [Suspend License]
  - [Contact Customer]
  - [Mark as False Positive]
  - [Collect Evidence for Legal Action]
```

---

## 21.8 🔒 Security Features

### **21.8.1 Hardware Binding**

```typescript
// Generate Hardware ID (SHA256 hash)
function generateHardwareId(): string {
  const data = {
    macAddress: getMacAddress(),      // 00:11:22:33:44:55
    cpuId: getCpuId(),                // BFEBFBFF000906E9
    motherboardSerial: getMBSerial(), // MS-7C84
    diskSerial: getDiskSerial()       // WD-WX12A34567890
  };
  
  const payload = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  
  return hash; // a3f2d8c4e5f6a7b8c9d0e1f2a3b4c5d6...
}

// License key contains hardware hash
License Key Format:
  RIM-YYYY-HWWWWW-TYPE-YYYYMMDD-CCCCC
  
  RIM-2025-A3F2D8-12M-20261215-X7Y9Z
       │    │      │      │       │
       │    │      │      │       └─ Checksum (HMAC-SHA256)
       │    │      │      └───────── Expiry Date
       │    │      └──────────────── Type (12 Months)
       │    └─────────────────────── Hardware Hash (first 6 chars)
       └──────────────────────────── Product + Year

// Validation
if (licenseKeyHardwareHash !== currentHardwareHash.substring(0, 6)) {
  throw new Error('Hardware mismatch - License not valid for this device');
}
```

**Benefits:**
- ✅ ป้องกันการ copy license key ไปใช้เครื่องอื่น
- ✅ One license = One hardware
- ✅ Cannot bypass with VM cloning

---

### **21.8.2 License Key Checksum**

```typescript
// Generate license key with HMAC checksum
function generateLicenseKey(hardwareId: string, type: string, expiry: Date): string {
  const year = new Date().getFullYear();
  const hwHash = hardwareId.substring(0, 6).toUpperCase();
  const typeCode = getLicenseTypeCode(type); // '12M', 'LIFE', etc.
  const expiryStr = formatDate(expiry, 'YYYYMMDD');
  
  const payload = `RIM-${year}-${hwHash}-${typeCode}-${expiryStr}`;
  
  // Generate checksum
  const secret = process.env.LICENSE_SECRET_KEY;
  const checksum = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
    .substring(0, 5)
    .toUpperCase();
  
  return `${payload}-${checksum}`;
}

// Validate checksum
function validateLicenseKey(key: string): boolean {
  const parts = key.split('-');
  const checksum = parts[parts.length - 1];
  const payload = parts.slice(0, -1).join('-');
  
  const expectedChecksum = crypto
    .createHmac('sha256', process.env.LICENSE_SECRET_KEY)
    .update(payload)
    .digest('hex')
    .substring(0, 5)
    .toUpperCase();
  
  return checksum === expectedChecksum;
}
```

**Benefits:**
- ✅ ตรวจจับการแก้ไข license key
- ✅ Cannot generate valid key without secret
- ✅ Tamper-proof

---

### **21.8.3 One Active Installation Policy**

```sql
-- Database constraint
CREATE UNIQUE INDEX idx_unique_active_installation 
ON license_installations(licenseId, hardwareId) 
WHERE status = 'active' AND isCurrentlyActive = true;

-- Application logic
async function activate(licenseKey: string, hardwareId: string) {
  // Check if already active elsewhere
  const activeInstallation = await db.query(`
    SELECT * FROM license_installations
    WHERE licenseKey = $1
    AND status = 'active'
    AND isCurrentlyActive = true
    AND hardwareId != $2
  `, [licenseKey, hardwareId]);
  
  if (activeInstallation.length > 0) {
    throw new Error({
      code: 'LICENSE_IN_USE',
      message: 'License is active on another device',
      currentInstallation: activeInstallation[0]
    });
  }
  
  // Proceed with activation...
}
```

**Benefits:**
- ✅ ป้องกัน license sharing
- ✅ 1 license = 1 active device only
- ✅ Clear error message

---

### **21.8.4 Geolocation Tracking (PDPA Compliant)**

```typescript
// Get geolocation from IP (not GPS)
import maxmind from 'maxmind';

async function getGeolocation(ipAddress: string) {
  const geoip = await maxmind.open('GeoLite2-City.mmdb');
  const geo = geoip.get(ipAddress);
  
  return {
    country: geo.country.names.en,
    countryCode: geo.country.iso_code,
    city: geo.city?.names?.en,
    latitude: geo.location.latitude,   // ±5-50 km accuracy
    longitude: geo.location.longitude, // Not GPS precise
    timezone: geo.location.time_zone,
    isp: geo.traits.isp
  };
}

// Store in activation_telemetry
INSERT INTO activation_telemetry (
  licenseKey,
  ipAddress,
  country,
  city,
  latitude,
  longitude,
  telemetryConsent // PDPA compliance
)
```

**PDPA Compliance:**
- ✅ IP geolocation เป็น public information
- ✅ ความแม่นยำต่ำ (±5-50 km)
- ✅ ไม่ใช่ GPS tracking
- ✅ User consent required (ToS)

---

### **21.8.5 Terms of Service & User Consent**

```
┌────────────────────────────────────────────────────────────────────┐
│ 📜 Terms of Service & Privacy Policy                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ Before using RIM System, please read and accept:                  │
│                                                                    │
│ 2. DATA COLLECTION & TELEMETRY                                     │
│                                                                    │
│ To prevent unauthorized use, we collect:                           │
│ ✅ License activation data                                         │
│ ✅ Hardware identifiers (MAC, CPU ID)                              │
│ ✅ IP address and approximate location (country/city)              │
│ ✅ System usage statistics                                         │
│ ✅ Periodic heartbeat signals                                      │
│                                                                    │
│ Used ONLY for:                                                     │
│ • Preventing software piracy                                       │
│ • Detecting unauthorized use                                       │
│ • Improving license security                                       │
│                                                                    │
│ We DO NOT collect:                                                 │
│ ❌ GPS location or real-time tracking                              │
│ ❌ Personal identifiable information                               │
│ ❌ Your business data                                              │
│                                                                    │
│ ☐ I have read and agree to the Terms of Service                   │
│ ☐ I consent to data collection for license validation             │
│                                                                    │
│                    [Decline]            [Accept & Continue]        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 21.9 🚨 Anti-Piracy Features

### **21.9.1 Anomaly Detection Rules**

```typescript
const detectionRules = [
  {
    id: 'RULE-001',
    name: 'Multiple Hardware IDs',
    severity: 'CRITICAL',
    condition: (license) => {
      const uniqueHardware = getUniqueHardwareCount(license.id);
      return uniqueHardware > 2;
    },
    action: 'ALERT_ADMIN'
  },
  
  {
    id: 'RULE-002',
    name: 'Geographic Anomaly',
    severity: 'CRITICAL',
    condition: async (license) => {
      const activations = await getRecentActivations(license.id, 24);
      if (activations.length < 2) return false;
      
      const distance = calculateDistance(
        activations[0].latitude, activations[0].longitude,
        activations[1].latitude, activations[1].longitude
      );
      
      const timeDiff = Math.abs(
        activations[0].timestamp - activations[1].timestamp
      ) / 3600000;
      
      // Bangkok → New York in < 2 hours = Impossible
      return distance > 1000 && timeDiff < 2;
    },
    action: 'SUSPEND_LICENSE'
  },
  
  {
    id: 'RULE-003',
    name: 'Simultaneous Usage',
    severity: 'HIGH',
    condition: async (license) => {
      const heartbeats = await getRecentHeartbeats(license.id, 5);
      const uniqueIPs = new Set(heartbeats.map(h => h.ipAddress));
      return uniqueIPs.size > 1;
    },
    action: 'ALERT_ADMIN'
  },
  
  {
    id: 'RULE-004',
    name: 'Lifetime License Abuse',
    severity: 'CRITICAL',
    condition: async (license) => {
      if (license.type !== 'lifetime') return false;
      
      const activationCount = await getActivationCount(license.id);
      const uniqueCountries = await getUniqueCountryCount(license.id);
      
      // Lifetime license in 5+ countries = Crack
      return activationCount > 5 && uniqueCountries > 3;
    },
    action: 'SUSPEND_LICENSE'
  }
];
```

---

### **21.9.2 Evidence Collection**

```
Admin Dashboard: Evidence Package

┌──────────────────────────────────────────┐
│ License: RIM-2025-C5F6A7-LIFE            │
│ Customer: XYZ Corp (Original)            │
├──────────────────────────────────────────┤
│                                          │
│ 📍 Suspicious Activations:               │
│                                          │
│ 1. Bangkok, TH (Legitimate)              │
│    IP: 203.154.12.34                     │
│    Date: Dec 1, 2025                     │
│    Hardware: a3f2d8c4e5f6...             │
│                                          │
│ 2. Singapore (Suspicious)                │
│    IP: 42.118.45.67                      │
│    Date: Dec 5, 2025                     │
│    Hardware: b4e5f9a1b2c3... (different!)│
│    ⚠️  Geographic jump: 1,436 km         │
│                                          │
│ 3. New York, US (Piracy)                 │
│    IP: 185.220.101.5                     │
│    Date: Dec 8, 2025                     │
│    Hardware: c5f6a2b3d4e5... (different!)│
│    ⚠️  Geographic jump: 15,343 km        │
│                                          │
│ 📊 Evidence:                             │
│ • Activation logs with timestamps        │
│ • IP addresses & geolocation             │
│ • Hardware fingerprints                  │
│ • Heartbeat history                      │
│                                          │
│ [Export Evidence PDF]                    │
│ [Contact Customer]                       │
│ [Suspend License]                        │
│ [Legal Action]                           │
└──────────────────────────────────────────┘
```

**ไม่มี Auto-Cleanup:**
- ✅ เก็บข้อมูลทั้งหมดไว้
- ✅ Admin ตัดสินใจเองว่าจะลบหรือไม่
- ✅ พร้อมสำหรับดำเนินการทางกฎหมาย
- ❌ ไม่ลบ installations อัตโนมัติ

---

## 21.10 📧 Email Templates

### **21.10.1 Activation Request (to Admin)**

```
Subject: 🔑 [RIM] New License Activation Request - ABC Company Ltd.

Dear Rachaseth,

New activation request:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUEST INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Request ID:     REQ-20251215-001
Request Date:   December 15, 2025
Status:         Pending Approval

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CUSTOMER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Company:         ABC Company Ltd.
Registration:    0105512345678
Contact Person:  John Doe
Email:           contact@abc.com
Phone:           02-123-4567

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LICENSE REQUEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

License Type:   12 Months
Price:          80,000 THB (33% discount)
Duration:       365 days
Expiry Date:    December 15, 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARDWARE INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hardware ID:    a3f2d8c4e5f6a7b8c9d0e1f2a3b4c5d6...
MAC Address:    00:11:22:33:44:55
Hostname:       ABC-SERVER-01
Location:       Bangkok, Thailand

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[✅ Approve & Send License Key]
[❌ Reject Request]

Admin Panel:
https://license-admin.yourdomain.com/requests/REQ-20251215-001
```

---

### **21.10.2 License Key Sent (to Customer)**

```
Subject: ✅ [RIM] Your License Key is Ready!

Dear ABC Company Ltd.,

Your RIM license activation request has been approved!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR LICENSE KEY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────────────────────────────────────┐
│  RIM-2025-A3F2D8-12M-20261215-X7Y9Z            │
└────────────────────────────────────────────────┘

License Type:    12 Months
Valid Until:     December 15, 2026
Company:         ABC Company Ltd.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO ACTIVATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Open RIM System
2. Click [Activate License]
3. Paste the license key above
4. Click [Activate]

⚠️  IMPORTANT:
   - This key is tied to your hardware
   - Do not share with others

Thank you for choosing RIM!
```

---

### **21.10.3 Anomaly Alert (to Admin)**

```
Subject: 🚨 [RIM] CRITICAL: License Crack Detected

Dear Rachaseth,

CRITICAL anomaly detected:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANOMALY DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

License Key:  RIM-2025-C5F6A7-LIFE
Company:      XYZ Corp
Severity:     CRITICAL
Detected:     December 15, 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVIDENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Same license used on 3 different hardware:

1. Bangkok, Thailand
   IP: 203.154.12.34
   Hardware: a3f2d8c4e5f6...
   
2. Singapore
   IP: 42.118.45.67
   Hardware: b4e5f9a1b2c3... (different!)
   
3. New York, USA
   IP: 185.220.101.5
   Hardware: c5f6a2b3d4e5... (different!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED ACTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[🚨 Suspend License Immediately]
[📧 Contact Customer]
[📊 View Full Evidence]

Admin Panel:
https://license-admin.yourdomain.com/anomalies/...
```

---

## 21.11 ✅ Validation Rules

### **License Key:**
- Format: `RIM-YYYY-XXXXXX-TYPE-YYYYMMDD-XXXXX`
- Checksum must match (HMAC-SHA256)
- Hardware hash must match current device
- Expiry date must not be past

### **Customer Information:**
- Company name: 3-255 characters, required
- Email: Valid email format, required
- Phone: 9-20 characters, required
- Registration: 10-13 digits (optional)

### **One Active Installation:**
- Only 1 active installation per license
- Block if already active elsewhere
- Provide clear error message with options

### **Inactivity Threshold:**
- 7 days no heartbeat = mark inactive
- 30+ days inactive = kept (not deleted)
- Admin decides when to remove

---

## 21.12 📊 Integration Points

**Feature 17 integrates with:**

1. **System Startup (main.ts)**
   - License validation on server start
   - Global guard on all routes

2. **Authentication (Feature 1)**
   - License check before login allowed

3. **All Features (Global)**
   - License guard blocks all APIs if expired
   - Except license-related endpoints

4. **Email Notifications (Feature 9)**
   - Activation requests
   - License keys
   - Anomaly alerts
   - Expiry warnings

5. **Activity Logs (Feature 22)**
   - License activations
   - Releases
   - Transfers
   - Suspensions

---

## 21.13 🧪 Testing Checklist

**Unit Tests:**
- [✅] Hardware ID generation
- [✅] License key generation
- [✅] License key validation
- [✅] Checksum verification
- [✅] Geolocation from IP

**Integration Tests:**
- [✅] First activation (trial)
- [✅] License activation (success)
- [✅] License activation (already active)
- [✅] License release
- [✅] License transfer request
- [✅] Heartbeat sending
- [✅] Inactivity detection
- [✅] Anomaly detection

**UI Tests:**
- [✅] License panel (in-app)
- [✅] Activation dialogs
- [✅] Error messages
- [✅] Admin dashboard
- [✅] Map visualization

**Security Tests:**
- [✅] Cannot activate with invalid key
- [✅] Cannot activate on different hardware
- [✅] Cannot bypass license check
- [✅] Cannot access admin dashboard (customer)
- [✅] Telemetry data encrypted (HTTPS)

**Anomaly Detection Tests:**
- [✅] Multiple hardware detection
- [✅] Geographic anomaly detection
- [✅] Simultaneous usage detection
- [✅] Lifetime license abuse detection

---

## 21.14 🎯 Success Metrics

**For Admin:**
- ✅ Time to approve activation: < 5 mins
- ✅ Anomaly detection accuracy: > 95%
- ✅ False positive rate: < 5%
- ✅ Evidence completeness: 100%

**For Customers:**
- ✅ Activation success rate: > 98%
- ✅ Self-service release rate: > 80%
- ✅ Support ticket reduction: > 50%

**For System:**
- ✅ Heartbeat reliability: > 99%
- ✅ Telemetry latency: < 1 second
- ✅ Dashboard uptime: > 99.9%

---

## 21.15 🚀 Deployment Architecture

### **Production Setup:**

```
Customer Sites (Multiple):
  ┌──────────────────────────────────┐
  │  RIM Application                 │
  │  • Next.js Frontend              │
  │  • NestJS Backend                │
  │  • PostgreSQL (Local)            │
  │  • License telemetry agent       │
  └──────────────────────────────────┘
  On-premise or Customer VPS

Central License Server:
  ┌──────────────────────────────────┐
  │  License Management Server       │
  │  • Next.js Dashboard             │
  │  • NestJS API                    │
  │  • PostgreSQL (Central)          │
  │  • Anomaly detection engine      │
  └──────────────────────────────────┘
  Your VPS/Cloud
  URL: https://license-admin.yourdomain.com
  
  Requirements:
  • VPS: 2 CPU, 4GB RAM, 50GB SSD
  • SSL Certificate (Let's Encrypt)
  • Daily backup
  • Monitoring (Uptime, Logs)
```

**Cost Estimate:**
- VPS: $20-50/month
- Domain: $12/year
- SSL: Free (Let's Encrypt)
- MaxMind GeoIP: Free (GeoLite2) or $1,000/year (Premium)
- **Total: ~$25-55/month**

---

## 21.16 💡 Key Benefits

### **For Admin (Rachaseth):**
- ✅ **Full Visibility** - See all installations globally
- ✅ **Crack Detection** - Automatic anomaly detection
- ✅ **Evidence Collection** - Ready for legal action
- ✅ **Easy Management** - One dashboard for all customers
- ✅ **Auto-Approval** - Click to generate & send keys

### **For Customers:**
- ✅ **Easy Activation** - Simple process
- ✅ **Self-Service** - Release & transfer without admin
- ✅ **Transparent** - See own license status
- ✅ **No Surprises** - Clear ToS and consent

### **For System:**
- ✅ **Security** - Hardware binding + checksum
- ✅ **Flexibility** - Configurable pricing
- ✅ **Scalability** - Handles thousands of installations
- ✅ **PDPA Compliant** - Legal and ethical
- ✅ **Evidence-Ready** - No auto-cleanup

---

## 21.17 🎓 Summary

**Feature 17: License & Activation System** provides:

✅ **License Control:**
- 30-day trial period
- Offline license key system
- Hardware binding (anti-clone)
- Customer lock with approval

✅ **Active Usage Tracking:**
- Know which installations are actually in use
- Heartbeat every 1 hour
- Inactive after 7 days no heartbeat
- No auto-cleanup (evidence kept)

✅ **One Active Installation:**
- 1 license = 1 active device
- Block if already active elsewhere
- Self-service release option

✅ **Anti-Piracy:**
- Automatic anomaly detection
- Geographic tracking (PDPA compliant)
- Evidence collection
- Alert system

✅ **Separate Dashboard:**
- Admin-only access
- Global installations map
- Real-time monitoring
- Outside RIM application

✅ **Security & Compliance:**
- HMAC checksum validation
- Terms of Service & user consent
- PDPA compliant (no GPS tracking)
- Complete audit trail

**Result:** Complete license management system with anti-piracy, active usage tracking, and legal compliance.

---

**END OF FEATURE 17**


## 22. System Settings & Configuration

### 21.1 Settings Table
```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  dataType VARCHAR(20),
  description TEXT,
  category VARCHAR(50),
  isEditable BOOLEAN DEFAULT true,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedBy INTEGER REFERENCES users(id)
);
```

### 15.2 Key Settings
```
company_name          # ชื่อบริษัท (เช่น "Watsons Thailand")
company_logo          # Path ไปยังไฟล์โลโก้
ticket_prefix         # Prefix ของ Ticket (เช่น "WAT", "KFC", "NTT")
                      # ใช้ใน Ticket Number: [PREFIX][YY][MM][XXXX]
                      # ตัวอย่าง: WAT2511001
smtp_host             # SMTP Server
smtp_port             # SMTP Port (587, 465)
smtp_user             # SMTP Username
smtp_password         # SMTP Password
rating_token_expiry_days  # จำนวนวันที่ Rating Token หมดอายุ (default: 30)
rating_enabled        # เปิด/ปิดระบบ Rating (true/false)
```

---

## 23. Activity Logs & Audit Trail

```sql
CREATE TABLE activity_logs (
  id SERIAL PRIMARY KEY,
  userId INTEGER REFERENCES users(id),
  entityType VARCHAR(50),
  entityId INTEGER,
  action VARCHAR(50),
  changes TEXT,
  ipAddress VARCHAR(45),
  userAgent TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 24. Notifications

```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  incidentId INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN DEFAULT false,
  readAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 25. Reports & Data Export

### 24.1 API Endpoints
```typescript
GET    /api/reports/incidents             // Incident reports
GET    /api/reports/technicians           // Performance
GET    /api/reports/stores                // Store summary
GET    /api/reports/sla                   // SLA compliance
GET    /api/reports/ratings               // Rating reports
GET    /api/reports/export/excel          // Export Excel
```

### 24.2 🔒 Read Only - Report Permissions (Permission-based Access)

**Read Only Role มีระบบ Permission แยกรายรายงาน**

#### **Table: user_report_permissions** (เพิ่มใหม่)
```sql
CREATE TABLE user_report_permissions (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reportType VARCHAR(50) NOT NULL,
  -- 'dashboard', 'incidents', 'technicians', 'stores', 
  -- 'sla', 'ratings', 'payments', 'performance'
  canView BOOLEAN DEFAULT true,
  canExport BOOLEAN DEFAULT false,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  createdBy INTEGER REFERENCES users(id),
  
  UNIQUE(userId, reportType)
);

CREATE INDEX idx_user_report_permissions_userId ON user_report_permissions(userId);
```

#### **ตัวอย่างการกำหนด Permission:**

**Case 1: ลูกค้า A (Read Only) - เห็นเฉพาะ SLA**
```sql
INSERT INTO user_report_permissions (userId, reportType, canView, canExport) VALUES
(101, 'dashboard', true, false),        -- เห็น Dashboard
(101, 'sla', true, true),               -- เห็น + Export SLA Report
(101, 'incidents', false, false),       -- ไม่เห็น Incident Report
(101, 'technicians', false, false),     -- ❌ ไม่เห็นรายชื่อ Technician
(101, 'ratings', false, false),         -- ไม่เห็น Rating Report
(101, 'payments', false, false);        -- ไม่เห็น Payment Report
```

**Case 2: ลูกค้า B (Read Only) - เห็นเฉพาะ Incidents ของสาขาตัวเอง**
```sql
INSERT INTO user_report_permissions (userId, reportType, canView, canExport) VALUES
(102, 'dashboard', true, false),        -- เห็น Dashboard
(102, 'incidents', true, true),         -- เห็น + Export Incident Report (filter by store)
(102, 'stores', true, false),           -- เห็น Store Info
(102, 'technicians', false, false),     -- ❌ ไม่เห็นรายชื่อ Technician
(102, 'sla', false, false),             -- ไม่เห็น SLA Report
(102, 'performance', false, false);     -- ไม่เห็น Performance Report
```

#### **API Permission Check:**
```typescript
// Middleware สำหรับ Read Only Users
async function checkReportPermission(userId: number, reportType: string): Promise<boolean> {
  const permission = await db.query(`
    SELECT canView 
    FROM user_report_permissions 
    WHERE userId = $1 AND reportType = $2
  `, [userId, reportType]);
  
  if (!permission) {
    return false; // ไม่มี permission record = ไม่อนุญาต
  }
  
  return permission.canView;
}

// ตัวอย่างการใช้งาน:
app.get('/api/reports/technicians', async (req, res) => {
  const user = req.user; // จาก JWT
  
  if (user.roles.includes('read_only')) {
    const hasPermission = await checkReportPermission(user.id, 'technicians');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Access denied to this report' });
    }
  }
  
  // ... ดึงข้อมูล report
});
```

#### **Available Report Types:**

| reportType | คำอธิบาย | ตัวอย่าง Use Case |
|------------|---------|------------------|
| `dashboard` | Dashboard หน้าหลัก | สถิติภาพรวม, KPI |
| `incidents` | รายงาน Incidents | รายการงานทั้งหมด/ตามสาขา |
| `technicians` | รายงานรายชื่อ Technician | ❌ **Sensitive** - ข้อมูลพนักงาน |
| `stores` | รายงานข้อมูลสาขา | ที่ตั้ง, IPs, เบอร์ติดต่อ |
| `sla` | รายงาน SLA Compliance | ทัน/ไม่ทัน SLA |
| `ratings` | รายงาน Customer Ratings | คะแนนประเมิน, Comments |
| `payments` | รายงานการเงิน Outsource | ❌ **Sensitive** - ข้อมูลการเงิน |
| `performance` | รายงานประสิทธิภาพ | ❌ **Sensitive** - Performance ช่าง |

#### **Best Practices:**
1. ✅ **Default Deny**: ถ้าไม่มี record = ไม่อนุญาต
2. ✅ **Granular Control**: แยก canView, canExport
3. ✅ **Audit Trail**: บันทึก createdBy (ใครกำหนด permission)
4. ✅ **Sensitive Data**: รายงานที่มีข้อมูลพนักงาน/การเงิน ควรระมัดระวัง

### 24.3 🎨 UI Layout - Report Permission Management

**Page: Edit User Report Permissions** (Super Admin only)
```
┌──────────────────────────────────────────────────────────────┐
│ User: John Doe (Read Only)                        [Save]     │
│ Configure Report Access Permissions                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Report Type         │ Can View │ Can Export │ Description   │
├─────────────────────┼──────────┼────────────┼───────────────┤
│ 📊 Dashboard        │ ☑        │ ☐          │ Overview      │
│ 🎫 Incidents        │ ☐        │ ☐          │ All incidents │
│ 👥 Technicians      │ ☐        │ ☐          │ ⚠️ Sensitive   │
│ 🏪 Stores           │ ☑        │ ☐          │ Store info    │
│ ⏱️ SLA              │ ☑        │ ☑          │ SLA reports   │
│ ⭐ Ratings          │ ☐        │ ☐          │ Customer rate │
│ 💰 Payments         │ ☐        │ ☐          │ ⚠️ Sensitive   │
│ 📈 Performance      │ ☐        │ ☐          │ ⚠️ Sensitive   │
└──────────────────────────────────────────────────────────────┘

ในตัวอย่างนี้:
- User เห็น: Dashboard, Stores, SLA
- User Export ได้: เฉพาะ SLA
- User ไม่เห็น: Incidents, Technicians, Ratings, Payments, Performance
```

**Page: Reports List (Read Only User View)**
```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Reports                                                   │
├──────────────────────────────────────────────────────────────┤
│ Available Reports:                                           │
│                                                              │
│ ✅ Dashboard                                  [View]         │
│    Overview statistics and KPIs                              │
│                                                              │
│ ✅ Store Information                          [View]         │
│    Store locations and details                               │
│                                                              │
│ ✅ SLA Reports                    [View] [📥 Export Excel]   │
│    SLA compliance and statistics                             │
│                                                              │
│ ❌ Incident Reports                                          │
│    🔒 Access denied                                          │
│                                                              │
│ ❌ Technician List                                           │
│    🔒 Access denied                                          │
│                                                              │
│ ❌ Payment Reports                                           │
│    🔒 Access denied                                          │
└──────────────────────────────────────────────────────────────┘
```

---

# PART 5: DEPLOYMENT & SUPPORT

## 26. Security Requirements

- JWT Authentication
- bcrypt Password Hashing
- HTTPS in Production
- Rate Limiting on Public APIs
- SQL Injection Prevention
- XSS Prevention

---

## 27. Deployment Model

**Single-tenant Installation:**
- 1 ระบบต่อ 1 ลูกค้า
- แยก Database กัน
- ตั้งค่าอิสระ (Logo, Prefix, Email)

---

## 28. Training & Documentation

- User Manual (PDF)
- Admin Guide (PDF)
- API Documentation (Swagger)
- Rating System Guide
- Email Configuration Guide

---

## 29. Support & Maintenance

### 28.1 Schedule
- Daily: Database backup
- Weekly: Log review
- Monthly: Performance analysis
- Quarterly: Security updates

---

# APPENDIX

## APPENDIX A: Complete Database Schema

```
33 Tables Total:

Core Tables:
1. users
2. roles
3. user_roles
4. companies
5. stores (+ business hours: businessHoursStart, businessHoursEnd, isOpen24Hours, closedDays)
6. categories

Incident Management:
7. incidents (+ cancellation fields + SLA fields + equipmentId)
8. incident_comments
9. incident_files (+ fileType, checkinId)
10. incident_status_history
11. incident_ratings
12. incident_checkins (🆕 Check-in/Check-out tracking)
13. incident_reassignments (🆕 v3.9 - Reassignment tracking)

Equipment Management:
14. equipment (🆕 Asset management - Asset Tag, Barcode, Serial Number, Warranty)
15. equipment_incidents (🆕 Link between equipment and incidents, replacement tracking)

Knowledge Base & Intelligence:
16. knowledge_articles (🆕 KB articles with full-text search, versioning)
17. knowledge_article_feedback (🆕 Article ratings and feedback)
18. incident_knowledge_links (🆕 Link KB articles to incidents)

Backup & Restore:
19. backup_configs (🆕 Backup configuration and schedules)
20. backup_history (🆕 Backup execution history with checksums)
21. restore_history (🆕 Restore operation tracking)
22. backup_logs (🆕 Detailed backup process logs)

Performance Management:
23. technician_performance_scores (🆕 Technician performance metrics, grades, rankings)

Outsource/Job Marketplace:
24. incident_job_offers
25. outsource_technician_profiles

SLA & Scheduling:
26. sla_policies (+ priorityLabel - customizable)
27. holidays (🆕 Public holidays tracking)

Notifications & Logs:
28. notifications
29. activity_logs
30. email_logs

Settings & Permissions:
31. settings
32. user_report_permissions (🆕 Read Only permissions)
33. password_reset_tokens (🆕 Password reset functionality)
```

---

## APPENDIX B: Complete API Reference

**Total Endpoints:** 135+ APIs covering all system features

All API endpoints are documented within their respective features (Part 2-3) with complete request/response examples, authentication requirements, and usage guidelines.

**New in v3.6:**
- Knowledge Base: 15+ endpoints (articles, feedback, search, analytics)
- Incident Intelligence: 5+ endpoints (similar incidents, KB suggestions, linking)

**New in v3.7:**
- Backup & Restore: 15+ endpoints (config, backup CRUD, restore, verification, logs)

**New in v3.8:**
- Performance Management: 10+ endpoints (scores, history, leaderboard, comparison, settings)

**New in v3.9:**
- Reassignment System: 5 endpoints (reassign, history, my-reassigned, respond, stats)

---

## APPENDIX C: Glossary

- **Incident:** รายการแจ้งซ่อม
- **Ticket:** หมายเลข Incident
- **SLA:** เป้าหมายเวลาในการแก้ไข
- **Outsource:** ช่างภายนอก
- **Rating Token:** UUID สำหรับประเมิน (ไม่ต้อง login)

---

## APPENDIX D: Change Log

# 📋 SRS v3.10.1 - Change Log & Summary

**วันที่อัพเดท:** 15 ธันวาคม 2025  
**เวอร์ชัน:** 3.10.1 - License & Activation System

---

## ✨ What's New in v3.10.1

### 🎯 Major Addition: Feature 17 - License & Activation System

**Purpose:** ระบบควบคุมการใช้งานและป้องกันการละเมิดลิขสิทธิ์ พร้อม Anti-Piracy Telemetry และ Active Usage Tracking

**Core Capabilities:**

✅ **Offline License Key System:**
- Trial 30 วัน (ใช้งานได้ทันทีหลังติดตั้ง)
- Hardware Binding (ป้องกัน clone)
- License key format: RIM-YYYY-XXXXXX-TYPE-YYYYMMDD-XXXXX
- HMAC-SHA256 checksum (tamper-proof)

✅ **One Active Installation Policy:**
- 1 license = 1 active device only
- Block activation if already active elsewhere
- Clear error message with resolution options
- Self-service release mechanism

✅ **Active Usage Tracking:**
- Heartbeat every 1 hour (background)
- Track last activity date
- Auto-mark inactive after 7 days no heartbeat
- **No auto-cleanup** (keep evidence for legal action)

✅ **Anti-Piracy Telemetry:**
- Geolocation from IP (PDPA compliant)
- Anomaly detection (multiple hardware, geographic jumps)
- Crack detection dashboard
- Evidence collection for legal action
- Alert system (email notifications)

✅ **Two-Tier Architecture:**
- **RIM App (Customer Site):** License panel (limited view)
- **Central License Server:** Admin dashboard (global monitoring)
- Complete separation (customer cannot access admin dashboard)

✅ **Database Schema (11 Tables):**
- licenses (local + central)
- license_installations
- activation_telemetry
- heartbeats
- license_pricing (configurable)
- activation_requests
- customer_change_requests
- license_transfer_requests
- license_config
- anomaly_detections

✅ **API Endpoints (30+ endpoints):**
- Public APIs: status, activate, release, request
- Telemetry APIs: receive, heartbeat
- Admin APIs: dashboard, monitoring, approvals
- License management: suspend, extend, delete

✅ **Security Features:**
- Hardware binding (MAC + CPU + Motherboard + Disk → SHA256)
- Checksum validation (HMAC-SHA256)
- Terms of Service & user consent (PDPA)
- Encrypted telemetry (HTTPS)
- One active installation enforcement

✅ **Admin Dashboard (Separate Server):**
- URL: https://license-admin.yourdomain.com
- Access: rachaseth.d@gmail.com only
- Global installations map (real-time)
- Active vs inactive tracking
- Anomaly detection dashboard
- Evidence package export
- License management (approve, suspend, extend)

✅ **Email Notifications:**
- Activation requests → Admin
- License keys → Customer
- Anomaly alerts → Admin
- Expiry warnings → Customer
- Auto-send after approval

✅ **Workflows:**
- First activation (trial)
- Request activation → Admin approve → Auto-send key
- Activate with conflict → Release or transfer
- Heartbeat & activity tracking
- Inactivity detection (no auto-cleanup)
- Anomaly detection (daily)
- Evidence collection

---

## 🏗️ Architecture Highlights

### **Two-Tier Design:**

```
Customer Site (RIM App):
  • License panel (view own license only)
  • Telemetry agent (background)
  • Local database (minimal)
  ↓ HTTPS
Central License Server:
  • Admin dashboard (global view)
  • Anomaly detection engine
  • Central database (complete)
  • Background jobs
```

**Benefits:**
- ✅ Customer cannot see other installations
- ✅ Admin dashboard outside RIM app
- ✅ No "god mode" in production
- ✅ Complete data separation

---

## 📊 Documentation Updates (v3.10.1)

**New Feature Added:**
- **Feature 17: License & Activation System** (Section 21)

**Sections Renumbered:**
- PART 4: System Components (21-24 → 22-25)
- PART 5: Deployment & Support (25-28 → 26-29)

**Documentation Quality:**
- Complete two-tier architecture (RIM App + Central Server)
- 11 database tables with full schema
- 30+ API endpoints with request/response examples
- 3 UI component mockups (in-app + admin dashboard)
- 5 detailed workflows
- Security features documentation
- Anti-piracy implementation guide
- Email templates (4 types)
- PDPA compliance guidelines
- Evidence collection procedures
- Cost estimates & deployment architecture

---

## 📈 Statistics (v3.10.1)

| Metric | v3.10 | v3.10.1 | Change |
|--------|-------|---------|--------|
| Total Features | 16 | 17 | +1 (License System) |
| Total Lines | 10,962 | 15,500+ | +4,538 |
| API Endpoints | 92+ | 122+ | +30 (License APIs) |
| Database Tables | 29 | 40 | +11 (License tables) |
| Documentation Sections | 29 | 30 | +1 (Feature 17) |

---

## ✅ Key Benefits (v3.10.1)

### For Admin (Rachaseth):
- ✅ **Full Visibility** - Monitor all installations globally
- ✅ **Crack Detection** - Automatic anomaly detection
- ✅ **Evidence Ready** - Complete audit trail (no auto-cleanup)
- ✅ **Easy Management** - One dashboard for all customers
- ✅ **Auto-Workflow** - Click to approve → System sends key

### For System Security:
- ✅ **Hardware Binding** - Cannot clone to other machines
- ✅ **One Active Device** - Prevent license sharing
- ✅ **Activity Tracking** - Know which installations are in use
- ✅ **PDPA Compliant** - Legal geolocation tracking
- ✅ **Evidence Collection** - Ready for legal action

### For Customers:
- ✅ **Easy Activation** - Simple process
- ✅ **Self-Service** - Release license without admin
- ✅ **Transparent** - See own license status
- ✅ **Fair Policy** - Clear ToS and consent

### For Monetization:
- ✅ **Configurable Pricing** - Admin sets prices
- ✅ **Multiple Tiers** - 1M, 3M, 6M, 12M, Lifetime
- ✅ **Trial Period** - 30 days free trial
- ✅ **Subscription Model** - Recurring revenue

---

## 🔐 Anti-Piracy Features

**Anomaly Detection Rules:**
1. **Multiple Hardware IDs** (CRITICAL)
   - Same license on 3+ different hardware
   - Action: Alert admin + suspend

2. **Geographic Anomaly** (CRITICAL)
   - Bangkok → New York in < 2 hours
   - Impossible travel = crack
   - Action: Suspend license + collect evidence

3. **Simultaneous Usage** (HIGH)
   - 2+ heartbeats from different IPs
   - Action: Alert admin

4. **Lifetime License Abuse** (CRITICAL)
   - Activated 5+ times in different countries
   - Action: Suspend + legal action

**Evidence Package:**
- Activation logs with timestamps
- IP addresses & geolocation (lat/long)
- Hardware fingerprints
- Heartbeat history
- Screenshots & reports
- Export to PDF

**No Auto-Cleanup:**
- Keep all data (including inactive installations)
- Admin decides when to delete
- Ready for legal proceedings

---

## 🚀 Ready for Development

**Feature 17: License & Activation System** is production-ready with:
- ✅ Complete two-tier architecture specification
- ✅ Database schemas with constraints and indexes
- ✅ API endpoints with full examples
- ✅ UI mockups and workflows
- ✅ Security implementation guide
- ✅ PDPA compliance guidelines
- ✅ Anti-piracy detection rules
- ✅ Email templates
- ✅ Deployment architecture
- ✅ Cost estimates
- ✅ Testing guidelines

**Deployment Estimate:**
- Central License Server setup: 1-2 days
- RIM App integration: 2-3 days
- Admin Dashboard: 3-4 days
- Testing & deployment: 2-3 days
- **Total: ~2 weeks**

**Cost Estimate:**
- VPS (Central Server): $20-50/month
- Domain: $12/year
- SSL: Free (Let's Encrypt)
- MaxMind GeoIP: Free (GeoLite2)
- **Total: ~$25-55/month**

**No guesswork. No missing pieces. Production-ready specification!** 💪

---




# 📋 SRS v3.10 - Change Log & Summary

**วันที่อัพเดท:** 11 ธันวาคม 2025  
**เวอร์ชัน:** 3.10 - Priority Level Configuration System

---

## ✨ What's New in v3.10

### 🎯 Major Addition: Feature 16 - Priority Level Configuration

**Purpose:** ให้ Super Admin สามารถกำหนดและปรับแต่งระดับความสำคัญ (Priority Levels) ของ Incident ให้เหมาะสมกับความต้องการของแต่ละบริษัท

**Core Capabilities:**
✅ **Configurable Priority Levels:**
- กำหนดได้ 2-5 priority levels ตามความต้องการ
- รองรับหลายภาษา (TH/EN) สำหรับชื่อและคำอธิบาย
- ปรับแต่งสีและ Icon ตามต้องการ
- กำหนด SLA Response Time แยกตาม Priority

✅ **Database Schema:**
- Table `priority_levels` พร้อม complete schema
- Support level_order (1-5), names (TH/EN), color, icon, SLA
- Validation rules และ constraints ครบถ้วน
- Default data สำหรับติดตั้งครั้งแรก (3 levels)

✅ **API Endpoints (7 endpoints):**
- GET /api/admin/priority-levels - ดึงรายการทั้งหมด (Super Admin)
- GET /api/priority-levels - ดึงรายการ Active (All roles)
- POST /api/admin/priority-levels - สร้าง Priority ใหม่
- PUT /api/admin/priority-levels/:id - แก้ไข Priority
- DELETE /api/admin/priority-levels/:id - ลบ Priority
- PATCH /api/admin/priority-levels/:id/activate - เปิด/ปิดใช้งาน
- PATCH /api/admin/priority-levels/:id/set-default - ตั้งเป็น Default

✅ **UI Components:**
- Priority Configuration Page (Super Admin only)
- Dynamic Priority Selection in Create Incident Form
- Priority Badge Display (ใช้ color และ icon จาก config)

✅ **Validation Rules (9 categories):**
- Priority count: 2-5 levels
- Unique level_order และ name_en
- Valid hex color (#RRGGBB)
- SLA > 0 minutes
- Must have 1 default priority
- Cannot delete if incidents exist
- At least 1 active priority

✅ **Integration Points:**
- Incident Management (Feature 2)
- SLA Management (Feature 11)
- Dashboard & Analytics (Feature 10)
- Email Notifications (Feature 9)
- Reports & Export (Feature 24)
- Activity Logs (Feature 22)

✅ **Testing Checklist:**
- 40+ test cases ครอบคลุม Unit, Integration, UI, Performance

---

## 🎯 Why Priority Configuration?

**Business Value:**
- 🏢 แต่ละบริษัทมี SLA และนโยบายที่แตกต่างกัน
  - โรงพยาบาล: 4 levels (Critical, High, Medium, Low)
  - ห้างสรรพสินค้า: 3 levels (High, Medium, Low)
  - โรงงาน: 5 levels (P1-P5)

- 🌐 รองรับ Localization
  - ใช้ภาษาที่เหมาะกับธุรกิจ (TH/EN)
  - Terminology ที่คุ้นเคย

- 🎨 Brand Alignment
  - สีที่สอดคล้องกับ Corporate Identity
  - Professional look & feel

- ⚡ Flexibility
  - เปลี่ยนแปลงได้ทุกเวลา
  - Dynamic form rendering
  - Backward compatible

---

## 📊 Documentation Updates (v3.10)

**New Feature Added:**
- **Feature 16: Priority Level Configuration** (Section 20)

**Sections Updated:**
- Table of Contents - เพิ่ม Feature 16
- PART 3: Advanced Features - เพิ่ม Feature 16
- PART 4: System Components - อัปเดต section numbers (21-24)
- PART 5: Deployment & Support - อัปเดต section numbers (25-28)

**Documentation Quality:**
- Complete database schema พร้อม field descriptions
- 7 API endpoints พร้อม request/response examples
- 3 UI component mockups
- 4 detailed workflows
- 9 validation rule categories
- 6 integration points
- 40+ test cases

---

## 📈 Statistics (v3.10)

| Metric | v3.9.1 | v3.10 | Change |
|--------|--------|-------|--------|
| Total Features | 15 | 16 | +1 (Priority Config) |
| Total Lines | 9,686 | 10,800+ | +1,114 |
| API Endpoints | 85+ | 92+ | +7 (Priority APIs) |
| Database Tables | 28 | 29 | +1 (priority_levels) |
| Documentation Sections | 28 | 29 | +1 (Feature 16) |

---

## ✅ Key Benefits (v3.10)

### For Super Admin:
- ✅ **Full Control** - กำหนด Priority ตามนโยบายบริษัท
- ✅ **Easy Configuration** - UI ที่ใช้งานง่าย พร้อม Color/Icon Picker
- ✅ **Safe Changes** - ป้องกันการลบ Priority ที่มี Incidents

### For System Flexibility:
- ✅ **Industry-Specific** - รองรับทุกอุตสาหกรรม
- ✅ **Scalable** - รองรับ 2-5 priority levels
- ✅ **Backward Compatible** - Incidents เดิมยังใช้งานได้

### For End Users:
- ✅ **Clear Priority Names** - ใช้ภาษาที่เข้าใจง่าย
- ✅ **Visual Clarity** - สีและ Icon ที่ชัดเจน
- ✅ **Consistent Experience** - Priority เดียวกันทั้งระบบ

---

## 🚀 Ready for Development

**Feature 16: Priority Level Configuration** is production-ready with:
- ✅ Complete specification (no ambiguity)
- ✅ Database schema with constraints
- ✅ API endpoints with examples
- ✅ UI mockups and workflows
- ✅ Validation rules clearly defined
- ✅ Integration points documented
- ✅ Test cases comprehensive
- ✅ Success metrics defined

**No guesswork. No missing pieces. Start coding immediately!** 💪

---

# 📋 SRS v3.9.1 - Change Log & Summary

**วันที่อัพเดท:** 18 พฤศจิกายน 2025  
**เวอร์ชัน:** 3.9.1 - Swagger API Documentation Setup

---

## ✨ What's New in v3.9.1

### 🎯 Major Addition: Swagger API Documentation

**Purpose:** เพิ่มระบบ API Documentation แบบ Auto-generated และ Interactive Testing

**Core Capabilities:**
✅ **Complete Swagger Setup:**
- Installation guide สำหรับ NestJS
- Configuration ใน `main.ts` พร้อม best practices
- Bearer Authentication setup
- API Tags organization (15 tags)

✅ **DTO Examples with Swagger Decorators:**
- `CreateIncidentDto` - Complete validation + Swagger decorators
- `IncidentResponseDto` - Response schema documentation
- `ReassignIncidentDto` - Reassignment request DTO
- All DTOs include examples and descriptions

✅ **Controller Examples:**
- **Incidents Controller** - 7 endpoints documented
  - GET, POST, PUT, DELETE incidents
  - Close incident (Help Desk only)
  - Cancel incident (Help Desk only)
- **Reassignments Controller** - 5 endpoints documented (Feature 15)
  - Reassign incident
  - Get history
  - My reassigned jobs
  - Respond to reassignment
  - Get statistics
- **Authentication Controller** - Login/Register

✅ **Best Practices & Guidelines:**
- How to use DTOs properly
- Adding examples to properties
- Documenting permissions
- Using Enums
- Error response schemas
- Grouping by tags
- Bearer auth configuration

✅ **Interactive Testing:**
- "Try it out" feature explained
- How to authorize with JWT
- Testing workflow step-by-step

✅ **Production Considerations:**
- Security (Basic Auth protection)
- Performance (caching)
- Environment-based setup

---

## 📊 Documentation Updates (v3.9.1)

**New Section Added:**
- **2.5 API Documentation (Swagger)** - Complete setup guide

**Subsections (10 parts):**
1. What is Swagger?
2. Installation & Setup
3. DTOs with Validation
4. Controller Decorators
5. Reassignment Controller Example
6. Authentication Controller
7. Accessing Swagger UI
8. Best Practices
9. Production Considerations
10. Summary

**Code Examples:** 15+ complete TypeScript examples
- main.ts configuration
- DTO definitions
- Controller implementations
- Decorators usage
- Testing workflow

---

## 📈 Statistics (v3.9.1)

| Metric | v3.9 | v3.9.1 | Change |
|--------|------|--------|--------|
| Total Lines | 8,708 | 9,686+ | +978 (Swagger section) |
| Code Examples | ~50 | ~65 | +15 (TypeScript) |
| Documentation Sections | 27 | 28 | +1 (Section 2.5) |

---

## ✅ Key Benefits (v3.9.1)

### For Developers:
- ✅ **Zero Doc Maintenance** - API docs auto-generated from code
- ✅ **Always Accurate** - Code = Documentation (can't be outdated)
- ✅ **Faster Development** - Test APIs directly in browser
- ✅ **Better Understanding** - See all endpoints in one place

### For Frontend/Mobile Team:
- ✅ **Clear API Specs** - Know exactly what to expect
- ✅ **Request/Response Examples** - No guesswork
- ✅ **Try Before Integrate** - Test APIs without writing code
- ✅ **Permission Documentation** - Understand role-based access

### For QA Team:
- ✅ **Complete API List** - Test coverage checklist
- ✅ **Interactive Testing** - Manual testing without Postman
- ✅ **Error Scenarios** - See all possible error responses

### For Project Manager:
- ✅ **API Inventory** - See all system capabilities
- ✅ **Progress Tracking** - Which APIs are implemented
- ✅ **Standard Format** - OpenAPI 3.0 compatible

---

## 🎯 Integration Points (v3.9.1)

**Swagger integrates with:**
1. **All 15 Features** - Every feature gets documented APIs
2. **Authentication System** - Bearer JWT auth
3. **Permission Matrix** - Role-based access clearly shown
4. **Reassignment System** - Complete v3.9 feature documentation
5. **Development Workflow** - Part of daily dev process

---

## 🚀 Access Points

**Development:**
```
http://localhost:3000/api-docs
```

**Staging:**
```
https://staging.rim.com/api-docs
```

**Production:**
```
https://rim.com/api-docs
(Protected with Basic Auth)
```

---

## 📞 Summary (v3.9.1)

### v3.9 → v3.9.1 Changes:

**Added:**
- ✨ **Section 2.5: API Documentation (Swagger)** - Complete setup guide
- ✨ 15+ TypeScript code examples
- ✨ Swagger configuration for NestJS
- ✨ DTO examples with decorators
- ✨ Controller examples (Incidents, Reassignments, Auth)
- ✨ Best practices for API documentation
- ✨ Production security considerations

**Enhanced:**
- ✨ Development Tools section (2.4) - Added "Swagger UI"
- ✨ Technology Stack documentation
- ✨ API testing workflow

**Result:**
- 📦 Complete API documentation system
- 📦 Auto-generated docs from code
- 📦 Interactive testing in browser
- 📦 Better team collaboration
- 📦 Faster onboarding for new developers

---

**พร้อม Implement Swagger ได้เลย!** 📖🚀

---

# 📋 SRS v3.9 - Change Log & Summary

**วันที่อัพเดท:** 18 พฤศจิกายน 2025  
**เวอร์ชัน:** 3.9 - Reassignment System

---

## ✨ What's New in v3.9

### 🎯 Major Updates

#### 1. **Feature 15: Reassignment System** 🆕

**Purpose:** ระบบมอบหมายงานใหม่ (Reassign) เมื่อช่างคนเดิมไม่สามารถทำงานต่อได้

**Core Capabilities:**
✅ **Flexible Reassignment:**
- Reassign งานจาก Technician เดิมไปยัง Technician ใหม่
- รองรับกรณี: ช่างลาป่วย, ช่างไม่มีทักษะ, ช่างมีงานล้น
- บันทึกเหตุผลครับครัน (ต้องระบุ minimum 10 characters)
- Complete audit trail ของทุก Reassignment

✅ **Smart Permission Control:**
- ✅ IT Manager, Help Desk, Supervisor สามารถ Reassign ได้
- ❌ **Super Admin ไม่สามารถ Reassign ได้** (ไม่ทำงานปฏิบัติการ)
- ❌ Technician ไม่สามารถส่งต่องานเอง (ป้องกันทุจริต)
- Permission Matrix อัพเดทให้ครบถ้วน

✅ **Technician Response System:**
- Technician สามารถ Accept/Reject งานที่ถูก Reassign มา
- กรณี Accept: ระบุ response note (optional)
- กรณี Reject: **ต้องระบุเหตุผล** (required, min 10 chars)
- Supervisor จะได้รับ notification ทันที

✅ **Complete History Tracking:**
- Timeline แสดงประวัติทั้งหมดของ Incident
- ใครทำอะไร เมื่อไหร่ เพราะอะไร
- Response status (pending, accepted, rejected)
- Integration กับ Activity Logs

✅ **Real-time Notifications:**
- แจ้งเตือนช่างคนใหม่ทันที (Email + In-app)
- แจ้งเตือนช่างเดิมให้รับทราบ
- แจ้งเตือน Supervisor เมื่อช่างตอบรับ/ปฏิเสธ

---

#### 2. **Permission Matrix Enhancement**

**Super Admin Restrictions (ตามนโยบาย):**
- ❌ ไม่สามารถสร้าง Incident
- ❌ ไม่สามารถมอบหมายงาน
- ❌ ไม่สามารถ **Reassign งาน** (เพิ่มใหม่ v3.9)
- ❌ ไม่สามารถปิดงาน
- ❌ ไม่สามารถยกเลิกงาน
- ✅ สามารถ: ตั้งค่าระบบ + ดูรายงานทั้งหมดเท่านั้น

**Updated Permission Matrix:**
```
| Reassign งาน | Super Admin | IT Mgr | Finance | Help Desk | Supervisor | Tech | End User | Read Only |
|--------------|-------------|--------|---------|-----------|------------|------|----------|-----------|
|              |      ❌     |   ✅   |    ❌   |     ✅    |     ✅     |  ❌  |    ❌    |     ❌    |
```

---

#### 3. **Documentation Structure Improvements**

**Fixed Numbering Issues:**
- ✅ PART 3: Features 11-19 (เพิ่ม Feature 15)
- ✅ PART 4: Sections 20-23 (แก้จาก 16-19)
- ✅ PART 5: Sections 24-27 (แก้จาก 20-23)
- ✅ Table of Contents อัพเดทให้ถูกต้องทั้งหมด

**Consistent Structure:**
- ทุก Feature มีโครงสร้างเดียวกัน: Overview → Database → API → UI → Workflows → Validation → Integration
- Cross-references ถูกต้องครบถ้วน
- ไม่มีข้อมูลซ้ำซ้อน

---

## 📊 Database Changes (v3.9)

### New Tables:

**1. `incident_reassignments`** - Reassignment tracking
- `incident_id` → Reference to incident
- `from_technician_id` → Previous technician (nullable)
- `to_technician_id` → New technician (required)
- `reason` → Reason for reassignment (required, TEXT)
- `reassigned_by` → Who performed the reassignment
- `status` → pending/accepted/rejected
- `response_note` → Technician's response
- `responded_at` → Response timestamp
- Indexes: incident, from_tech, to_tech, date

**Business Rules:**
1. ✅ Incident status must be `assigned` or `in_progress`
2. ✅ New technician must be active with Technician role
3. ✅ Cannot reassign to same technician
4. ✅ Reason must be at least 10 characters
5. ✅ Auto-updates Incident.technician_id and Incident.status
6. ✅ Creates activity log entry

**Total Tables:** 32 → 33 tables (+1)

---

## 📈 API Changes (v3.9)

**New Endpoints:** 5 endpoints added

**Reassignment APIs:**
1. `POST /api/incidents/:id/reassign` - Reassign incident to new technician
2. `GET /api/incidents/:id/reassignments` - View reassignment history
3. `GET /api/reassignments/my-reassigned` - Technician's reassigned jobs
4. `POST /api/reassignments/:id/respond` - Accept/Reject reassignment
5. `GET /api/reassignments/stats` - Reassignment statistics

**Total Endpoints:** 130 → 135+ (+5)

---

## 🎨 UI Updates (v3.9)

**New Components:**
1. **Reassignment Button** - On Incident Detail page (visible only to authorized roles)
2. **Reassignment Modal** - Select technician, enter reason, confirm action
3. **Reassignment History Timeline** - View complete reassignment history
4. **Technician Dashboard Widget** - "งานที่ถูก Reassign ให้คุณ"
5. **Response Modal** - Accept/Reject with optional note

**Key Features:**
- Technician list with availability status
- Real-time validation
- Clear permission-based visibility
- Interactive timeline with status indicators
- Badge notifications for pending reassignments

---

## ✅ Key Benefits (v3.9)

### For Operations Team:
- ✅ **Flexibility** - จัดการทรัพยากรได้อย่างมีประสิทธิภาพ
- ✅ **No Stalled Incidents** - ป้องกันงานค้างเพราะช่างไม่พร้อม
- ✅ **Complete Audit Trail** - รู้ว่าใครทำอะไร เมื่อไหร่ เพราะอะไร
- ✅ **SLA Protection** - Reassign ได้ก่อนเกิน SLA

### For Technicians:
- ✅ **Clear Communication** - รู้เหตุผลที่งานถูก Reassign
- ✅ **Choice** - สามารถ Accept/Reject งานได้ (พร้อมเหตุผล)
- ✅ **Transparency** - เห็นประวัติการ Reassign ทั้งหมด

### For Management:
- ✅ **Analytics** - ดูสถิติการ Reassign, เหตุผลที่พบบ่อย
- ✅ **Performance Insights** - ระบุช่างที่ถูก Reassign บ่อย (อาจต้องการ training)
- ✅ **Process Improvement** - เข้าใจปัญหาที่ทำให้ต้อง Reassign

### Security:
- ✅ **Role-based Access** - Super Admin ไม่สามารถทำ operational tasks
- ✅ **Fraud Prevention** - Technician ไม่สามารถส่งต่องานเอง
- ✅ **Mandatory Reasons** - ต้องระบุเหตุผลเสมอ (accountability)

---

## 📦 Documentation Statistics (v3.9)

| Metric | v3.8 | v3.9 | Change |
|--------|------|------|--------|
| Total Lines | 7,353 | 8,429+ | +1,076 (new feature + change log) |
| Features | 14 | 15 | +1 (Reassignment System) |
| Database Tables | 32 | 33 | +1 (incident_reassignments) |
| API Endpoints | ~130 | ~135 | +5 (Reassignment APIs) |
| UI Components | ~85 | ~90 | +5 (Reassignment UI) |

---

## 🔗 Integration Points (v3.9)

**Feature 15 integrates with:**

1. **Incident Management (Feature 2)**
   - Updates incident status and technician
   - Links: `incidents.id` ↔ `incident_reassignments.incident_id`

2. **User Management (Feature 1)**
   - Lists available technicians
   - Validates permissions and roles
   - Links: `users.id` ↔ `incident_reassignments.to_technician_id`

3. **Activity Logs (Feature 21)**
   - Records all reassignment actions
   - Events: `reassignment_created`, `reassignment_accepted`, `reassignment_rejected`

4. **Email Notifications (Feature 9)**
   - Notifies new technician
   - Notifies old technician
   - Notifies supervisor on response

5. **Dashboard & Analytics (Feature 10)**
   - Reassignment statistics
   - Top reasons analysis
   - Technician performance impact

6. **SLA Management (Feature 11)**
   - Reassignment resets `assigned_at` timestamp
   - SLA timer consideration

---

## 🎯 Success Metrics (v3.9)

**KPIs to Track:**
1. **Reassignment Rate:** < 15% of total incidents
2. **Response Time:** < 30 minutes average (pending → accepted/rejected)
3. **Acceptance Rate:** > 90%
4. **SLA Impact:** Maintain current compliance levels
5. **User Satisfaction:** Survey Supervisors and Technicians

---

## 🚀 Ready for Development (v3.9)

**Feature 15 is fully documented with:**
- ✅ 1 database table with complete schema and indexes
- ✅ 5 API endpoints with request/response examples
- ✅ 5 detailed UI components with mockups
- ✅ 3 step-by-step workflows
- ✅ 6 validation rules clearly defined
- ✅ Permission matrix updated (Super Admin restrictions enforced)
- ✅ Integration points with 6 existing features
- ✅ Testing checklist with 30+ test cases
- ✅ Success metrics and KPIs defined

**No ambiguity. No guesswork. Production-ready specification.**

---

## 📞 Summary (v3.9)

### v3.8 → v3.9 Changes:

**Added:**
- ✨ **Feature 15: Reassignment System** (complete workflow)
- ✨ 1 new database table (`incident_reassignments`)
- ✨ 5 new API endpoints (reassign, history, my-reassigned, respond, stats)
- ✨ 5 new UI components (modal, history, dashboard widget, response)
- ✨ Permission matrix updated (Super Admin ❌ Reassign)
- ✨ Integration with 6 existing features
- ✨ Complete testing checklist

**Fixed:**
- 🐛 Section numbering in Table of Contents (Part 4: 20-23, Part 5: 24-27)
- 🐛 All cross-references updated to match new structure
- 🐛 Permission notes clarified for all roles

**Enhanced:**
- ✨ Super Admin restrictions clearly enforced (no operational tasks)
- ✨ Documentation consistency across all features
- ✨ Change log structure for better tracking

**Result:**
- 📦 Complete reassignment workflow with full flexibility
- 📦 Enhanced accountability with mandatory reasons
- 📦 Better resource management for operations team
- 📦 Clear audit trail for all actions
- 📦 Fraud prevention built into permission system

---

**พร้อมพัฒนาได้เลย!** 🚀

---

# 📋 SRS v3.8 - Change Log & Summary

**วันที่อัพเดท:** 18 พฤศจิกายน 2025  
**เวอร์ชัน:** 3.8 - Technician Performance Grading System

---

## ✨ What's New in v3.8

### 🎯 Major Updates

#### 1. **Feature 14: Technician Performance Grading System** 🆕

**Purpose:** ระบบประเมินผลการทำงานของช่างเทคนิคแบบ objective และ data-driven

✅ **Multi-Dimensional Performance Metrics:**
- 7 Core KPIs with configurable weights (total 100%)
  1. SLA Compliance (20%)
  2. Work Volume (15%)
  3. Resolution Time (15%)
  4. Response Time (10%)
  5. First-Time Fix Rate (15%)
  6. Reopen Rate (10%)
  7. Customer Satisfaction (15%)

✅ **Bonus Points System (+15% max):**
- KB Article Usage (+5%)
- Equipment Handling (+5%)
- Availability/Online Time (+3%)
- Documentation Quality (+2%)

✅ **Grading Scale:**
- 8 grade levels: A+, A, B+, B, C+, C, D, F
- Clear performance descriptions for each grade
- Automatic grade assignment based on total score

✅ **Performance Dashboard:**
- Overall score and grade display
- Detailed breakdown by metric
- Comparison with team average
- Comparison with top performer
- Personal ranking (e.g., #3 out of 45)

✅ **Trend Analysis:**
- 6-month historical performance
- Month-over-month improvement tracking
- Visual trend graphs
- Change indicators (+/- from last month)

✅ **Improvement Recommendations:**
- Identify metrics below target
- Prioritize improvement areas
- Specific actionable suggestions
- KB article recommendations

✅ **Team Leaderboard:**
- Top performers ranking
- Grade distribution visualization
- Team statistics
- Healthy competition

✅ **Achievement System:**
- Unlock badges for exceptional performance
- Examples: Volume Champion, Speed Demon, KB Master
- Gamification elements for motivation

---

### 📊 Database Changes (v3.8)

**New Table:** 1 table added

1. **`technician_performance_scores`** - Comprehensive performance data
   - Period-based records (monthly)
   - Raw metric values (SLA%, volume, times, rates, ratings)
   - Calculated scores for each metric
   - Weighted scores
   - Bonus/penalty points
   - Final total score and grade
   - Team ranking and comparison data
   - Historical tracking
   
**Total Tables:** 31 → 32 tables (+1)

---

### 📈 API Changes (v3.8)

**New Endpoints:** 10+ endpoints added

**Performance APIs:**
- `GET /api/technicians/:id/performance/current` - Current month performance
- `GET /api/technicians/:id/performance/history` - Historical data (multi-month)
- `GET /api/technicians/:id/performance/metrics/:metricName` - Detailed metric breakdown
- `GET /api/technicians/:id/performance/comparison` - Compare with team

**Team & Leaderboard APIs:**
- `GET /api/technicians/performance/leaderboard` - Rankings
- `GET /api/technicians/performance/team-stats` - Team statistics

**Admin APIs:**
- `POST /api/technicians/performance/calculate` - Calculate scores (cron job)
- `GET /api/technicians/performance/settings` - Get calculation settings
- `PUT /api/technicians/performance/settings` - Update weights/targets

**Total Endpoints:** 125 → 135+ (+10)

---

### 🎨 UI Updates (v3.8)

**New Dashboard - Technician Performance View:**
1. **Performance Summary Card**
   - Large grade display (A+, A, B+, etc.)
   - Overall score with progress bar
   - Ranking indicator
   - Trend indicator (up/down from last month)

2. **Metrics Breakdown Section**
   - Each metric with individual score
   - Visual progress bars
   - Comparison indicators (you vs team vs target)
   - Color-coded status (exceeds/meets/below target)

3. **Bonus Points Display**
   - Breakdown of all bonus categories
   - Total bonus earned
   - Achievements unlocked

4. **Improvement Opportunities**
   - List of metrics needing attention
   - Gap analysis (current vs target)
   - Priority indicators
   - Actionable recommendations

5. **Performance Trend Graph**
   - 6-month historical view
   - Visual trend line
   - Month labels
   - Improvement percentage

6. **Team Comparison Section**
   - Side-by-side comparison table
   - Your score vs Team Avg vs Top Performer
   - Key metrics comparison

7. **Leaderboard (Manager View)**
   - Top 10 performers list
   - Grade distribution chart
   - Filter and sort options
   - Export functionality

---

## ✅ Key Benefits (v3.8)

### For Technicians:
- ✅ **Clear Performance Visibility** - Know exactly how you're doing
- ✅ **Fair Evaluation** - Based on objective data, not opinion
- ✅ **Growth Tracking** - See your improvement over time
- ✅ **Specific Guidance** - Know what to improve and how
- ✅ **Recognition** - Achievements and badges for motivation
- ✅ **Healthy Competition** - Compare with peers (optional)

### For Managers:
- ✅ **Data-Driven Decisions** - Performance reviews based on facts
- ✅ **Team Overview** - Quickly identify top/bottom performers
- ✅ **Targeted Training** - Focus training on weak areas
- ✅ **Fair Compensation** - Use grades for bonus/incentive decisions
- ✅ **Trend Analysis** - Track team improvement over time
- ✅ **Resource Planning** - Identify which metrics need attention

### For Business:
- ✅ **Service Quality** - Improve customer satisfaction
- ✅ **Efficiency Gains** - Reduce resolution times
- ✅ **Cost Control** - Improve first-time fix rate
- ✅ **Employee Retention** - Fair evaluation increases satisfaction
- ✅ **Continuous Improvement** - Systematic performance enhancement

---

## 📦 Documentation Statistics (v3.8)

| Metric | v3.7 | v3.8 | Change |
|--------|------|------|--------|
| Total Lines | 6,336 | 7,079+ | +743 (new feature) |
| Features | 13 | 14 | +1 (Performance Grading) |
| Database Tables | 31 | 32 | +1 (Performance table) |
| API Endpoints | ~125 | ~135 | +10 (Performance APIs) |

---

## 🎯 Performance Calculation Details

**Automated Monthly Calculation:**
- Runs on 1st of each month at 02:00 AM
- Processes all active technicians
- Collects data from previous month
- Calculates all metrics and scores
- Assigns grades and rankings
- Sends notification emails

**Calculation Formula:**
```
Total Score = 
  (SLA Score × 0.20) +
  (Volume Score × 0.15) +
  (Resolution Score × 0.15) +
  (Response Score × 0.10) +
  (First-Fix Score × 0.15) +
  (Reopen Score × 0.10) +
  (Rating Score × 0.15) +
  Bonus Points (up to +15)
  
Grade = Assigned based on Total Score range
```

**Configurable Elements:**
- Metric weights (can be adjusted by Super Admin)
- Work volume targets
- Time standards (resolution/response)
- SLA compliance thresholds
- Bonus point criteria

---

## 🚀 Ready for Development (v3.8)

**Feature 14 is fully documented with:**
- ✅ Complete KPI definitions with formulas
- ✅ Detailed grading scale
- ✅ Comprehensive database schema
- ✅ 10+ API endpoints with examples
- ✅ Detailed UI mockup
- ✅ Automated calculation workflow
- ✅ Integration with existing features
- ✅ Validation rules

**No ambiguity. No guesswork. Production-ready specification.**

---

## 📞 Summary (v3.8)

### v3.7 → v3.8 Changes:

**Added:**
- ✨ **Feature 14: Technician Performance Grading System**
- ✨ 1 new database table (technician_performance_scores)
- ✨ 10+ new API endpoints (performance metrics, leaderboard, settings)
- ✨ Performance dashboard UI with detailed breakdown
- ✨ 7 core KPIs + 4 bonus categories
- ✨ 8-level grading scale (A+ to F)
- ✨ Team leaderboard and comparison
- ✨ Achievement system (badges)
- ✨ Automated monthly calculation (cron job)

**Enhanced:**
- ✨ Dashboard with performance widgets
- ✨ Technician motivation through gamification
- ✨ Manager tools for team evaluation

**Result:**
- 📦 Complete performance management system
- 📦 Objective, data-driven evaluation
- 📦 Clear targets and improvement guidance
- 📦 Fair compensation basis
- 📦 Continuous improvement culture

---

**พร้อมพัฒนาได้เลย!** 🚀

---

# 📋 SRS v3.7 - Change Log & Summary

**วันที่อัพเดท:** 18 พฤศจิกายน 2025  
**เวอร์ชัน:** 3.7 - Backup & Restore System

---

## ✨ What's New in v3.7

### 🎯 Major Updates

#### 1. **Feature 13: Backup & Restore System** 🆕

**Purpose:** ปกป้องข้อมูลและกู้คืนระบบเมื่อเกิดปัญหา

✅ **Automated Backup System:**
- Scheduled automatic backups (daily, weekly, monthly)
- Configurable backup time and day of month/week
- Retention policy management (days and max count)
- Email notifications on success/failure
- Multi-location storage support (local + network drive + cloud)

✅ **Manual Backup on Demand:**
- Create backup anytime with custom name
- Choose components: Database, Files, Configuration
- Select custom backup path
- Real-time progress tracking with live logs
- Background processing support

✅ **Disaster Recovery:**
- Full system restore from backup
- Selective restore (database-only, files-only)
- Pre-restore safety backup
- Verification before restore
- System restart after restoration

✅ **Backup Management:**
- List all backups with details
- Download backup files
- Verify backup integrity (checksum validation)
- Delete old/unnecessary backups
- View detailed backup logs

✅ **Data Protection Features:**
- Compression support (60-70% size reduction)
- Optional encryption (AES-256)
- SHA-256 checksums for integrity verification
- Multi-location redundancy
- Cloud storage integration (AWS S3, Google Cloud, Azure)

✅ **Monitoring & Logging:**
- Comprehensive backup statistics
- Execution history with timing
- Detailed process logs (info, warning, error)
- Success rate tracking
- Disk space monitoring

---

### 📊 Database Changes (v3.7)

**New Tables:** 4 tables added

1. **`backup_configs`** - Configuration and schedules
   - Auto backup settings (schedule, time, day)
   - Storage locations (primary, secondary, cloud)
   - Retention policy (days, max count)
   - Backup options (compress, encrypt, include files)
   - Notification settings
   - Singleton pattern (one config only)

2. **`backup_history`** - Backup execution records
   - Backup metadata (type, name, status)
   - Content flags (database, files, config)
   - File details (path, size, compressed size)
   - Storage locations (local, cloud URLs)
   - Checksums (SHA-256 for verification)
   - Statistics (tables, records, files count)
   - Timing (start, complete, duration)
   - Error tracking

3. **`restore_history`** - Restore operation tracking
   - Source backup reference
   - Restore type and status
   - Components restored flags
   - Statistics (records, tables, files)
   - Pre-restore backup reference
   - Error tracking
   - Audit trail (who, when, from where)

4. **`backup_logs`** - Detailed process logs
   - Log levels (info, warning, error, debug)
   - Timestamped messages
   - Contextual details (JSON)
   - Linked to backup_history

**Total Tables:** 27 → 31 tables (+4)

---

### 📈 API Changes (v3.7)

**New Endpoints:** 15+ endpoints added

**Backup Configuration APIs:**
- `GET /api/backup/config` - Get current settings
- `PUT /api/backup/config` - Update settings
- `POST /api/backup/config/test-path` - Test path validity

**Backup Management APIs:**
- `POST /api/backup/create` - Create manual backup
- `GET /api/backup/:id/status` - Get backup progress
- `GET /api/backup/list` - List all backups
- `GET /api/backup/:id` - Get backup details
- `GET /api/backup/:id/download` - Download backup file
- `DELETE /api/backup/:id` - Delete backup
- `POST /api/backup/:id/verify` - Verify integrity

**Restore APIs:**
- `GET /api/backup/restore/available` - List restorable backups
- `POST /api/backup/restore` - Execute restore (critical)
- `GET /api/backup/restore/:id/status` - Get restore progress
- `GET /api/backup/restore/history` - List restore history

**Logging APIs:**
- `GET /api/backup/:id/logs` - Get backup logs
- `GET /api/backup/activity-log` - System-wide activity

**Total Endpoints:** 110 → 125+ (+15)

---

### 🎨 UI Updates (v3.7)

**New Pages:**
1. **Backup Settings** - Configure auto backup, storage, retention
2. **Backup Management** - View, create, restore, manage backups
3. **Backup Detail Modal** - Comprehensive backup information
4. **Backup Progress Modal** - Real-time backup/restore progress
5. **Restore Confirmation Modal** - Critical operation warning

**Key UI Features:**
- Path testing before save
- Real-time progress bars
- Live log streaming
- Backup verification status
- Multi-location storage indicators
- Success rate statistics
- Disk space monitoring

---

## ✅ Key Benefits (v3.7)

### For Super Admin:
- ✅ **Peace of Mind** - Automated daily/monthly backups
- ✅ **Disaster Recovery** - Restore system in 10-15 minutes
- ✅ **Flexible Storage** - Local + Network + Cloud options
- ✅ **Data Protection** - Compression + Encryption support
- ✅ **Easy Management** - Simple UI for all operations

### For Business:
- ✅ **Compliance** - Meet data retention requirements
- ✅ **Business Continuity** - Minimize downtime from failures
- ✅ **Cost Savings** - Prevent data loss disasters
- ✅ **Audit Trail** - Complete backup/restore history
- ✅ **Scalability** - Supports growing data volumes

### Technical Advantages:
- ✅ **PostgreSQL Native** - Uses pg_dump/pg_restore
- ✅ **File System Backup** - Preserves directory structure
- ✅ **Compression** - 60-70% size reduction
- ✅ **Integrity Verification** - SHA-256 checksums
- ✅ **Multi-location Redundancy** - No single point of failure

---

## 📦 Documentation Statistics (v3.7)

| Metric | v3.6 | v3.7 | Change |
|--------|------|------|--------|
| Total Lines | 5,593 | 6,080+ | +487 (new feature) |
| Features | 12 | 13 | +1 (Backup & Restore) |
| Database Tables | 27 | 31 | +4 (Backup tables) |
| API Endpoints | ~110 | ~125 | +15 (Backup APIs) |

---

## 🔒 Security Considerations (v3.7)

**Access Control:**
- ✅ Super Admin only access to all backup features
- ✅ All operations logged in activity_logs
- ✅ Audit trail with user, IP, timestamp

**Data Protection:**
- ✅ Optional AES-256 encryption for backups
- ✅ Secure credential storage for cloud
- ✅ Path validation prevents directory traversal
- ✅ Checksums ensure data integrity

**Best Practices Implemented:**
- ✅ 3-2-1 backup rule support
- ✅ Pre-restore safety backup
- ✅ Confirmation code for critical operations
- ✅ Retention policy automation
- ✅ Comprehensive error handling

---

## 🚀 Ready for Development (v3.7)

**Feature 13 is fully documented with:**
- ✅ 4 database tables with complete schemas
- ✅ 15+ API endpoints with request/response examples
- ✅ 5 detailed UI mockups with layouts
- ✅ 4 step-by-step workflows
- ✅ Validation rules and error handling
- ✅ Security best practices
- ✅ Integration with existing features

**No ambiguity. No guesswork. Production-ready specification.**

---

## 📞 Summary (v3.7)

### v3.6 → v3.7 Changes:

**Added:**
- ✨ **Feature 13: Backup & Restore System**
- ✨ 4 new database tables (backup_configs, backup_history, restore_history, backup_logs)
- ✨ 15+ new API endpoints (backup management, restore, verification)
- ✨ 5 new UI pages/modals (settings, management, progress, confirmation)
- ✨ Automated backup scheduler (cron-based)
- ✨ Multi-location storage support (local, network, cloud)
- ✨ Compression and encryption support
- ✨ Complete disaster recovery system

**Enhanced:**
- ✨ System reliability with automated backups
- ✨ Data protection with multiple redundancy
- ✨ Business continuity with quick restore

**Result:**
- 📦 Complete backup and disaster recovery solution
- 📦 Automated protection of all system data
- 📦 Quick recovery from server failures
- 📦 Compliance with data retention policies
- 📦 Enterprise-grade data protection

---

**พร้อมพัฒนาได้เลย!** 🚀

---

# 📋 SRS v3.6 - Change Log & Summary

**วันที่อัพเดท:** 18 พฤศจิกายน 2025  
**เวอร์ชัน:** 3.6 - Knowledge Base & Incident Intelligence

---

## ✨ What's New in v3.6

### 🎯 Major Updates

#### 1. **Feature 12: Knowledge Base & Incident Intelligence** 🆕

**Purpose:** เก็บรวบรวมและแบ่งปันความรู้จากการแก้ปัญหาทุกครั้ง

✅ **Knowledge Base System:**
- Online manual repository with full-text search
- Rich content: Step-by-step guides, images, videos, PDF attachments
- Article categorization by equipment type and category
- Version control and approval workflow
- Article rating and feedback system (helpful/not helpful)
- Usage analytics and performance tracking

✅ **Intelligent Incident Integration:**
- Auto-suggest KB articles when creating incident
  - Based on: Category, Equipment, Keywords, Store history
  - Relevance scoring (0-100%)
- Link KB articles to incidents (manual or auto)
- Track article effectiveness per incident

✅ **Similar Incidents History:**
- Find past incidents with similar issues (AI-powered matching)
- Show successful resolutions and approaches
- Display: Resolution time, Technician, KB articles used, Rating
- Matching factors: Same equipment, category, keywords, store
- Learn from past successes

✅ **Technician Preparation:**
- View linked KB articles before going on-site
- Review similar past incidents and resolutions
- Access equipment manuals and video tutorials
- Better prepared = Higher first-time fix rate (20-30% improvement)

✅ **Knowledge Creation from Incidents:**
- Create KB article directly from resolved incident
- Pre-fill with incident data
- Convert tribal knowledge to documented knowledge
- Continuous knowledge building

---

### 📊 Database Changes (v3.6)

**New Tables:** 3 tables added

1. **`knowledge_articles`** - KB article repository
   - Full-text search capability (PostgreSQL TSVECTOR)
   - Version control (previousVersionId)
   - Rich content: steps, images, videos, attachments
   - Metadata: views, ratings, status
   
2. **`knowledge_article_feedback`** - User feedback
   - Helpful/Not helpful ratings
   - Comments and suggestions
   - Track reading time
   - Link to incidents
   
3. **`incident_knowledge_links`** - Incident-KB linking
   - Link types: auto-suggested, manual-added, created-from-incident
   - Track effectiveness (wasHelpful)
   - Audit trail

**Modified Tables:**
- `categories` - Add kbArticleCount field (optional)

**Total Tables:** 24 → 27 tables (+3)

---

### 📈 API Changes (v3.6)

**New Endpoints:** 20+ endpoints added

**Knowledge Base APIs:**
- `GET /api/knowledge/articles` - List with filters, search, pagination
- `GET /api/knowledge/articles/:id` - Full article content
- `POST /api/knowledge/articles` - Create article
- `PUT /api/knowledge/articles/:id` - Update article
- `DELETE /api/knowledge/articles/:id` - Delete article
- `PATCH /api/knowledge/articles/:id/status` - Publish/Archive
- `POST /api/knowledge/articles/:id/feedback` - Submit rating
- `GET /api/knowledge/statistics` - KB analytics
- `GET /api/knowledge/articles/:id/analytics` - Article performance

**Incident Intelligence APIs:**
- `GET /api/incidents/:id/suggested-articles` - Auto-suggest KB articles
- `POST /api/incidents/:id/knowledge-links` - Link article to incident
- `GET /api/incidents/:id/knowledge-links` - Get linked articles
- `PATCH /api/incidents/:incidentId/knowledge-links/:articleId` - Mark helpful
- `GET /api/incidents/:id/similar` - Find similar past incidents

**Total Endpoints:** 95 → 110+ (+15)

---

### 🎨 UI Updates (v3.6)

**New Pages:**
1. **Knowledge Base Home** - Browse, search articles by category
2. **KB Article Detail** - Full content with steps, media, feedback
3. **KB Article Editor** - Rich text editor for creating/editing
4. **KB Analytics Dashboard** - Usage statistics, top articles

**Enhanced Pages:**
1. **Incident Detail** - New tab: "Knowledge Base"
   - Shows suggested KB articles with relevance scores
   - Shows similar past incidents with resolutions
   - Link/unlink articles
   - Mark articles as helpful/not helpful
   
2. **Incident Creation** - Real-time KB suggestions
   - As user types, system suggests relevant articles
   - User can view articles and try self-fix
   - Or proceed to create incident (articles auto-linked)

---

## ✅ Key Benefits (v3.6)

### For Technicians:
- ✅ **Better Preparation** - Know what to expect before arriving
- ✅ **Access to Guides** - Step-by-step instructions with photos/videos
- ✅ **Learn from Others** - See how colleagues solved similar issues
- ✅ **Faster Resolution** - 20-30% improvement in first-time fix rate
- ✅ **Confidence Boost** - Armed with knowledge and context

### For Help Desk:
- ✅ **Reduced Tickets** - Users can self-fix with KB articles
- ✅ **Better Assignment** - Link relevant guides when dispatching
- ✅ **Knowledge Capture** - Convert incidents to reusable knowledge
- ✅ **Quality Improvement** - Learn which solutions work best

### For IT Managers:
- ✅ **Knowledge Retention** - Don't lose expertise when staff leaves
- ✅ **Training Tool** - New technicians learn faster
- ✅ **Analytics** - See which issues are most common
- ✅ **Cost Reduction** - Fewer repeat visits, better efficiency

### For End Users:
- ✅ **Self-Service** - Fix simple issues themselves
- ✅ **24/7 Access** - KB available anytime
- ✅ **Faster Support** - Technicians arrive better prepared
- ✅ **Better Experience** - Issues resolved quicker

---

## 📦 Documentation Statistics (v3.6)

| Metric | v3.5 | v3.6 | Change |
|--------|------|------|--------|
| Total Lines | 4,936 | 5,700+ | +764 (new feature) |
| Features | 11 | 12 | +1 (Knowledge Base) |
| Database Tables | 24 | 27 | +3 (KB tables) |
| API Endpoints | ~95 | ~110 | +15 (KB & Intelligence APIs) |

---

## 🔗 Integration Summary (v3.6)

```
Knowledge Base integrates with:

1️⃣ Incidents (Feature 2)
   - Auto-suggest articles when creating incident
   - Link articles for technician reference
   - Track which articles helped resolve issues
   
2️⃣ Equipment (Feature 4)
   - Link articles to equipment types
   - Show relevant guides on equipment page
   - Equipment-specific troubleshooting
   
3️⃣ Categories (Feature 5)
   - Browse KB by category
   - Category-based article suggestions
   - Track articles per category
   
4️⃣ Dashboard (Feature 10)
   - KB usage statistics
   - Top performing articles
   - Knowledge contribution metrics
```

---

## 🚀 Ready for Development (v3.6)

**Feature 12 is fully documented with:**
- ✅ 3 database tables with complete schemas and indexes
- ✅ 20+ API endpoints with request/response examples
- ✅ 4 detailed UI mockups
- ✅ 4 step-by-step workflows
- ✅ Full-text search implementation guide
- ✅ Integration points with existing features
- ✅ Validation rules and business logic

**No ambiguity. No guesswork. Production-ready specification.**

---

## 📞 Summary (v3.6)

### v3.5 → v3.6 Changes:

**Added:**
- ✨ **Feature 12: Knowledge Base & Incident Intelligence**
- ✨ 3 new database tables (knowledge_articles, knowledge_article_feedback, incident_knowledge_links)
- ✨ 20+ new API endpoints (KB management, search, analytics, incident intelligence)
- ✨ 4 new UI pages/sections (KB home, article detail, editor, analytics)
- ✨ Auto-suggest and similar incidents functionality
- ✨ Full-text search with PostgreSQL TSVECTOR
- ✨ Article versioning and approval workflow

**Enhanced:**
- ✨ Incident detail page with KB integration
- ✨ Incident creation with real-time suggestions
- ✨ Equipment and category pages with KB links

**Result:**
- 📦 Complete knowledge management system
- 📦 Improved first-time fix rate (estimated 20-30%)
- 📦 Better technician preparation and confidence
- 📦 Reduced incident volume through self-service
- 📦 Continuous knowledge building from incidents

---

**พร้อมพัฒนาได้เลย!** 🚀

---

# 📋 SRS v3.5 - Change Log & Summary

**วันที่อัพเดท:** 17 พฤศจิกายน 2025  
**เวอร์ชัน:** 3.5 - Equipment & Store Integration Enhancement

---

## ✨ What's New in v3.5

### 🎯 Major Updates

#### 1. **Fixed Documentation Structure**
- ❌ **Removed:** Duplicate Equipment Management feature (was in both Feature 4 and Feature 6)
- ✅ **Consolidated:** All equipment functionality into **Feature 4: Equipment Management**
- ✅ **Renumbered:** All features correctly (Feature 4-11)
- ✅ **Cleaned up:** Table of Contents and cross-references

**Before (v3.4):**
```
Feature 4: Category Management
Feature 5: File Upload System  
Feature 6: Equipment Management (duplicate!)
Feature 7: Outsource Marketplace
...

AND also:
Feature 4: Equipment Management (another one!)
```

**After (v3.5):**
```
Feature 4: Equipment Management ✅
Feature 5: Category Management
Feature 6: File Upload System
Feature 7: Outsource Marketplace
...
```

---

#### 2. **Enhanced Equipment Management Documentation**
✅ **Comprehensive Asset Management:**
- Complete database schema with all fields documented
- Asset Tag, Barcode, Serial Number tracking
- Warranty management and expiry alerts
- Equipment-Store linking
- Equipment-Incident linking via `equipment_incidents` table
- Equipment replacement workflow

✅ **Better API Documentation:**
- All CRUD endpoints with examples
- Barcode scanning endpoints
- Warranty management endpoints
- Import/Export Excel functionality
- Statistics and analytics endpoints

✅ **Improved UI Mockups:**
- Equipment list with filters
- Equipment details with tabs (Info, Location, Warranty, Maintenance)
- Equipment selection modal for incidents
- Barcode scanning interface

✅ **Complete Workflows:**
- Add new equipment workflow
- Link equipment to incident workflow
- Replace equipment workflow
- Warranty expiry alert workflow

---

#### 3. **Store-Incident Integration Enhancement**
✅ **Comprehensive Analytics:**
- Incident statistics per store (30-day summary)
- Top issues analysis (most frequent problems)
- Problematic equipment identification
- Performance metrics tracking
- Customer satisfaction per store
- Cost analysis (Insource vs Outsource)

✅ **Enhanced Store Details UI:**
- **Tab 4: Incidents** - Recent incidents list with filters
- **Tab 5: Statistics** - Complete analytics dashboard
  - Incident trends graph
  - Top issues breakdown
  - Most problematic equipment
  - Performance metrics
  - Cost analysis

✅ **New API Endpoints:**
```typescript
GET /api/stores/:id/incidents          // All incidents for store
GET /api/stores/:id/incidents/summary  // 30-day summary
GET /api/stores/:id/statistics         // Complete analytics
GET /api/stores/:id/equipment          // All equipment in store
GET /api/stores/:id/top-issues         // Most frequent problems
```

---

## 📊 Database Changes

### New Tables (v3.5):
1. **`equipment`** - Complete asset management
   - Asset Tag, Barcode, Serial Number
   - Brand, Model, Part Number
   - Store location, IP Address, MAC Address
   - Purchase Date, Install Date, Warranty Expiry
   - Status, Maintenance history
   
2. **`equipment_incidents`** - Equipment-Incident linking
   - Links equipment to incidents
   - Tracks equipment replacements
   - Records old/new serial numbers

### Modified Tables:
1. **`incidents`** - Added `equipmentId` field (optional)
2. **Store APIs** - Enhanced with incident/equipment statistics

**Total Tables:** 22 → 24 tables

---

## 📈 Documentation Statistics

| Metric | v3.4 | v3.5 | Change |
|--------|------|------|--------|
| Total Lines | 5,376 | 4,898 | -478 (removed duplicates) |
| File Size | ~240KB | ~224KB | -16KB |
| Features | 11 | 11 | Same (consolidated) |
| Database Tables | 22 | 24 | +2 (equipment tables) |
| API Endpoints | ~80 | ~95 | +15 (equipment & store APIs) |

---

## 🔗 Integration Flow

### Complete System Integration:

```
1️⃣ Store → Equipment
   View all equipment installed at a store
   Filter by type, status, warranty

2️⃣ Store → Incidents
   View all incidents for a store
   Analyze patterns and trends
   Identify problem areas

3️⃣ Equipment → Incidents
   View repair history for equipment
   Track maintenance count
   Identify problematic equipment

4️⃣ Incident → Equipment
   Link incident to specific equipment
   Auto-update equipment status
   Track replacement if needed
```

---

## ✅ Key Benefits

### For Asset Management:
- ✅ **No Lost Equipment** - Track every asset with Asset Tag
- ✅ **Better Warranty Management** - Alerts before expiry
- ✅ **Informed Decisions** - See which brands/models fail often
- ✅ **Complete History** - Full maintenance record per equipment
- ✅ **Easy Scanning** - Barcode support for quick lookup

### For Store Management:
- ✅ **Incident Analytics** - See patterns per store
- ✅ **Problem Identification** - Find top issues quickly
- ✅ **Cost Control** - Track maintenance costs per store
- ✅ **Performance Tracking** - Monitor SLA compliance
- ✅ **Customer Satisfaction** - Track ratings per store

### For Technicians:
- ✅ **Better Preparation** - View equipment details before dispatch
- ✅ **Easy Check-in** - Scan barcode to verify equipment
- ✅ **Replacement Tracking** - Record old/new serial numbers
- ✅ **Complete Context** - See previous repair history

---

## 🚀 Ready for Development

**All features are 100% documented:**
- ✅ Database schemas with indexes
- ✅ API endpoints with request/response examples
- ✅ UI mockups with detailed layouts
- ✅ Step-by-step workflows
- ✅ Validation rules
- ✅ Business logic

**No ambiguity. No guesswork. Production-ready specification.**

---

## 📞 Summary

### v3.4 → v3.5 Changes:

**Fixed:**
- 🐛 Removed duplicate Equipment Management feature
- 🐛 Corrected feature numbering (4-11)
- 🐛 Fixed Table of Contents cross-references

**Enhanced:**
- ✨ Complete Equipment Management documentation
- ✨ Store-Incident Integration with analytics
- ✨ Added 15+ new API endpoints
- ✨ Better examples and workflows

**Added:**
- ✨ 2 new database tables (equipment, equipment_incidents)
- ✨ Feature highlights summary section
- ✨ Integration flow documentation
- ✨ Comprehensive change log

**Result:**
- 📦 Cleaner, more organized documentation
- 📦 Removed ~500 lines of duplicate content
- 📦 Added ~150 lines of new valuable content
- 📦 Better structure for development teams

---

**พร้อมพัฒนาได้เลย!** 🚀

---

**END OF DOCUMENT - SRS Version 3.8**

