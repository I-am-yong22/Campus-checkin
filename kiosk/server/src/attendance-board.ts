import { todayStr } from './datetime.js';
import {
  loadTeamAttendanceContext,
  isGlobalExemptDate,
  resolveAttendanceStatus,
} from './attendance-context.js';

export interface TodayBoardCheckedItem {
  userId: number;
  name: string;
  teamName: string | null;
  avatarUrl: string | null;
  status: 'NORMAL' | 'LATE' | 'CHECK_OUT';
  time: string;
  workMinutes?: number;
  sortAt: number;
}

export interface TodayBoardAbsentItem {
  userId: number;
  name: string;
  teamName: string | null;
  avatarUrl: string | null;
  faceRegistered: boolean;
}

export interface TodayBoard {
  date: string;
  checked: Omit<TodayBoardCheckedItem, 'sortAt'>[];
  absent: TodayBoardAbsentItem[];
  summary: { checkedCount: number; absentCount: number };
  exemptDay: boolean;
}

function formatTimeShanghai(d: Date): string {
  return d.toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}

export async function resolveTodayBoard(
  prisma: typeof import('./db.js').prisma,
): Promise<TodayBoard> {
  const date = todayStr();

  if (await isGlobalExemptDate(prisma, date)) {
    return {
      date,
      checked: [],
      absent: [],
      summary: { checkedCount: 0, absentCount: 0 },
      exemptDay: true,
    };
  }

  const members = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { in: ['USER', 'LEADER'] },
    },
    select: {
      id: true,
      name: true,
      teamId: true,
      avatarUrl: true,
      faceRegistered: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }],
  });

  const byTeam = new Map<number | null, typeof members>();
  for (const m of members) {
    const list = byTeam.get(m.teamId) ?? [];
    list.push(m);
    byTeam.set(m.teamId, list);
  }

  const checkedRaw: TodayBoardCheckedItem[] = [];
  const absent: TodayBoardAbsentItem[] = [];

  for (const [teamId, teamMembers] of byTeam) {
    const userIds = teamMembers.map((m) => m.id);
    const ctxMap = await loadTeamAttendanceContext(prisma, teamId, date, userIds);

    for (const m of teamMembers) {
      const ctx = ctxMap.get(m.id)!;
      const status = resolveAttendanceStatus(ctx);
      const teamName = m.team?.name ?? null;

      if (status === 'ABSENT') {
        absent.push({
          userId: m.id,
          name: m.name,
          teamName,
          avatarUrl: m.avatarUrl,
          faceRegistered: m.faceRegistered,
        });
        continue;
      }

      if (status === 'EXEMPT' || status === 'ON_LEAVE' || !ctx.checkIn) continue;

      const ci = ctx.checkIn;
      const hasCheckout = !!ci.checkOutAt;
      checkedRaw.push({
        userId: m.id,
        name: m.name,
        teamName,
        avatarUrl: m.avatarUrl,
        status: hasCheckout ? 'CHECK_OUT' : ci.status === 'LATE' ? 'LATE' : 'NORMAL',
        time: formatTimeShanghai(hasCheckout ? ci.checkOutAt! : ci.checkInAt),
        workMinutes: ci.workMinutes ?? undefined,
        sortAt: (hasCheckout ? ci.checkOutAt! : ci.checkInAt).getTime(),
      });
    }
  }

  checkedRaw.sort((a, b) => b.sortAt - a.sortAt);
  const checked = checkedRaw.map(({ sortAt: _, ...rest }) => rest);

  return {
    date,
    checked,
    absent,
    summary: { checkedCount: checked.length, absentCount: absent.length },
    exemptDay: false,
  };
}
