interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  collapsed?: boolean;
}

/** 与 public/favicon.svg 共用同一图标，避免颜色/造型不一致 */
const BRAND_ICON = '/favicon.svg?v=2';

export default function BrandLogo({ size = 32, showText = true, collapsed = false }: BrandLogoProps) {
  const icon = (
    <img
      src={BRAND_ICON}
      width={size}
      height={size}
      alt=""
      aria-hidden
      draggable={false}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );

  if (!showText) return icon;

  return (
    <div className="brand-logo" style={{ gap: collapsed ? 0 : 10 }}>
      {icon}
      {!collapsed && <span className="brand-logo__text">校园打卡</span>}
    </div>
  );
}
