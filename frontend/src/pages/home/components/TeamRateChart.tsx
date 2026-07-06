import { Card } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { StatsOverview } from '../../../api/stats';
import { buildTeamRateChartOption } from '../chartOptions';

interface Props {
  data: StatsOverview;
  height?: number;
}

export default function TeamRateChart({ data, height = 320 }: Props) {
  const option = buildTeamRateChartOption(data);
  return (
    <Card title={`各团队今日签到率（${data.date}）`} className="home-dashboard-card">
      {data.teamRates.length > 0 ? (
        <ReactECharts option={option} style={{ height }} />
      ) : (
        <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>暂无团队数据</div>
      )}
    </Card>
  );
}
