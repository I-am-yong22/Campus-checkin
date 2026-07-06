import api from './client';

export interface CalendarExemption {
  id: number;
  teamId: number | null;
  date: string;
  reason: string | null;
  team?: { id: number; name: string } | null;
}

export const calendarApi = {
  list: (params?: { teamId?: number; from?: string; to?: string }) =>
    api.get<CalendarExemption[]>('/calendar/exemptions', { params }).then((r) => r.data),

  create: (data: { date: string; teamId?: number; reason?: string }) =>
    api.post<CalendarExemption>('/calendar/exemptions', data).then((r) => r.data),

  remove: (id: number) => api.delete(`/calendar/exemptions/${id}`).then((r) => r.data),
};
