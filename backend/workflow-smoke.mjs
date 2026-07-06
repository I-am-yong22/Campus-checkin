/**
 * 团队创建申请 + 成员邀请冒烟测试（需 backend 已启动）
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

async function main() {
  console.log('=== 团队申请/邀请冒烟测试 ===\n');

  const adminToken = await tokenFor('admin');
  const leader2Token = await tokenFor('leader2');
  const user2Token = await tokenFor('user2');
  const userToken = await tokenFor('user');
  ok('签发 JWT');

  const teamName = `冒烟团队_${Date.now()}`;
  let applicationId;
  let invitationId;
  let teamId;
  let applicationId2;
  let teamId2;

  // 清理 leader2 状态
  const leader2 = await prisma.user.findUnique({ where: { username: 'leader2' } });
  if (!leader2) throw new Error('leader2 不存在');
  if (leader2.teamId) {
    await prisma.user.update({ where: { id: leader2.id }, data: { teamId: null } });
  }
  await prisma.teamCreationRequest.deleteMany({ where: { applicantId: leader2.id } });

  // 1. 负责人提交创建申请
  {
    const { status, data } = await api(leader2Token, '/team-applications', {
      method: 'POST',
      body: JSON.stringify({
        name: teamName,
        description: '冒烟测试团队',
        reason: '用于自动化冒烟测试创建团队流程',
      }),
    });
    if (status === 201 || status === 200) {
      applicationId = data.id;
      ok(`POST /team-applications (${teamName})`);
    } else fail('POST /team-applications', `status=${status} ${JSON.stringify(data)}`);
  }

  // 2. 学员不能申请
  {
    const { status } = await api(user2Token, '/team-applications', {
      method: 'POST',
      body: JSON.stringify({ name: 'x', reason: 'test reason here' }),
    });
    if (status === 403) ok('POST /team-applications 学员 403');
    else fail('POST /team-applications 学员 403', `status=${status}`);
  }

  // 3. 管理员待审列表
  {
    const { status, data } = await api(adminToken, '/team-applications/pending');
    if (status === 200 && Array.isArray(data) && data.some((a) => a.id === applicationId)) {
      ok(`GET /team-applications/pending (${data.length})`);
    } else fail('GET /team-applications/pending', `status=${status}`);
  }

  // 4. 管理员批准
  {
    const { status, data } = await api(adminToken, `/team-applications/${applicationId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED', reviewComment: '冒烟批准' }),
    });
    if (status === 200 && data.teamId) {
      teamId = data.teamId;
      ok(`PATCH review APPROVED (teamId=${teamId})`);
    } else fail('PATCH review APPROVED', `status=${status}`);
  }

  // 刷新 leader2 token（teamId 已变）
  const leader2Updated = await prisma.user.findUnique({ where: { username: 'leader2' } });
  if (!leader2Updated) throw new Error('leader2 不存在');
  const leader2Token2 = jwt.sign(
    {
      sub: leader2Updated.id,
      username: leader2Updated.username,
      role: leader2Updated.role,
      teamId: leader2Updated.teamId,
    },
    JWT_SECRET,
    { expiresIn: '1h' },
  );

  if (!leader2Updated?.teamId) {
    fail('负责人加入团队', '批准后 teamId 未设置');
  } else {
    ok('负责人已绑定团队');
  }

  // 5. 邀请候选
  {
    const { status, data } = await api(leader2Token2, '/team-invitations/candidates');
    if (status === 200 && data.some((u) => u.username === 'user2')) {
      ok(`GET /team-invitations/candidates (${data.length})`);
    } else fail('GET candidates', `status=${status}`);
  }

  const user2 = await prisma.user.findUnique({ where: { username: 'user2' } });
  if (!user2) throw new Error('user2 不存在');

  // 6. 发送邀请
  {
    const { status, data } = await api(leader2Token2, '/team-invitations', {
      method: 'POST',
      body: JSON.stringify({ inviteeId: user2.id, message: '欢迎加入' }),
    });
    if (status === 201 || status === 200) {
      invitationId = data.id;
      ok('POST /team-invitations');
    } else fail('POST /team-invitations', `status=${status}`);
  }

  // 7. user2 查看邀请
  {
    const { status, data } = await api(user2Token, '/team-invitations/mine');
    if (status === 200 && data.some((i) => i.id === invitationId)) {
      ok('GET /team-invitations/mine');
    } else fail('GET /team-invitations/mine', `status=${status}`);
  }

  // 8. user2 接受邀请
  {
    const { status, data } = await api(user2Token, `/team-invitations/${invitationId}/accept`, {
      method: 'PATCH',
    });
    if (status === 200 && data.success) {
      ok('PATCH accept invitation');
    } else fail('PATCH accept', `status=${status}`);
  }

  const user2After = await prisma.user.findUnique({ where: { username: 'user2' } });
  if (user2After?.teamId === teamId) {
    ok('user2 已加入团队');
  } else {
    fail('user2 加入团队', `teamId=${user2After?.teamId}`);
  }

  // 9. peers 可见（需刷新 token，JWT 内 teamId 已变）
  {
    const user2TokenFresh = jwt.sign(
      {
        sub: user2After.id,
        username: user2After.username,
        role: user2After.role,
        teamId: user2After.teamId,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    );
    const { status, data } = await api(user2TokenFresh, '/teams/peers');
    if (status === 200 && data.members?.length >= 2) {
      ok(`GET /teams/peers (${data.members.length} 人)`);
    } else fail('GET /teams/peers', `status=${status} members=${data.members?.length}`);
  }

  // 10. 负责人移出成员
  {
    const { status, data } = await api(leader2Token2, `/teams/members/${user2After.id}/remove`, {
      method: 'POST',
    });
    if ((status === 200 || status === 201) && data.success) ok('POST /teams/members/:id/remove');
    else fail('POST remove member', `status=${status}`);
  }

  const user2Removed = await prisma.user.findUnique({ where: { username: 'user2' } });
  if (!user2Removed?.teamId) ok('user2 已被移出团队');
  else fail('user2 移出校验', `teamId=${user2Removed?.teamId}`);

  // 11. 不能移出自己
  {
    const { status } = await api(leader2Token2, `/teams/members/${leader2Updated.id}/remove`, {
      method: 'POST',
    });
    if (status === 400) ok('移出自己 400');
    else fail('移出自己', `status=${status}`);
  }

  // 12. 学员不能移人
  {
    const user2TokenFresh = await tokenFor('user2');
    const { status } = await api(user2TokenFresh, `/teams/members/${user2.id}/remove`, {
      method: 'POST',
    });
    if (status === 403) ok('学员 remove 403');
    else fail('学员 remove', `status=${status}`);
  }

  // 13. 负责人可创建第二个团队
  const teamName2 = `${teamName}_二团`;
  {
    const { status, data } = await api(leader2Token2, '/team-applications', {
      method: 'POST',
      body: JSON.stringify({
        name: teamName2,
        description: '第二个团队',
        reason: '负责人多团队冒烟测试',
      }),
    });
    if (status === 200 || status === 201) {
      applicationId2 = data.id;
      ok('负责人再次 POST /team-applications');
    } else fail('负责人再次建团申请', `status=${status}`);
  }

  {
    const { status, data } = await api(adminToken, `/team-applications/${applicationId2}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    if (status === 200 && data.teamId) {
      teamId2 = data.teamId;
      ok(`第二个团队批准 (teamId=${teamId2})`);
    } else fail('第二个团队批准', `status=${status}`);
  }

  {
    const { status, data } = await api(leader2Token2, '/teams/managed');
    if (status === 200 && data.length >= 2 && data.some((t) => t.id === teamId) && data.some((t) => t.id === teamId2)) {
      ok(`GET /teams/managed (${data.length} 个)`);
    } else fail('GET /teams/managed', `status=${status} count=${data?.length}`);
  }

  {
    const { status, data } = await api(leader2Token2, `/teams/members?teamId=${teamId2}`);
    if (status === 200 && data.team?.id === teamId2) ok('GET /teams/members?teamId= 切换团队');
    else fail('GET /teams/members 切换', `status=${status}`);
  }

  if (teamId2) {
    await prisma.teamInviteCode.deleteMany({ where: { teamId: teamId2 } }).catch(() => {});
    await prisma.checkInRule.deleteMany({ where: { teamId: teamId2 } }).catch(() => {});
    await prisma.team.delete({ where: { id: teamId2 } }).catch(() => {});
  }
  if (applicationId2) {
    await prisma.teamCreationRequest.delete({ where: { id: applicationId2 } }).catch(() => {});
  }
  // 清理：移除 user2 团队（便于下次测试）
  await prisma.user.update({ where: { username: 'user2' }, data: { teamId: null } });
    await prisma.teamInvitation.deleteMany({ where: { teamId } });
    await prisma.teamInviteCode.deleteMany({ where: { teamId } });
  await prisma.user.update({ where: { username: 'leader2' }, data: { teamId: null } });
  if (teamId) {
    await prisma.checkInRule.deleteMany({ where: { teamId } }).catch(() => {});
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
  }
  if (applicationId) {
    await prisma.teamCreationRequest.delete({ where: { id: applicationId } }).catch(() => {});
  }

  console.log(`\n=== 结果: ${passed} 通过, ${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
