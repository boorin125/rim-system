// src/settings/pwa.controller.ts
// Public — the installed mobile app (PWA) reads its name and icon from here at runtime,
// so every server (one shared frontend image) gets its own app name / logo / TEST badge.

import { Controller, Get, Param, ParseIntPipe, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { SettingsService } from './settings.service';

const ICON_SIZES = [180, 192, 512];
const DEFAULT_ICON = path.join(process.cwd(), 'assets', 'pwa-default.png');

// 5x5 block letters — the Alpine image has no fonts, so SVG <text> would render as boxes
const GLYPHS: Record<string, string[]> = {
  T: ['#####', '..#..', '..#..', '..#..', '..#..'],
  E: ['#####', '#....', '####.', '#....', '#####'],
  S: ['#####', '#....', '#####', '....#', '#####'],
};

function blockText(text: string, cell: number, x0: number, y0: number, fill: string) {
  const rects: string[] = [];
  [...text].forEach((ch, i) => {
    const rows = GLYPHS[ch] || [];
    rows.forEach((row, r) => {
      [...row].forEach((px, c) => {
        if (px === '#') {
          rects.push(`<rect x="${x0 + (i * 6 + c) * cell}" y="${y0 + r * cell}" width="${cell}" height="${cell}" fill="${fill}"/>`);
        }
      });
    });
  });
  return rects.join('');
}

@Controller('settings/public/pwa')
export class PwaController {
  private iconCache = new Map<string, Buffer>();

  constructor(private readonly settingsService: SettingsService) {}

  private async getSource() {
    const org = await this.settingsService.getOrganizationSettings();
    let file = DEFAULT_ICON;
    if (org.logoPath && !org.logoPath.startsWith('http')) {
      const p = path.join(process.cwd(), org.logoPath.replace(/^\//, ''));
      if (fs.existsSync(p)) file = p;
    }
    const mtime = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
    const version = crypto
      .createHash('md5')
      .update(`${file}|${mtime}|${org.isTestServer}`)
      .digest('hex')
      .slice(0, 8);
    return { org, file, version };
  }

  @Get('manifest.webmanifest')
  async manifest(@Res() res: Response) {
    const { org, version } = await this.getSource();
    const base = org.appName || (org.organizationName ? `RIM ${org.organizationName}` : 'RIM System');
    const name = org.isTestServer && !/test/i.test(base) ? `${base} TEST` : base;
    const icon = (size: number) => `/api/settings/public/pwa/icon/${size}?v=${version}`;

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(JSON.stringify({
      // = the old static manifest's implicit id (start_url) so already-installed apps keep updating
      id: '/dashboard',
      name,
      short_name: name,
      description: 'IT Service Management and Incident Tracking System',
      start_url: '/dashboard',
      scope: '/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0f172a',
      theme_color: org.isTestServer ? '#dc2626' : '#2563eb',
      icons: [
        { src: icon(192), sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: icon(512), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }));
  }

  @Get('icon/:size')
  async icon(@Param('size', ParseIntPipe) size: number, @Res() res: Response) {
    if (!ICON_SIZES.includes(size)) throw new NotFoundException();
    const { org, file, version } = await this.getSource();
    const key = `${size}|${version}`;

    let png = this.iconCache.get(key);
    if (!png) {
      png = await this.renderIcon(file, size, org.isTestServer);
      this.iconCache.set(key, png);
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(png);
  }

  private async renderIcon(file: string, size: number, isTest: boolean): Promise<Buffer> {
    const src = await sharp(file).flatten({ background: '#ffffff' }).png().toBuffer();

    // Square background in the logo's own corner colour so wide logos blend in
    const { data } = await sharp(src).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    const background = { r: data[0], g: data[1], b: data[2], alpha: 1 };

    // Keep everything inside the maskable safe zone (centre circle, 80% diameter)
    const boxW = Math.round(size * 0.62);
    const boxH = Math.round(size * (isTest ? 0.34 : 0.62));
    const logo = await sharp(src)
      .resize(boxW, boxH, { fit: 'contain', background })
      .toBuffer();

    const layers: sharp.OverlayOptions[] = [
      { input: logo, left: Math.round((size - boxW) / 2), top: Math.round(size * (isTest ? 0.2 : 0.19)) },
    ];

    if (isTest) {
      const bandTop = Math.round(size * 0.58);
      const bandH = Math.round(size * 0.2);
      const cell = Math.max(2, Math.floor(size * 0.022));
      const textW = 23 * cell;
      const textH = 5 * cell;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
        <rect x="0" y="${bandTop}" width="${size}" height="${bandH}" fill="#dc2626"/>
        ${blockText('TEST', cell, Math.round((size - textW) / 2), Math.round(bandTop + (bandH - textH) / 2), '#ffffff')}
      </svg>`;
      layers.push({ input: Buffer.from(svg), left: 0, top: 0 });
    }

    return sharp({ create: { width: size, height: size, channels: 4, background } })
      .composite(layers)
      .png()
      .toBuffer();
  }
}
