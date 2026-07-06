// 统一以 Asia/Shanghai (UTC+8) 计算日期与时间，避免服务器时区差异
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function nowShanghai(): Date {
  return new Date(Date.now() + TZ_OFFSET_MS);
}

// 返回 YYYY-MM-DD
export function todayStr(): string {
  const d = nowShanghai();
  return d.toISOString().slice(0, 10);
}

// 返回 HH:mm
export function nowTimeStr(): string {
  const d = nowShanghai();
  return d.toISOString().slice(11, 16);
}

// "HH:mm" -> 分钟数
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
