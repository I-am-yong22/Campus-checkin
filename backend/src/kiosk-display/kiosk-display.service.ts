import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SaveBirthdayDto,
  SaveCarouselSlideDto,
  SaveCountdownDto,
  SaveMissionBoardDto,
} from './dto/kiosk-display.dto';

function todayStrShanghai(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function nowTimeStrShanghai(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);
}

@Injectable()
export class KioskDisplayService {
  constructor(private prisma: PrismaService) {}

  /** 打卡机待机轮播内容（无需登录） */
  async standbyPayload() {
    const date = todayStrShanghai();
    const time = nowTimeStrShanghai();

    const [carousel, countdowns, boards, birthdays] = await Promise.all([
      this.prisma.kioskCarouselSlide.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.kioskCountdown.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.kioskMissionBoard.findMany({
        where: { enabled: true },
        include: {
          team: { select: { id: true, name: true } },
          gaps: { orderBy: { sortOrder: 'asc' } },
          progress: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.kioskBirthdayShow.findMany({
        where: { date, enabled: true },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const activeBirthdays = birthdays.filter((b) => time >= b.startTime);

    return {
      date,
      time,
      carousel: carousel.map((s) => ({
        id: s.id,
        title: s.title,
        imageUrl: s.imageUrl,
      })),
      countdowns: countdowns.map((c) => ({
        id: c.id,
        title: c.title,
        targetAt: c.targetAt.toISOString(),
      })),
      missionBoards: boards.map((b) => ({
        id: b.id,
        teamId: b.teamId,
        teamName: b.team?.name ?? null,
        title: b.title,
        deadlineAt: b.deadlineAt?.toISOString() ?? null,
        headline: b.headline,
        gaps: b.gaps.map((g) => ({
          deliverable: g.deliverable,
          assignees: g.assignees,
        })),
        progress: b.progress.map((p) => ({ label: p.label, percent: p.percent })),
      })),
      birthdays: activeBirthdays.map((b) => ({
        id: b.id,
        userName: b.user.name,
        message: b.message,
        startTime: b.startTime,
      })),
    };
  }

  async listCarousel() {
    return this.prisma.kioskCarouselSlide.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async saveCarousel(dto: SaveCarouselSlideDto) {
    if (dto.id) {
      return this.prisma.kioskCarouselSlide.update({
        where: { id: dto.id },
        data: {
          title: dto.title,
          imageUrl: dto.imageUrl,
          sortOrder: dto.sortOrder,
          enabled: dto.enabled,
        },
      });
    }
    return this.prisma.kioskCarouselSlide.create({
      data: {
        title: dto.title ?? '轮播图',
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async deleteCarousel(id: number) {
    await this.prisma.kioskCarouselSlide.delete({ where: { id } });
    return { success: true };
  }

  async listCountdowns() {
    return this.prisma.kioskCountdown.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async saveCountdown(dto: SaveCountdownDto) {
    const targetAt = new Date(dto.targetAt);
    if (dto.id) {
      return this.prisma.kioskCountdown.update({
        where: { id: dto.id },
        data: {
          title: dto.title,
          targetAt,
          sortOrder: dto.sortOrder,
          enabled: dto.enabled,
        },
      });
    }
    return this.prisma.kioskCountdown.create({
      data: {
        title: dto.title,
        targetAt,
        sortOrder: dto.sortOrder ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async deleteCountdown(id: number) {
    await this.prisma.kioskCountdown.delete({ where: { id } });
    return { success: true };
  }

  async listMissionBoards() {
    return this.prisma.kioskMissionBoard.findMany({
      include: {
        team: { select: { id: true, name: true } },
        gaps: { orderBy: { sortOrder: 'asc' } },
        progress: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async saveMissionBoard(dto: SaveMissionBoardDto) {
    const deadlineAt = dto.deadlineAt ? new Date(dto.deadlineAt) : null;
    const gaps = dto.gaps ?? [];
    const progress = dto.progress ?? [];

    if (dto.id) {
      const exists = await this.prisma.kioskMissionBoard.findUnique({ where: { id: dto.id } });
      if (!exists) throw new NotFoundException('看板不存在');
      await this.prisma.kioskMissionGap.deleteMany({ where: { boardId: dto.id } });
      await this.prisma.kioskMissionProgress.deleteMany({ where: { boardId: dto.id } });
      return this.prisma.kioskMissionBoard.update({
        where: { id: dto.id },
        data: {
          teamId: dto.teamId ?? null,
          title: dto.title,
          deadlineAt,
          headline: dto.headline,
          sortOrder: dto.sortOrder,
          enabled: dto.enabled,
          gaps: {
            create: gaps.map((g, i) => ({
              deliverable: g.deliverable,
              assignees: g.assignees,
              sortOrder: g.sortOrder ?? i,
            })),
          },
          progress: {
            create: progress.map((p, i) => ({
              label: p.label,
              percent: p.percent,
              sortOrder: p.sortOrder ?? i,
            })),
          },
        },
        include: { gaps: true, progress: true, team: true },
      });
    }

    return this.prisma.kioskMissionBoard.create({
      data: {
        teamId: dto.teamId ?? null,
        title: dto.title,
        deadlineAt,
        headline: dto.headline,
        sortOrder: dto.sortOrder ?? 0,
        enabled: dto.enabled ?? true,
        gaps: {
          create: gaps.map((g, i) => ({
            deliverable: g.deliverable,
            assignees: g.assignees,
            sortOrder: g.sortOrder ?? i,
          })),
        },
        progress: {
          create: progress.map((p, i) => ({
            label: p.label,
            percent: p.percent,
            sortOrder: p.sortOrder ?? i,
          })),
        },
      },
      include: { gaps: true, progress: true, team: true },
    });
  }

  async deleteMissionBoard(id: number) {
    await this.prisma.kioskMissionBoard.delete({ where: { id } });
    return { success: true };
  }

  async listBirthdays(month?: string) {
    const m = month || todayStrShanghai().slice(0, 7);
    return this.prisma.kioskBirthdayShow.findMany({
      where: { date: { startsWith: m } },
      include: { user: { select: { id: true, name: true, username: true } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async saveBirthday(dto: SaveBirthdayDto) {
    if (dto.id) {
      return this.prisma.kioskBirthdayShow.update({
        where: { id: dto.id },
        data: {
          userId: dto.userId,
          date: dto.date,
          startTime: dto.startTime,
          message: dto.message,
          enabled: dto.enabled,
        },
        include: { user: { select: { id: true, name: true } } },
      });
    }
    return this.prisma.kioskBirthdayShow.create({
      data: {
        userId: dto.userId,
        date: dto.date,
        startTime: dto.startTime,
        message: dto.message,
        enabled: dto.enabled ?? true,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async deleteBirthday(id: number) {
    await this.prisma.kioskBirthdayShow.delete({ where: { id } });
    return { success: true };
  }
}
