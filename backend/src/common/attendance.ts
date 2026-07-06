import { CheckIn, CheckInStatus, LeaveStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AttendanceStatus =
  | 'ON_DUTY'
  | 'COMPLETED'
  | 'MAKEUP'
  | 'ON_LEAVE'
  | 'ABSENT'
  | 'EXEMPT';

export interface AttendanceContext {
  checkIn: CheckIn | null;
  onLeave: boolean;
  leaveReason?: string | null;
  exempt: boolean;
  exemptReason?: string | null;
}

export function resolveAttendanceStatus(ctx: AttendanceContext): AttendanceStatus {
  if (ctx.exempt) return 'EXEMPT';
  if (ctx.onLeave) return 'ON_LEAVE';
  if (!ctx.checkIn) return 'ABSENT';
  if (ctx.checkIn.status === CheckInStatus.MAKEUP) return 'MAKEUP';
  if (ctx.checkIn.checkOutAt) return 'COMPLETED';
  if (ctx.checkIn.status === CheckInStatus.LATE) return 'ON_DUTY';
  return 'ON_DUTY';
}

export function isDateInLeaveRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate;
}

/** 批量加载某日团队出勤上下文 */
export async function loadTeamAttendanceContext(
  prisma: PrismaService,
  teamId: number,
  date: string,
  userIds: number[],
): Promise<Map<number, AttendanceContext>> {
  const [checkIns, leaves, exemptions] = await Promise.all([
    prisma.checkIn.findMany({ where: { teamId, date, userId: { in: userIds } } }),
    prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        status: LeaveStatus.APPROVED,
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { userId: true, type: true, reason: true },
    }),
    prisma.calendarExemption.findMany({
      where: {
        date,
        OR: [{ teamId: null }, { teamId }],
      },
    }),
  ]);

  const checkInMap = new Map(checkIns.map((c) => [c.userId, c]));
  const leaveMap = new Map(leaves.map((l) => [l.userId, l]));
  const exempt = exemptions.length > 0;
  const exemptReason = exemptions.find((e) => e.teamId === teamId)?.reason
    ?? exemptions.find((e) => e.teamId === null)?.reason
    ?? null;

  const result = new Map<number, AttendanceContext>();
  for (const uid of userIds) {
    const leave = leaveMap.get(uid);
    result.set(uid, {
      checkIn: checkInMap.get(uid) ?? null,
      onLeave: !!leave,
      leaveReason: leave ? `${leave.type}: ${leave.reason}` : null,
      exempt,
      exemptReason,
    });
  }
  return result;
}

/** 判断某日是否为休息日（全局或团队级） */
export async function isExemptDate(
  prisma: PrismaService,
  teamId: number | null,
  date: string,
): Promise<boolean> {
  const found = await prisma.calendarExemption.findFirst({
    where: {
      date,
      OR: teamId ? [{ teamId: null }, { teamId }] : [{ teamId: null }],
    },
  });
  return !!found;
}
