/**
 * 团队邀请码冒烟测试（需 backend 已启动）
 * 用法：npm run smoke:invite-code
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
  if (!user) throw new Error(`用户 ${username} 不存在，请先 npm run seed`);
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

async function setupLeaderTeam(adminToken, leaderUsername) {
  const leader = await prisma.user.findUnique({ where: { username: leaderUsername } });
  if (!leader) throw new Error(`${leaderUsername} 不存在`);

  await prisma.user.update({ where: { id: leader.id }, data: { teamId: null } });
  await prisma.teamCreationRequest.deleteMany({ where: { applicantId: leader.id } });

  const teamName = `邀请码冒烟_${Date.now()}`;
  const createRes = await api(await tokenFor(leaderUsername), '/team-applications', {
    method: 'POST',
    body: JSON.stringify({
      name: teamName,
      description: '邀请码测试',
      reason: '自动化测试团队邀请码功能',
    }),
  });
  if (createRes.status !== 200 && createRes.status !== 201) {
    throw new Error(`建团申请失败: ${createRes.status}`);
  }

  const reviewRes = await api(adminToken, `/team-applications/${createRes.data.id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  if (!reviewRes.data?.teamId) throw new Error('建团批准失败');

  const updated = await prisma.user.findUnique({ where: { username: leaderUsername } });
  const leaderToken = jwt.sign(
    {
      sub: updated.id,
      username: updated.username,
      role: updated.role,
      teamId: updated.teamId,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  return { teamId: reviewRes.data.teamId, leaderToken, applicationId: createRes.data.id };
}

async function cleanup(teamId, applicationId, leaderId, userId) {
  if (userId) {
    await prisma.user.update({ where: { id: userId }, data: { teamId: null } }).catch(() => {});
  }
  if (leaderId) {
    await prisma.user.update({ where: { id: leaderId }, data: { teamId: null } }).catch(() => {});
  }
  if (teamId) {
    await prisma.teamInviteCode.deleteMany({ where: { teamId } }).catch(() => {});
    await prisma.teamInvitation.deleteMany({ where: { teamId } }).catch(() => {});
    await prisma.checkInRule.deleteMany({ where: { teamId } }).catch(() => {});
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  }
  if (applicationId) {
    await prisma.teamCreationRequest.delete({ where: { id: applicationId } }).catch(() => {});
  }
}

async function main() {
  console.log('=== 团队邀请码冒烟测试 ===\n');

  const adminToken = await tokenFor('admin');
  ok('签发 JWT');

  let teamId;
  let applicationId;
  let leaderToken;
  let code1;
  let code2;

  const leader = await prisma.user.findUnique({ where: { username: 'leader' } });
  const user = await prisma.user.findUnique({ where: { username: 'user' } });
  if (!leader || !user) throw new Error('leader / user 不存在');

  await prisma.user.update({ where: { id: user.id }, data: { teamId: null } });

  try {
    ({ teamId, leaderToken, applicationId } = await setupLeaderTeam(adminToken, 'leader'));
    ok(`建团完成 (teamId=${teamId})`);

    // 生成邀请码
    {
      const { status, data } = await api(leaderToken, '/team-invite-codes', { method: 'POST' });
      if ((status === 200 || status === 201) && data.code?.length === 6) {
        code1 = data.code;
        ok(`POST /team-invite-codes (${code1})`);
      } else fail('POST /team-invite-codes', `status=${status}`);
    }

    // 重复生成返回同一码
    {
      const { status, data } = await api(leaderToken, '/team-invite-codes', { method: 'POST' });
      if (status === 200 || status === 201) {
        if (data.code === code1) ok('POST /team-invite-codes 复用已有码');
        else fail('POST /team-invite-codes 复用', `code changed ${data.code}`);
      } else fail('POST /team-invite-codes 复用', `status=${status}`);
    }

    // GET mine
    {
      const { status, data } = await api(leaderToken, '/team-invite-codes/mine');
      if (status === 200 && data?.code === code1) ok('GET /team-invite-codes/mine');
      else fail('GET /team-invite-codes/mine', `status=${status}`);
    }

    const userToken = await tokenFor('user');

    // 预览
    {
      const { status, data } = await api(userToken, `/team-invite-codes/preview?code=${code1}`);
      if (status === 200 && data.team?.id === teamId) ok('GET /team-invite-codes/preview');
      else fail('GET /team-invite-codes/preview', `status=${status}`);
    }

    // 重新生成
    {
      const { status, data } = await api(leaderToken, '/team-invite-codes/regenerate', { method: 'POST' });
      if ((status === 200 || status === 201) && data.code?.length === 6 && data.code !== code1) {
        code2 = data.code;
        ok(`POST /team-invite-codes/regenerate (${code2})`);
      } else fail('POST regenerate', `status=${status}`);
    }

    // 旧码失效
    {
      const { status } = await api(userToken, `/team-invite-codes/preview?code=${code1}`);
      if (status === 400) ok('旧邀请码 preview 400');
      else fail('旧邀请码 preview', `status=${status}`);
    }

    // 加入
    {
      const { status, data } = await api(userToken, '/team-invite-codes/join', {
        method: 'POST',
        body: JSON.stringify({ code: code2 }),
      });
      if (status === 200 || status === 201) {
        if (data.success && data.team?.id === teamId) ok('POST /team-invite-codes/join');
        else fail('POST join', JSON.stringify(data));
      } else fail('POST join', `status=${status}`);
    }

    const userAfter = await prisma.user.findUnique({ where: { username: 'user' } });
    if (userAfter?.teamId === teamId) ok('user 已通过邀请码加入团队');
    else fail('user 加入团队校验', `teamId=${userAfter?.teamId}`);

    // 重复加入同一团队
    {
      const { status } = await api(userToken, '/team-invite-codes/join', {
        method: 'POST',
        body: JSON.stringify({ code: code2 }),
      });
      if (status === 400) ok('重复 join 400');
      else fail('重复 join', `status=${status}`);
    }

    // 退出团队
    {
      const { status, data } = await api(userToken, '/teams/leave', { method: 'POST' });
      if ((status === 200 || status === 201) && data.success) ok('POST /teams/leave');
      else fail('POST /teams/leave', `status=${status}`);
    }

    const userLeft = await prisma.user.findUnique({ where: { username: 'user' } });
    if (!userLeft?.teamId) ok('user 已退出团队');
    else fail('user 退出校验', `teamId=${userLeft?.teamId}`);

    // 退出后可再次加入
    const userTokenAfterLeave = await tokenFor('user');
    {
      const { status, data } = await api(userTokenAfterLeave, '/team-invite-codes/join', {
        method: 'POST',
        body: JSON.stringify({ code: code2 }),
      });
      if (status === 200 || status === 201) ok('退出后再次 join');
      else fail('退出后再次 join', `status=${status}`);
    }

    // 负责人不能退出
    {
      const { status } = await api(leaderToken, '/teams/leave', { method: 'POST' });
      if (status === 403) ok('负责人 leave 403');
      else fail('负责人 leave', `status=${status}`);
    }

    // 禁用
    {
      const { status } = await api(leaderToken, '/team-invite-codes/disable', { method: 'POST' });
      if (status === 200 || status === 201) ok('POST /team-invite-codes/disable');
      else fail('POST disable', `status=${status}`);
    }

    // 重置 user 测禁用码
    await prisma.user.update({ where: { id: user.id }, data: { teamId: null } });
    const userTokenFresh = await tokenFor('user');
    {
      const { status } = await api(userTokenFresh, '/team-invite-codes/join', {
        method: 'POST',
        body: JSON.stringify({ code: code2 }),
      });
      if (status === 400) ok('禁用码 join 400');
      else fail('禁用码 join', `status=${status}`);
    }
  } finally {
    await cleanup(teamId, applicationId, leader.id, user.id);
  }

  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
