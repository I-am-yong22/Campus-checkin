import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  loadTeamAttendanceContext,
  resolveAttendanceStatus,
} from '../common/attendance';
import { todayStr } from '../common/datetime';
import {
  datesInMonth,
  loadMonthlyWorkHoursContext,
  resolveDayEffectiveWorkMinutes,
} from '../common/work-hours-aggregation';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';

const STATUS_LABEL: Record<string, string> = {
  ON_DUTY: '在岗',
  COMPLETED: '已完成',
  MAKEUP: '补签',
  ON_LEAVE: '请假',
  ABSENT: '缺勤',
  EXEMPT: '休息日',
};

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: string[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

@Injectable()
export class ExportService {
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
  ) {}

  async teamDaily(
    requester: { id: number; role: Role; teamId: number | null },
    teamId?: number,
    date?: string,
  ) {
    const overview = await this.teamsService.membersOverview(requester, teamId, date);
    const includeWorkHours = requester.role === Role.ADMIN;
    const header = includeWorkHours
      ? ['姓名', '用户名', '角色', '人脸', '出勤状态', '签到时间', '签退时间', '工时(分钟)', '比对距离', '备注']
      : ['姓名', '用户名', '角色', '人脸', '出勤状态', '签到时间', '比对距离', '备注'];
    const rows: string[][] = [header];
    const workHoursCtx =
      includeWorkHours && overview.team?.id
        ? await loadMonthlyWorkHoursContext(
            this.prisma,
            overview.members.map((member) => ({
              userId: member.id,
              teamId: overview.team!.id,
            })),
            overview.date.slice(0, 7),
          )
        : null;

    for (const m of overview.members) {
      const status = (m as any).attendanceStatus as string;
      const ci = m.checkIn;
      const base = [
        m.name,
        m.username,
        m.role === 'LEADER' ? '负责人' : '学员',
        m.faceRegistered ? '已录入' : '未录入',
        STATUS_LABEL[status] || status,
        ci ? new Date(ci.checkInAt).toISOString() : '',
      ];
      if (includeWorkHours) {
        let workMinutes = '';
        if (workHoursCtx && overview.team?.id) {
          const checkIn = workHoursCtx.checkInByUserDate.get(`${m.id}:${overview.date}`);
          const intervals = workHoursCtx.leaveIntervalsForUserOnDate(m.id, overview.date);
          const minutes = resolveDayEffectiveWorkMinutes(checkIn, intervals);
          if (minutes > 0) workMinutes = String(minutes);
        } else if (ci?.workMinutes != null) {
          workMinutes = String(ci.workMinutes);
        }
        rows.push([
          ...base,
          ci?.checkOutAt ? new Date(ci.checkOutAt).toISOString() : '',
          workMinutes,
          ci ? String(ci.matchScore) : '',
          ci?.remark || (m as any).leaveReason || (m as any).exemptReason || '',
        ]);
      } else {
        rows.push([
          ...base,
          ci ? String(ci.matchScore) : '',
          ci?.remark || (m as any).leaveReason || (m as any).exemptReason || '',
        ]);
      }
    }
    const filename = `team-daily-${overview.team?.name || 'team'}-${overview.date}.csv`;
    return { filename, content: toCsv(rows) };
  }

  async userMonthly(userId: number, month?: string) {
    const m = month || todayStr().slice(0, 7);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, teamId: true },
    });
    if (!user) throw new BadRequestException('用户不存在');

    const checkIns = await this.prisma.checkIn.findMany({
      where: { userId, date: { startsWith: m } },
      orderBy: { date: 'asc' },
    });
    const checkInMap = new Map(checkIns.map((c) => [c.date, c]));
    const ctx = await loadMonthlyWorkHoursContext(
      this.prisma,
      [{ userId, teamId: user.teamId }],
      m,
    );
    const monthDates = datesInMonth(m);

    const rows: string[][] = [['日期', '出勤状态', '签到时间', '签退时间', '工时(分钟)', '比对距离', '备注']];

    for (const date of monthDates) {
      const checkIn = checkInMap.get(date) ?? null;
      let status = '缺勤';
      if (user.teamId) {
        const ctxMap = await loadTeamAttendanceContext(this.prisma, user.teamId, date, [userId]);
        status = STATUS_LABEL[resolveAttendanceStatus(ctxMap.get(userId)!)] || '缺勤';
      } else if (checkIn) {
        status = checkIn.checkOutAt ? '已完成' : checkIn.status === 'MAKEUP' ? '补签' : '在岗';
      }
      const stored = ctx.checkInByUserDate.get(`${userId}:${date}`);
      const intervals = ctx.leaveIntervalsForUserOnDate(userId, date);
      const minutes = resolveDayEffectiveWorkMinutes(stored ?? checkIn, intervals);
      rows.push([
        date,
        status,
        checkIn ? new Date(checkIn.checkInAt).toISOString() : '',
        checkIn?.checkOutAt ? new Date(checkIn.checkOutAt).toISOString() : '',
        minutes > 0 ? String(minutes) : '',
        checkIn ? String(checkIn.matchScore) : '',
        checkIn?.remark || '',
      ]);
    }

    const filename = `checkin-${user.username}-${m}.csv`;
    return { filename, content: toCsv(rows) };
  }

  async overviewCsv(days = 7) {
    const dates: string[] = [];
    const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
    const safeDays = Math.min(Math.max(days, 3), 31);
    for (let i = safeDays - 1; i >= 0; i--) {
      const d = new Date(Date.now() + TZ_OFFSET_MS - i * 86400000);
      dates.push(d.toISOString().slice(0, 10));
    }

    const checkInsByDate = await this.prisma.checkIn.groupBy({
      by: ['date'],
      where: { date: { in: dates } },
      _count: { id: true },
    });
    const lateByDate = await this.prisma.checkIn.groupBy({
      by: ['date'],
      where: { date: { in: dates }, status: 'LATE' },
      _count: { id: true },
    });
    const totalMap = new Map(checkInsByDate.map((r) => [r.date, r._count.id]));
    const lateMap = new Map(lateByDate.map((r) => [r.date, r._count.id]));

    const rows: string[][] = [['日期', '签到人数', '迟到人数']];
    for (const date of dates) {
      rows.push([date, String(totalMap.get(date) || 0), String(lateMap.get(date) || 0)]);
    }
    return { filename: `overview-trend-${safeDays}d.csv`, content: toCsv(rows) };
  }

  async workHours(teamId?: number, month?: string) {
    const m = month || todayStr().slice(0, 7);
    if (!teamId) throw new BadRequestException('请选择团队');
    const resolvedTeamId = teamId;

    const team = await this.prisma.team.findUnique({ where: { id: resolvedTeamId } });
    if (!team) throw new BadRequestException('团队不存在');

    const members = await this.prisma.user.findMany({
      where: {
        teamId: resolvedTeamId,
        status: 'ACTIVE',
        role: { in: [Role.USER, Role.LEADER] },
      },
      select: { id: true, name: true, username: true },
      orderBy: { name: 'asc' },
    });

    const checkIns = await this.prisma.checkIn.findMany({
      where: { teamId: resolvedTeamId, date: { startsWith: m } },
    });
    const byUserDate = new Map<string, (typeof checkIns)[0]>();
    for (const c of checkIns) {
      byUserDate.set(`${c.userId}:${c.date}`, c);
    }

    const ctx = await loadMonthlyWorkHoursContext(
      this.prisma,
      members.map((member) => ({ userId: member.id, teamId: resolvedTeamId })),
      m,
    );

    const monthDates = datesInMonth(m);
    const rows: string[][] = [
      ['姓名', '用户名', '日期', '签到时间', '签退时间', '工时(分钟)', '签退类型', '备注'],
    ];

    for (const member of members) {
      for (const date of monthDates) {
        const c = byUserDate.get(`${member.id}:${date}`);
        const stored = ctx.checkInByUserDate.get(`${member.id}:${date}`);
        const intervals = ctx.leaveIntervalsForUserOnDate(member.id, date);
        const minutes = resolveDayEffectiveWorkMinutes(stored ?? c, intervals);
        if (!c && minutes <= 0) continue;
        rows.push([
          member.name,
          member.username,
          date,
          c ? new Date(c.checkInAt).toISOString() : '',
          c?.checkOutAt ? new Date(c.checkOutAt).toISOString() : '',
          minutes > 0 ? String(minutes) : '',
          c?.checkOutType || '',
          c?.remark || '',
        ]);
      }
    }

    const filename = `work-hours-${team.name}-${m}.csv`;
    return { filename, content: toCsv(rows) };
  }
}
