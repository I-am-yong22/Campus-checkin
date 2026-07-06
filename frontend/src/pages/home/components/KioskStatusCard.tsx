import { Card, Statistic } from 'antd';
import dayjs from 'dayjs';
import type { KioskStatus } from '../../../api/stats';
import { brand, chartColors } from '../../../theme';

interface Props {
  kiosk: KioskStatus | null;
}

export default function KioskStatusCard({ kiosk }: Props) {
  return (
    <Card title="签到机状态" className="home-dashboard-card">
      <Statistic
        title="在线状态"
        value={kiosk?.online ? '在线' : '离线'}
        valueStyle={{ color: kiosk?.online ? chartColors.success : brand.error, fontSize: 20 }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
        最近心跳：{kiosk?.lastSeenAt ? dayjs(kiosk.lastSeenAt).format('MM-DD HH:mm:ss') : '—'}
      </div>
      <div style={{ fontSize: 12, color: '#666' }}>
        最近签到：{kiosk?.lastCheckInAt ? dayjs(kiosk.lastCheckInAt).format('MM-DD HH:mm:ss') : '—'}
      </div>
    </Card>
  );
}
