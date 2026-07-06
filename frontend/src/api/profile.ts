import api from './client';
import type { User } from '../types';

export const profileApi = {
  updateProfile: (name: string) =>
    api.patch<User>('/auth/profile', { name }).then((r) => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<User>('/auth/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  removeAvatar: () => api.delete<User>('/auth/avatar').then((r) => r.data),
};
