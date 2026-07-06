import type { PrismaClient } from '@prisma/client';

function todayStrShanghai(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function nowTimeStrShanghai(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);
}

/** 打卡机待机轮播内容（与主后端 kiosk-display/standby 一致） */
export async function loadStandbyDisplay(prisma: PrismaClient) {
  const date = todayStrShanghai();
  const time = nowTimeStrShanghai();

  const [carousel, countdowns, boards, birthdays] = await Promise.all([
    prisma.kioskCarouselSlide.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.kioskCountdown.findMany({
      where: { enabled: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.kioskMissionBoard.findMany({
      where: { enabled: true },
      include: {
        team: { select: { id: true, name: true } },
        gaps: { orderBy: { sortOrder: 'asc' } },
        progress: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.kioskBirthdayShow.findMany({
      where: { date, enabled: true },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const activeBirthdays = birthdays.filter((b) => time >= b.startTime);

  return {
    date,
    time,
    carousel: carousel.map((s) => ({
      id: s.id,
      title: s.title,
      imageUrl: s.imageUrl,
    })),
    countdowns: countdowns.map((c) => ({
      id: c.id,
      title: c.title,
      targetAt: c.targetAt.toISOString(),
    })),
    missionBoards: boards.map((b) => ({
      id: b.id,
      teamId: b.teamId,
      teamName: b.team?.name ?? null,
      title: b.title,
      deadlineAt: b.deadlineAt?.toISOString() ?? null,
      headline: b.headline,
      gaps: b.gaps.map((g) => ({
        deliverable: g.deliverable,
        assignees: g.assignees,
      })),
      progress: b.progress.map((p) => ({ label: p.label, percent: p.percent })),
    })),
    birthdays: activeBirthdays.map((b) => ({
      id: b.id,
      userName: b.user.name,
      message: b.message,
      startTime: b.startTime,
    })),
  };
}
