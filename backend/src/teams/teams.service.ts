import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeaveStatus, Role, UserStatus } from '@prisma/client';
import {
  AttendanceStatus,
  loadTeamAttendanceContext,
  resolveAttendanceStatus,
} from '../common/attendance';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { todayStr } from '../common/datetime';
import { maskCheckInWorkHours } from '../common/work-hours';
import { CreateTeamDto, UpdateRuleDto, UpdateTeamDto } from './dto/teams.dto';

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async listManagedTeams(leaderId: number) {
    const teamIds = await this.getManagedTeamIds(leaderId);
    if (teamIds.length === 0) return [];

    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { memberships: true } },
      },
    });
    const byId = new Map(teams.map((t) => [t.id, t]));
    return teamIds
      .map((id) => {
        const t = byId.get(id);
        if (!t) return null;
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          memberCount: t._count.memberships,
        };
      })
      .filter((t): t is NonNullable<typeof t> => !!t);
  }

  async getManagedTeamIds(leaderId: number): Promise<number[]> {
    const rows = await this.prisma.teamCreationRequest.findMany({
      where: {
        applicantId: leaderId,
        status: LeaveStatus.APPROVED,
        teamId: { not: null },
      },
      select: { teamId: true },
      orderBy: [{ reviewedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => r.teamId!);
  }

  async assertLeaderManagesTeam(leaderId: number, teamId: number) {
    const managed = await this.getManagedTeamIds(leaderId);
    if (!managed.includes(teamId)) {
      throw new ForbiddenException('您无权管理该团队');
    }
  }

  async resolveLeaderTeamId(leaderId: number, teamId?: number): Promise<number> {
    const managed = await this.getManagedTeamIds(leaderId);
    if (managed.length === 0) {
      throw new BadRequestException('您尚未创建团队');
    }
    if (teamId != null) {
      if (!managed.includes(teamId)) {
        throw new ForbiddenException('您无权管理该团队');
      }
      return teamId;
    }
    const leader = await this.prisma.user.findUnique({ where: { id: leaderId } });
    if (leader?.teamId && managed.includes(leader.teamId)) {
      return leader.teamId;
    }
    return managed[0];
  }

  async getMemberTeamIds(userId: number): Promise<number[]> {
    const rows = await this.prisma.teamMembership.findMany({
      where: { userId },
      select: { teamId: true },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((r) => r.teamId);
  }

  async isTeamMember(userId: number, teamId: number) {
    const row = await this.prisma.teamMembership.findUnique({
      where: { userId_teamId: { userId, teamId } },
    });
    return !!row;
  }

  async assertTeamAccess(userId: number, role: Role, teamId: number) {
    if (role === Role.LEADER) {
      const managed = await this.getManagedTeamIds(userId);
      if (managed.includes(teamId)) return;
    }
    if (await this.isTeamMember(userId, teamId)) return;
    throw new ForbiddenException('您无权访问该团队');
  }

  async countTeamMembers(teamId: number) {
    return this.prisma.teamMembership.count({ where: { teamId } });
  }

  async addTeamMember(userId: number, teamId: number, activate = true) {
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMembership.upsert({
        where: { userId_teamId: { userId, teamId } },
        create: { userId, teamId },
        update: {},
      });
      if (activate) {
        await tx.user.update({ where: { id: userId }, data: { teamId } });
      }
    });
  }

  async resolveUserTeamId(userId: number, role: Role, teamId?: number): Promise<number | null> {
    if (role === Role.LEADER) {
      try {
        return await this.resolveLeaderTeamId(userId, teamId);
      } catch (e) {
        if (e instanceof BadRequestException) return null;
        throw e;
      }
    }
    if (role === Role.USER) {
      const memberOf = await this.getMemberTeamIds(userId);
      if (memberOf.length === 0) return null;
      if (teamId != null) {
        if (!memberOf.includes(teamId)) {
          throw new ForbiddenException('您不在该团队中');
        }
        return teamId;
      }
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.teamId && memberOf.includes(user.teamId)) return user.teamId;
      return memberOf[0];
    }
    return teamId ?? null;
  }

  async listMyTeams(userId: number, role: Role) {
    const memberRows = await this.prisma.teamMembership.findMany({
      where: { userId },
      include: { team: { select: { id: true, name: true, description: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    const byId = new Map<
      number,
      { id: number; name: string; description: string | null; memberCount: number; isOwner: boolean; isMember: boolean }
    >();

    for (const row of memberRows) {
      byId.set(row.teamId, {
        id: row.team.id,
        name: row.team.name,
        description: row.team.description,
        memberCount: await this.countTeamMembers(row.teamId),
        isOwner: false,
        isMember: true,
      });
    }

    if (role === Role.LEADER) {
      for (const tid of await this.getManagedTeamIds(userId)) {
        if (byId.has(tid)) {
          byId.get(tid)!.isOwner = true;
        } else {
          const team = await this.prisma.team.findUnique({
            where: { id: tid },
            select: { id: true, name: true, description: true },
          });
          if (team) {
            byId.set(tid, {
              id: team.id,
              name: team.name,
              description: team.description,
              memberCount: await this.countTeamMembers(tid),
              isOwner: true,
              isMember: false,
            });
          }
        }
      }
    }

    return Array.from(byId.values());
  }

  async setActiveTeam(userId: number, role: Role, teamId: number) {
    await this.assertTeamAccess(userId, role, teamId);
    await this.prisma.user.update({ where: { id: userId }, data: { teamId } });
    return { success: true, teamId };
  }

  private memberUsersWhere(teamId: number) {
    return {
      status: UserStatus.ACTIVE,
      role: { in: [Role.USER, Role.LEADER] as Role[] },
      teamMemberships: { some: { teamId } },
    };
  }

  private async fetchTeamMembers(teamId: number, withPhone = false) {
    return this.prisma.user.findMany({
      where: this.memberUsersWhere(teamId),
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        faceRegistered: true,
        avatarUrl: true,
        ...(withPhone ? { phone: true } : {}),
      },
      orderBy: [{ role: 'desc' }, { name: 'asc' }],
    });
  }

  async list() {
    const teams = await this.prisma.team.findMany({
      orderBy: { id: 'asc' },
      include: {
        checkInRule: true,
        _count: { select: { memberships: true } },
      },
    });
    return teams.map((t) => ({
      ...t,
      memberCount: t._count.memberships,
    }));
  }

  async create(dto: CreateTeamDto) {
    const exists = await this.prisma.team.findUnique({ where: { name: dto.name } });
    if (exists) throw new BadRequestException('团队名称已存在');
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        checkInRule: { create: {} },
      },
      include: { checkInRule: true },
    });
    return team;
  }

  async update(id: number, dto: UpdateTeamDto) {
    await this.ensureTeam(id);
    return this.prisma.team.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.ensureTeam(id);
    const memberCount = await this.countTeamMembers(id);
    if (memberCount > 0) {
      throw new BadRequestException('该团队下还有成员，请先移除成员再删除');
    }
    await this.prisma.team.delete({ where: { id } });
    return { success: true };
  }

  async updateRule(teamId: number, actorId: number, dto: UpdateRuleDto) {
    await this.ensureTeam(teamId);
    const rule = await this.prisma.checkInRule.upsert({
      where: { teamId },
      update: { ...dto },
      create: { teamId, ...dto },
    });
    await this.audit.log(actorId, 'CHECKIN_RULE_UPDATE', { teamId, ...dto });
    return rule;
  }

  async membersOverview(
    requester: { id: number; role: Role; teamId: number | null },
    teamId?: number,
    date?: string,
  ) {
    const dateStr = date || todayStr();
    let resolvedTeamId = teamId;

    if (requester.role === Role.LEADER) {
      try {
        resolvedTeamId = await this.resolveLeaderTeamId(requester.id, teamId);
      } catch (e) {
        if (e instanceof BadRequestException) {
          return {
            date: dateStr,
            team: null,
            summary: { total: 0, checkedIn: 0, late: 0, makeup: 0, onLeave: 0, absent: 0, exempt: 0 },
            members: [],
          };
        }
        throw e;
      }
    } else if (requester.role === Role.USER) {
      resolvedTeamId = (await this.resolveUserTeamId(requester.id, requester.role, teamId)) ?? undefined;
      if (!resolvedTeamId) {
        return {
          date: dateStr,
          team: null,
          summary: { total: 0, checkedIn: 0, late: 0, makeup: 0, onLeave: 0, absent: 0, exempt: 0 },
          members: [],
        };
      }
    } else if (!resolvedTeamId) {
      throw new BadRequestException('请选择团队');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: resolvedTeamId },
      include: { checkInRule: true },
    });
    if (!team) throw new NotFoundException('团队不存在');

    const members = await this.fetchTeamMembers(resolvedTeamId!, true);

    const userIds = members.map((m) => m.id);
    const ctxMap = await loadTeamAttendanceContext(this.prisma, resolvedTeamId!, dateStr, userIds);

    const rows = members.map((m) => {
      const ctx = ctxMap.get(m.id)!;
      const attendanceStatus = resolveAttendanceStatus(ctx);
      return {
        ...m,
        checkedIn:
          attendanceStatus === 'ON_DUTY' ||
          attendanceStatus === 'COMPLETED' ||
          attendanceStatus === 'MAKEUP',
        attendanceStatus,
        checkIn: maskCheckInWorkHours(ctx.checkIn, m.id, requester),
        onLeave: ctx.onLeave,
        leaveReason: ctx.leaveReason,
        exempt: ctx.exempt,
        exemptReason: ctx.exemptReason,
      };
    });

    const countBy = (s: AttendanceStatus) => rows.filter((r) => r.attendanceStatus === s).length;
    const lateCount = rows.filter(
      (r) => r.checkIn?.status === 'LATE' && (r.attendanceStatus === 'ON_DUTY' || r.attendanceStatus === 'COMPLETED'),
    ).length;

    return {
      date: dateStr,
      team: { id: team.id, name: team.name, checkInRule: team.checkInRule },
      summary: {
        total: members.length,
        checkedIn: countBy('ON_DUTY') + countBy('COMPLETED') + countBy('MAKEUP'),
        onDuty: countBy('ON_DUTY'),
        completed: countBy('COMPLETED'),
        late: lateCount,
        makeup: countBy('MAKEUP'),
        onLeave: countBy('ON_LEAVE'),
        absent: countBy('ABSENT'),
        exempt: countBy('EXEMPT'),
      },
      members: rows,
    };
  }

  async peers(
    requester: { id: number; role: Role; teamId: number | null },
    teamId?: number,
  ) {
    let resolvedTeamId: number | null = null;

    if (requester.role === Role.LEADER) {
      try {
        resolvedTeamId = await this.resolveLeaderTeamId(requester.id, teamId);
      } catch (e) {
        if (e instanceof BadRequestException) {
          return { team: null, members: [] };
        }
        throw e;
      }
    } else if (requester.role === Role.USER) {
      resolvedTeamId = await this.resolveUserTeamId(requester.id, requester.role, teamId);
    } else {
      resolvedTeamId = teamId ?? requester.teamId;
    }

    if (!resolvedTeamId) {
      return { team: null, members: [] };
    }

    await this.assertTeamAccess(requester.id, requester.role, resolvedTeamId);

    const team = await this.prisma.team.findUnique({
      where: { id: resolvedTeamId },
      select: { id: true, name: true, description: true },
    });
    if (!team) {
      return { team: null, members: [] };
    }

    const members = await this.fetchTeamMembers(resolvedTeamId);

    return { team, members };
  }

  /** 普通用户主动退出指定团队 */
  async leaveTeam(userId: number, teamId?: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.role !== Role.USER) {
      throw new ForbiddenException('仅普通用户可自行退出团队');
    }

    const resolvedTeamId = teamId ?? user.teamId;
    if (!resolvedTeamId) {
      throw new BadRequestException('请指定要退出的团队');
    }
    if (!(await this.isTeamMember(userId, resolvedTeamId))) {
      throw new BadRequestException('您不在该团队中');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: resolvedTeamId },
      select: { id: true, name: true },
    });

    await this.detachUserFromTeam(userId, resolvedTeamId);

    await this.audit.log(userId, 'TEAM_LEAVE', { teamId: resolvedTeamId, teamName: team?.name });
    return { success: true, team };
  }

  /** 负责人将学员移出团队 */
  async removeMember(leaderId: number, memberUserId: number, teamId?: number) {
    const leader = await this.prisma.user.findUnique({ where: { id: leaderId } });
    if (!leader || leader.role !== Role.LEADER) {
      throw new ForbiddenException('仅项目负责人可移除成员');
    }
    if ((await this.getManagedTeamIds(leaderId)).length === 0) {
      throw new BadRequestException('您尚未创建团队');
    }
    if (leaderId === memberUserId) {
      throw new BadRequestException('不能移除自己');
    }

    const resolvedTeamId = await this.resolveLeaderTeamId(leaderId, teamId);

    const member = await this.prisma.user.findUnique({ where: { id: memberUserId } });
    if (!member) throw new NotFoundException('用户不存在');
    if (member.role !== Role.USER) {
      throw new BadRequestException('只能移除普通学员');
    }
    if (!(await this.isTeamMember(memberUserId, resolvedTeamId))) {
      throw new BadRequestException('该用户不在该团队中');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: resolvedTeamId },
      select: { id: true, name: true },
    });

    await this.detachUserFromTeam(memberUserId, resolvedTeamId);

    await this.audit.log(leaderId, 'TEAM_MEMBER_REMOVE', {
      targetUserId: memberUserId,
      targetUserName: member.name,
      teamId: resolvedTeamId,
      teamName: team?.name,
    });
    return { success: true };
  }

  private async detachUserFromTeam(userId: number, teamId: number) {
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMembership.deleteMany({ where: { userId, teamId } });
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user?.teamId === teamId) {
        const next = await tx.teamMembership.findFirst({
          where: { userId },
          orderBy: { joinedAt: 'asc' },
        });
        await tx.user.update({
          where: { id: userId },
          data: { teamId: next?.teamId ?? null },
        });
      }
      await tx.teamInvitation.deleteMany({ where: { inviteeId: userId, teamId } });
    });
  }

  private async ensureTeam(id: number) {
    const t = await this.prisma.team.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('团队不存在');
    return t;
  }
}
