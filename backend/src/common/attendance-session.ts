import { timeToMinutes } from './datetime';

export interface EffectiveAttendanceRule {
  checkInStart: string;
  lateTime: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  enabled: boolean;
  source: 'task' | 'platform';
}

export type AttendanceAction = 'CHECK_IN' | 'CHECK_OUT' | 'REJECT';

export interface AttendanceRecordState {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
}

export function ruleFromPlatformRule(rule: {
  startTime: string;
  lateTime: string;
  endTime: string;
  checkOutStart?: string | null;
  checkOutEnd?: string | null;
  enabled: boolean;
}): EffectiveAttendanceRule {
  return {
    checkInStart: rule.startTime,
    lateTime: rule.lateTime,
    checkInEnd: rule.endTime,
    checkOutStart: rule.checkOutStart ?? '17:00',
    checkOutEnd: rule.checkOutEnd ?? '18:00',
    enabled: rule.enabled,
    source: 'platform',
  };
}

export function ruleFromTask(task: {
  checkInStart: string;
  lateTime: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
}): EffectiveAttendanceRule {
  return {
    checkInStart: task.checkInStart,
    lateTime: task.lateTime,
    checkInEnd: task.checkInEnd,
    checkOutStart: task.checkOutStart,
    checkOutEnd: task.checkOutEnd,
    enabled: true,
    source: 'task',
  };
}

export function resolveAction(
  rule: EffectiveAttendanceRule,
  nowMinutes: number,
  state: AttendanceRecordState,
): { action: AttendanceAction; message: string } {
  if (!rule.enabled) {
    return { action: 'REJECT', message: '今日出勤规则未启用' };
  }

  const ciStart = timeToMinutes(rule.checkInStart);
  const ciEnd = timeToMinutes(rule.checkInEnd);
  const coStart = timeToMinutes(rule.checkOutStart);
  const coEnd = timeToMinutes(rule.checkOutEnd);

  if (state.hasCheckOut) {
    return { action: 'REJECT', message: '今日签到签退已完成' };
  }

  if (!state.hasCheckIn) {
    if (nowMinutes >= ciStart && nowMinutes <= ciEnd) {
      return { action: 'CHECK_IN', message: '请面向镜头完成签到' };
    }
    if (nowMinutes < ciStart) {
      return { action: 'REJECT', message: `未到签到时间，请于 ${rule.checkInStart} 后再试` };
    }
    return { action: 'REJECT', message: `已过签到时段（${rule.checkInStart}–${rule.checkInEnd}）` };
  }

  if (nowMinutes >= coStart && nowMinutes <= coEnd) {
    return { action: 'CHECK_OUT', message: '请面向镜头完成签退' };
  }
  if (nowMinutes < coStart) {
    return { action: 'REJECT', message: `当前不在签退时段，请于 ${rule.checkOutStart} 后再试` };
  }
  return { action: 'REJECT', message: `已过签退时段（${rule.checkOutStart}–${rule.checkOutEnd}）` };
}

export function computeWorkMinutes(checkInAt: Date, checkOutAt: Date): number {
  return Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
}

/** 标准全日工时（签到开始至签退截止），用于已通过请假日折算 */
export function computeStandardWorkMinutes(rule: EffectiveAttendanceRule): number {
  const start = timeToMinutes(rule.checkInStart);
  const end = timeToMinutes(rule.checkOutEnd);
  return Math.max(0, end - start);
}

/** 将 YYYY-MM-DD + HH:mm 转为 Date（按上海时区） */
export function dateTimeInShanghai(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+08:00`);
}

