import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CheckOutType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  computeWorkMinutes,
  dateTimeInShanghai,
} from '../common/attendance-session';
import { todayStr } from '../common/datetime';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceRuleService } from './attendance-rule.service';

@Injectable()
export class AutoCheckoutCron {
  private readonly logger = new Logger(AutoCheckoutCron.name);

  constructor(
    private prisma: PrismaService,
    private ruleService: AttendanceRuleService,
    private audit: AuditService,
  ) {}

  /** 每日 00:05（上海）为昨日未签退记录补记签退 */
  @Cron('5 0 * * *', { timeZone: 'Asia/Shanghai' })
  async handleAutoCheckout() {
    const yesterday = this.yesterdayStr();
    this.logger.log(`开始自动补签退：${yesterday}`);

    const pending = await this.prisma.checkIn.findMany({
      where: {
        date: yesterday,
        checkOutAt: null,
        status: { not: 'MAKEUP' },
      },
      select: { id: true, userId: true, teamId: true, checkInAt: true },
    });

    let count = 0;
    for (const record of pending) {
      const rule = await this.ruleService.resolvePlatformRule(yesterday);
      if (!rule) continue;

      const checkOutAt = dateTimeInShanghai(yesterday, rule.checkOutEnd);
      const workMinutes = computeWorkMinutes(record.checkInAt, checkOutAt);

      await this.prisma.checkIn.update({
        where: { id: record.id },
        data: {
          checkOutAt,
          checkOutType: CheckOutType.AUTO,
          workMinutes,
        },
      });
      count++;
    }

    if (count > 0) {
      await this.audit.log(null, 'AUTO_CHECKOUT_BATCH', { date: yesterday, count });
    }
    this.logger.log(`自动补签退完成：${count} 条`);
  }

  private yesterdayStr(): string {
    const today = todayStr();
    const [y, m, d] = today.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  }
}
