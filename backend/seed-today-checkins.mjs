import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayStr() {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

function shanghaiCheckInAt(hour, minute, second = 0) {
  const [y, mo, d] = todayStr().split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, hour - 8, minute, second));
}

/** 看板演示：今日保留 6 人已签到，其余为未签到（两侧均 >5） */
const CHECKED_DEMO_COUNT = 6;

const SLOTS = [
  { h: 8, m: 5, s: 12, status: 'NORMAL' },
  { h: 8, m: 12, s: 34, status: 'NORMAL' },
  { h: 8, m: 18, s: 9, status: 'NORMAL' },
  { h: 8, m: 25, s: 41, status: 'NORMAL' },
  { h: 8, m: 33, s: 22, status: 'NORMAL' },
  { h: 8, m: 41, s: 55, status: 'NORMAL' },
  { h: 8, m: 52, s: 3, status: 'NORMAL' },
  { h: 9, m: 3, s: 17, status: 'LATE' },
  { h: 9, m: 8, s: 44, status: 'LATE' },
  { h: 9, m: 15, s: 28, status: 'LATE' },
];

async function main() {
  const date = todayStr();

  const members = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      role: { in: ['USER', 'LEADER'] },
    },
    select: { id: true, name: true, username: true, teamId: true },
    orderBy: [{ username: 'asc' }],
  });

  if (members.length < CHECKED_DEMO_COUNT + 1) {
    console.warn(
      `警告：可用账号仅 ${members.length} 人，看板演示数据可能较少。可通过管理端创建更多用户。`,
    );
  }

  const deleted = await prisma.checkIn.deleteMany({ where: { date } });
  console.log(`已清空今日(${date})签到 ${deleted.count} 条`);

  const toCheckIn = members.slice(0, CHECKED_DEMO_COUNT);

  for (let i = 0; i < toCheckIn.length; i++) {
    const user = toCheckIn[i];
    const slot = SLOTS[i];
    await prisma.checkIn.create({
      data: {
        userId: user.id,
        teamId: user.teamId,
        date,
        checkInAt: shanghaiCheckInAt(slot.h, slot.m, slot.s),
        matchScore: 0.92,
        livenessPassed: true,
        status: slot.status,
      },
    });
    console.log(`✓ 已签到 ${user.name} (${user.username}) ${slot.h}:${String(slot.m).padStart(2, '0')} ${slot.status}`);
  }

  const absent = members.slice(CHECKED_DEMO_COUNT);
  console.log(`\n未签到 ${absent.length} 人：${absent.map((m) => m.name).join('、')}`);
  console.log(`\n看板演示就绪：已签到 ${toCheckIn.length} 人，未签到 ${absent.length} 人`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
