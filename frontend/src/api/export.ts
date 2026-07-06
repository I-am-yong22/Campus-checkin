import api from './client';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header?: string, fallback = 'export.csv') {
  if (!header) return fallback;
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
  return m ? decodeURIComponent(m[1]) : fallback;
}

async function downloadCsv(path: string, params?: Record<string, unknown>) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const name = filenameFromDisposition(res.headers['content-disposition']);
  saveBlob(res.data, name);
}

export const exportApi = {
  teamDaily: (params?: { teamId?: number; date?: string }) =>
    downloadCsv('/export/team-daily', params),

  userMonthly: (params?: { month?: string; userId?: number }) =>
    downloadCsv('/export/user-monthly', params),

  overview: (days = 7) => downloadCsv('/export/overview', { days }),

  workHours: (params?: { teamId?: number; month?: string }) =>
    downloadCsv('/export/work-hours', params),
};
