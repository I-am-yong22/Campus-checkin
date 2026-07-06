import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, Role, TeamInviteCodeStatus, UserStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import {
  CreateTeamApplicationDto,
  CreateTeamInvitationDto,
  JoinTeamByCodeDto,
  ReviewTeamApplicationDto,
} from './dto/team-workflow.dto';

const userBrief = {
  id: true,
  name: true,
  username: true,
  role: true,
  avatarUrl: true,
} as const;

const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

@Injectable()
export class TeamWorkflowService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private teamsService: TeamsService,
  ) {}

  // ── 团队创建申请 ──

  async createApplication(applicantId: number, dto: CreateTeamApplicationDto) {
    const applicant = await this.prisma.user.findUnique({ where: { id: applicantId } });
    if (!applicant) throw new NotFoundException('用户不存在');
    if (applicant.role !== Role.LEADER) {
      throw new ForbiddenException('仅项目负责人可申请创建团队');
    }

    const pending = await this.prisma.teamCreationRequest.findFirst({
      where: { applicantId, status: LeaveStatus.PENDING },
    });
    if (pending) {
      throw new BadRequestException('您已有待审核的团队创建申请');
    }

    const nameExists = await this.prisma.team.findUnique({ where: { name: dto.name.trim() } });
    if (nameExists) {
      throw new BadRequestException('团队名称已存在，请更换名称');
    }

    const dupName = await this.prisma.teamCreationRequest.findFirst({
      where: { name: dto.name.trim(), status: LeaveStatus.PENDING },
    });
    if (dupName) {
      throw new BadRequestException('该团队名称已有待审核申请');
    }

    return this.prisma.teamCreationRequest.create({
      data: {
        applicantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        reason: dto.reason.trim(),
      },
      include: { applicant: { select: userBrief } },
    });
  }

  async myApplications(applicantId: number) {
    return this.prisma.teamCreationRequest.findMany({
      where: { applicantId },
      include: {
        reviewer: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pendingApplications() {
    return this.prisma.teamCreationRequest.findMany({
      where: { status: LeaveStatus.PENDING },
      include: { applicant: { select: userBrief } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async pendingApplicationCount() {
    const count = await this.prisma.teamCreationRequest.count({
      where: { status: LeaveStatus.PENDING },
    });
    return { count };
  }

  async reviewApplication(
    reviewerId: number,
    id: number,
    dto: ReviewTeamApplicationDto,
  ) {
    if (dto.status !== LeaveStatus.APPROVED && dto.status !== LeaveStatus.REJECTED) {
      throw new BadRequestException('审核结果无效');
    }

    const req = await this.prisma.teamCreationRequest.findUnique({
      where: { id },
      include: { applicant: true },
    });
    if (!req) throw new NotFoundException('申请不存在');
    if (req.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('该申请已处理');
    }

    if (dto.status === LeaveStatus.REJECTED) {
      const updated = await this.prisma.teamCreationRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.REJECTED,
          reviewerId,
          reviewComment: dto.reviewComment?.trim() || null,
          reviewedAt: new Date(),
        },
        include: { applicant: { select: userBrief }, reviewer: { select: { id: true, name: true } } },
      });
      await this.audit.log(reviewerId, 'TEAM_APPLICATION_REJECT', { requestId: id, name: req.name });
      return updated;
    }

    // 批准：创建团队并绑定负责人
    const nameExists = await this.prisma.team.findUnique({ where: { name: req.name } });
    if (nameExists) {
      throw new BadRequestException('团队名称已存在，无法批准');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: req.name,
          description: req.description,
          checkInRule: { create: {} },
        },
      });
      if (!req.applicant.teamId) {
        await tx.user.update({
          where: { id: req.applicantId },
          data: { teamId: team.id },
        });
      }
      await tx.teamMembership.upsert({
        where: { userId_teamId: { userId: req.applicantId, teamId: team.id } },
        create: { userId: req.applicantId, teamId: team.id },
        update: {},
      });
      const updated = await tx.teamCreationRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.APPROVED,
          reviewerId,
          reviewComment: dto.reviewComment?.trim() || null,
          reviewedAt: new Date(),
          teamId: team.id,
        },
        include: {
          applicant: { select: userBrief },
          reviewer: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      });
      return updated;
    });

    await this.audit.log(reviewerId, 'TEAM_APPLICATION_APPROVE', {
      requestId: id,
      teamId: result.teamId,
      name: req.name,
    });
    return result;
  }

  // ── 成员邀请 ──

  private async assertLeaderOfTeam(leaderId: number, teamId: number) {
    const leader = await this.prisma.user.findUnique({ where: { id: leaderId } });
    if (!leader || leader.role !== Role.LEADER) {
      throw new ForbiddenException('仅项目负责人可邀请成员');
    }
    await this.teamsService.assertLeaderManagesTeam(leaderId, teamId);
    return leader;
  }

  private async resolveTeamId(leaderId: number, teamId?: number) {
    return this.teamsService.resolveLeaderTeamId(leaderId, teamId);
  }

  async inviteCandidates(leaderId: number, keyword?: string, teamId?: number) {
    const resolvedTeamId = await this.resolveTeamId(leaderId, teamId);
    await this.assertLeaderOfTeam(leaderId, resolvedTeamId);

    const where: any = {
      role: Role.USER,
      status: UserStatus.ACTIVE,
      teamId: null,
    };
    if (keyword?.trim()) {
      where.OR = [
        { username: { contains: keyword.trim() } },
        { name: { contains: keyword.trim() } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: userBrief,
      orderBy: { name: 'asc' },
      take: 50,
    });

    const pendingInviteeIds = await this.prisma.teamInvitation.findMany({
      where: { teamId: resolvedTeamId, status: LeaveStatus.PENDING },
      select: { inviteeId: true },
    });
    const pendingSet = new Set(pendingInviteeIds.map((i) => i.inviteeId));

    return users.map((u) => ({ ...u, pendingInvite: pendingSet.has(u.id) }));
  }

  async createInvitation(leaderId: number, dto: CreateTeamInvitationDto, teamId?: number) {
    const resolvedTeamId = await this.resolveTeamId(leaderId, teamId);
    await this.assertLeaderOfTeam(leaderId, resolvedTeamId);

    const invitee = await this.prisma.user.findUnique({ where: { id: dto.inviteeId } });
    if (!invitee) throw new NotFoundException('被邀请用户不存在');
    if (invitee.role !== Role.USER) {
      throw new BadRequestException('只能邀请普通用户加入团队');
    }
    if (invitee.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('该用户已被禁用');
    }
    if (await this.teamsService.isTeamMember(dto.inviteeId, resolvedTeamId)) {
      throw new BadRequestException('该用户已是本团队成员');
    }

    const existing = await this.prisma.teamInvitation.findUnique({
      where: { teamId_inviteeId: { teamId: resolvedTeamId, inviteeId: dto.inviteeId } },
    });
    if (existing?.status === LeaveStatus.PENDING) {
      throw new BadRequestException('已向该用户发出邀请，请等待对方处理');
    }
    if (existing?.status === LeaveStatus.APPROVED) {
      throw new BadRequestException('该用户已是本团队成员');
    }

    const invitation = existing
      ? await this.prisma.teamInvitation.update({
          where: { id: existing.id },
          data: {
            status: LeaveStatus.PENDING,
            inviterId: leaderId,
            message: dto.message?.trim() || null,
            respondedAt: null,
          },
          include: {
            invitee: { select: userBrief },
            team: { select: { id: true, name: true } },
          },
        })
      : await this.prisma.teamInvitation.create({
          data: {
            teamId: resolvedTeamId,
            inviterId: leaderId,
            inviteeId: dto.inviteeId,
            message: dto.message?.trim() || null,
          },
          include: {
            invitee: { select: userBrief },
            team: { select: { id: true, name: true } },
          },
        });

    await this.audit.log(leaderId, 'TEAM_INVITE_SEND', {
      invitationId: invitation.id,
      inviteeId: dto.inviteeId,
      teamId: resolvedTeamId,
    });
    return invitation;
  }

  async sentInvitations(leaderId: number, teamId?: number) {
    const resolvedTeamId = await this.resolveTeamId(leaderId, teamId);

    return this.prisma.teamInvitation.findMany({
      where: { teamId: resolvedTeamId, inviterId: leaderId },
      include: {
        invitee: { select: userBrief },
        team: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async myInvitations(inviteeId: number) {
    return this.prisma.teamInvitation.findMany({
      where: { inviteeId, status: LeaveStatus.PENDING },
      include: {
        inviter: { select: userBrief },
        team: { select: { id: true, name: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pendingInvitationCount(inviteeId: number) {
    const count = await this.prisma.teamInvitation.count({
      where: { inviteeId, status: LeaveStatus.PENDING },
    });
    return { count };
  }

  async acceptInvitation(inviteeId: number, id: number) {
    const inv = await this.prisma.teamInvitation.findUnique({
      where: { id },
      include: { team: true },
    });
    if (!inv) throw new NotFoundException('邀请不存在');
    if (inv.inviteeId !== inviteeId) throw new ForbiddenException('无权处理该邀请');
    if (inv.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('该邀请已处理');
    }

    const user = await this.prisma.user.findUnique({ where: { id: inviteeId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (await this.teamsService.isTeamMember(inviteeId, inv.teamId)) {
      throw new BadRequestException('您已是该团队成员');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMembership.upsert({
        where: { userId_teamId: { userId: inviteeId, teamId: inv.teamId } },
        create: { userId: inviteeId, teamId: inv.teamId },
        update: {},
      });
      await tx.user.update({
        where: { id: inviteeId },
        data: { teamId: inv.teamId },
      });
      await tx.teamInvitation.update({
        where: { id },
        data: { status: LeaveStatus.APPROVED, respondedAt: new Date() },
      });
    });

    await this.audit.log(inviteeId, 'TEAM_INVITE_ACCEPT', { invitationId: id, teamId: inv.teamId });
    return { success: true, team: inv.team };
  }

  async rejectInvitation(inviteeId: number, id: number) {
    const inv = await this.prisma.teamInvitation.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('邀请不存在');
    if (inv.inviteeId !== inviteeId) throw new ForbiddenException('无权处理该邀请');
    if (inv.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('该邀请已处理');
    }

    await this.prisma.teamInvitation.update({
      where: { id },
      data: { status: LeaveStatus.REJECTED, respondedAt: new Date() },
    });
    await this.audit.log(inviteeId, 'TEAM_INVITE_REJECT', { invitationId: id });
    return { success: true };
  }

  async cancelInvitation(leaderId: number, id: number) {
    const inv = await this.prisma.teamInvitation.findUnique({ where: { id } });
    if (!inv) throw new NotFoundException('邀请不存在');
    if (inv.inviterId !== leaderId) throw new ForbiddenException('只能撤销自己发出的邀请');
    if (inv.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('只能撤销待处理的邀请');
    }

    await this.prisma.teamInvitation.delete({ where: { id } });
    await this.audit.log(leaderId, 'TEAM_INVITE_CANCEL', { invitationId: id });
    return { success: true };
  }

  // ── 团队邀请码 ──

  private async getLeaderTeamId(leaderId: number, teamId?: number) {
    return this.teamsService.resolveLeaderTeamId(leaderId, teamId);
  }

  private async createUniqueInviteCode(teamId: number, creatorId: number) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = randomInviteCode();
      const exists = await this.prisma.teamInviteCode.findUnique({ where: { code } });
      if (!exists) {
        return this.prisma.teamInviteCode.create({
          data: { teamId, creatorId, code },
          include: {
            team: { select: { id: true, name: true } },
            creator: { select: userBrief },
          },
        });
      }
    }
    throw new BadRequestException('邀请码生成失败，请稍后重试');
  }

  async myInviteCode(leaderId: number, teamId?: number) {
    const resolvedTeamId = await this.getLeaderTeamId(leaderId, teamId);
    const active = await this.prisma.teamInviteCode.findFirst({
      where: { teamId: resolvedTeamId, status: TeamInviteCodeStatus.ACTIVE },
      include: {
        team: { select: { id: true, name: true } },
        creator: { select: userBrief },
      },
      orderBy: { createdAt: 'desc' },
    });
    return active;
  }

  async createInviteCode(leaderId: number, teamId?: number) {
    const resolvedTeamId = await this.getLeaderTeamId(leaderId, teamId);
    await this.assertLeaderOfTeam(leaderId, resolvedTeamId);

    const existing = await this.prisma.teamInviteCode.findFirst({
      where: { teamId: resolvedTeamId, status: TeamInviteCodeStatus.ACTIVE },
      include: {
        team: { select: { id: true, name: true } },
        creator: { select: userBrief },
      },
    });
    if (existing) return existing;

    const created = await this.createUniqueInviteCode(resolvedTeamId, leaderId);
    await this.audit.log(leaderId, 'TEAM_INVITE_CODE_CREATE', {
      codeId: created.id,
      teamId: resolvedTeamId,
      code: created.code,
    });
    return created;
  }

  async regenerateInviteCode(leaderId: number, teamId?: number) {
    const resolvedTeamId = await this.getLeaderTeamId(leaderId, teamId);
    await this.assertLeaderOfTeam(leaderId, resolvedTeamId);

    const now = new Date();
    await this.prisma.teamInviteCode.updateMany({
      where: { teamId: resolvedTeamId, status: TeamInviteCodeStatus.ACTIVE },
      data: { status: TeamInviteCodeStatus.DISABLED, disabledAt: now },
    });

    const created = await this.createUniqueInviteCode(resolvedTeamId, leaderId);
    await this.audit.log(leaderId, 'TEAM_INVITE_CODE_REGENERATE', {
      codeId: created.id,
      teamId: resolvedTeamId,
      code: created.code,
    });
    return created;
  }

  async disableInviteCode(leaderId: number, teamId?: number) {
    const resolvedTeamId = await this.getLeaderTeamId(leaderId, teamId);
    await this.assertLeaderOfTeam(leaderId, resolvedTeamId);

    const active = await this.prisma.teamInviteCode.findFirst({
      where: { teamId: resolvedTeamId, status: TeamInviteCodeStatus.ACTIVE },
    });
    if (!active) {
      throw new BadRequestException('当前没有可用的邀请码');
    }

    const updated = await this.prisma.teamInviteCode.update({
      where: { id: active.id },
      data: { status: TeamInviteCodeStatus.DISABLED, disabledAt: new Date() },
    });
    await this.audit.log(leaderId, 'TEAM_INVITE_CODE_DISABLE', {
      codeId: updated.id,
      teamId: resolvedTeamId,
      code: updated.code,
    });
    return { success: true };
  }

  private async findActiveInviteCode(code: string) {
    const normalized = code.trim().toUpperCase();
    const record = await this.prisma.teamInviteCode.findUnique({
      where: { code: normalized },
      include: {
        team: { select: { id: true, name: true, description: true } },
      },
    });
    if (!record || record.status !== TeamInviteCodeStatus.ACTIVE) {
      throw new BadRequestException('邀请码无效或已失效');
    }
    return record;
  }

  async previewInviteCode(code: string) {
    const record = await this.findActiveInviteCode(code);
    const leader = await this.prisma.user.findFirst({
      where: { teamId: record.teamId, role: Role.LEADER, status: UserStatus.ACTIVE },
      select: { id: true, name: true, username: true },
      orderBy: { id: 'asc' },
    });
    return {
      code: record.code,
      team: record.team,
      leader,
    };
  }

  async joinByInviteCode(userId: number, dto: JoinTeamByCodeDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role !== Role.USER) {
      throw new ForbiddenException('仅普通用户可通过邀请码加入团队');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('账号已被禁用');
    }

    const record = await this.findActiveInviteCode(dto.code);
    if (await this.teamsService.isTeamMember(userId, record.teamId)) {
      throw new BadRequestException('您已是该团队成员');
    }

    await this.teamsService.addTeamMember(userId, record.teamId, true);

    await this.audit.log(userId, 'TEAM_INVITE_CODE_JOIN', {
      codeId: record.id,
      teamId: record.teamId,
      code: record.code,
    });
    return { success: true, team: record.team };
  }
}
