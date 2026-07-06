import api from './client';
import type { LeaveRequest } from '../types';

export const leaveApi = {
  create: (data: {
    startDate: string;
    endDate: string;
    type?: string;
    reason: string;
    reviewTarget?: 'LEADER' | 'ADMIN';
  }) =>
    api.post<LeaveRequest>('/leave', data).then((r) => r.data),

  mine: () => api.get<LeaveRequest[]>('/leave/mine').then((r) => r.data),

  pending: () => api.get<LeaveRequest[]>('/leave/pending').then((r) => r.data),

  pendingCount: () => api.get<{ count: number }>('/leave/pending/count').then((r) => r.data),

  reviewed: () => api.get<LeaveRequest[]>('/leave/reviewed').then((r) => r.data),

  review: (id: number, data: { status: 'APPROVED' | 'REJECTED'; reviewComment?: string }) =>
    api.patch<LeaveRequest>(`/leave/${id}/review`, data).then((r) => r.data),

  cancel: (id: number) => api.delete(`/leave/${id}`).then((r) => r.data),
};
