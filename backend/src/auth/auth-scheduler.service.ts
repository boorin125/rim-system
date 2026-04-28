// Auto-logout all online users at 22:00 every night (Thailand time UTC+7)
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { UserStatus } from '@prisma/client'

@Injectable()
export class AuthSchedulerService {
  private readonly logger = new Logger(AuthSchedulerService.name)

  constructor(private prisma: PrismaService) {}

  // Runs at 22:00 Thailand time (UTC+7 = 15:00 UTC)
  @Cron('0 15 * * *', { timeZone: 'UTC' })
  async autoLogoutAllUsers() {
    const now = new Date()

    const result = await this.prisma.user.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    })

    // Only delete tokens that expire at or before the cutoff — this avoids a race
    // where a user logs in right after the cron fires and their new token gets wiped.
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lte: now } },
    })

    this.logger.log(`Auto-logout at 22:00: set ${result.count} users offline`)
  }

  // Runs daily at 01:00 UTC (08:00 Thailand time) — purge expired scheduled deletions
  @Cron('0 1 * * *', { timeZone: 'UTC' })
  async purgeScheduledDeletions() {
    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.PENDING_DELETION,
        scheduledDeleteAt: { lte: new Date() },
      },
      select: { id: true, email: true },
    })

    for (const user of users) {
      await this.prisma.user.delete({ where: { id: user.id } })
      this.logger.log(`Permanently deleted user ${user.email} (7-day grace period expired)`)
    }

    if (users.length > 0) {
      this.logger.log(`Purge: permanently deleted ${users.length} user(s)`)
    }
  }
}
