import { nowTimeStr, timeToMinutes, todayStr } from './datetime.js';
import {
  EffectiveAttendanceRule,
  resolvePlatformRule,
} from './attendance-session.js';

export type KioskStandbyPhase =
  | 'EXEMPT'
  | 'BEFORE_CHECK_IN'
  | 'WORK_PERIOD'
  | 'AFTER_DAY'
  | 'RULE_DISABLED'
  | 'NO_RULE';

export type KioskDisplayMode = 'ATTENDANCE' | 'STANDBY';

export interface KioskNextEvent {
  type: 'CHECK_IN' | 'CHECK_OUT';
  time: string;
  minutesUntil: number;
}

export interface KioskSchedule {
  date: string;
  time: string;
  mode: KioskDisplayMode;
  attendanceActive: boolean;
  rule: EffectiveAttendanceRule | null;
  exempt: boolean;
  taskNote: string | null;
  standbyPhase: KioskStandbyPhase;
  standbyMessage: string;
  nextEvent: KioskNextEvent | null;
}

export function isInAttendanceWindow(rule: EffectiveAttendanceRule, nowMinutes: number): boolean {
  const ciStart = timeToMinutes(rule.checkInStart);
  const ciEnd = timeToMinutes(rule.checkInEnd);
  const coStart = timeToMinutes(rule.checkOutStart);
  const coEnd = timeToMinutes(rule.checkOutEnd);
  return (
    (nowMinutes >= ciStart && nowMinutes <= ciEnd) ||
    (nowMinutes >= coStart && nowMinutes <= coEnd)
  );
}

function minutesUntil(nowMinutes: number, targetTime: string): number {
  const target = timeToMinutes(targetTime);
  return target > nowMinutes ? target - nowMinutes : 0;
}

export function resolveStandbyPhase(
  rule: EffectiveAttendanceRule | null,
  exempt: boolean,
  nowMinutes: number,
): { phase: KioskStandbyPhase; message: string; nextEvent: KioskNextEvent | null } {
  if (exempt) {
    return { phase: 'EXEMPT', message: '今日无需打卡，请好好休息', nextEvent: null };
  }
  if (!rule) {
    return { phase: 'NO_RULE', message: '尚未配置出勤规则，请联系管理员', nextEvent: null };
  }
  if (!rule.enabled) {
    return { phase: 'RULE_DISABLED', message: '今日出勤规则未启用', nextEvent: null };
  }

  const ciStart = timeToMinutes(rule.checkInStart);
  const ciEnd = timeToMinutes(rule.checkInEnd);
  const coStart = timeToMinutes(rule.checkOutStart);
  const coEnd = timeToMinutes(rule.checkOutEnd);

  if (nowMinutes < ciStart) {
    const mins = minutesUntil(nowMinutes, rule.checkInStart);
    return {
      phase: 'BEFORE_CHECK_IN',
      message: `签到将于 ${rule.checkInStart} 开始`,
      nextEvent: { type: 'CHECK_IN', time: rule.checkInStart, minutesUntil: mins },
    };
  }
  if (nowMinutes > coEnd) {
    return { phase: 'AFTER_DAY', message: '今日打卡已结束，辛苦了', nextEvent: null };
  }
  if (nowMinutes > ciEnd && nowMinutes < coStart) {
    const mins = minutesUntil(nowMinutes, rule.checkOutStart);
    return {
      phase: 'WORK_PERIOD',
      message: `当前为工作时段，签退请于 ${rule.checkOutStart} 后再来`,
      nextEvent: { type: 'CHECK_OUT', time: rule.checkOutStart, minutesUntil: mins },
    };
  }
  if (nowMinutes > ciEnd && nowMinutes <= coEnd) {
    return {
      phase: 'WORK_PERIOD',
      message: '请面向镜头完成签退',
      nextEvent: null,
    };
  }
  return {
    phase: 'BEFORE_CHECK_IN',
    message: `签到时段 ${rule.checkInStart}–${rule.checkInEnd}`,
    nextEvent: null,
  };
}

async function isGlobalExempt(
  prisma: typeof import('./db.js').prisma,
  date: string,
): Promise<{ exempt: boolean; reason: string | null }> {
  const found = await prisma.calendarExemption.findFirst({
    where: { date, teamId: null },
  });
  return { exempt: !!found, reason: found?.reason ?? null };
}

export async function resolveKioskSchedule(
  prisma: typeof import('./db.js').prisma,
): Promise<KioskSchedule> {
  const date = todayStr();
  const time = nowTimeStr();
  const nowMinutes = timeToMinutes(time);

  const { exempt, reason } = await isGlobalExempt(prisma, date);
  const task = await prisma.attendanceTask.findUnique({ where: { date } });
  const taskNote = task?.status === 'PUBLISHED' ? task.note : null;

  let rule: EffectiveAttendanceRule | null = null;
  let effectiveExempt = exempt;

  if (!exempt) {
    if (task?.status === 'PUBLISHED' && task.note?.includes('免打卡')) {
      effectiveExempt = true;
    } else {
      rule = await resolvePlatformRule(prisma, date);
    }
  }

  const { phase, message, nextEvent } = resolveStandbyPhase(rule, effectiveExempt, nowMinutes);
  const attendanceActive =
    !effectiveExempt && !!rule && rule.enabled && isInAttendanceWindow(rule, nowMinutes);

  return {
    date,
    time,
    mode: attendanceActive ? 'ATTENDANCE' : 'STANDBY',
    attendanceActive,
    rule,
    exempt: effectiveExempt,
    taskNote,
    standbyPhase: phase,
    standbyMessage: effectiveExempt && (taskNote || reason)
      ? (taskNote || (reason ? `今日休息：${reason}` : '今日无需打卡'))
      : message,
    nextEvent,
  };
}
