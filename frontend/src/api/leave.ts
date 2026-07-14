import api from './client';
import type { LeaveRequest } from '../types';

export const leaveApi = {
  create: (data: {
    startDate: string;
    endDate: string;
    type?: string;
    reason: string;
    reviewTarget?: 'LEADER' | 'ADMIN';
    leaveMode?: 'FULL_DAY' | 'HOURLY';
    startTime?: string;
    durationHours?: number;
    durationMinutes?: number;
  }) =>
    api.post<LeaveRequest>('/leave', data).then((r) => r.data),

  mine: () => api.get<LeaveRequest[]>('/leave/mine').then((r) => r.data),

  pending: () => api.get<LeaveRequest[]>('/leave/pending').then((r) => r.data),

  pendingCount: () => api.get<{ count: number }>('/leave/pending/count').then((r) => r.data),

  reviewed: () => api.get<LeaveRequest[]>('/leave/reviewed').then((r) => r.data),

  review: (id: number, data: { status: 'APPROVED' | 'REJECTED'; reviewComment?: string }) =>
    api.patch<LeaveRequest>(`/leave/${id}/review`, data).then((r) => r.data),

  writeOff: (id: number) =>
    api.post<LeaveRequest>(`/leave/${id}/write-off`).then((r) => r.data),

  cancel: (id: number) => api.delete(`/leave/${id}`).then((r) => r.data),
};

export function formatLeavePeriod(r: LeaveRequest): string {
  const date =
    r.startDate === r.endDate ? r.startDate : `${r.startDate} ~ ${r.endDate}`;
  if (r.timeMeta?.mode === 'HOURLY' && r.timeMeta.startTime && r.timeMeta.durationMinutes) {
    const h = Math.floor(r.timeMeta.durationMinutes / 60);
    const m = r.timeMeta.durationMinutes % 60;
    const dur = m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
    const end = r.timeMeta.leaveEndAt
      ? new Date(r.timeMeta.leaveEndAt).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Asia/Shanghai',
        })
      : '';
    return `${date} ${r.timeMeta.startTime}–${end}（${dur}）`;
  }
  return date;
}

export const WRITE_OFF_SCENARIO_LABEL: Record<string, string> = {
  SAME_DAY: '当日返回',
  NEXT_DAY: '次日返回',
  OTHER: '其他',
};
