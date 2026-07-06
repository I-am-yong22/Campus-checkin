// 统一以 Asia/Shanghai (UTC+8) 计算日期与时间，避免机器时区差异（与主后端逻辑一致）
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function nowShanghai(): Date {
  return new Date(Date.now() + TZ_OFFSET_MS);
}

// 返回 YYYY-MM-DD
export function todayStr(): string {
  return nowShanghai().toISOString().slice(0, 10);
}

// 返回 HH:mm
export function nowTimeStr(): string {
  return nowShanghai().toISOString().slice(11, 16);
}

// "HH:mm" -> 分钟数
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// 欧氏距离，越小越相似（与主后端 FaceService.euclideanDistance 一致）
export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}
