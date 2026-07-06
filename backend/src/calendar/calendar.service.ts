import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExemptionDto } from './dto/calendar.dto';

@Injectable()
export class CalendarService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(params: { teamId?: number; from?: string; to?: string }) {
    const where: any = {};
    if (params.teamId !== undefined) {
      where.OR = [{ teamId: null }, { teamId: params.teamId }];
    }
    if (params.from || params.to) {
      where.date = {};
      if (params.from) where.date.gte = params.from;
      if (params.to) where.date.lte = params.to;
    }
    return this.prisma.calendarExemption.findMany({
      where,
      include: { team: { select: { id: true, name: true } } },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }

  async create(actorId: number, dto: CreateExemptionDto) {
    if (dto.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: dto.teamId } });
      if (!team) throw new NotFoundException('团队不存在');
    }
    try {
      const row = await this.prisma.calendarExemption.create({
        data: {
          teamId: dto.teamId ?? null,
          date: dto.date,
          reason: dto.reason?.trim() || null,
        },
        include: { team: { select: { id: true, name: true } } },
      });
      await this.audit.log(actorId, 'CALENDAR_EXEMPTION_CREATE', {
        date: dto.date,
        teamId: dto.teamId ?? null,
        reason: dto.reason,
      });
      return row;
    } catch {
      throw new BadRequestException('该日期休息日已存在');
    }
  }

  async remove(actorId: number, id: number) {
    const row = await this.prisma.calendarExemption.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('休息日记录不存在');
    await this.prisma.calendarExemption.delete({ where: { id } });
    await this.audit.log(actorId, 'CALENDAR_EXEMPTION_DELETE', {
      date: row.date,
      teamId: row.teamId,
    });
    return { success: true };
  }

  assertTeamAccess(requester: { role: Role; teamId: number | null }, teamId?: number) {
    if (requester.role === Role.LEADER) {
      if (!requester.teamId || teamId !== requester.teamId) {
        throw new BadRequestException('只能查看本团队休息日');
      }
    }
  }
}
