import { dateTimeInShanghai } from './attendance-session';
import { timeToMinutes } from './datetime';
import { PrismaService } from '../prisma/prisma.service';

export type LeaveMode = 'FULL_DAY' | 'HOURLY';

export interface LeaveTimeMeta {
  leaveId: number;
  mode: LeaveMode;
  startTime?: string;
  durationMinutes?: number;
  leaveStartAt?: string;
  leaveEndAt?: string;
}

export const LEAVE_TIME_ACTION = 'LEAVE_TIME';

export function parseLeaveDuration(hours: number, minutes: number): number {
  const h = Math.max(0, Math.floor(hours) || 0);
  const m = Math.max(0, Math.floor(minutes) || 0);
  return h * 60 + m;
}

export function buildHourlyLeaveRange(
  startDate: string,
  startTime: string,
  durationMinutes: number,
): { leaveStartAt: Date; leaveEndAt: Date } {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  if (endMinutes > 24 * 60) {
    throw new Error('按小时请假不能跨自然日');
  }
  const leaveStartAt = dateTimeInShanghai(startDate, startTime);
  const endHour = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;
  const leaveEndAt = dateTimeInShanghai(startDate, endTime);
  return { leaveStartAt, leaveEndAt };
}

export function formatLeaveTimeMeta(meta: LeaveTimeMeta | null | undefined): string | null {
  if (!meta || meta.mode === 'FULL_DAY') return null;
  if (!meta.startTime || !meta.durationMinutes) return null;
  const h = Math.floor(meta.durationMinutes / 60);
  const m = meta.durationMinutes % 60;
  const dur = m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  const end = meta.leaveEndAt
    ? new Date(meta.leaveEndAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      })
    : '';
  return `${meta.startTime}–${end}（${dur}）`;
}

function parseAuditDetail(detail: string | null): Record<string, unknown> | null {
  if (!detail) return null;
  try {
    return JSON.parse(detail) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function loadLeaveTimeMetaByLeaveIds(
  prisma: PrismaService,
  leaveIds: number[],
): Promise<Map<number, LeaveTimeMeta>> {
  const map = new Map<number, LeaveTimeMeta>();
  if (leaveIds.length === 0) return map;

  const logs = await prisma.auditLog.findMany({
    where: { action: LEAVE_TIME_ACTION },
    orderBy: { createdAt: 'asc' },
    select: { detail: true },
  });

  for (const log of logs) {
    const d = parseAuditDetail(log.detail);
    if (!d || typeof d.leaveId !== 'number') continue;
    if (!leaveIds.includes(d.leaveId)) continue;
    const mode = (d.mode as LeaveMode) || 'FULL_DAY';
    map.set(d.leaveId, {
      leaveId: d.leaveId,
      mode,
      startTime: typeof d.startTime === 'string' ? d.startTime : undefined,
      durationMinutes: typeof d.durationMinutes === 'number' ? d.durationMinutes : undefined,
      leaveStartAt: typeof d.leaveStartAt === 'string' ? d.leaveStartAt : undefined,
      leaveEndAt: typeof d.leaveEndAt === 'string' ? d.leaveEndAt : undefined,
    });
  }

  return map;
}

export function addDaysToDateStr(date: string, days: number): string {
  const [y, mo, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
