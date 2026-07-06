import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { AuditService } from '../audit/audit.service';
import {
  AVATAR_DIR,
  AVATAR_MAX_BYTES,
  AVATAR_MIME,
  avatarFileName,
  avatarPublicPath,
  extFromMime,
} from '../common/avatar';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { UpdateProfileDto } from './dto/profile.dto';

type AvatarUpload = { buffer: Buffer; mimetype: string; size: number };

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user) {
      throw new UnauthorizedException('账号不存在，请确认用户名或联系管理员');
    }
    if (user.status === 'DISABLED') {
      throw new UnauthorizedException('账号已被禁用，请联系管理员');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('密码错误');
    }

    const token = await this.signToken(user.id, user.username, user.role, user.teamId);
    await this.audit.log(user.id, 'LOGIN', { username: user.username });
    return {
      token,
      user: this.sanitize(user),
    };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { team: true },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.sanitize(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name.trim() },
      include: { team: true },
    });
    await this.audit.log(userId, 'PROFILE_UPDATE', { name: dto.name.trim() });
    return this.sanitize(user);
  }

  async uploadAvatar(userId: number, file: AvatarUpload) {
    if (!file) throw new BadRequestException('请选择图片文件');
    if (!AVATAR_MIME.has(file.mimetype)) {
      throw new BadRequestException('仅支持 JPG、PNG、WebP 格式');
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException('图片大小不能超过 2MB');
    }
    const ext = extFromMime(file.mimetype);
    if (!ext) throw new BadRequestException('不支持的图片格式');

    if (!existsSync(AVATAR_DIR)) {
      mkdirSync(AVATAR_DIR, { recursive: true });
    }

    this.removeAvatarFiles(userId);

    const filename = avatarFileName(userId, ext);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${AVATAR_DIR}/${filename}`, file.buffer);

    const avatarUrl = avatarPublicPath(userId, ext);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: { team: true },
    });
    await this.audit.log(userId, 'AVATAR_UPDATE', { avatarUrl });
    return this.sanitize(user);
  }

  async removeAvatar(userId: number) {
    this.removeAvatarFiles(userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      include: { team: true },
    });
    await this.audit.log(userId, 'AVATAR_DELETE', {});
    return this.sanitize(user);
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('原密码错误');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    return { success: true };
  }

  private removeAvatarFiles(userId: number) {
    if (!existsSync(AVATAR_DIR)) return;
    const prefix = `${userId}.`;
    for (const f of readdirSync(AVATAR_DIR)) {
      if (f.startsWith(prefix)) {
        try {
          unlinkSync(`${AVATAR_DIR}/${f}`);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private async signToken(id: number, username: string, role: string, teamId: number | null) {
    return this.jwt.signAsync({ sub: id, username, role, teamId });
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
