/**
 * Kiosk 侧栏测试：恢复平台默认出勤规则 + 补齐演示成员 + 今日全员未签到（≥20 人）
 * 用法：node seed-kiosk-absent-20.mjs
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
const TARGET_ABSENT = 20;

function todayStr() {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}

const DEMO_USERS = Array.from({ length: 14 }, (_, i) => {
  const n = i + 1;
  const pad = String(n).padStart(2, '0');
  return {
    username: `demo${pad}`,
    name: `演示学员${pad}`,
    teamIndex: i % 4,
  };
});

const TEAM_NAMES = ['暑期实践一团', '暑期实践二团', '创新创业团', '志愿服务队'];

async function restorePlatformRule() {
  await prisma.platformCheckInRule.upsert({
    where: { id: 1 },
    update: {
      startTime: '08:00',
      lateTime: '09:00',
      endTime: '10:00',
      checkOutStart: '17:00',
      checkOutEnd: '22:00',
      enabled: true,
    },
    create: {
      id: 1,
      startTime: '08:00',
      lateTime: '09:00',
      endTime: '10:00',
      checkOutStart: '17:00',
      checkOutEnd: '22:00',
      enabled: true,
    },
  });
  console.log('已恢复平台规则：签到 08:00–10:00，签退 17:00–22:00');
}

async function ensureDemoMembers(teamByName) {
  const passwordHash = await bcrypt.hash('123456', 10);
  let created = 0;

  for (const def of DEMO_USERS) {
    const teamName = TEAM_NAMES[def.teamIndex];
    const teamId = teamByName.get(teamName);
    if (!teamId) continue;

    const existing = await prisma.user.findUnique({ where: { username: def.username } });
    if (existing) continue;

    const user = await prisma.user.create({
      data: {
        username: def.username,
        name: def.name,
        role: Role.USER,
        passwordHash,
        teamId,
        mustChangePassword: true,
        faceRegistered: false,
      },
    });
    await prisma.teamMembership.upsert({
      where: { userId_teamId: { userId: user.id, teamId } },
      create: { userId: user.id, teamId },
      update: {},
    });
    created++;
  }

  if (created > 0) console.log(`新增演示成员 ${created} 人（demo01–demo14）`);
  else console.log('演示成员已存在，跳过创建');
}

async function main() {
  const date = todayStr();

  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const teamByName = new Map(teams.map((t) => [t.name, t.id]));

  await restorePlatformRule();

  const task = await prisma.attendanceTask.findUnique({ where: { date } });
  if (task?.status === 'PUBLISHED') {
    await prisma.attendanceTask.update({
      where: { id: task.id },
      data: { status: 'CANCELLED' },
    });
    console.log('已取消今日出勤任务覆盖');
  }

  await ensureDemoMembers(teamByName);

  const deleted = await prisma.checkIn.deleteMany({ where: { date } });
  console.log(`已清空今日签到 ${deleted.count} 条`);

  const members = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { in: ['USER', 'LEADER'] }, teamId: { not: null } },
    select: { name: true },
    orderBy: [{ team: { name: 'asc' } }, { name: 'asc' }],
  });

  console.log(`\n在队成员 ${members.length} 人，今日未签到 ${members.length} 人`);
  if (members.length < TARGET_ABSENT) {
    console.warn(`警告：未签到人数不足 ${TARGET_ABSENT}，当前 ${members.length}`);
  } else {
    console.log(`侧栏测试就绪：未签到 ≥ ${TARGET_ABSENT} 人`);
  }
  console.log('\n刷新 http://127.0.0.1:5174 查看侧栏（当前应在签退时段 17:00–22:00）');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
