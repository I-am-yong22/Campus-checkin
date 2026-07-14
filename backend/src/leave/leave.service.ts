import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveReviewTarget, LeaveStatus, Role } from '@prisma/client';
import {
  buildHourlyLeaveRange,
  LEAVE_TIME_ACTION,
  LeaveTimeMeta,
  loadLeaveTimeMetaByLeaveIds,
  parseLeaveDuration,
} from '../common/leave-time';
import {
  buildEffectiveLeaveIntervals,
  buildWriteOffDates,
  detectWriteOffScenario,
  intervalsOverlap,
  LEAVE_WRITEOFF_ACTION,
  LeaveWriteOffRecord,
  loadWriteOffsByLeaveIds,
  mergeLeaveIntervals,
} from '../common/leave-writeoff';
import { todayStr } from '../common/datetime';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLeaveDto, ReviewLeaveDto } from './dto/leave.dto';

const userSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  teamId: true,
  team: { select: { id: true, name: true } },
} as const;

type LeaveRow = {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  type: string;
  reason: string;
  reviewTarget: LeaveReviewTarget;
  status: LeaveStatus;
  reviewerId: number | null;
  reviewComment: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: number; name: string; username: string; role: Role; teamId: number | null; team: { id: number; name: string } | null };
  reviewer?: { id: number; name: string } | null;
};

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private validateDateRange(startDate: string, endDate: string) {
    if (startDate > endDate) {
      throw new BadRequestException('结束日期不能早于开始日期');
    }
  }

  private resolveLeaveMode(dto: CreateLeaveDto): 'FULL_DAY' | 'HOURLY' {
    if (dto.startDate !== dto.endDate) {
      if (dto.leaveMode === 'HOURLY') {
        throw new BadRequestException('多日请假仅支持整天请假');
      }
      return 'FULL_DAY';
    }
    return dto.leaveMode === 'HOURLY' ? 'HOURLY' : 'FULL_DAY';
  }

  private buildTimeMetaForCreate(
    leaveId: number,
    dto: CreateLeaveDto,
    mode: 'FULL_DAY' | 'HOURLY',
  ): LeaveTimeMeta {
    if (mode === 'FULL_DAY') {
      return { leaveId, mode: 'FULL_DAY' };
    }
    if (!dto.startTime) {
      throw new BadRequestException('按小时请假请选择开始时刻');
    }
    const durationMinutes = parseLeaveDuration(
      dto.durationHours ?? 0,
      dto.durationMinutes ?? 0,
    );
    if (durationMinutes < 60) {
      throw new BadRequestException('按小时请假最少 1 小时');
    }
    const { leaveStartAt, leaveEndAt } = buildHourlyLeaveRange(
      dto.startDate,
      dto.startTime,
      durationMinutes,
    );
    return {
      leaveId,
      mode: 'HOURLY',
      startTime: dto.startTime,
      durationMinutes,
      leaveStartAt: leaveStartAt.toISOString(),
      leaveEndAt: leaveEndAt.toISOString(),
    };
  }

  private async assertNoTimeOverlap(
    userId: number,
    newIntervals: { start: Date; end: Date }[],
    excludeLeaveId?: number,
  ) {
    const existing = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        ...(excludeLeaveId ? { id: { not: excludeLeaveId } } : {}),
      },
      select: { id: true, startDate: true, endDate: true },
    });
    if (existing.length === 0) return;

    const leaveIds = existing.map((l) => l.id);
    const [timeMetaMap, writeOffMap] = await Promise.all([
      loadLeaveTimeMetaByLeaveIds(this.prisma, leaveIds),
      loadWriteOffsByLeaveIds(this.prisma, leaveIds),
    ]);

    const existingIntervals = mergeLeaveIntervals(
      existing.flatMap((l) =>
        buildEffectiveLeaveIntervals(
          l,
          timeMetaMap.get(l.id),
          writeOffMap.get(l.id),
        ),
      ),
    );

    for (const ni of newIntervals) {
      for (const ei of existingIntervals) {
        if (intervalsOverlap(ni, ei)) {
          throw new BadRequestException('该时间段与已有请假（待审/已通过）重叠，请调整');
        }
      }
    }
  }

  private async enrichLeaves<T extends LeaveRow>(rows: T[]) {
    const leaveIds = rows.map((r) => r.id);
    const [timeMetaMap, writeOffMap] = await Promise.all([
      loadLeaveTimeMetaByLeaveIds(this.prisma, leaveIds),
      loadWriteOffsByLeaveIds(this.prisma, leaveIds),
    ]);
    return rows.map((r) => ({
      ...r,
      timeMeta: timeMetaMap.get(r.id) ?? { leaveId: r.id, mode: 'FULL_DAY' as const },
      writeOff: writeOffMap.get(r.id) ?? null,
    }));
  }

  async create(userId: number, applicantRole: Role, dto: CreateLeaveDto) {
    this.validateDateRange(dto.startDate, dto.endDate);
    const mode = this.resolveLeaveMode(dto);

    const applicant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });
    if (!applicant) throw new NotFoundException('用户不存在');

    const reviewTarget = this.resolveReviewTarget(applicantRole, applicant.teamId, dto);
    const draftMeta = this.buildTimeMetaForCreate(0, dto, mode);
    const draftIntervals = buildEffectiveLeaveIntervals(
      { id: 0, startDate: dto.startDate, endDate: dto.endDate },
      draftMeta,
      null,
    );
    await this.assertNoTimeOverlap(userId, draftIntervals);

    const leave = await this.prisma.leaveRequest.create({
      data: {
        userId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        type: dto.type?.trim() || '事假',
        reason: dto.reason.trim(),
        reviewTarget,
      },
      include: { user: { select: userSelect } },
    });

    const timeMeta = this.buildTimeMetaForCreate(leave.id, dto, mode);
    await this.audit.log(userId, LEAVE_TIME_ACTION, {
      leaveId: leave.id,
      mode: timeMeta.mode,
      startTime: timeMeta.startTime,
      durationMinutes: timeMeta.durationMinutes,
      leaveStartAt: timeMeta.leaveStartAt,
      leaveEndAt: timeMeta.leaveEndAt,
    });

    return {
      ...leave,
      timeMeta,
      writeOff: null,
    };
  }

  async mine(userId: number) {
    const rows = await this.prisma.leaveRequest.findMany({
      where: { userId },
      include: {
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return this.enrichLeaves(rows);
  }

  async pendingForReview(requester: { id: number; role: Role; teamId: number | null }) {
    let rows: LeaveRow[] = [];
    if (requester.role === Role.LEADER) {
      if (!requester.teamId) return [];
      rows = await this.prisma.leaveRequest.findMany({
        where: {
          status: LeaveStatus.PENDING,
          reviewTarget: LeaveReviewTarget.LEADER,
          user: {
            teamId: requester.teamId,
            id: { not: requester.id },
          },
        },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'asc' },
      });
    } else if (requester.role === Role.ADMIN) {
      rows = await this.prisma.leaveRequest.findMany({
        where: {
          status: LeaveStatus.PENDING,
          reviewTarget: LeaveReviewTarget.ADMIN,
        },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'asc' },
      });
    }
    return this.enrichLeaves(rows);
  }

  async pendingCount(requester: { id: number; role: Role; teamId: number | null }) {
    const list = await this.pendingForReview(requester);
    return { count: list.length };
  }

  async reviewHistory(requester: { id: number; role: Role; teamId: number | null }) {
    let rows: LeaveRow[] = [];
    if (requester.role === Role.LEADER) {
      if (!requester.teamId) return [];
      rows = await this.prisma.leaveRequest.findMany({
        where: {
          reviewTarget: LeaveReviewTarget.LEADER,
          status: { in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED] },
          user: { teamId: requester.teamId },
        },
        include: {
          user: { select: userSelect },
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { reviewedAt: 'desc' },
        take: 50,
      });
    } else if (requester.role === Role.ADMIN) {
      rows = await this.prisma.leaveRequest.findMany({
        where: {
          reviewTarget: LeaveReviewTarget.ADMIN,
          status: { in: [LeaveStatus.APPROVED, LeaveStatus.REJECTED] },
        },
        include: {
          user: { select: userSelect },
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { reviewedAt: 'desc' },
        take: 50,
      });
    }
    return this.enrichLeaves(rows);
  }

  private resolveReviewTarget(
    applicantRole: Role,
    applicantTeamId: number | null,
    dto: CreateLeaveDto,
  ): LeaveReviewTarget {
    if (applicantRole === Role.LEADER) {
      return LeaveReviewTarget.ADMIN;
    }

    if (!dto.reviewTarget) {
      throw new BadRequestException('请选择审批人：项目负责人或管理员');
    }

    if (dto.reviewTarget === 'LEADER') {
      if (!applicantTeamId) {
        throw new BadRequestException('您未加入团队，请选择「管理员」审批');
      }
      return LeaveReviewTarget.LEADER;
    }

    return LeaveReviewTarget.ADMIN;
  }

  private assertCanReview(
    requester: { id: number; role: Role; teamId: number | null },
    leave: { userId: number; reviewTarget: LeaveReviewTarget; user: { teamId: number | null } },
  ) {
    if (leave.userId === requester.id) {
      throw new ForbiddenException('不能审核自己的请假申请');
    }

    if (leave.reviewTarget === LeaveReviewTarget.LEADER) {
      if (requester.role !== Role.LEADER) {
        throw new ForbiddenException('该申请由项目负责人审批');
      }
      if (!requester.teamId || leave.user.teamId !== requester.teamId) {
        throw new ForbiddenException('只能审核本团队成员的请假');
      }
      return;
    }

    if (requester.role !== Role.ADMIN) {
      throw new ForbiddenException('该申请由管理员审批');
    }
  }

  private assertCanWriteOff(
    requester: { id: number; role: Role; teamId: number | null },
    leave: { userId: number; reviewTarget: LeaveReviewTarget; user: { teamId: number | null } },
  ) {
    this.assertCanReview(requester, leave);
  }

  async review(
    requester: { id: number; role: Role; teamId: number | null },
    id: number,
    dto: ReviewLeaveDto,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!leave) throw new NotFoundException('请假记录不存在');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('该申请已处理，无法重复审核');
    }

    this.assertCanReview(requester, leave);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: dto.status,
        reviewerId: requester.id,
        reviewComment: dto.reviewComment?.trim() || null,
        reviewedAt: new Date(),
      },
      include: {
        user: { select: userSelect },
        reviewer: { select: { id: true, name: true } },
      },
    });

    await this.audit.log(requester.id, 'LEAVE_REVIEW', {
      leaveId: id,
      targetUserId: leave.userId,
      status: dto.status,
      reviewComment: dto.reviewComment,
    });

    const [enriched] = await this.enrichLeaves([updated]);
    return enriched;
  }

  async writeOff(
    requester: { id: number; role: Role; teamId: number | null },
    id: number,
  ) {
    const leave = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!leave) throw new NotFoundException('请假记录不存在');
    if (leave.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException('仅已通过的请假可核销');
    }

    this.assertCanWriteOff(requester, leave);

    const existing = await loadWriteOffsByLeaveIds(this.prisma, [id]);
    if (existing.has(id)) {
      throw new BadRequestException('该请假已核销，不可重复操作');
    }

    const { writeOffAt, writeOffDate } = buildWriteOffDates();
    if (writeOffDate < leave.startDate) {
      throw new BadRequestException('尚未到请假开始日，暂不可核销');
    }

    const scenario = detectWriteOffScenario(leave.startDate, writeOffDate);
    await this.audit.log(requester.id, LEAVE_WRITEOFF_ACTION, {
      leaveId: id,
      targetUserId: leave.userId,
      writeOffAt,
      writeOffDate,
      scenario,
      startDate: leave.startDate,
      endDate: leave.endDate,
    });

    const writeOff: LeaveWriteOffRecord = {
      leaveId: id,
      writeOffAt,
      writeOffDate,
      scenario,
      operatorId: requester.id,
    };

    const [timeMetaMap] = await Promise.all([
      loadLeaveTimeMetaByLeaveIds(this.prisma, [id]),
    ]);

    return {
      ...leave,
      timeMeta: timeMetaMap.get(id) ?? { leaveId: id, mode: 'FULL_DAY' as const },
      writeOff,
    };
  }

  async cancel(userId: number, id: number) {
    const leave = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) throw new NotFoundException('请假记录不存在');
    if (leave.userId !== userId) throw new ForbiddenException('只能撤销自己的申请');
    if (leave.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('仅待审核的申请可撤销');
    }
    await this.prisma.leaveRequest.delete({ where: { id } });
    return { success: true };
  }
}
