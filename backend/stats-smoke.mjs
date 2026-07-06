/**
 * 统计与团队成员冒烟测试（需 backend 已启动）
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
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('=== 统计 / 团队成员冒烟测试 ===\n');

  const adminToken = await tokenFor('admin');
  const leaderToken = await tokenFor('leader');
  const userToken = await tokenFor('user');
  ok('签发 JWT');

  // 1. 管理员统计
  {
    const { status, data } = await api(adminToken, '/stats/overview?days=7');
    if (status === 200 && data.overview && Array.isArray(data.teamRates) && data.dailyTrend?.length === 7) {
      ok(`GET /stats/overview (今日签到 ${data.overview.todayCheckIns})`);
    } else fail('GET /stats/overview', `status=${status}`);
  }

  // 2. 非管理员 403
  {
    const { status } = await api(leaderToken, '/stats/overview');
    if (status === 403) ok('GET /stats/overview 负责人 403');
    else fail('GET /stats/overview 负责人 403', `status=${status}`);
  }

  const team = await prisma.team.findFirst();
  if (!team) {
    fail('种子团队', '不存在');
    process.exit(1);
  }

  // 3. 负责人查看本团队成员
  {
    const { status, data } = await api(leaderToken, '/teams/members');
    if (status === 200 && data.team?.id === team.id && Array.isArray(data.members)) {
      ok(`GET /teams/members 负责人 (${data.members.length} 人)`);
    } else fail('GET /teams/members 负责人', `status=${status}`);
  }

  // 4. 管理员需传 teamId
  {
    const { status, data } = await api(adminToken, `/teams/members?teamId=${team.id}`);
    if (status === 200 && data.summary && data.members.length >= 1) {
      ok('GET /teams/members 管理员指定团队');
    } else fail('GET /teams/members 管理员', `status=${status}`);
  }

  // 5. 管理员未传 teamId 400
  {
    const { status } = await api(adminToken, '/teams/members');
    if (status === 400) ok('GET /teams/members 管理员未选团队 400');
    else fail('GET /teams/members 未选团队', `status=${status}`);
  }

  // 6. 普通用户 403
  {
    const { status } = await api(userToken, '/teams/members');
    if (status === 403) ok('GET /teams/members 普通用户 403');
    else fail('GET /teams/members 普通用户 403', `status=${status}`);
  }

  console.log(`\n=== 结果：${passed} 通过，${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
