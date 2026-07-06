import { PrismaClient, Role, TeamInviteCodeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface TeamDef {
  name: string;
  description: string;
}

interface UserDef {
  username: string;
  name: string;
  role: Role;
  password: string;
}

const TEAMS: TeamDef[] = [
  { name: '暑期实践一团', description: '2026 暑期社会实践 · 一团（计算机学院）' },
  { name: '暑期实践二团', description: '2026 暑期社会实践 · 二团（商学院）' },
  { name: '创新创业团', description: '大学生创新创业训练计划团队' },
  { name: '志愿服务队', description: '校园社区志愿服务团队' },
];

const USERS: UserDef[] = [
  { username: 'admin', name: '管理员', role: Role.ADMIN, password: 'admin123' },
  { username: 'leader', name: '项目负责人', role: Role.LEADER, password: 'leader123' },
  { username: 'user', name: '普通用户', role: Role.USER, password: 'user123' },
];

/** 各团队邀请码（6 位，方便手动输入测试） */
const TEAM_INVITE_CODES: Record<string, string> = {
  暑期实践一团: 'TEAM01',
  暑期实践二团: 'TEAM02',
  创新创业团: 'TEAM03',
  志愿服务队: 'TEAM04',
};

async function upsertTeam(def: TeamDef) {
  const team = await prisma.team.upsert({
    where: { name: def.name },
    update: { description: def.description },
    create: {
      name: def.name,
      description: def.description,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-08-31'),
    },
  });
  await prisma.checkInRule.upsert({
    where: { teamId: team.id },
    update: {},
    create: {
      teamId: team.id,
      startTime: '08:00',
      lateTime: '09:00',
      endTime: '10:00',
      checkOutStart: '17:00',
      checkOutEnd: '18:00',
      enabled: true,
    },
  });
  return team;
}

async function upsertUser(def: UserDef) {
  const passwordHash = await bcrypt.hash(def.password, 10);

  return prisma.user.upsert({
    where: { username: def.username },
    update: {
      name: def.name,
      role: def.role,
      teamId: null,
      mustChangePassword: def.username === 'admin' ? false : true,
    },
    create: {
      username: def.username,
      name: def.name,
      role: def.role,
      passwordHash,
      mustChangePassword: def.username === 'admin' ? false : true,
      faceRegistered: false,
    },
  });
}

async function ensureInviteCode(teamId: number, code: string, creatorId: number) {
  const existing = await prisma.teamInviteCode.findFirst({
    where: { teamId, status: TeamInviteCodeStatus.ACTIVE },
  });
  if (existing) return existing;

  return prisma.teamInviteCode.upsert({
    where: { code },
    update: { teamId, creatorId, status: TeamInviteCodeStatus.ACTIVE, disabledAt: null },
    create: { teamId, code, creatorId, status: TeamInviteCodeStatus.ACTIVE },
  });
}

async function main() {
  await prisma.platformCheckInRule.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      startTime: '08:00',
      lateTime: '09:00',
      endTime: '10:00',
      checkOutStart: '17:00',
      checkOutEnd: '18:00',
      enabled: true,
    },
  });

  const teamByName = new Map<string, number>();
  for (const def of TEAMS) {
    const team = await upsertTeam(def);
    teamByName.set(def.name, team.id);
  }

  for (const def of USERS) {
    await upsertUser(def);
  }

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } });

  for (const [teamName, code] of Object.entries(TEAM_INVITE_CODES)) {
    const teamId = teamByName.get(teamName);
    if (teamId) await ensureInviteCode(teamId, code, admin.id);
  }

  const slideCount = await prisma.kioskCarouselSlide.count();
  if (slideCount === 0) {
    await prisma.kioskCarouselSlide.createMany({
      data: [
        { title: '轮播图1', sortOrder: 0 },
        { title: '轮播图2', sortOrder: 1 },
        { title: '轮播图3', sortOrder: 2 },
      ],
    });
  }

  const countdownCount = await prisma.kioskCountdown.count();
  if (countdownCount === 0) {
    await prisma.kioskCountdown.create({
      data: {
        title: '暑期实践结束',
        targetAt: new Date('2026-08-31T23:59:59+08:00'),
        sortOrder: 0,
      },
    });
  }

  console.log('\n=== 种子数据已就绪 ===\n');
  console.log('默认账号（均未加入团队，生产环境请修改密码）：');
  console.log('  admin  / admin123   管理员');
  console.log('  leader / leader123  项目负责人');
  console.log('  user   / user123    普通用户');
  console.log('\n演示团队（空团队，可手动分配或通过邀请码加入）：');
  for (const t of TEAMS) {
    const id = teamByName.get(t.name);
    const code = TEAM_INVITE_CODES[t.name];
    console.log(`  · ${t.name} (id=${id})  邀请码: ${code}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
