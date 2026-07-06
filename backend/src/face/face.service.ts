import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FaceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  static parseDescriptors(raw: string): number[][] {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    if (typeof parsed[0] === 'number') return [parsed as number[]];
    return parsed as number[][];
  }

  static minDistance(query: number[], templates: number[][]): number {
    if (templates.length === 0) return Infinity;
    return Math.min(...templates.map((t) => FaceService.euclideanDistance(query, t)));
  }

  async register(userId: number, descriptor: number[]) {
    if (!descriptor || descriptor.length !== 128) {
      throw new BadRequestException('请提供有效的人脸特征');
    }
    const json = JSON.stringify(descriptor);
    await this.prisma.faceProfile.upsert({
      where: { userId },
      update: { descriptor: json },
      create: { userId, descriptor: json },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { faceRegistered: true },
    });
    await this.audit.log(userId, 'FACE_REGISTER', { userId });
    return { success: true };
  }

  async status(userId: number) {
    const profile = await this.prisma.faceProfile.findUnique({ where: { userId } });
    return {
      registered: !!profile,
      registeredAt: profile?.registeredAt ?? null,
    };
  }

  static euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const d = a[i] - b[i];
      sum += d * d;
    }
    return Math.sqrt(sum);
  }
}
