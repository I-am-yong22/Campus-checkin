import { LeaveStatus, PrismaClient, Role, TeamInviteCodeStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = '123456';

interface TeamDef {
  name: string;
  description: string;
}

interface UserDef {
  username: string;
  name: string;
  role: Role;
  password?: string;
  /** 当前活跃团队（User.teamId） */
  activeTeamName?: string;
  /** 所属团队（可多个） */
  teamNames?: string[];
}

const TEAMS: TeamDef[] = [
  { name: '暑期实践一团', description: '2026 暑期社会实践 · 一团（计算机学院）' },
  { name: '暑期实践二团', description: '2026 暑期社会实践 · 二团（商学院）' },
  { name: '创新创业团', description: '大学生创新创业训练计划团队' },
  { name: '志愿服务队', description: '校园社区志愿服务团队' },
];

const USERS: UserDef[] = [
  { username: 'admin', name: 'Evan', role: Role.ADMIN },
  // leader 负责一团 + 二团
  {
    username: 'leader',
    name: '张负责人',
    role: Role.LEADER,
    password: 'leader123',
    activeTeamName: '暑期实践一团',
    teamNames: ['暑期实践一团'],
  },
  {
    username: 'leader2',
    name: '李负责人',
    role: Role.LEADER,
    password: 'leader123',
    activeTeamName: '创新创业团',
    teamNames: ['创新创业团'],
  },
  {
    username: 'leader3',
    name: '王负责人',
    role: Role.LEADER,
    password: 'leader123',
    activeTeamName: '志愿服务队',
    teamNames: ['志愿服务队'],
  },
  {
    username: 'user',
    name: '赵同学',
    role: Role.USER,
    password: 'user123',
    activeTeamName: '暑期实践一团',
    teamNames: ['暑期实践一团'],
  },
  // 无团队，可测邀请码 / 点对点邀请
  { username: 'user2', name: '待入团队学员', role: Role.USER, password: 'user123' },
  // 同时在一团、二团，可测多团队切换
  {
    username: 'user10',
    name: '跨团学员',
    role: Role.USER,
    password: 'user123',
    activeTeamName: '暑期实践一团',
    teamNames: ['暑期实践一团', '暑期实践二团'],
  },
  { username: 'user3', name: '一团学员甲', role: Role.USER, activeTeamName: '暑期实践一团', teamNames: ['暑期实践一团'] },
  { username: 'user4', name: '一团学员乙', role: Role.USER, activeTeamName: '暑期实践一团', teamNames: ['暑期实践一团'] },
  { username: 'user5', name: '二团学员甲', role: Role.USER, activeTeamName: '暑期实践二团', teamNames: ['暑期实践二团'] },
  { username: 'user6', name: '二团学员乙', role: Role.USER, activeTeamName: '暑期实践二团', teamNames: ['暑期实践二团'] },
  { username: 'user7', name: '创创学员甲', role: Role.USER, activeTeamName: '创新创业团', teamNames: ['创新创业团'] },
  { username: 'user8', name: '创创学员乙', role: Role.USER, activeTeamName: '创新创业团', teamNames: ['创新创业团'] },
  { username: 'user9', name: '志愿学员甲', role: Role.USER, activeTeamName: '志愿服务队', teamNames: ['志愿服务队'] },
];

/** 负责人与其负责的团队（不含成员身份，仅管理关系） */
const LEADER_OWNS: Record<string, string[]> = {
  leader: ['暑期实践一团', '暑期实践二团'],
  leader2: ['创新创业团'],
  leader3: ['志愿服务队'],
};

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

async function upsertUser(def: UserDef, teamByName: Map<string, number>) {
  const password = def.password ?? DEFAULT_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 10);
  const activeTeamId = def.activeTeamName ? teamByName.get(def.activeTeamName) ?? null : null;

  return prisma.user.upsert({
    where: { username: def.username },
    update: {
      name: def.name,
      role: def.role,
      teamId: activeTeamId,
      mustChangePassword: def.username === 'admin' ? false : true,
    },
    create: {
      username: def.username,
      name: def.name,
      role: def.role,
      passwordHash,
      teamId: activeTeamId ?? undefined,
      mustChangePassword: def.username === 'admin' ? false : true,
      faceRegistered: false,
    },
  });
}

async function ensureMembership(userId: number, teamId: number) {
  await prisma.teamMembership.upsert({
    where: { userId_teamId: { userId, teamId } },
    create: { userId, teamId },
    update: {},
  });
}

async function ensureApprovedCreation(
  applicantId: number,
  teamId: number,
  teamName: string,
  reviewerId: number,
) {
  const existing = await prisma.teamCreationRequest.findFirst({
    where: { applicantId, teamId, status: LeaveStatus.APPROVED },
  });
  if (existing) return existing;

  return prisma.teamCreationRequest.create({
    data: {
      applicantId,
      name: teamName,
      description: `${teamName} 演示数据`,
      reason: '种子数据自动创建',
      status: LeaveStatus.APPROVED,
      reviewerId,
      reviewComment: '种子数据自动批准',
      reviewedAt: new Date(),
      teamId,
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

  const userByName = new Map<string, number>();
  for (const def of USERS) {
    const user = await upsertUser(def, teamByName);
    userByName.set(def.username, user.id);

    if (def.teamNames?.length) {
      for (const teamName of def.teamNames) {
        const teamId = teamByName.get(teamName);
        if (teamId) await ensureMembership(user.id, teamId);
      }
    }
  }

  const adminId = userByName.get('admin')!;

  for (const [leaderUsername, teamNames] of Object.entries(LEADER_OWNS)) {
    const applicantId = userByName.get(leaderUsername);
    if (!applicantId) continue;
    for (const teamName of teamNames) {
      const teamId = teamByName.get(teamName);
      if (teamId) await ensureApprovedCreation(applicantId, teamId, teamName, adminId);
    }
  }

  for (const [teamName, code] of Object.entries(TEAM_INVITE_CODES)) {
    const teamId = teamByName.get(teamName);
    if (!teamId) continue;
    const ownerUsername = Object.entries(LEADER_OWNS).find(([, names]) => names.includes(teamName))?.[0];
    const creatorId = ownerUsername ? userByName.get(ownerUsername) : adminId;
    if (creatorId) await ensureInviteCode(teamId, code, creatorId);
  }

  // Kiosk 演示数据（仅首次）
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
  console.log('团队（4 个）：');
  for (const t of TEAMS) {
    const id = teamByName.get(t.name);
    const code = TEAM_INVITE_CODES[t.name];
    console.log(`  · ${t.name} (id=${id})  邀请码: ${code}`);
  }
  console.log('\n账号（默认密码见括号，其余学员 123456）：');
  console.log('  admin / admin123        管理员');
  console.log('  leader / leader123      负责人，负责「一团 + 二团」');
  console.log('  leader2 / leader123     负责人，「创新创业团」');
  console.log('  leader3 / leader123     负责人，「志愿服务队」');
  console.log('  user / user123          学员，仅「一团」');
  console.log('  user10 / user123        学员，「一团 + 二团」可测切换');
  console.log('  user2 / user123         无团队，可测邀请入团');
  console.log('  user3~user9             各团队学员');
  console.log('\n测试建议：');
  console.log('  · leader 登录 → 我的团队 → 切换一团/二团 → 管理/出勤/统计');
  console.log('  · user10 登录 → 我的团队 → 切换一团/二团查看成员');
  console.log('  · user2 登录 → 我的团队 → 加入团队 → 输入 TEAM01~04');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
