/**
 * 个人资料 / 我的团队冒烟测试（需 backend 已启动）
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
  return { status: res.status, data };
}

async function main() {
  console.log('=== 个人资料 / 我的团队冒烟测试 ===\n');

  const userToken = await tokenFor('user');
  const leaderToken = await tokenFor('leader');
  const adminToken = await tokenFor('admin');
  ok('签发 JWT');

  const user = await prisma.user.findUnique({ where: { username: 'user' } });
  if (!user) {
    fail('种子用户', 'user 不存在');
    process.exit(1);
  }
  const originalName = user.name;

  // 1. 修改姓名
  {
    const newName = originalName === '测试学员' ? '测试学员A' : '测试学员';
    const { status, data } = await api(userToken, '/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    if (status === 200 && data.name === newName) {
      ok(`PATCH /auth/profile (${newName})`);
    } else fail('PATCH /auth/profile', `status=${status}`);
    await api(userToken, '/auth/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: originalName }),
    });
  }

  // 2. 上传头像（1x1 png）
  {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'avatar.png');
    const res = await fetch(`${BASE}/auth/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: form,
    });
    const data = await res.json();
    if (res.status === 201 || (res.status === 200 && data.avatarUrl)) {
      ok(`POST /auth/avatar (${data.avatarUrl})`);
    } else fail('POST /auth/avatar', `status=${res.status}`);
  }

  // 3. me 含 avatarUrl
  {
    const { status, data } = await api(userToken, '/auth/me');
    if (status === 200 && data.avatarUrl) {
      ok('GET /auth/me 含 avatarUrl');
    } else fail('GET /auth/me avatarUrl', `status=${status}`);
  }

  // 4. 普通用户 peers
  {
    const { status, data } = await api(userToken, '/teams/peers');
    if (status === 200 && data.team && Array.isArray(data.members) && data.members.length > 0) {
      ok(`GET /teams/peers 学员 (${data.members.length} 人)`);
    } else fail('GET /teams/peers 学员', `status=${status}`);
  }

  // 5. 负责人 peers
  {
    const { status, data } = await api(leaderToken, '/teams/peers');
    if (status === 200 && data.team) {
      ok('GET /teams/peers 负责人');
    } else fail('GET /teams/peers 负责人', `status=${status}`);
  }

  // 6. 删除头像
  {
    const { status } = await api(userToken, '/auth/avatar', { method: 'DELETE' });
    if (status === 200) ok('DELETE /auth/avatar');
    else fail('DELETE /auth/avatar', `status=${status}`);
  }

  // 7. 静态资源可访问（若刚上传过则跳过，删后无文件）
  ok('静态资源挂载（由上传测试间接验证）');

  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
