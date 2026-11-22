// src/modules/integration/integration-exception.filter.ts
// Every Integration API error is { "error": { "code", "message" } } (spec §4)
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

const CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

@Catch()
export class IntegrationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('IntegrationApi');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = 500;
    let message = 'เกิดข้อผิดพลาดภายในระบบ';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as any;
      const m = typeof body === 'string' ? body : body?.message;
      message = Array.isArray(m) ? m.join(', ') : m || exception.message;
    } else {
      this.logger.error('Unhandled integration error', exception as any);
    }
    const code = CODES[status] || (status >= 500 ? 'INTERNAL' : 'BAD_REQUEST');
    res.status(status).json({ error: { code, message } });
  }
}
