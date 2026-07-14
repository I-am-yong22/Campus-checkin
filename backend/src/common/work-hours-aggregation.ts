import { LeaveStatus } from '@prisma/client';
import {
  buildEffectiveLeaveIntervals,
  effectiveWorkMinutes,
  loadWriteOffsByLeaveIds,
  mergeLeaveIntervals,
} from './leave-writeoff';
import { loadLeaveTimeMetaByLeaveIds } from './leave-time';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkHoursTotals {
  checkInMinutes: number;
  leaveMinutes: number;
  totalMinutes: number;
  completedDays: number;
  checkInCompletedDays: number;
  leaveDays: number;
}

export interface UserMonthlyContext {
  userId: number;
  teamId: number | null;
}

export interface ExemptIndex {
  global: Set<string>;
  byTeam: Map<number, Set<string>>;
}

export function datesInMonth(month: string): string[] {
  const [y, mo] = month.split('-').map(Number);
  const days = new Date(y, mo, 0).getDate();
  return Array.from({ length: days }, (_, i) =>
    `${month}-${String(i + 1).padStart(2, '0')}`,
  );
}

export function monthBounds(month: string): { start: string; end: string } {
  const dates = datesInMonth(month);
  return { start: dates[0], end: dates[dates.length - 1] };
}

export function buildExemptIndex(
  exemptions: { date: string; teamId: number | null }[],
): ExemptIndex {
  const global = new Set<string>();
  const byTeam = new Map<number, Set<string>>();
  for (const e of exemptions) {
    if (e.teamId === null) {
      global.add(e.date);
      continue;
    }
    if (!byTeam.has(e.teamId)) byTeam.set(e.teamId, new Set());
    byTeam.get(e.teamId)!.add(e.date);
  }
  return { global, byTeam };
}

export function isExemptDate(index: ExemptIndex, date: string, teamId: number | null): boolean {
  if (index.global.has(date)) return true;
  if (teamId != null && index.byTeam.get(teamId)?.has(date)) return true;
  return false;
}

type LeaveRow = {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
};

export async function loadMonthlyWorkHoursContext(
  prisma: PrismaService,
  users: UserMonthlyContext[],
  month: string,
) {
  const userIds = users.map((u) => u.userId);
  const teamByUser = new Map(users.map((u) => [u.userId, u.teamId]));
  const { start: monthStart, end: monthEnd } = monthBounds(month);

  const [checkIns, leaves, exemptions] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId: { in: userIds }, date: { startsWith: month } },
      select: {
        userId: true,
        date: true,
        checkInAt: true,
        checkOutAt: true,
        workMinutes: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: LeaveStatus.APPROVED,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      select: { id: true, userId: true, startDate: true, endDate: true },
    }),
    prisma.calendarExemption.findMany({
      where: { date: { startsWith: month } },
      select: { date: true, teamId: true },
    }),
  ]);

  const leaveIds = leaves.map((l) => l.id);
  const [timeMetaMap, writeOffMap] = await Promise.all([
    loadLeaveTimeMetaByLeaveIds(prisma, leaveIds),
    loadWriteOffsByLeaveIds(prisma, leaveIds),
  ]);

  const checkInByUserDate = new Map<string, (typeof checkIns)[0]>();
  for (const c of checkIns) {
    checkInByUserDate.set(`${c.userId}:${c.date}`, c);
  }

  const leavesByUser = new Map<number, LeaveRow[]>();
  for (const l of leaves) {
    const list = leavesByUser.get(l.userId) ?? [];
    list.push(l);
    leavesByUser.set(l.userId, list);
  }

  const exemptIndex = buildExemptIndex(exemptions);

  function leaveIntervalsForUserOnDate(userId: number, date: string) {
    const userLeaves = leavesByUser.get(userId) ?? [];
    const dayIntervals = userLeaves.flatMap((l) => {
      const ivs = buildEffectiveLeaveIntervals(
        l,
        timeMetaMap.get(l.id),
        writeOffMap.get(l.id),
      );
      return ivs.filter((iv) => {
        const dayStart = new Date(`${date}T00:00:00+08:00`).getTime();
        const dayEnd = new Date(`${date}T23:59:59.999+08:00`).getTime();
        return iv.start.getTime() <= dayEnd && iv.end.getTime() > dayStart;
      });
    });
    return mergeLeaveIntervals(dayIntervals);
  }

  return {
    teamByUser,
    checkInByUserDate,
    exemptIndex,
    leaveIntervalsForUserOnDate,
  };
}

export function resolveDayEffectiveWorkMinutes(
  checkIn: { checkInAt: Date; checkOutAt: Date | null } | null | undefined,
  leaveIntervals: ReturnType<typeof mergeLeaveIntervals>,
): number {
  if (!checkIn?.checkOutAt) return 0;
  return effectiveWorkMinutes(checkIn.checkInAt, checkIn.checkOutAt, leaveIntervals);
}

export async function aggregateMonthlyWorkHours(
  prisma: PrismaService,
  users: UserMonthlyContext[],
  month: string,
): Promise<Map<number, WorkHoursTotals>> {
  if (users.length === 0) return new Map();

  const dates = datesInMonth(month);
  const ctx = await loadMonthlyWorkHoursContext(prisma, users, month);
  const result = new Map<number, WorkHoursTotals>();

  for (const { userId } of users) {
    let checkInMinutes = 0;
    let checkInCompletedDays = 0;

    for (const date of dates) {
      const teamId = ctx.teamByUser.get(userId) ?? null;
      if (isExemptDate(ctx.exemptIndex, date, teamId)) continue;

      const checkIn = ctx.checkInByUserDate.get(`${userId}:${date}`);
      const intervals = ctx.leaveIntervalsForUserOnDate(userId, date);
      const minutes = resolveDayEffectiveWorkMinutes(checkIn, intervals);
      if (minutes > 0) {
        checkInMinutes += minutes;
        checkInCompletedDays++;
      }
    }

    result.set(userId, {
      checkInMinutes,
      leaveMinutes: 0,
      totalMinutes: checkInMinutes,
      completedDays: checkInCompletedDays,
      checkInCompletedDays,
      leaveDays: 0,
    });
  }

  return result;
}
