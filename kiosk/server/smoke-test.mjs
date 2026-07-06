/**
 * 单机签到服务 API 冒烟测试（需 kiosk/server 已启动，且 DATABASE_URL 可连）
 * 用法：npm run smoke
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const BASE = `http://${process.env.KIOSK_HOST || '127.0.0.1'}:${process.env.KIOSK_PORT || 4000}/api`;
const ADMIN_TOKEN = process.env.KIOSK_ADMIN_TOKEN || '';
const THRESHOLD = Number(process.env.KIOSK_FACE_MATCH_THRESHOLD) || 0.42;
const MAIN_API = process.env.MAIN_API_URL || 'http://127.0.0.1:3000/api';

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

async function api(path, init) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

// 128 维测试向量
function vec(seed = 0) {
  return Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1 + seed) * 0.01);
}

// 与 vec() 明显不同的向量（欧氏距离远大于阈值）
function badVec() {
  return Array.from({ length: 128 }, (_, i) => (i % 2 === 0 ? 1 : -1));
}

async function main() {
  console.log('=== 单机签到服务冒烟测试 ===\n');

  // 1. 健康检查
  try {
    const { status, data } = await api('/health');
    if (status === 200 && data.ok) ok('GET /health');
    else fail('GET /health', `status=${status}`);
  } catch (e) {
    fail('GET /health', e.message);
    console.error('\n请先启动 kiosk/server：cd kiosk/server && npm run dev\n');
    process.exit(1);
  }

  // 2. 出勤调度
  {
    const { status, data } = await api('/schedule');
    if (status === 200 && (data.mode === 'ATTENDANCE' || data.mode === 'STANDBY')) {
      ok(`GET /schedule (mode=${data.mode})`);
    } else fail('GET /schedule', `status=${status}`);
  }

  // 2b. 待机轮播内容
  {
    const { status, data } = await api('/standby/display');
    if (status === 200 && Array.isArray(data.carousel) && Array.isArray(data.countdowns)) {
      ok(`GET /standby/display (轮播${data.carousel.length} 倒计时${data.countdowns.length})`);
    } else fail('GET /standby/display', `status=${status}`);
  }

  // 3. 人脸库
  const facesRes = await api('/faces');
  if (facesRes.status === 200 && Array.isArray(facesRes.data.faces)) {
    ok(`GET /faces (${facesRes.data.count} 人)`);
  } else fail('GET /faces');

  // 4. 用户列表
  const usersRes = await api('/users');
  if (usersRes.status === 200 && Array.isArray(usersRes.data.users)) {
    ok(`GET /users (${usersRes.data.count} 人)`);
  } else fail('GET /users');

  // 准备测试用户与人脸
  const testUser = await prisma.user.findFirst({
    where: { username: 'user', status: 'ACTIVE' },
    include: { faceProfile: true, team: { include: { checkInRule: true } } },
  });
  if (!testUser) {
    fail('测试用户 user 不存在，请先 npm run seed');
    await cleanup();
    process.exit(1);
  }

  const descriptor = vec(1);
  await prisma.faceProfile.upsert({
    where: { userId: testUser.id },
    update: { descriptor: JSON.stringify(descriptor) },
    create: { userId: testUser.id, descriptor: JSON.stringify(descriptor) },
  });
  await prisma.user.update({ where: { id: testUser.id }, data: { faceRegistered: true } });

  const date = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  await prisma.checkIn.deleteMany({ where: { userId: testUser.id, date } });

  // 放宽平台规则以便冒烟（全天可签到签退）
  await prisma.platformCheckInRule.upsert({
    where: { id: 1 },
    update: {
      startTime: '00:00',
      lateTime: '23:59',
      endTime: '23:59',
      checkOutStart: '00:00',
      checkOutEnd: '23:59',
      enabled: true,
    },
    create: {
      id: 1,
      startTime: '00:00',
      lateTime: '23:59',
      endTime: '23:59',
      checkOutStart: '00:00',
      checkOutEnd: '23:59',
      enabled: true,
    },
  });
  await prisma.attendanceTask.deleteMany({ where: { date } });

  // 4. 距离过大
  {
    const bad = badVec();
    const { status, data } = await api('/attendance', {
      method: 'POST',
      body: JSON.stringify({ userId: testUser.id, descriptor: bad }),
    });
    if (status === 400 && data.distance > THRESHOLD) ok('POST /attendance 拒绝距离过大');
    else fail('POST /attendance 拒绝距离过大', `status=${status} dist=${data.distance}`);
  }

  await prisma.checkIn.deleteMany({ where: { userId: testUser.id, date } });

  // 5. 签到成功
  {
    const { status, data } = await api('/attendance', {
      method: 'POST',
      body: JSON.stringify({ userId: testUser.id, descriptor }),
    });
    if (status === 200 && data.success && data.action === 'CHECK_IN') {
      ok(`POST /attendance 签到成功`);
    } else fail('POST /attendance 签到成功', `status=${status}`);
  }

  // 6. 签退成功
  {
    const { status, data } = await api('/attendance', {
      method: 'POST',
      body: JSON.stringify({ userId: testUser.id, descriptor }),
    });
    if (status === 200 && data.success && data.action === 'CHECK_OUT' && data.workMinutes >= 0) {
      ok(`POST /attendance 签退成功 (工时 ${data.workMinutes} 分)`);
    } else fail('POST /attendance 签退成功', `status=${status}`);
  }

  // 7. 当日已完成拒绝
  {
    const { status, data } = await api('/attendance', {
      method: 'POST',
      body: JSON.stringify({ userId: testUser.id, descriptor }),
    });
    if (status === 400 && data.action === 'REJECT') ok('POST /attendance 已完成拒绝重复');
    else fail('POST /attendance 已完成拒绝重复', `status=${status}`);
  }

  // 7b. 无团队用户也可签到
  {
    const noTeamUser = await prisma.user.findFirst({
      where: { status: 'ACTIVE', role: { in: ['USER', 'LEADER'] }, teamId: null },
    });
    if (noTeamUser) {
      const noTeamDesc = vec(99);
      await prisma.faceProfile.upsert({
        where: { userId: noTeamUser.id },
        update: { descriptor: JSON.stringify(noTeamDesc) },
        create: { userId: noTeamUser.id, descriptor: JSON.stringify(noTeamDesc) },
      });
      await prisma.user.update({ where: { id: noTeamUser.id }, data: { faceRegistered: true } });
      await prisma.checkIn.deleteMany({ where: { userId: noTeamUser.id, date } });

      const { status, data } = await api('/attendance', {
        method: 'POST',
        body: JSON.stringify({ userId: noTeamUser.id, descriptor: noTeamDesc }),
      });
      if (status === 200 && data.success && data.action === 'CHECK_IN') {
        ok('POST /attendance 无团队用户可签到');
      } else {
        fail('POST /attendance 无团队用户可签到', `status=${status} ${data.message ?? ''}`);
      }
      await prisma.checkIn.deleteMany({ where: { userId: noTeamUser.id, date } });
    } else {
      console.log('  - 跳过无团队签到测试（当前无 teamId 为空的学员）');
    }
  }

  // 8. 管理口令校验
  if (ADMIN_TOKEN) {
    const badVerify = await api('/admin/verify', {
      method: 'POST',
      headers: { 'x-admin-token': 'wrong-token' },
    });
    if (badVerify.status === 401) ok('POST /admin/verify 拒绝错误口令');
    else fail('POST /admin/verify 拒绝错误口令', `status=${badVerify.status}`);

    const okVerify = await api('/admin/verify', {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    if (okVerify.status === 200 && okVerify.data.ok) ok('POST /admin/verify 口令正确');
    else fail('POST /admin/verify 口令正确', `status=${okVerify.status}`);
  } else {
    console.log('  - 跳过口令校验测试（未配置 KIOSK_ADMIN_TOKEN）');
  }

  // 9. 现场录入口令
  if (ADMIN_TOKEN) {
    const noToken = await api('/face/register', {
      method: 'POST',
      body: JSON.stringify({ userId: testUser.id, descriptor: vec(2) }),
    });
    if (noToken.status === 401) ok('POST /face/register 拒绝无口令');
    else fail('POST /face/register 拒绝无口令', `status=${noToken.status}`);

    const newDesc = vec(2);
    const seatBefore = testUser.seat;
    await prisma.user.update({
      where: { id: testUser.id },
      data: { seat: null },
    });

    const reg = await api('/face/register', {
      method: 'POST',
      headers: { 'x-admin-token': ADMIN_TOKEN },
      body: JSON.stringify({ userId: testUser.id, descriptor: newDesc }),
    });
    if (reg.status === 200 && reg.data.success && reg.data.seat) {
      ok(`POST /face/register 录入成功 (座位 ${reg.data.seat})`);
      const dbUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { seat: true },
      });
      if (dbUser?.seat === reg.data.seat) ok('POST /face/register 座位已写入数据库');
      else fail('POST /face/register 座位已写入数据库', `db=${dbUser?.seat} resp=${reg.data.seat}`);

      const reg2 = await api('/face/register', {
        method: 'POST',
        headers: { 'x-admin-token': ADMIN_TOKEN },
        body: JSON.stringify({ userId: testUser.id, descriptor: vec(3) }),
      });
      if (reg2.status === 200 && reg2.data.seat === reg.data.seat) {
        ok('POST /face/register 重复录入保留原座位');
      } else {
        fail('POST /face/register 重复录入保留原座位', `first=${reg.data.seat} second=${reg2.data?.seat}`);
      }
    } else {
      fail('POST /face/register 录入成功', `status=${reg.status} msg=${reg.data?.message}`);
    }

    await prisma.user.update({
      where: { id: testUser.id },
      data: { seat: seatBefore },
    });

    // 恢复测试用人脸
    await prisma.faceProfile.update({
      where: { userId: testUser.id },
      data: { descriptor: JSON.stringify(descriptor) },
    });
  } else {
    console.log('  - 跳过口令测试（未配置 KIOSK_ADMIN_TOKEN）');
  }

  // 10. 主后端已移除 POST /checkin
  try {
    const res = await fetch(`${MAIN_API}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descriptor: vec(0) }),
    });
    if (res.status === 401 || res.status === 404 || res.status === 405) {
      ok(`主后端 POST /checkin 已关闭 (HTTP ${res.status})`);
    } else {
      fail('主后端 POST /checkin 应不可用', `HTTP ${res.status}`);
    }
  } catch {
    console.log('  - 跳过主后端检测（主后端未启动）');
  }

  // 清理当日测试签到
  await prisma.checkIn.deleteMany({ where: { userId: testUser.id, date } });

  console.log(`\n=== 结果：${passed} 通过，${failed} 失败 ===`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

async function cleanup() {
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await cleanup();
  process.exit(1);
});
