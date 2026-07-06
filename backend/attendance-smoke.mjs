/**
 * 签到签退与工时 API 冒烟测试（需 backend 已启动）
 * 用法：npm run smoke:attendance
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const API = process.env.MAIN_API_URL || 'http://127.0.0.1:3000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
}

async function tokenFor(username) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error(`用户 ${username} 不存在，请先 npm run seed`);
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, teamId: user.teamId },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function api(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** 清理当日冒烟出勤任务，避免上次 cancel 后无法重建 */
async function cleanupSmokeTask(date) {
  await prisma.attendanceTask.deleteMany({
    where: {
      date,
      OR: [{ note: 'smoke-test' }, { status: 'CANCELLED' }],
    },
  });
}

async function main() {
  console.log('=== 签到签退与工时冒烟测试 ===\n');

  let adminToken;
  let userToken;
  try {
    adminToken = await tokenFor('admin');
    userToken = await tokenFor('user');
    ok('获取 admin / user token');
  } catch (e) {
    fail('获取 token', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { username: 'user' }, select: { id: true, teamId: true } });
  if (!user?.teamId) {
    fail('测试用户需有团队');
    await prisma.$disconnect();
    process.exit(1);
  }

  const date = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

  await cleanupSmokeTask(date);

  // 创建并发布全平台出勤任务
  const createRes = await api('/admin/attendance-tasks', adminToken, {
    method: 'POST',
    body: JSON.stringify({
      date,
      checkInStart: '00:00',
      lateTime: '23:59',
      checkInEnd: '23:59',
      checkOutStart: '00:00',
      checkOutEnd: '23:59',
      note: 'smoke-test',
    }),
  });
  if (createRes.status === 201 || createRes.status === 200) {
    ok('POST 创建出勤任务');
  } else if (createRes.status === 409) {
    ok('出勤任务已存在（跳过创建）');
  } else {
    fail('POST 创建出勤任务', `status=${createRes.status}`);
  }

  const tasks = await api(`/admin/attendance-tasks?month=${date.slice(0, 7)}`, adminToken);
  const task = tasks.data?.find?.((t) => t.date === date) || tasks.data?.[0];
  if (task?.id) {
    if (task.status === 'PUBLISHED') {
      ok('POST 发布出勤任务 (已发布)');
    } else {
      const pub = await api(`/admin/attendance-tasks/${task.id}/publish`, adminToken, { method: 'POST' });
      if (pub.status === 201 || pub.status === 200 || pub.data?.status === 'PUBLISHED') ok('POST 发布出勤任务');
      else if (pub.status === 400 && pub.data?.message?.includes('已发布')) ok('POST 发布出勤任务 (已发布)');
      else fail('POST 发布出勤任务', `status=${pub.status}`);
    }
  }

  const ruleRes = await api(`/attendance/effective-rule?date=${date}`, userToken);
  if (ruleRes.status === 200 && ruleRes.data?.rule?.source === 'task') {
    ok('GET effective-rule 优先任务');
  } else {
    fail('GET effective-rule', JSON.stringify(ruleRes.data));
  }

  const todayRes = await api('/checkin/today', userToken);
  if (todayRes.status === 200 && 'phase' in todayRes.data) {
    ok('GET checkin/today 含 phase');
  } else {
    fail('GET checkin/today', `status=${todayRes.status}`);
  }

  // 模拟昨日未签退 + 自动补签退逻辑（直接写库后调用 cron 等价更新）
  const yesterday = new Date(Date.UTC(...date.split('-').map(Number)));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  await prisma.checkIn.deleteMany({ where: { userId: user.id, date: yStr } });
  const checkInAt = new Date(`${yStr}T09:00:00+08:00`);
  await prisma.checkIn.create({
    data: {
      userId: user.id,
      teamId: user.teamId,
      date: yStr,
      checkInAt,
      matchScore: 0.1,
      status: 'NORMAL',
    },
  });
  const checkOutEnd = ruleRes.data?.rule?.checkOutEnd || '18:00';
  const checkOutAt = new Date(`${yStr}T${checkOutEnd}:00+08:00`);
  const workMinutes = Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
  await prisma.checkIn.updateMany({
    where: { userId: user.id, date: yStr, checkOutAt: null },
    data: { checkOutAt, checkOutType: 'AUTO', workMinutes },
  });
  const patched = await prisma.checkIn.findFirst({ where: { userId: user.id, date: yStr } });
  if (patched?.checkOutType === 'AUTO' && patched.workMinutes > 0) {
    ok('自动补签退数据模型');
  } else {
    fail('自动补签退数据模型');
  }

  const exportRes = await fetch(`${API}/export/work-hours?teamId=${user.teamId}&month=${date.slice(0, 7)}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (exportRes.status === 200 && exportRes.headers.get('content-type')?.includes('csv')) {
    ok('GET export/work-hours (管理员)');
  } else {
    fail('GET export/work-hours', `status=${exportRes.status}`);
  }

  const leaderboard = await api('/stats/work-hours/leaderboard?month=' + date.slice(0, 7), adminToken);
  if (leaderboard.status === 200 && Array.isArray(leaderboard.data?.leaderboard)) {
    ok('GET stats/work-hours/leaderboard (管理员)');
  } else {
    fail('GET stats/work-hours/leaderboard', `status=${leaderboard.status}`);
  }

  const userSummary = await api('/checkin/work-hours/summary?month=' + date.slice(0, 7), userToken);
  if (userSummary.status === 200 && typeof userSummary.data?.totalMinutes === 'number') {
    ok('GET checkin/work-hours/summary (个人)');
  } else {
    fail('GET checkin/work-hours/summary', `status=${userSummary.status}`);
  }

  const leaderToken = await tokenFor('leader');
  const forbiddenExport = await fetch(`${API}/export/work-hours?teamId=${user.teamId}&month=${date.slice(0, 7)}`, {
    headers: { Authorization: `Bearer ${leaderToken}` },
  });
  if (forbiddenExport.status === 403) ok('负责人无法导出全员工时');
  else fail('负责人无法导出全员工时', `status=${forbiddenExport.status}`);

  // 清理测试任务（取消）
  if (task?.id) {
    await api(`/admin/attendance-tasks/${task.id}/cancel`, adminToken, { method: 'POST' });
  }
  await prisma.checkIn.deleteMany({ where: { userId: user.id, date: yStr } });

  console.log(`\n=== 结果：${passed} 通过，${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
