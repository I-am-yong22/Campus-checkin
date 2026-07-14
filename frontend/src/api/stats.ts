import api from './client';

export interface StatsOverview {
  date: string;
  overview: {
    totalUsers: number;
    faceRegistered: number;
    todayCheckIns: number;
    todayLate: number;
    todayMakeup: number;
    todayOnLeave: number;
    todayAbsent: number;
    todayExempt: boolean;
    pendingLeaves: number;
    teamCount: number;
  };
  teamRates: {
    teamId: number;
    teamName: string;
    memberCount: number;
    checkedIn: number;
    rate: number;
  }[];
  dailyTrend: { date: string; total: number; late: number }[];
}

export interface TeamStats {
  team: { id: number; name: string };
  memberCount: number;
  today: {
    checkedIn: number;
    late: number;
    makeup: number;
    onLeave: number;
    absent: number;
    exempt: number;
  };
  dailyTrend: {
    date: string;
    memberCount: number;
    checkedIn: number;
    late: number;
    onLeave: number;
    absent: number;
    exempt: number;
    checkInRate: number;
    lateRate: number;
    leaveRate: number;
  }[];
}

export interface AttentionList {
  date: string;
  absentToday: { id: number; name: string; username: string; teamId: number | null; teamName: string | null }[];
  noFace: { id: number; name: string; username: string; teamId: number | null; teamName: string | null }[];
}

export interface KioskStatus {
  online: boolean;
  lastSeenAt: string | null;
  lastCheckInAt: string | null;
  version: string | null;
}

export interface WorkHoursLeaderboard {
  month: string;
  teamId: number | null;
  leaderboard: {
    rank: number;
    userId: number;
    name: string;
    username: string;
    teamId: number | null;
    teamName: string | null;
    checkInMinutes: number;
    leaveMinutes: number;
    totalMinutes: number;
    completedDays: number;
    checkInCompletedDays: number;
    leaveDays: number;
  }[];
}

export const statsApi = {
  overview: (days = 7) =>
    api.get<StatsOverview>('/stats/overview', { params: { days } }).then((r) => r.data),

  team: (params?: { teamId?: number; days?: number }) =>
    api.get<TeamStats>('/stats/team', { params }).then((r) => r.data),

  attention: (teamId?: number) =>
    api.get<AttentionList>('/stats/attention', { params: teamId ? { teamId } : {} }).then((r) => r.data),

  kiosk: () => api.get<KioskStatus>('/stats/kiosk').then((r) => r.data),

  workHoursLeaderboard: (params?: { month?: string; teamId?: number }) =>
    api.get<WorkHoursLeaderboard>('/stats/work-hours/leaderboard', { params }).then((r) => r.data),
};
