import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(userId: number | null, action: string, detail?: Record<string, unknown>, ip?: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        detail: detail ? JSON.stringify(detail) : null,
        ip: ip ?? null,
      },
    });
  }

  async list(params: { page?: number; pageSize?: number; action?: string }) {
    const page = Number(params.page) || 1;
    const pageSize = Math.min(Number(params.pageSize) || 20, 100);
    const where: any = {};
    if (params.action) where.action = params.action;
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items };
  }
}
