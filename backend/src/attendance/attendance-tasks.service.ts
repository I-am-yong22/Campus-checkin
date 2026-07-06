import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceTaskStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AttendanceRuleService } from './attendance-rule.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttendanceTaskDto, UpdateAttendanceTaskDto } from './dto/attendance-task.dto';

@Injectable()
export class AttendanceTasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private ruleService: AttendanceRuleService,
  ) {}

  async list(month?: string) {
    const where: { date?: { startsWith: string } } = {};
    if (month) where.date = { startsWith: month };
    return this.prisma.attendanceTask.findMany({
      where,
      include: {
        publishedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }

  async create(actorId: number, dto: CreateAttendanceTaskDto) {
    const platformRule = await this.ruleService.getPlatformRuleOrThrow();

    const existing = await this.prisma.attendanceTask.findUnique({
      where: { date: dto.date },
    });
    if (existing) throw new ConflictException('当日已有出勤任务');

    const task = await this.prisma.attendanceTask.create({
      data: {
        date: dto.date,
        checkInStart: dto.checkInStart ?? platformRule.startTime,
        lateTime: dto.lateTime ?? platformRule.lateTime,
        checkInEnd: dto.checkInEnd ?? platformRule.endTime,
        checkOutStart: dto.checkOutStart ?? platformRule.checkOutStart,
        checkOutEnd: dto.checkOutEnd ?? platformRule.checkOutEnd,
        note: dto.note,
      },
    });

    await this.audit.log(actorId, 'ATTENDANCE_TASK_CREATE', { taskId: task.id, date: dto.date });
    return task;
  }

  async update(actorId: number, id: number, dto: UpdateAttendanceTaskDto) {
    const task = await this.prisma.attendanceTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('出勤任务不存在');
    if (task.status !== AttendanceTaskStatus.DRAFT) {
      throw new BadRequestException('仅草稿任务可编辑');
    }

    const updated = await this.prisma.attendanceTask.update({
      where: { id },
      data: { ...dto },
    });
    await this.audit.log(actorId, 'ATTENDANCE_TASK_UPDATE', { taskId: id });
    return updated;
  }

  async publish(actorId: number, id: number) {
    const task = await this.prisma.attendanceTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('出勤任务不存在');
    if (task.status === AttendanceTaskStatus.PUBLISHED) {
      throw new BadRequestException('任务已发布');
    }
    if (task.status === AttendanceTaskStatus.CANCELLED) {
      throw new BadRequestException('已取消的任务不能发布');
    }

    const updated = await this.prisma.attendanceTask.update({
      where: { id },
      data: {
        status: AttendanceTaskStatus.PUBLISHED,
        publishedById: actorId,
        publishedAt: new Date(),
      },
      include: { publishedBy: { select: { id: true, name: true } } },
    });
    await this.audit.log(actorId, 'ATTENDANCE_TASK_PUBLISH', { taskId: id, date: task.date });
    return updated;
  }

  async cancel(actorId: number, id: number) {
    const task = await this.prisma.attendanceTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('出勤任务不存在');
    if (task.status === AttendanceTaskStatus.CANCELLED) {
      throw new BadRequestException('任务已取消');
    }

    const updated = await this.prisma.attendanceTask.update({
      where: { id },
      data: { status: AttendanceTaskStatus.CANCELLED },
      include: { publishedBy: { select: { id: true, name: true } } },
    });
    await this.audit.log(actorId, 'ATTENDANCE_TASK_CANCEL', { taskId: id });
    return updated;
  }
}
