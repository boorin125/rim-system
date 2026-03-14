// src/modules/license/patch-public.controller.ts
// Public patch download — no authentication required

import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { PatchService } from './patch.service';

@Controller('public/patches')
export class PatchPublicController {
  constructor(private readonly patchService: PatchService) {}

  /**
   * GET /api/public/patches
   * List published patches (for customer-facing download page)
   */
  @Get()
  async listPatches() {
    return this.patchService.listPublicPatches();
  }

  /**
   * GET /api/public/patches/:id/download
   * Download patch file — increments counter
   */
  @Get(':id/download')
  async downloadPatch(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const patch = await this.patchService.downloadPatch(id);
    const filePath = this.patchService.getFilePath(patch);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Patch file not found');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${patch.fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', patch.fileSize);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }
}
