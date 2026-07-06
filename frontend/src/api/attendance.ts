import api from './client';

export interface EffectiveRule {
  checkInStart: string;
  lateTime: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  source: 'task' | 'platform';
}

export interface PlatformAttendanceRule {
  id: number;
  startTime: string;
  lateTime: string;
  endTime: string;
  checkOutStart: string;
  checkOutEnd: string;
  enabled: boolean;
  updatedAt: string;
}

export interface AttendanceTask {
  id: number;
  date: string;
  checkInStart: string;
  lateTime: string;
  checkInEnd: string;
  checkOutStart: string;
  checkOutEnd: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
  note?: string | null;
  publishedAt?: string | null;
  publishedBy?: { id: number; name: string } | null;
}

export const attendanceApi = {
  effectiveRule: (date?: string) =>
    api.get<{ date: string; rule: EffectiveRule | null }>('/attendance/effective-rule', { params: { date } }).then((r) => r.data),

  getPlatformRule: () =>
    api.get<PlatformAttendanceRule>('/admin/platform-attendance-rule').then((r) => r.data),

  updatePlatformRule: (data: Partial<Omit<PlatformAttendanceRule, 'id' | 'updatedAt'>>) =>
    api.put<PlatformAttendanceRule>('/admin/platform-attendance-rule', data).then((r) => r.data),

  listTasks: (params?: { month?: string }) =>
    api.get<AttendanceTask[]>('/admin/attendance-tasks', { params }).then((r) => r.data),

  createTask: (data: {
    date: string;
    checkInStart?: string;
    lateTime?: string;
    checkInEnd?: string;
    checkOutStart?: string;
    checkOutEnd?: string;
    note?: string;
  }) => api.post<AttendanceTask>('/admin/attendance-tasks', data).then((r) => r.data),

  updateTask: (id: number, data: Partial<Omit<AttendanceTask, 'id' | 'date' | 'status'>>) =>
    api.patch<AttendanceTask>(`/admin/attendance-tasks/${id}`, data).then((r) => r.data),

  publishTask: (id: number) => api.post<AttendanceTask>(`/admin/attendance-tasks/${id}/publish`).then((r) => r.data),

  cancelTask: (id: number) => api.post<AttendanceTask>(`/admin/attendance-tasks/${id}/cancel`).then((r) => r.data),
};
