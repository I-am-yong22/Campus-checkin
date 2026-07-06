import BrandLogo from './BrandLogo';

interface KioskHeaderProps {
  clock: string;
  onLogoLongPress?: () => void;
  extra?: React.ReactNode;
}

export default function KioskHeader({ clock, onLogoLongPress, extra }: KioskHeaderProps) {
  return (
    <header className="kiosk-header">
      <div
        className="kiosk-header__brand"
        onContextMenu={(e) => {
          e.preventDefault();
          onLogoLongPress?.();
        }}
      >
        <BrandLogo size={36} />
        <div className="kiosk-clock">{clock}</div>
      </div>
      {extra && <div className="kiosk-header__extra">{extra}</div>}
    </header>
  );
}
