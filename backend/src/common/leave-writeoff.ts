import { computeWorkMinutes, dateTimeInShanghai } from './attendance-session';
import { addDaysToDateStr, LeaveMode, LeaveTimeMeta } from './leave-time';
import { PrismaService } from '../prisma/prisma.service';
import { todayStr } from './datetime';

export type LeaveWriteOffScenario = 'SAME_DAY' | 'NEXT_DAY' | 'OTHER';

export interface LeaveWriteOffRecord {
  leaveId: number;
  writeOffAt: string;
  writeOffDate: string;
  scenario: LeaveWriteOffScenario;
  operatorId?: number;
}

export const LEAVE_WRITEOFF_ACTION = 'LEAVE_WRITEOFF';

export interface LeaveInterval {
  start: Date;
  end: Date;
}

export interface LeaveForInterval {
  id: number;
  startDate: string;
  endDate: string;
}

function parseAuditDetail(detail: string | null): Record<string, unknown> | null {
  if (!detail) return null;
  try {
    return JSON.parse(detail) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function detectWriteOffScenario(
  startDate: string,
  writeOffDate: string,
): LeaveWriteOffScenario {
  if (writeOffDate === startDate) return 'SAME_DAY';
  if (writeOffDate === addDaysToDateStr(startDate, 1)) return 'NEXT_DAY';
  return 'OTHER';
}

export async function loadWriteOffsByLeaveIds(
  prisma: PrismaService,
  leaveIds: number[],
): Promise<Map<number, LeaveWriteOffRecord>> {
  const map = new Map<number, LeaveWriteOffRecord>();
  if (leaveIds.length === 0) return map;

  const logs = await prisma.auditLog.findMany({
    where: { action: LEAVE_WRITEOFF_ACTION },
    orderBy: { createdAt: 'asc' },
    select: { userId: true, detail: true },
  });

  for (const log of logs) {
    const d = parseAuditDetail(log.detail);
    if (!d || typeof d.leaveId !== 'number') continue;
    if (!leaveIds.includes(d.leaveId)) continue;
    map.set(d.leaveId, {
      leaveId: d.leaveId,
      writeOffAt: String(d.writeOffAt),
      writeOffDate: String(d.writeOffDate),
      scenario: (d.scenario as LeaveWriteOffScenario) || 'OTHER',
      operatorId: log.userId ?? undefined,
    });
  }

  return map;
}

function dayStart(date: string): Date {
  return dateTimeInShanghai(date, '00:00');
}

function dayEnd(date: string): Date {
  return dateTimeInShanghai(addDaysToDateStr(date, 1), '00:00');
}

export function buildEffectiveLeaveIntervals(
  leave: LeaveForInterval,
  timeMeta: LeaveTimeMeta | null | undefined,
  writeOff?: LeaveWriteOffRecord | null,
): LeaveInterval[] {
  const mode: LeaveMode = timeMeta?.mode ?? 'FULL_DAY';
  const writeOffAt = writeOff ? new Date(writeOff.writeOffAt) : null;
  const writeOffDate = writeOff?.writeOffDate ?? null;

  if (mode === 'HOURLY' && timeMeta?.leaveStartAt && timeMeta?.leaveEndAt) {
    const start = new Date(timeMeta.leaveStartAt);
    const plannedEnd = new Date(timeMeta.leaveEndAt);
    const end = writeOffAt ?? plannedEnd;
    if (end.getTime() <= start.getTime()) return [];
    return [{ start, end }];
  }

  const intervals: LeaveInterval[] = [];
  let d = leave.startDate;
  while (d <= leave.endDate) {
    if (writeOffDate && d > writeOffDate) break;

    if (writeOffDate && d === writeOffDate && writeOffAt) {
      const start = dayStart(d);
      if (writeOffAt.getTime() > start.getTime()) {
        intervals.push({ start, end: writeOffAt });
      }
    } else {
      intervals.push({ start: dayStart(d), end: dayEnd(d) });
    }

    d = addDaysToDateStr(d, 1);
  }

  return intervals;
}

export function mergeLeaveIntervals(intervals: LeaveInterval[]): LeaveInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: LeaveInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) {
        last.end = cur.end;
      }
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function overlapMinutes(
  workStart: Date,
  workEnd: Date,
  leaveIntervals: LeaveInterval[],
): number {
  let total = 0;
  for (const iv of leaveIntervals) {
    const start = new Date(Math.max(workStart.getTime(), iv.start.getTime()));
    const end = new Date(Math.min(workEnd.getTime(), iv.end.getTime()));
    if (end.getTime() > start.getTime()) {
      total += computeWorkMinutes(start, end);
    }
  }
  return total;
}

export function effectiveWorkMinutes(
  checkInAt: Date,
  checkOutAt: Date,
  leaveIntervals: LeaveInterval[],
): number {
  const raw = computeWorkMinutes(checkInAt, checkOutAt);
  const merged = mergeLeaveIntervals(leaveIntervals);
  const overlap = overlapMinutes(checkInAt, checkOutAt, merged);
  return Math.max(0, raw - overlap);
}

export function intervalsOverlap(a: LeaveInterval, b: LeaveInterval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function isFullDayLeaveOnDate(
  leave: LeaveForInterval,
  timeMeta: LeaveTimeMeta | null | undefined,
  writeOff: LeaveWriteOffRecord | null | undefined,
  date: string,
): boolean {
  if (date < leave.startDate || date > leave.endDate) return false;
  const mode = timeMeta?.mode ?? 'FULL_DAY';
  if (mode === 'HOURLY') return false;
  if (writeOff && date > writeOff.writeOffDate) return false;
  return true;
}

export function buildWriteOffDates(
  writeOffAt: Date = new Date(),
): { writeOffAt: string; writeOffDate: string } {
  const writeOffDate = todayStr();
  return { writeOffAt: writeOffAt.toISOString(), writeOffDate };
}
