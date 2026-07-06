import { Card } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { TeamStats } from '../../../api/stats';
import { buildTeamDailyTrendOption } from '../chartOptions';

interface Props {
  data: TeamStats;
  height?: number;
}

export default function TeamTrendChart({ data, height = 320 }: Props) {
  const option = buildTeamDailyTrendOption(data);
  return (
    <Card title="近 7 日出勤趋势" className="home-dashboard-card" style={{ marginBottom: 16 }}>
      <ReactECharts option={option} style={{ height }} />
    </Card>
  );
}
