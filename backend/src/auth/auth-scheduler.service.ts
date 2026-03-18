// Auto-logout all online users at 22:00 every night (Thailand time UTC+7)
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AuthSchedulerService {
  private readonly logger = new Logger(AuthSchedulerService.name)

  constructor(private prisma: PrismaService) {}

  // Runs at 22:00 Thailand time (UTC+7 = 15:00 UTC)
  @Cron('0 15 * * *', { timeZone: 'UTC' })
  async autoLogoutAllUsers() {
    const result = await this.prisma.user.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    })

    // Also invalidate all refresh tokens so users must re-login tomorrow
    await this.prisma.refreshToken.deleteMany({})

    this.logger.log(`Auto-logout at 22:00: set ${result.count} users offline`)
  }
}
