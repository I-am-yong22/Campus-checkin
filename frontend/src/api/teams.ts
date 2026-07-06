import api from './client';
import type { CheckIn, Team } from '../types';

export type AttendanceStatus =
  | 'ON_DUTY'
  | 'COMPLETED'
  | 'MAKEUP'
  | 'ON_LEAVE'
  | 'ABSENT'
  | 'EXEMPT';

export interface TeamMemberRow {
  id: number;
  name: string;
  username: string;
  role: string;
  faceRegistered: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  checkedIn: boolean;
  attendanceStatus: AttendanceStatus;
  checkIn: CheckIn | null;
  onLeave: boolean;
  leaveReason?: string | null;
  exempt: boolean;
  exemptReason?: string | null;
}

export interface TeamMembersOverview {
  date: string;
  team: (Team & { checkInRule?: { startTime: string; lateTime: string; endTime: string; enabled: boolean } }) | null;
  summary: {
    total: number;
    checkedIn: number;
    onDuty?: number;
    completed?: number;
    late: number;
    makeup: number;
    onLeave: number;
    absent: number;
    exempt: number;
  };
  members: TeamMemberRow[];
}

export interface ManagedTeam {
  id: number;
  name: string;
  description?: string | null;
  memberCount: number;
}

export interface MyTeamItem extends ManagedTeam {
  isOwner: boolean;
  isMember: boolean;
}

export const teamsApi = {
  myTeams: () => api.get<MyTeamItem[]>('/teams/mine').then((r) => r.data),

  managedTeams: () => api.get<ManagedTeam[]>('/teams/managed').then((r) => r.data),

  setActiveTeam: (teamId: number) =>
    api.post<{ success: boolean; teamId: number }>(`/teams/active?teamId=${teamId}`).then((r) => r.data),

  members: (params?: { teamId?: number; date?: string }) =>
    api.get<TeamMembersOverview>('/teams/members', { params }).then((r) => r.data),

  peers: (params?: { teamId?: number }) =>
    api
      .get<{
        team: { id: number; name: string; description?: string | null } | null;
        members: {
          id: number;
          name: string;
          username: string;
          role: string;
          faceRegistered: boolean;
          avatarUrl?: string | null;
        }[];
      }>('/teams/peers', { params })
      .then((r) => r.data),

  leaveTeam: (teamId?: number) =>
    api
      .post<{ success: boolean }>('/teams/leave', undefined, { params: teamId ? { teamId } : {} })
      .then((r) => r.data),

  removeMember: (userId: number, teamId?: number) =>
    api
      .post<{ success: boolean }>(`/teams/members/${userId}/remove`, undefined, {
        params: teamId ? { teamId } : {},
      })
      .then((r) => r.data),
};
