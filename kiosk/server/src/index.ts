import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { prisma } from './db';
import { euclideanDistance, nowTimeStr, timeToMinutes, todayStr } from './datetime';
import {
  computeWorkMinutes,
  resolveAction,
  resolvePlatformRule,
} from './attendance-session';
import { resolveKioskSchedule } from './kiosk-schedule.js';
import { loadStandbyDisplay } from './kiosk-standby-display.js';
import { resolveTodayBoard } from './attendance-board.js';
import { assignSeatIfNeeded, SeatsFullError } from './seat.js';

function parseDescriptors(raw: string): number[][] {
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  if (typeof parsed[0] === 'number') return [parsed as number[]];
  return parsed as number[][];
}

function minDistance(query: number[], templates: number[][]): number {
  if (templates.length === 0) return Infinity;
  return Math.min(...templates.map((t) => euclideanDistance(query, t)));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HOST = process.env.KIOSK_HOST || '127.0.0.1';
const PORT = Number(process.env.KIOSK_PORT) || 4000;
const THRESHOLD = Number(process.env.KIOSK_FACE_MATCH_THRESHOLD) || 0.45;
const ADMIN_TOKEN = process.env.KIOSK_ADMIN_TOKEN || '';
const KIOSK_VERSION = process.env.KIOSK_VERSION || '1.0.0';
const UPLOADS_DIR =
  process.env.UPLOADS_DIR || path.resolve(__dirname, '../../../backend/uploads');

async function touchHeartbeat(checkIn = false) {
  const now = new Date();
  await prisma.kioskHeartbeat.upsert({
    where: { id: 1 },
    update: {
      lastSeenAt: now,
      ...(checkIn ? { lastCheckInAt: now } : {}),
      version: KIOSK_VERSION,
    },
    create: {
      id: 1,
      lastSeenAt: now,
      lastCheckInAt: checkIn ? now : null,
      version: KIOSK_VERSION,
    },
  });
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '2mb' }));

if (fs.existsSync(UPLOADS_DIR)) {
  app.use('/uploads', express.static(UPLOADS_DIR));
}

const api = express.Router();

// 健康检查
api.get('/health', async (_req, res) => {
  try {
    await touchHeartbeat(false);
    res.json({ ok: true, threshold: THRESHOLD, time: nowTimeStr(), date: todayStr() });
  } catch (e: any) {
    res.status(500).json({ ok: false, message: e?.message });
  }
});

// 待机 / 打卡模式调度（按出勤时段与休息日）
api.get('/schedule', async (_req, res) => {
  try {
    await touchHeartbeat(false);
    const schedule = await resolveKioskSchedule(prisma);
    res.json(schedule);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || '调度信息获取失败' });
  }
});

// 待机轮播内容
api.get('/standby/display', async (_req, res) => {
  try {
    await touchHeartbeat(false);
    const payload = await loadStandbyDisplay(prisma);
    res.json(payload);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || '待机内容获取失败' });
  }
});

// 今日签到看板：已签到 + 未签到
api.get('/attendance/today-board', async (_req, res) => {
  try {
    const board = await resolveTodayBoard(prisma);
    res.json(board);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || '签到看板获取失败' });
  }
});

// 人脸库：供前端做 1:N 识别（已绑定 127.0.0.1，仅本机可访问）
api.get('/faces', async (_req, res) => {
  const profiles = await prisma.faceProfile.findMany({
    include: { user: { select: { id: true, name: true, username: true, teamId: true, status: true } } },
  });
  const faces = profiles
    .filter((p) => p.user && p.user.status === 'ACTIVE')
    .map((p) => ({
      userId: p.userId,
      name: p.user.name,
      username: p.user.username,
      teamId: p.user.teamId,
      descriptors: parseDescriptors(p.descriptor),
    }));
  res.json({ count: faces.length, faces });
});

// 用户列表：供现场录入时选择目标用户
api.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      faceRegistered: true,
      seat: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ teamId: 'asc' }, { name: 'asc' }],
  });
  res.json({ count: users.length, users });
});

