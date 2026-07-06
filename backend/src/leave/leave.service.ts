import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveReviewTarget, LeaveStatus, Role } from '@prisma/client';
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

  private async assertNoOverlap(userId: number, startDate: string, endDate: string) {
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new BadRequestException('该时间段与已有请假（待审/已通过）重叠，请调整日期');
    }
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

  async create(userId: number, applicantRole: Role, dto: CreateLeaveDto) {
    this.validateDateRange(dto.startDate, dto.endDate);
    await this.assertNoOverlap(userId, dto.startDate, dto.endDate);

    const applicant = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });
    if (!applicant) throw new NotFoundException('用户不存在');

    const reviewTarget = this.resolveReviewTarget(applicantRole, applicant.teamId, dto);

    return this.prisma.leaveRequest.create({
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
  }

  async mine(userId: number) {
    return this.prisma.leaveRequest.findMany({
      where: { userId },
      include: {
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pendingForReview(requester: { id: number; role: Role; teamId: number | null }) {
    if (requester.role === Role.LEADER) {
      if (!requester.teamId) return [];
      return this.prisma.leaveRequest.findMany({
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
    }

    if (requester.role === Role.ADMIN) {
      return this.prisma.leaveRequest.findMany({
        where: {
          status: LeaveStatus.PENDING,
          reviewTarget: LeaveReviewTarget.ADMIN,
        },
        include: { user: { select: userSelect } },
        orderBy: { createdAt: 'asc' },
      });
    }

    return [];
  }

  async pendingCount(requester: { id: number; role: Role; teamId: number | null }) {
    const list = await this.pendingForReview(requester);
    return { count: list.length };
  }

  async reviewHistory(requester: { id: number; role: Role; teamId: number | null }) {
    if (requester.role === Role.LEADER) {
      if (!requester.teamId) return [];
      return this.prisma.leaveRequest.findMany({
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
    }

    if (requester.role === Role.ADMIN) {
      return this.prisma.leaveRequest.findMany({
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

    return [];
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

    return updated;
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
