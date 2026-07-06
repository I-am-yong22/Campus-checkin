import api from './client';

export interface AuditLogRow {
  id: number;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
  user: { id: number; name: string; username: string } | null;
}

export interface AuditLogList {
  total: number;
  page: number;
  pageSize: number;
  items: AuditLogRow[];
}

export const auditApi = {
  list: (params?: { page?: number; pageSize?: number; action?: string }) =>
    api.get<AuditLogList>('/admin/audit-logs', { params }).then((r) => r.data),
};
