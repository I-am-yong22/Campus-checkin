import type { FaceEntry } from './face/faceApi';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.message || `请求失败 (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export interface HealthResp {
  ok: boolean;
  threshold: number;
  time: string;
  date: string;
}

export interface KioskSchedule {
  date: string;
  time: string;
  mode: 'ATTENDANCE' | 'STANDBY';
  attendanceActive: boolean;
  rule: {
    checkInStart: string;
    lateTime: string;
    checkInEnd: string;
    checkOutStart: string;
    checkOutEnd: string;
    source: 'task' | 'platform';
    enabled: boolean;
  } | null;
  exempt: boolean;
  taskNote: string | null;
  standbyPhase: string;
  standbyMessage: string;
  nextEvent: { type: 'CHECK_IN' | 'CHECK_OUT'; time: string; minutesUntil: number } | null;
}

export interface StandbyDisplay {
  date: string;
  time: string;
  carousel: { id: number; title: string; imageUrl: string | null }[];
  countdowns: { id: number; title: string; targetAt: string }[];
  missionBoards: {
    id: number;
    teamId: number | null;
    teamName: string | null;
    title: string;
    deadlineAt: string | null;
    headline: string | null;
    gaps: { deliverable: string; assignees: string }[];
    progress: { label: string; percent: number }[];
  }[];
  birthdays: { id: number; userName: string; message: string | null; startTime: string }[];
}

export interface TodayBoardCheckedItem {
  userId: number;
  name: string;
  teamName: string | null;
  avatarUrl: string | null;
  status: 'NORMAL' | 'LATE' | 'CHECK_OUT';
  time: string;
  workMinutes?: number;
}

export interface TodayBoardAbsentItem {
  userId: number;
  name: string;
  teamName: string | null;
  avatarUrl: string | null;
  faceRegistered: boolean;
}

export interface TodayBoard {
  date: string;
  checked: TodayBoardCheckedItem[];
  absent: TodayBoardAbsentItem[];
  summary: { checkedCount: number; absentCount: number };
  exemptDay: boolean;
}

export interface KioskUser {
  id: number;
  name: string;
  username: string;
  role: string;
  faceRegistered: boolean;
  seat: string | null;
  team: { id: number; name: string } | null;
}

export interface CheckInResp {
  success: boolean;
  action?: 'CHECK_IN' | 'CHECK_OUT';
  name: string;
  avatarUrl?: string | null;
  teamName: string | null;
  status?: 'NORMAL' | 'LATE';
  date: string;
  checkInAt?: string;
  checkOutAt?: string;
  workMinutes?: number;
  matchScore?: number;
  message: string;
}

export const kioskApi = {
  health: () => request<HealthResp>('/health'),
  schedule: () => request<KioskSchedule>('/schedule'),
  standbyDisplay: () => request<StandbyDisplay>('/standby/display'),
  todayBoard: () => request<TodayBoard>('/attendance/today-board'),
  faces: () => request<{ count: number; faces: FaceEntry[] }>('/faces'),
  users: () => request<{ count: number; users: KioskUser[] }>('/users'),
  attendance: (userId: number, descriptor: number[]) =>
    request<CheckInResp>('/attendance', {
      method: 'POST',
      body: JSON.stringify({ userId, descriptor }),
    }),
  checkin: (userId: number, descriptor: number[]) =>
    request<CheckInResp>('/checkin', {
      method: 'POST',
      body: JSON.stringify({ userId, descriptor }),
    }),
  registerFace: (userId: number, descriptor: number[], adminToken: string) =>
    request<{ success: boolean; name: string; seat?: string; message: string }>('/face/register', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
      body: JSON.stringify({ userId, descriptor }),
    }),
  verifyAdmin: (adminToken: string) =>
    request<{ ok: boolean }>('/admin/verify', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    }),
};
