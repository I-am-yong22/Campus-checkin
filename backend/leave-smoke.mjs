/**
 * 请假模块冒烟测试（需 backend 已启动）
 * 用法：node leave-smoke.mjs
 * 通过 Prisma 查用户 + JWT 签发令牌，不依赖账号密码是否被改过。
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

/** 清理冒烟测试占用的日期，避免重复运行因已通过/待审记录导致失败 */
async function cleanupTestLeaves() {
  const users = await prisma.user.findMany({
    where: { username: { in: ['user', 'leader'] } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length === 0) return;

  const testDates = [
    '2026-08-01', '2026-08-02', '2026-08-10',
    '2026-09-01', '2026-09-10',
    '2026-12-01', '2026-12-02',
  ];
  const deleted = await prisma.leaveRequest.deleteMany({
    where: {
      userId: { in: userIds },
      OR: [
        { startDate: { in: testDates } },
        { endDate: { in: testDates } },
      ],
    },
  });
  if (deleted.count > 0) {
    console.log(`  · 已清理 ${deleted.count} 条历史冒烟请假记录\n`);
  }
}

async function main() {
  console.log('=== 请假模块冒烟测试 ===\n');

  await cleanupTestLeaves();

  let userToken, leaderToken, adminToken;
  try {
    userToken = await tokenFor('user');
    leaderToken = await tokenFor('leader');
    adminToken = await tokenFor('admin');
    ok('签发 user / leader / admin JWT');
  } catch (e) {
    fail('签发 JWT', e.message);
    console.error('\n请确认 backend 已启动且已 seed\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  // 清理 user 待审/测试记录（通过 mine 找最近的测试日期）
  const mine0 = await api(userToken, '/leave/mine');
  if (mine0.status !== 200) fail('GET /leave/mine', `status=${mine0.status}`);
  else ok('GET /leave/mine');

  // 1. 普通用户提交给负责人（使用独立日期避免与历史数据重叠）
  const createBody = {
    startDate: '2026-12-01',
    endDate: '2026-12-02',
    type: '事假',
    reason: '冒烟测试请假',
    reviewTarget: 'LEADER',
  };
  let leaveId;
  {
    const { status, data } = await api(userToken, '/leave', {
      method: 'POST',
      body: JSON.stringify(createBody),
    });
    if (status === 201 || status === 200) {
      leaveId = data.id;
      ok(`POST /leave 提交成功 (id=${leaveId})`);
    } else if (status === 400 && data.message?.includes('重叠')) {
      // 已有记录，从 mine 取 pending
      const pending = mine0.data.find((r) => r.status === 'PENDING' && r.startDate === createBody.startDate);
      if (pending) {
        leaveId = pending.id;
        ok('POST /leave 已有同日期申请，复用记录');
      } else fail('POST /leave', data.message);
    } else fail('POST /leave', `status=${status} ${data.message}`);
  }

  // 1b. 未选审批人应失败
  {
    const { status, data } = await api(userToken, '/leave', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        reason: '缺审批人',
      }),
    });
    if (status === 400 && data.message?.includes('审批')) ok('POST /leave 普通用户须选审批人');
    else fail('POST /leave 须选审批人', `status=${status}`);
  }

  // 1c. 学员提交给管理员，负责人不可见
  let adminLeaveId;
  {
    const { status, data } = await api(userToken, '/leave', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        type: '事假',
        reason: '提交给管理员',
        reviewTarget: 'ADMIN',
      }),
    });
    if (status === 200 || status === 201) {
      adminLeaveId = data.id;
      ok('POST /leave 学员可提交给管理员');
    } else if (status === 400 && data.message?.includes('重叠')) {
      const mine = await api(userToken, '/leave/mine');
      const row = mine.data.find((r) => r.startDate === '2026-09-10' && r.status === 'PENDING');
      adminLeaveId = row?.id;
      ok('POST /leave 复用管理员通道申请');
    } else fail('POST /leave 管理员通道', `status=${status}`);
  }
  if (adminLeaveId) {
    const leaderPending = await api(leaderToken, '/leave/pending');
    const leaderSees = leaderPending.data?.some((r) => r.id === adminLeaveId);
    if (!leaderSees) ok('负责人看不到提交给管理员的申请');
    else fail('负责人不应看到管理员通道申请');

    const adminPending = await api(adminToken, '/leave/pending');
    const adminSees = adminPending.data?.some((r) => r.id === adminLeaveId);
    if (adminSees) ok('管理员可见提交给自己的申请');
    else fail('管理员应看到待审申请');

    await api(adminToken, `/leave/${adminLeaveId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    ok('管理员通过学员（管理员通道）申请');
  }

  // 2. 日期倒置应失败
  {
    const { status } = await api(userToken, '/leave', {
      method: 'POST',
      body: JSON.stringify({ ...createBody, startDate: '2026-12-10', endDate: '2026-12-08' }),
    });
    if (status === 400) ok('POST /leave 拒绝结束早于开始');
    else fail('POST /leave 拒绝结束早于开始', `status=${status}`);
  }

  // 3. 普通用户不能看待审列表
  {
    const { status } = await api(userToken, '/leave/pending');
    if (status === 403) ok('GET /leave/pending 普通用户 403');
    else fail('GET /leave/pending 普通用户 403', `status=${status}`);
  }

  // 4. 负责人看待审
  {
    const { status, data } = await api(leaderToken, '/leave/pending');
    if (status === 200 && Array.isArray(data)) {
      const found = data.some((r) => r.id === leaveId);
      if (found) ok(`GET /leave/pending 负责人可见学员申请 (${data.length} 条)`);
      else fail('GET /leave/pending', '未找到学员申请');
    } else fail('GET /leave/pending', `status=${status}`);
  }

  // 5. 负责人通过
  if (leaveId) {
    const { status, data } = await api(leaderToken, `/leave/${leaveId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    if (status === 200 && data.status === 'APPROVED') ok('PATCH /leave/:id/review 负责人通过');
    else fail('PATCH 通过', `status=${status} ${data.message}`);
  }

  // 6. 重叠应拒绝
  {
    const { status, data } = await api(userToken, '/leave', {
      method: 'POST',
      body: JSON.stringify({
        ...createBody,
        startDate: '2026-12-01',
        endDate: '2026-12-01',
        reason: '重叠测试',
      }),
    });
    if (status === 400 && data.message?.includes('重叠')) ok('POST /leave 拒绝日期重叠');
    else fail('POST /leave 拒绝日期重叠', `status=${status} ${data.message}`);
  }

  // 7. 新申请 + 撤销
  let cancelId;
  {
    const { status, data } = await api(userToken, '/leave', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-08-01',
        endDate: '2026-08-02',
        type: '病假',
        reason: '撤销测试',
        reviewTarget: 'LEADER',
      }),
    });
    if (status === 200 || status === 201) {
      cancelId = data.id;
      ok('POST /leave 第二条申请');
    } else if (status === 400 && data.message?.includes('重叠')) {
      const mine = await api(userToken, '/leave/mine');
      const row = mine.data.find((r) => r.startDate === '2026-08-01' && r.status === 'PENDING');
      cancelId = row?.id;
      ok('POST /leave 复用已有待撤销记录');
    } else fail('POST /leave 第二条', `status=${status}`);
  }

  if (cancelId) {
    const { status } = await api(userToken, `/leave/${cancelId}`, { method: 'DELETE' });
    if (status === 200) ok('DELETE /leave/:id 撤销待审');
    else fail('DELETE 撤销', `status=${status}`);
  }

  // 8. 负责人不能审自己（负责人提交 → admin 审）
  let leaderLeaveId;
  {
    const { status, data } = await api(leaderToken, '/leave', {
      method: 'POST',
      body: JSON.stringify({
        startDate: '2026-08-10',
        endDate: '2026-08-10',
        type: '事假',
        reason: '负责人请假',
      }),
    });
    if (status === 200 || status === 201) leaderLeaveId = data.id;
    else if (status === 400) {
      const mine = await api(leaderToken, '/leave/mine');
      const row = mine.data.find((r) => r.startDate === '2026-08-10' && r.status === 'PENDING');
      leaderLeaveId = row?.id;
    }
    if (leaderLeaveId) {
      ok('负责人提交请假（自动走管理员）');
      const row = (await api(leaderToken, '/leave/mine')).data.find((r) => r.id === leaderLeaveId);
      if (row?.reviewTarget === 'ADMIN') ok('负责人申请 reviewTarget=ADMIN');
      else fail('负责人 reviewTarget', row?.reviewTarget);
    } else fail('负责人提交请假');
  }

  if (leaderLeaveId) {
    const selfReview = await api(leaderToken, `/leave/${leaderLeaveId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'APPROVED' }),
    });
    if (selfReview.status === 403) ok('负责人不能审核自己 403');
    else fail('负责人不能审核自己', `status=${selfReview.status}`);

    const adminReview = await api(adminToken, `/leave/${leaderLeaveId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'REJECTED', reviewComment: '冒烟驳回' }),
    });
    if (adminReview.status === 200 && adminReview.data.status === 'REJECTED') {
      ok('管理员可审核负责人请假');
    } else fail('管理员审核负责人', `status=${adminReview.status}`);
  }

  // 9. 已处理列表
  {
    const { status, data } = await api(leaderToken, '/leave/reviewed');
    if (status === 200 && Array.isArray(data) && data.length > 0) ok(`GET /leave/reviewed (${data.length} 条)`);
    else fail('GET /leave/reviewed', `status=${status} len=${data?.length}`);
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
