import { Controller, Post, Delete, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private pushService: PushService) {}

  /** GET /push/vapid-public-key — browser needs this to subscribe */
  @Get('vapid-public-key')
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  /** POST /push/subscribe — browser sends subscription object after permission granted */
  @Post('subscribe')
  async subscribe(
    @Req() req: any,
    @Body() body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      userAgent?: string;
    },
  ) {
    await this.pushService.subscribe(req.user.id, body);
    return { message: 'Subscribed' };
  }

  /** DELETE /push/unsubscribe — browser or user manually disables push */
  @Delete('unsubscribe')
  @HttpCode(200)
  async unsubscribe(@Body() body: { endpoint: string }) {
    await this.pushService.unsubscribe(body.endpoint);
    return { message: 'Unsubscribed' };
  }
}
