import api from './client';

export interface TeamCreationRequest {
  id: number;
  name: string;
  description?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewComment?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  applicant?: { id: number; name: string; username: string };
  reviewer?: { id: number; name: string } | null;
  team?: { id: number; name: string } | null;
}

export interface TeamInvitation {
  id: number;
  teamId: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  invitee?: { id: number; name: string; username: string; avatarUrl?: string | null };
  inviter?: { id: number; name: string; username: string };
  team?: { id: number; name: string; description?: string | null };
}

export interface InviteCandidate {
  id: number;
  name: string;
  username: string;
  avatarUrl?: string | null;
  pendingInvite: boolean;
}

export interface TeamInviteCode {
  id: number;
  teamId: number;
  code: string;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  disabledAt?: string | null;
  team?: { id: number; name: string };
  creator?: { id: number; name: string; username: string };
}

export interface TeamInviteCodePreview {
  code: string;
  team: { id: number; name: string; description?: string | null };
  leader?: { id: number; name: string; username: string } | null;
}

export const teamWorkflowApi = {
  teamParams: (teamId?: number) => (teamId ? { teamId } : {}),

  // 团队创建申请
  createApplication: (data: { name: string; description?: string; reason: string }) =>
    api.post<TeamCreationRequest>('/team-applications', data).then((r) => r.data),

  myApplications: () =>
    api.get<TeamCreationRequest[]>('/team-applications/mine').then((r) => r.data),

  pendingApplications: () =>
    api.get<TeamCreationRequest[]>('/team-applications/pending').then((r) => r.data),

  pendingApplicationCount: () =>
    api.get<{ count: number }>('/team-applications/pending/count').then((r) => r.data),

  reviewApplication: (id: number, data: { status: 'APPROVED' | 'REJECTED'; reviewComment?: string }) =>
    api.patch<TeamCreationRequest>(`/team-applications/${id}/review`, data).then((r) => r.data),

  // 成员邀请
  inviteCandidates: (keyword?: string, teamId?: number) =>
    api
      .get<InviteCandidate[]>('/team-invitations/candidates', {
        params: { ...(keyword ? { keyword } : {}), ...teamWorkflowApi.teamParams(teamId) },
      })
      .then((r) => r.data),

  sendInvitation: (data: { inviteeId: number; message?: string }, teamId?: number) =>
    api
      .post<TeamInvitation>('/team-invitations', data, { params: teamWorkflowApi.teamParams(teamId) })
      .then((r) => r.data),

  sentInvitations: (teamId?: number) =>
    api
      .get<TeamInvitation[]>('/team-invitations/sent', { params: teamWorkflowApi.teamParams(teamId) })
      .then((r) => r.data),

  myInvitations: () =>
    api.get<TeamInvitation[]>('/team-invitations/mine').then((r) => r.data),

  pendingInvitationCount: () =>
    api.get<{ count: number }>('/team-invitations/pending/count').then((r) => r.data),

  acceptInvitation: (id: number) =>
    api.patch(`/team-invitations/${id}/accept`).then((r) => r.data),

  rejectInvitation: (id: number) =>
    api.patch(`/team-invitations/${id}/reject`).then((r) => r.data),

  cancelInvitation: (id: number) =>
    api.delete(`/team-invitations/${id}`).then((r) => r.data),

  // 团队邀请码
  myInviteCode: (teamId?: number) =>
    api
      .get<TeamInviteCode | null>('/team-invite-codes/mine', { params: teamWorkflowApi.teamParams(teamId) })
      .then((r) => r.data),

  createInviteCode: (teamId?: number) =>
    api
      .post<TeamInviteCode>('/team-invite-codes', undefined, { params: teamWorkflowApi.teamParams(teamId) })
      .then((r) => r.data),

  regenerateInviteCode: (teamId?: number) =>
    api
      .post<TeamInviteCode>('/team-invite-codes/regenerate', undefined, {
        params: teamWorkflowApi.teamParams(teamId),
      })
      .then((r) => r.data),

  disableInviteCode: (teamId?: number) =>
    api
      .post<{ success: boolean }>('/team-invite-codes/disable', undefined, {
        params: teamWorkflowApi.teamParams(teamId),
      })
      .then((r) => r.data),

  previewInviteCode: (code: string) =>
    api
      .get<TeamInviteCodePreview>('/team-invite-codes/preview', { params: { code: code.trim().toUpperCase() } })
      .then((r) => r.data),

  joinByInviteCode: (code: string) =>
    api
      .post<{ success: boolean; team: { id: number; name: string; description?: string | null } }>(
        '/team-invite-codes/join',
        { code: code.trim().toUpperCase() },
      )
      .then((r) => r.data),
};
