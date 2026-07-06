import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, ImportUsersDto, UpdateUserDto } from './dto/users.dto';

const DEFAULT_PASSWORD = '123456';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async list(params: { role?: Role; teamId?: number; keyword?: string; page?: number; pageSize?: number }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;
    const where: Prisma.UserWhereInput = {};
    if (params.role) where.role = params.role;
    if (params.teamId) where.teamId = Number(params.teamId);
    if (params.keyword) {
      where.OR = [
        { username: { contains: params.keyword } },
        { name: { contains: params.keyword } },
      ];
    }
    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { team: true },
        orderBy: { id: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: items.map((u) => this.sanitize(u)) };
  }

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) {
      throw new BadRequestException(`用户名 ${dto.username} 已存在`);
    }
    if (dto.teamId) {
      await this.ensureTeam(dto.teamId);
    }
    const passwordHash = await bcrypt.hash(dto.password || DEFAULT_PASSWORD, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        name: dto.name,
        role: dto.role || Role.USER,
        teamId: dto.teamId ?? null,
        phone: dto.phone,
        passwordHash,
        mustChangePassword: true,
        faceRegistered: false,
      },
      include: { team: true },
    });
    return { ...this.sanitize(user), initialPassword: dto.password || DEFAULT_PASSWORD };
  }

  async importMany(dto: ImportUsersDto) {
    const results: { username: string; success: boolean; message?: string; initialPassword?: string }[] = [];
    for (const u of dto.users) {
      try {
        const created = await this.create(u);
        results.push({ username: u.username, success: true, initialPassword: created.initialPassword });
      } catch (e: any) {
        results.push({ username: u.username, success: false, message: e?.message || '导入失败' });
      }
    }
    const successCount = results.filter((r) => r.success).length;
    return { total: dto.users.length, successCount, failCount: dto.users.length - successCount, results };
  }

  async update(actorId: number, id: number, dto: UpdateUserDto) {
    await this.ensureUser(id);
    if (dto.teamId) {
      await this.ensureTeam(dto.teamId);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        teamId: dto.teamId === undefined ? undefined : dto.teamId,
        phone: dto.phone,
        status: dto.status,
      },
      include: { team: true },
    });
    if (dto.status === 'DISABLED') {
      await this.audit.log(actorId, 'USER_DISABLE', { targetUserId: id, name: user.name });
    }
    return this.sanitize(user);
  }

  async resetPassword(actorId: number, id: number, password?: string) {
    await this.ensureUser(id);
    const pwd = password || DEFAULT_PASSWORD;
    const passwordHash = await bcrypt.hash(pwd, 10);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await this.audit.log(actorId, 'USER_RESET_PASSWORD', { targetUserId: id });
    return { success: true, initialPassword: pwd };
  }

  async remove(id: number) {
    await this.ensureUser(id);
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  private async ensureUser(id: number) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('用户不存在');
    return u;
  }

  private async ensureTeam(id: number) {
    const t = await this.prisma.team.findUnique({ where: { id } });
    if (!t) throw new BadRequestException('指定的团队不存在');
    return t;
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
