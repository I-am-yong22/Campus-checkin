import api from './client';

export interface CarouselSlide {
  id: number;
  sortOrder: number;
  title: string;
  imageUrl: string | null;
  enabled: boolean;
}

export interface KioskCountdown {
  id: number;
  title: string;
  targetAt: string;
  enabled: boolean;
  sortOrder: number;
}

export interface MissionGap {
  deliverable: string;
  assignees: string;
  sortOrder?: number;
}

export interface MissionProgress {
  label: string;
  percent: number;
  sortOrder?: number;
}

export interface MissionBoard {
  id: number;
  teamId: number | null;
  team?: { id: number; name: string } | null;
  title: string;
  deadlineAt: string | null;
  headline: string | null;
  enabled: boolean;
  sortOrder: number;
  gaps: MissionGap[];
  progress: MissionProgress[];
}

export interface BirthdayShow {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  message: string | null;
  enabled: boolean;
  user?: { id: number; name: string; username: string };
}

export const kioskDisplayApi = {
  listCarousel: () => api.get<CarouselSlide[]>('/kiosk-display/carousel').then((r) => r.data),
  saveCarousel: (data: Partial<CarouselSlide>) =>
    api.post<CarouselSlide>('/kiosk-display/carousel', data).then((r) => r.data),
  deleteCarousel: (id: number) => api.delete(`/kiosk-display/carousel/${id}`).then((r) => r.data),

  listCountdowns: () => api.get<KioskCountdown[]>('/kiosk-display/countdowns').then((r) => r.data),
  saveCountdown: (data: Partial<KioskCountdown> & { title: string; targetAt: string }) =>
    api.post<KioskCountdown>('/kiosk-display/countdowns', data).then((r) => r.data),
  deleteCountdown: (id: number) => api.delete(`/kiosk-display/countdowns/${id}`).then((r) => r.data),

  listMissionBoards: () => api.get<MissionBoard[]>('/kiosk-display/mission-boards').then((r) => r.data),
  saveMissionBoard: (data: Partial<MissionBoard> & { title: string }) =>
    api.post<MissionBoard>('/kiosk-display/mission-boards', data).then((r) => r.data),
  deleteMissionBoard: (id: number) => api.delete(`/kiosk-display/mission-boards/${id}`).then((r) => r.data),

  listBirthdays: (month?: string) =>
    api.get<BirthdayShow[]>('/kiosk-display/birthdays', { params: { month } }).then((r) => r.data),
  saveBirthday: (data: Partial<BirthdayShow> & { userId: number; date: string; startTime: string }) =>
    api.post<BirthdayShow>('/kiosk-display/birthdays', data).then((r) => r.data),
  deleteBirthday: (id: number) => api.delete(`/kiosk-display/birthdays/${id}`).then((r) => r.data),
};
