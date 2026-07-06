import { join } from 'node:path';

export const AVATAR_DIR = join(process.cwd(), 'uploads', 'avatars');
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function avatarPublicPath(userId: number, ext: string) {
  return `/uploads/avatars/${userId}.${ext}`;
}

export function avatarFileName(userId: number, ext: string) {
  return `${userId}.${ext}`;
}

export function extFromMime(mime: string): string | null {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}
