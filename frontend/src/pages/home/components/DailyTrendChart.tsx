import { Card } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { StatsOverview } from '../../../api/stats';
import { buildPlatformDailyTrendOption } from '../chartOptions';

interface Props {
  data: StatsOverview;
  height?: number;
}

export default function DailyTrendChart({ data, height = 320 }: Props) {
  const option = buildPlatformDailyTrendOption(data);
  return (
    <Card title="近 7 日签到趋势" className="home-dashboard-card">
      <ReactECharts option={option} style={{ height }} />
    </Card>
  );
}
