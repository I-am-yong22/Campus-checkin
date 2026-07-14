import { BadRequestException, Injectable } from '@nestjs/common';
import { LeaveStatus, Role, UserStatus } from '@prisma/client';
import {
  loadTeamAttendanceContext,
  resolveAttendanceStatus,
} from '../common/attendance';
import { todayStr } from '../common/datetime';
import { aggregateMonthlyWorkHours } from '../common/work-hours-aggregation';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function lastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() + TZ_OFFSET_MS - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

@Injectable()
export class StatsService {
  constructor(
    private prisma: PrismaService,
    private teamsService: TeamsService,
  ) {}

  async overview(days = 7) {
    const safeDays = Math.min(Math.max(days, 3), 31);
    const today = todayStr();
    const dates = lastNDates(safeDays);

    const [
      totalUsers,
      faceRegistered,
      todayCheckIns,
      todayLate,
      todayMakeup,
      pendingLeaves,
      teams,
      checkInsByDate,
      todayOnLeave,
      todayExempt,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE, role: { in: [Role.USER, Role.LEADER] } } }),
      this.prisma.user.count({
        where: { status: UserStatus.ACTIVE, role: { in: [Role.USER, Role.LEADER] }, faceRegistered: true },
      }),
      this.prisma.checkIn.count({ where: { date: today } }),
      this.prisma.checkIn.count({ where: { date: today, status: 'LATE' } }),
      this.prisma.checkIn.count({ where: { date: today, status: 'MAKEUP' } }),
      this.prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
      this.prisma.team.findMany({
        orderBy: { id: 'asc' },
        include: { _count: { select: { members: { where: { status: UserStatus.ACTIVE } } } } },
      }),
      this.prisma.checkIn.groupBy({
        by: ['date'],
        where: { date: { in: dates } },
        _count: { id: true },
      }),
      this.countOnLeaveToday(today),
      this.isGlobalExemptToday(today),
    ]);

    const lateByDate = await this.prisma.checkIn.groupBy({
      by: ['date'],
      where: { date: { in: dates }, status: 'LATE' },
      _count: { id: true },
    });
    const totalMap = new Map(checkInsByDate.map((r) => [r.date, r._count.id]));
    const lateMap = new Map(lateByDate.map((r) => [r.date, r._count.id]));

    const dailyTrend = dates.map((date) => ({
      date,
      total: totalMap.get(date) || 0,
      late: lateMap.get(date) || 0,
    }));

    const todayCheckInsByTeam = await this.prisma.checkIn.groupBy({
      by: ['teamId'],
      where: { date: today, teamId: { not: null } },
      _count: { id: true },
    });
    const checkedMap = new Map(
      todayCheckInsByTeam.map((r) => [r.teamId as number, r._count.id]),
    );

    const teamRates = teams.map((t) => {
      const memberCount = t._count.members;
      const checkedIn = checkedMap.get(t.id) || 0;
      return {
        teamId: t.id,
        teamName: t.name,
        memberCount,
        checkedIn,
        rate: memberCount > 0 ? Number(((checkedIn / memberCount) * 100).toFixed(1)) : 0,
      };
    });

    const absentToday = todayExempt ? 0 : await this.countAbsentToday(today);

    return {
      date: today,
      overview: {
        totalUsers,
        faceRegistered,
        todayCheckIns,
        todayLate,
        todayMakeup,
        todayOnLeave,
        todayAbsent: absentToday,
        todayExempt,
        pendingLeaves,
        teamCount: teams.length,
      },
      teamRates,
      dailyTrend,
    };
  }

  async teamStats(
    requester: { id: number; role: Role; teamId: number | null },
    teamId?: number,
    days = 7,
  ) {
    const safeDays = Math.min(Math.max(days, 3), 31);
    let resolvedTeamId = teamId;
    if (requester.role === Role.LEADER) {
      resolvedTeamId = await this.teamsService.resolveLeaderTeamId(requester.id, teamId);
    } else if (!resolvedTeamId) {
      throw new BadRequestException('请选择团队');
    }

    const team = await this.prisma.team.findUnique({ where: { id: resolvedTeamId } });
    if (!team) throw new BadRequestException('团队不存在');

    const members = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { in: [Role.USER, Role.LEADER] },
        teamMemberships: { some: { teamId: resolvedTeamId } },
      },
      select: { id: true },
    });
    const memberCount = members.length;
    const userIds = members.map((m) => m.id);
    const dates = lastNDates(safeDays);

    const dailyTrend: {
      date: string;
      memberCount: number;
      checkedIn: number;
      late: number;
      onLeave: number;
      absent: number;
      exempt: number;
      checkInRate: number;
      lateRate: number;
      leaveRate: number;
    }[] = [];
    for (const date of dates) {
      const ctxMap = await loadTeamAttendanceContext(this.prisma, resolvedTeamId!, date, userIds);
      let checkedIn = 0;
      let late = 0;
      let onLeave = 0;
      let absent = 0;
      let exempt = 0;
      for (const uid of userIds) {
        const status = resolveAttendanceStatus(ctxMap.get(uid)!);
        const ci = ctxMap.get(uid)!.checkIn;
        if (status === 'ON_DUTY' || status === 'COMPLETED' || status === 'MAKEUP') {
          checkedIn++;
          if (ci?.status === 'LATE') late++;
        } else if (status === 'ON_LEAVE') onLeave++;
        else if (status === 'EXEMPT') exempt++;
        else if (status === 'ABSENT') absent++;
      }
      const effective = memberCount - exempt;
      dailyTrend.push({
        date,
        memberCount,
        checkedIn: checkedIn + late,
        late,
        onLeave,
        absent,
        exempt,
        checkInRate: effective > 0 ? Number((((checkedIn + late) / effective) * 100).toFixed(1)) : 0,
        lateRate: effective > 0 ? Number(((late / effective) * 100).toFixed(1)) : 0,
        leaveRate: effective > 0 ? Number(((onLeave / effective) * 100).toFixed(1)) : 0,
      });
    }

    const today = todayStr();
    const todayCtx = await loadTeamAttendanceContext(this.prisma, resolvedTeamId!, today, userIds);
    const todaySummary = { checkedIn: 0, onDuty: 0, completed: 0, late: 0, makeup: 0, onLeave: 0, absent: 0, exempt: 0 };
    for (const uid of userIds) {
      const s = resolveAttendanceStatus(todayCtx.get(uid)!);
      const ci = todayCtx.get(uid)!.checkIn;
      if (s === 'ON_DUTY') {
        todaySummary.onDuty++;
        todaySummary.checkedIn++;
        if (ci?.status === 'LATE') todaySummary.late++;
      } else if (s === 'COMPLETED') {
        todaySummary.completed++;
        todaySummary.checkedIn++;
        if (ci?.status === 'LATE') todaySummary.late++;
      } else if (s === 'MAKEUP') {
        todaySummary.makeup++;
        todaySummary.checkedIn++;
      } else if (s === 'ON_LEAVE') todaySummary.onLeave++;
      else if (s === 'EXEMPT') todaySummary.exempt++;
      else if (s === 'ABSENT') todaySummary.absent++;
    }

    return {
      team: { id: team.id, name: team.name },
      memberCount,
      today: todaySummary,
      dailyTrend,
    };
  }

  async attention(
    requester: { id: number; role: Role; teamId: number | null },
    teamId?: number,
  ) {
    const today = todayStr();
    let resolvedTeamId = teamId;

    if (requester.role === Role.LEADER) {
      try {
        resolvedTeamId = await this.teamsService.resolveLeaderTeamId(requester.id, teamId);
      } catch (e) {
        if (e instanceof BadRequestException) {
          return { date: today, absentToday: [], noFace: [] };
        }
        throw e;
      }
    }

    const memberWhere: any = {
      status: UserStatus.ACTIVE,
      role: { in: [Role.USER, Role.LEADER] },
    };
    if (resolvedTeamId) {
      memberWhere.teamMemberships = { some: { teamId: resolvedTeamId } };
    }

    const members = await this.prisma.user.findMany({
      where: memberWhere,
      select: {
        id: true,
        name: true,
        username: true,
        teamId: true,
        faceRegistered: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const noFace = members
      .filter((m) => !m.faceRegistered)
      .map((m) => ({
        id: m.id,
        name: m.name,
        username: m.username,
        teamId: m.teamId,
        teamName: m.team?.name ?? null,
      }));

    const absentToday: typeof noFace = [];
    const byTeam = new Map<number, number[]>();
    for (const m of members) {
      if (!m.teamId) continue;
      const list = byTeam.get(m.teamId) || [];
      list.push(m.id);
      byTeam.set(m.teamId, list);
    }

    for (const [tid, uids] of byTeam) {
      const ctxMap = await loadTeamAttendanceContext(this.prisma, tid, today, uids);
      for (const uid of uids) {
        const status = resolveAttendanceStatus(ctxMap.get(uid)!);
        if (status === 'ABSENT') {
          const m = members.find((x) => x.id === uid)!;
          absentToday.push({
            id: m.id,
            name: m.name,
            username: m.username,
            teamId: m.teamId,
            teamName: m.team?.name ?? null,
          });
        }
      }
    }

    return { date: today, absentToday, noFace };
  }

  async kioskStatus() {
    const hb = await this.prisma.kioskHeartbeat.findUnique({ where: { id: 1 } });
    const now = Date.now();
    const online = hb ? now - hb.lastSeenAt.getTime() < 2 * 60 * 1000 : false;
    return {
      online,
      lastSeenAt: hb?.lastSeenAt ?? null,
      lastCheckInAt: hb?.lastCheckInAt ?? null,
      version: hb?.version ?? null,
    };
  }

  async workHoursLeaderboard(month?: string, teamId?: number) {
    const m = month || todayStr().slice(0, 7);
    const userWhere: any = {
      status: UserStatus.ACTIVE,
      role: { in: [Role.USER, Role.LEADER] },
    };
    if (teamId) userWhere.teamId = teamId;

    const members = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        username: true,
        teamId: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const totalsMap = await aggregateMonthlyWorkHours(
      this.prisma,
      members.map((u) => ({ userId: u.id, teamId: u.teamId })),
      m,
    );

    const leaderboard = members
      .map((u) => {
        const totals = totalsMap.get(u.id)!;
        return {
          userId: u.id,
          name: u.name,
          username: u.username,
          teamId: u.teamId,
          teamName: u.team?.name ?? null,
          checkInMinutes: totals.checkInMinutes,
          leaveMinutes: totals.leaveMinutes,
          totalMinutes: totals.totalMinutes,
          completedDays: totals.completedDays,
          checkInCompletedDays: totals.checkInCompletedDays,
          leaveDays: totals.leaveDays,
        };
      })
      .sort((a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name, 'zh-CN'))
      .map((row, index) => ({ rank: index + 1, ...row }));

    return { month: m, teamId: teamId ?? null, leaderboard };
  }

  private async countOnLeaveToday(today: string): Promise<number> {
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { userId: true },
    });
    const userIds = [...new Set(leaves.map((l) => l.userId))];
    if (userIds.length === 0) return 0;
    const checkedIn = await this.prisma.checkIn.count({
      where: { date: today, userId: { in: userIds } },
    });
    return userIds.length - checkedIn;
  }

  private async isGlobalExemptToday(today: string): Promise<boolean> {
    const found = await this.prisma.calendarExemption.findFirst({
      where: { date: today, teamId: null },
    });
    return !!found;
  }

  private async countAbsentToday(today: string): Promise<number> {
    const members = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { in: [Role.USER, Role.LEADER] },
        teamId: { not: null },
      },
      select: { id: true, teamId: true },
    });
    const byTeam = new Map<number, number[]>();
    for (const m of members) {
      const list = byTeam.get(m.teamId!) || [];
      list.push(m.id);
      byTeam.set(m.teamId!, list);
    }
    let absent = 0;
    for (const [tid, uids] of byTeam) {
      const ctxMap = await loadTeamAttendanceContext(this.prisma, tid, today, uids);
      for (const uid of uids) {
        if (resolveAttendanceStatus(ctxMap.get(uid)!) === 'ABSENT') absent++;
      }
    }
    return absent;
  }
}
