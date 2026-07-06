import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const date = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const user = await prisma.user.findFirst({
  where: { username: 'user' },
  select: { teamId: true },
});
if (!user?.teamId) {
  console.error('测试用户 user 无团队');
  process.exit(1);
}
const teamId = user.teamId;

await prisma.attendanceTask.updateMany({
  where: { teamId, date },
  data: { status: 'CANCELLED' },
});

const CHECK_IN_START = process.env.CHECK_IN_START || '14:00';
const CHECK_IN_END = process.env.CHECK_IN_END || '14:30';
const LATE_TIME = process.env.LATE_TIME || '14:10';

await prisma.checkInRule.upsert({
  where: { teamId },
  update: {
    startTime: CHECK_IN_START,
    lateTime: LATE_TIME,
    endTime: CHECK_IN_END,
    checkOutStart: '17:00',
    checkOutEnd: '18:00',
    enabled: true,
  },
  create: {
    teamId,
    startTime: CHECK_IN_START,
    lateTime: LATE_TIME,
    endTime: CHECK_IN_END,
    checkOutStart: '17:00',
    checkOutEnd: '18:00',
  },
});

const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
console.log(`已设置 ${team?.name} 签到 ${CHECK_IN_START}–${CHECK_IN_END}，签退 17:00–18:00`);
console.log('今日任务已取消，使用团队默认规则');
const rule = await prisma.checkInRule.findUnique({ where: { teamId } });
console.log(JSON.stringify({ date, rule }, null, 2));

await prisma.$disconnect();
