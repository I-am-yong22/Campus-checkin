import type { ReactNode } from 'react';

interface Props {
  left: ReactNode;
  right: ReactNode;
}

/** 双列瀑布流：每列独立堆叠，避免矮卡片被同行拉高 */
export default function DashboardMasonry({ left, right }: Props) {
  return (
    <div className="home-dashboard-masonry">
      <div className="home-dashboard-masonry__col">{left}</div>
      <div className="home-dashboard-masonry__col">{right}</div>
    </div>
  );
}
