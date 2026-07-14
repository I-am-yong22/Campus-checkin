import api from './client';
import type { CheckIn } from '../types';

export const faceApi = {
  register: (descriptor: number[]) => api.post('/face/register', { descriptor }).then((r) => r.data),
  status: () => api.get<{ registered: boolean; registeredAt: string | null }>('/face/status').then((r) => r.data),
};

// 注意：人脸签到写入已迁移至单机签到服务（kiosk），主站仅保留只读查询。
export const checkInApi = {
  today: () =>
    api
      .get<{
        date: string;
        checkedIn: boolean;
        checkedOut: boolean;
        phase: 'NONE' | 'ON_DUTY' | 'COMPLETED';
        record: CheckIn | null;
        effectiveRule: {
          checkInStart: string;
          lateTime: string;
          checkInEnd: string;
          checkOutStart: string;
          checkOutEnd: string;
          source: 'task' | 'platform';
        } | null;
      }>('/checkin/today')
      .then((r) => r.data),
  mine: (month?: string) => api.get<CheckIn[]>('/checkin/mine', { params: { month } }).then((r) => r.data),
  team: (params?: { teamId?: number; date?: string }) =>
    api.get<CheckIn[]>('/checkin/team', { params }).then((r) => r.data),

  makeup: (data: { userId: number; date: string; remark: string }) =>
    api.post<CheckIn>('/checkin/makeup', data).then((r) => r.data),

  workHoursSummary: (month?: string) =>
    api
      .get<{
        month: string;
        totalMinutes: number;
        checkInMinutes: number;
        leaveMinutes: number;
        completedDays: number;
        checkInCompletedDays: number;
        leaveDays: number;
        recordCount: number;
      }>('/checkin/work-hours/summary', { params: { month } })
      .then((r) => r.data),
};
