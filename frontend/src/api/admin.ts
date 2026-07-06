import api from './client';
import type { Role, Team, User } from '../types';

export interface UserListResp {
  total: number;
  page: number;
  pageSize: number;
  items: User[];
}

export const adminApi = {
  listUsers: (params: { role?: Role; teamId?: number; keyword?: string; page?: number; pageSize?: number }) =>
    api.get<UserListResp>('/admin/users', { params }).then((r) => r.data),

  createUser: (data: { username: string; name: string; password?: string; role?: Role; teamId?: number; phone?: string }) =>
    api.post<User & { initialPassword: string }>('/admin/users', data).then((r) => r.data),

  importUsers: (users: any[]) =>
    api.post('/admin/users/import', { users }).then((r) => r.data),

  updateUser: (id: number, data: Partial<{ name: string; role: Role; teamId: number | null; phone: string; status: string }>) =>
    api.patch<User>(`/admin/users/${id}`, data).then((r) => r.data),

  resetPassword: (id: number, password?: string) =>
    api.post<{ success: boolean; initialPassword: string }>(`/admin/users/${id}/reset-password`, { password }).then((r) => r.data),

  deleteUser: (id: number) => api.delete(`/admin/users/${id}`).then((r) => r.data),

  listTeams: () => api.get<(Team & { memberCount: number; checkInRule?: any })[]>('/teams').then((r) => r.data),

  createTeam: (data: { name: string; description?: string; startDate?: string; endDate?: string }) =>
    api.post<Team>('/teams', data).then((r) => r.data),

  updateTeam: (id: number, data: Partial<{ name: string; description: string; startDate: string; endDate: string }>) =>
    api.patch<Team>(`/teams/${id}`, data).then((r) => r.data),

  deleteTeam: (id: number) => api.delete(`/teams/${id}`).then((r) => r.data),
};
