import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CheckInStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AttendanceRuleService } from '../attendance/attendance-rule.service';
import { todayStr } from '../common/datetime';
import { maskCheckInWorkHours } from '../common/work-hours';
import {
  aggregateMonthlyWorkHours,
  loadMonthlyWorkHoursContext,
  resolveDayEffectiveWorkMinutes,
} from '../common/work-hours-aggregation';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { MakeupCheckInDto } from './dto/checkin.dto';

@Injectable()
export class CheckInService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private teamsService: TeamsService,
    private ruleService: AttendanceRuleService,
  ) {}

  async today(userId: number) {
    const date = todayStr();
    const record = await this.prisma.checkIn.findUnique({
      where: { userId_date: { userId, date } },
    });
    const effectiveRule = await this.ruleService.resolvePlatformRule(date);

    const phase = !record
      ? 'NONE'
      : record.checkOutAt
        ? 'COMPLETED'
        : 'ON_DUTY';

    return {
      date,
      checkedIn: !!record,
      checkedOut: !!record?.checkOutAt,
      phase,
      record,
      effectiveRule,
    };
  }

  async mine(userId: number, month?: string) {
    const where: any = { userId };
    if (month) {
      where.date = { startsWith: month };
    }
    const rows = await this.prisma.checkIn.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    if (!month) return rows;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });
    const ctx = await loadMonthlyWorkHoursContext(
      this.prisma,
      [{ userId, teamId: user?.teamId ?? null }],
      month,
    );
    return rows.map((r) => ({
      ...r,
      effectiveWorkMinutes: resolveDayEffectiveWorkMinutes(
        r,
        ctx.leaveIntervalsForUserOnDate(userId, r.date),
      ),
    }));
  }

  async teamCheckIns(
    requester: { id: number; role: Role; teamId: number | null },
    params: { teamId?: number; date?: string },
  ) {
    let teamId = params.teamId;
    if (requester.role === Role.LEADER) {
      teamId = requester.teamId ?? -1;
    }
    const where: any = {};
    if (teamId) where.teamId = teamId;
    if (params.date) where.date = params.date;
    return this.prisma.checkIn.findMany({
      where,
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: [{ date: 'desc' }, { checkInAt: 'desc' }],
    }).then((rows) =>
      rows.map((r) => ({
        ...maskCheckInWorkHours(r, r.userId, requester)!,
        user: r.user,
      })),
    );
  }

  async workHoursSummary(userId: number, month?: string) {
    const m = month || todayStr().slice(0, 7);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });
    const records = await this.prisma.checkIn.findMany({
      where: { userId, date: { startsWith: m } },
      select: {
        id: true,
        date: true,
        checkInAt: true,
        checkOutAt: true,
        workMinutes: true,
        status: true,
      },
      orderBy: { date: 'asc' },
    });
    const totalsMap = await aggregateMonthlyWorkHours(
      this.prisma,
      [{ userId, teamId: user?.teamId ?? null }],
      m,
    );
    const totals = totalsMap.get(userId)!;
    return {
      month: m,
      ...totals,
      recordCount: records.length,
      records,
    };
  }

  async makeup(
    requester: { id: number; role: Role; teamId: number | null },
    dto: MakeupCheckInDto,
  ) {
    if (requester.role !== Role.LEADER && requester.role !== Role.ADMIN) {
      throw new ForbiddenException('无权补签');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, name: true, teamId: true, status: true },
    });
    if (!target) throw new NotFoundException('用户不存在');
    if (target.status !== 'ACTIVE') throw new BadRequestException('该用户已被禁用');

    if (requester.role === Role.LEADER) {
      if (!target.teamId) {
        throw new ForbiddenException('只能为本团队成员补签');
      }
      await this.teamsService.assertLeaderManagesTeam(requester.id, target.teamId);
      if (!(await this.teamsService.isTeamMember(target.id, target.teamId))) {
        throw new ForbiddenException('该用户不在该团队中');
      }
    }

    const existing = await this.prisma.checkIn.findUnique({
      where: { userId_date: { userId: dto.userId, date: dto.date } },
    });
    if (existing) throw new ConflictException('该日已有签到记录');

    const remark = dto.remark?.trim();
    if (!remark) throw new BadRequestException('请填写补签备注');

    const record = await this.prisma.checkIn.create({
      data: {
        userId: dto.userId,
        teamId: target.teamId ?? undefined,
        date: dto.date,
        matchScore: 0,
        livenessPassed: false,
        status: CheckInStatus.MAKEUP,
        remark,
      },
    });

    await this.audit.log(requester.id, 'CHECKIN_MAKEUP', {
      targetUserId: dto.userId,
      targetName: target.name,
      date: dto.date,
      remark,
    });

    return record;
  }
}
