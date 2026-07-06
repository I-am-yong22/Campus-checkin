/** 头像静态资源路径（开发环境经 Vite 代理 /uploads） */
export function avatarSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url;
}
