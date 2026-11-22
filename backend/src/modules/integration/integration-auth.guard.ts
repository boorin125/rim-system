// src/modules/integration/integration-auth.guard.ts
// Integration API v1 auth (spec §2, checklist §11):
// Bearer → hash → not revoked → domain rule on → Caller matches + passes the domain rule → scope → rate limit → audit
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IntegrationService } from './integration.service';
import { isAllowedUrl, normalizeOrigin, ownDomain } from './integration-domain';

export const INTEGRATION_SCOPE = 'integration_scope';
/** Scope the endpoint needs, e.g. @IntegrationScope('incidents:read') */
export const IntegrationScope = (scope: string) => SetMetadata(INTEGRATION_SCOPE, scope);

export class RateLimitedException extends HttpException {
  constructor() {
    super('เรียกเกิน 120 ครั้งต่อนาที — ลองใหม่ภายหลัง', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Real client IP behind Cloudflare / nginx */
function clientIp(req: any): string | null {
  const h = req.headers || {};
  const fwd = (h['cf-connecting-ip'] || h['x-real-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || '').toString().trim();
  return (fwd || req.ip || req.socket?.remoteAddress || '').toString().slice(0, 64) || null;
}

@Injectable()
export class IntegrationAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly integration: IntegrationService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const res = ctx.switchToHttp().getResponse();
    const started = Date.now();
    const ip = clientIp(req);
    const audit: { keyId: number | null; keyName: string | null } = { keyId: null, keyName: null };

    // Audit every request — including rejected ones — once the response is sent
    res.on('finish', () =>
      this.integration.audit({
        ...audit,
        method: req.method,
        path: String(req.originalUrl || req.url || ''),
        status: res.statusCode,
        durationMs: Date.now() - started,
        ip,
      }),
    );

    const header = String(req.headers['authorization'] || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('ไม่มี API Key (Authorization: Bearer …)');

    const key = await this.integration.findKeyByToken(token);
    if (!key) throw new UnauthorizedException('API Key ไม่ถูกต้อง');
    audit.keyId = key.id;
    audit.keyName = key.name;
    if (key.revokedAt) throw new UnauthorizedException('API Key ถูกยกเลิกแล้ว');

    const own = ownDomain();
    if (!own) throw new ForbiddenException('Integration ปิดอยู่บนเครื่องนี้ (URL ไม่ใช่ https / เป็น IP)');

    const caller = String(req.headers['x-integration-caller'] || '').trim();
    if (!caller || !isAllowedUrl(caller, own) || normalizeOrigin(caller) !== key.callerUrl) {
      throw new ForbiddenException('X-Integration-Caller ไม่ตรงกับที่ผูกไว้กับ Key นี้');
    }
    // The bound caller itself must still pass the domain rule (e.g. after this server changed domain)
    if (!isAllowedUrl(key.callerUrl, own)) throw new ForbiddenException('Caller ของ Key นี้อยู่นอกโดเมนที่อนุญาต');

    const need = this.reflector.get<string>(INTEGRATION_SCOPE, ctx.getHandler());
    if (need && !key.scopes.includes(need)) throw new ForbiddenException(`Key นี้ไม่มีสิทธิ์ ${need}`);

    if (!this.integration.takeRateToken(key.id)) throw new RateLimitedException();

    this.integration.touchKey(key.id, ip);
    req.integrationKey = key;
    return true;
  }
}