// 签到 / 签退（时间窗校验）
async function handleAttendance(req: express.Request, res: express.Response) {
  try {
    const { userId, descriptor } = req.body as {
      userId?: number;
      descriptor?: number[];
    };

    if (!userId || !Array.isArray(descriptor) || descriptor.length === 0) {
      return res.status(400).json({ message: '参数缺失：userId / descriptor' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { faceProfile: true, team: true },
    });
    if (!user) return res.status(400).json({ message: '用户不存在' });
    if (user.status !== 'ACTIVE') return res.status(400).json({ message: '该用户已被禁用' });
    if (!user.faceProfile) {
      return res.status(400).json({ message: '该用户尚未录入人脸' });
    }

    const stored = parseDescriptors(user.faceProfile.descriptor);
    const distance = minDistance(descriptor, stored);
    if (distance > THRESHOLD) {
      return res.status(400).json({
        message: `人脸比对未通过`,
        distance: Number(distance.toFixed(4)),
      });
    }

    const date = todayStr();
    const exempt = await prisma.calendarExemption.findFirst({
      where: {
        date,
        OR: user.teamId ? [{ teamId: null }, { teamId: user.teamId }] : [{ teamId: null }],
      },
    });
    if (exempt) {
      return res.status(400).json({ message: '今日为休息日，无需打卡', action: 'REJECT' });
    }

    const taskRow = await prisma.attendanceTask.findUnique({
      where: { date },
    });
    if (taskRow?.status === 'PUBLISHED' && taskRow.note?.includes('免打卡')) {
      return res.status(400).json({ message: taskRow.note || '今日无需打卡', action: 'REJECT' });
    }

    const nowMinutes = timeToMinutes(nowTimeStr());
    const rule = await resolvePlatformRule(prisma, date);
    if (!rule) {
      return res.status(400).json({ message: '平台未配置出勤规则' });
    }

    const existing = await prisma.checkIn.findUnique({
      where: { userId_date: { userId, date } },
    });

    const state = {
      hasCheckIn: !!existing,
      hasCheckOut: !!existing?.checkOutAt,
    };
    const { action, message: actionMsg } = resolveAction(rule, nowMinutes, state);
    if (action === 'REJECT') {
      return res.status(400).json({ message: actionMsg, action: 'REJECT' });
    }

    if (action === 'CHECK_IN') {
      let status: 'NORMAL' | 'LATE' = 'NORMAL';
      if (nowMinutes > timeToMinutes(rule.lateTime)) status = 'LATE';

      const record = await prisma.checkIn.create({
        data: {
          userId,
          teamId: user.teamId,
          date,
          matchScore: Number(distance.toFixed(4)),
          livenessPassed: false,
          status,
        },
      });

      await touchHeartbeat(true);

      return res.json({
        success: true,
        action: 'CHECK_IN',
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
        teamName: user.team?.name ?? null,
        status,
        date,
        checkInAt: record.checkInAt,
        matchScore: record.matchScore,
        message: status === 'LATE' ? '签到成功（迟到）' : '签到成功',
      });
    }

    // CHECK_OUT
    const checkOutAt = new Date();
    const workMinutes = computeWorkMinutes(existing!.checkInAt, checkOutAt);
    const updated = await prisma.checkIn.update({
      where: { id: existing!.id },
      data: {
        checkOutAt,
        checkOutScore: Number(distance.toFixed(4)),
        checkOutType: 'MANUAL',
        workMinutes,
      },
    });

    await touchHeartbeat(true);

    return res.json({
      success: true,
      action: 'CHECK_OUT',
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      teamName: user.team?.name ?? null,
      date,
      checkInAt: updated.checkInAt,
      checkOutAt: updated.checkOutAt,
      workMinutes: updated.workMinutes,
      message: `签退成功，今日工时 ${workMinutes} 分钟`,
    });
  } catch (e: any) {
    console.error('attendance error', e);
    return res.status(500).json({ message: '操作失败：' + (e?.message || '服务器错误') });
  }
}

api.post('/attendance', handleAttendance);

// 兼容旧接口
api.post('/checkin', handleAttendance);

// 管理口令校验（现场录入入口）
api.post('/admin/verify', (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(403).json({ message: '未配置管理口令 KIOSK_ADMIN_TOKEN，现场录入已禁用' });
  }
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: '管理口令错误，无权访问' });
  }
  return res.json({ ok: true });
});

// 现场人脸录入：需管理口令（请求头 x-admin-token）
api.post('/face/register', async (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(403).json({ message: '未配置管理口令 KIOSK_ADMIN_TOKEN，现场录入已禁用' });
  }
  const token = req.header('x-admin-token');
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ message: '管理口令错误，无权现场录入' });
  }

  const { userId, descriptor } = req.body as { userId?: number; descriptor?: number[] };
  if (!userId || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ message: '参数缺失：userId / descriptor' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(400).json({ message: '用户不存在' });

  const json = JSON.stringify(descriptor);
  await prisma.faceProfile.upsert({
    where: { userId },
    update: { descriptor: json },
    create: { userId, descriptor: json },
  });
  await prisma.user.update({ where: { id: userId }, data: { faceRegistered: true } });

  try {
    const seat = await assignSeatIfNeeded(prisma, userId);
    return res.json({
      success: true,
      name: user.name,
      seat,
      message: `已为「${user.name}」录入人脸，座位 ${seat}`,
    });
  } catch (e) {
    if (e instanceof SeatsFullError) {
      return res.status(409).json({ message: e.message });
    }
    throw e;
  }
});

app.use('/api', api);

// 生产环境：直接托管已构建的本地签到网页（kiosk/web/dist）
const webDist = path.resolve(__dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
} else {
  app.get('/', (_req, res) =>
    res.send('单机签到服务运行中。开发模式请单独启动 kiosk/web（npm run dev）。'),
  );
}

app.listen(PORT, HOST, () => {
  console.log('========================================');
  console.log('  校园打卡 · 单机签到本地服务已启动');
  console.log(`  监听地址: http://${HOST}:${PORT}  (仅本机)`);
  console.log(`  比对阈值: ${THRESHOLD}`);
  console.log(`  现场录入: ${ADMIN_TOKEN ? '已启用（需管理口令）' : '未启用（未配置口令）'}`);
  console.log('========================================');
});
