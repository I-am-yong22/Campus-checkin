/**
 * 功能扩展冒烟测试（需 backend 已启动）
 */
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://127.0.0.1:3000/api';
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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
  if (!user) throw new Error(`用户 ${username} 不存在`);
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role, teamId: user.teamId },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function api(token, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function main() {
  console.log('=== 功能扩展冒烟测试 ===\n');

  const adminToken = await tokenFor('admin');
  const leaderToken = await tokenFor('leader');
  const userToken = await tokenFor('user');
  ok('签发 JWT');

  const team = await prisma.team.findFirst();
  const user = await prisma.user.findUnique({ where: { username: 'user' } });
  if (!team || !user) {
    fail('种子数据', '团队或 user 不存在');
    process.exit(1);
  }

  const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

  // 1. 团队成员出勤状态字段
  {
    const { status, data } = await api(leaderToken, '/teams/members');
    const m = data.members?.[0];
    if (status === 200 && m?.attendanceStatus && data.summary?.onLeave !== undefined) {
      ok(`GET /teams/members 出勤状态 (${m.attendanceStatus})`);
    } else fail('GET /teams/members 出勤状态', `status=${status}`);
  }

  // 2. 统计 overview 扩展字段
  {
    const { status, data } = await api(adminToken, '/stats/overview?days=7');
    if (status === 200 && data.overview?.todayOnLeave !== undefined && data.overview?.todayAbsent !== undefined) {
      ok('GET /stats/overview 扩展字段');
    } else fail('GET /stats/overview 扩展字段', `status=${status}`);
  }

  // 3. 负责人团队统计
  {
    const { status, data } = await api(leaderToken, '/stats/team?days=7');
    if (status === 200 && data.dailyTrend?.length === 7 && data.today) {
      ok('GET /stats/team 负责人');
    } else fail('GET /stats/team', `status=${status}`);
  }

  // 4. 待关注名单
  {
    const { status, data } = await api(adminToken, '/stats/attention');
    if (status === 200 && Array.isArray(data.absentToday) && Array.isArray(data.noFace)) {
      ok(`GET /stats/attention (缺勤 ${data.absentToday.length})`);
    } else fail('GET /stats/attention', `status=${status}`);
  }

  // 5. kiosk 状态
  {
    const { status, data } = await api(adminToken, '/stats/kiosk');
    if (status === 200 && typeof data.online === 'boolean') {
      ok(`GET /stats/kiosk (online=${data.online})`);
    } else fail('GET /stats/kiosk', `status=${status}`);
  }

  // 6. 休息日
  let exemptId;
  {
    const { status, data } = await api(adminToken, '/calendar/exemptions', {
      method: 'POST',
      body: JSON.stringify({ teamId: team.id, date: '2099-01-01', reason: '冒烟测试' }),
    });
    if (status === 201 || status === 200) {
      exemptId = data.id;
      ok('POST /calendar/exemptions');
    } else fail('POST /calendar/exemptions', `status=${status}`);
  }

  // 7. 补签
  {
    await prisma.checkIn.deleteMany({ where: { userId: user.id, date: today } }).catch(() => {});
    const { status, data } = await api(leaderToken, '/checkin/makeup', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, date: today, remark: '冒烟补签' }),
    });
    if (status === 201 || status === 200) {
      if (data.status === 'MAKEUP') ok('POST /checkin/makeup');
      else fail('POST /checkin/makeup', 'status not MAKEUP');
    } else fail('POST /checkin/makeup', `status=${status} ${JSON.stringify(data)}`);
  }

  // 8. 审计日志
  {
    const { status, data } = await api(adminToken, '/admin/audit-logs?page=1');
    if (status === 200 && Array.isArray(data.items)) {
      ok(`GET /admin/audit-logs (${data.total} 条)`);
    } else fail('GET /admin/audit-logs', `status=${status}`);
  }

  // 9. 待审请假数
  {
    const { status, data } = await api(leaderToken, '/leave/pending/count');
    if (status === 200 && typeof data.count === 'number') {
      ok(`GET /leave/pending/count (${data.count})`);
    } else fail('GET /leave/pending/count', `status=${status}`);
  }

  // 10. CSV 导出
  {
    const { status, data } = await api(adminToken, `/export/team-daily?teamId=${team.id}&date=${today}`);
    if (status === 200 && typeof data === 'string' && data.includes('姓名')) {
      ok('GET /export/team-daily CSV');
    } else fail('GET /export/team-daily', `status=${status}`);
  }

  // 清理
  if (exemptId) {
    await api(adminToken, `/calendar/exemptions/${exemptId}`, { method: 'DELETE' });
  }

  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
