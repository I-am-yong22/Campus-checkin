import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceTaskStatus } from '@prisma/client';
import {
  EffectiveAttendanceRule,
  ruleFromPlatformRule,
  ruleFromTask,
} from '../common/attendance-session';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlatformRuleDto } from './dto/platform-rule.dto';

@Injectable()
export class AttendanceRuleService {
  constructor(private prisma: PrismaService) {}

  async resolvePlatformRule(date: string): Promise<EffectiveAttendanceRule | null> {
    const task = await this.prisma.attendanceTask.findUnique({
      where: { date },
    });
    if (task?.status === AttendanceTaskStatus.PUBLISHED) {
      return ruleFromTask(task);
    }

    const rule = await this.prisma.platformCheckInRule.findUnique({ where: { id: 1 } });
    if (!rule) return null;
    return ruleFromPlatformRule(rule);
  }

  async getPlatformRuleOrThrow() {
    const rule = await this.prisma.platformCheckInRule.findUnique({ where: { id: 1 } });
    if (!rule) throw new NotFoundException('平台默认出勤规则未配置');
    return rule;
  }

  async updatePlatformRule(dto: UpdatePlatformRuleDto) {
    await this.getPlatformRuleOrThrow();
    return this.prisma.platformCheckInRule.update({
      where: { id: 1 },
      data: { ...dto },
    });
  }
}
