import type { PrismaClient } from '@prisma/client';

const ROWS = ['A', 'B', 'C', 'D', 'E'] as const;

export const ALL_SEATS: string[] = ROWS.flatMap((row) =>
  [1, 2, 3, 4, 5, 6].map((n) => `${row}${n}`),
);

export class SeatsFullError extends Error {
  constructor() {
    super('座位已满（30/30），请联系管理员');
    this.name = 'SeatsFullError';
  }
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** 首次录入时随机分配空闲座位；已有座位则原样返回 */
export async function assignSeatIfNeeded(
  prisma: PrismaClient,
  userId: number,
): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { seat: true },
  });
  if (!existing) throw new Error('用户不存在');
  if (existing.seat) return existing.seat;

  for (let attempt = 0; attempt < 3; attempt++) {
    const takenRows = await prisma.user.findMany({
      where: { seat: { not: null } },
      select: { seat: true },
    });
    const taken = new Set(takenRows.map((r) => r.seat!));
    const available = ALL_SEATS.filter((s) => !taken.has(s));
    if (available.length === 0) throw new SeatsFullError();

    const seat = pickRandom(available);
    try {
      const updated = await prisma.user.updateMany({
        where: { id: userId, seat: null },
        data: { seat },
      });
      if (updated.count === 1) return seat;

      const raced = await prisma.user.findUnique({
        where: { id: userId },
        select: { seat: true },
      });
      if (raced?.seat) return raced.seat;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002' && attempt < 2) continue;
      throw e;
    }
  }

  throw new SeatsFullError();
}
