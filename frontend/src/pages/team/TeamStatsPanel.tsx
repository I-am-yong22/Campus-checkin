import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Spin } from 'antd';
import ReactECharts from 'echarts-for-react';
import { statsApi, type TeamStats } from '../../api/stats';
import { buildTeamDailyTrendOption } from '../home/chartOptions';
import TeamTodayKpiRow from '../home/components/TeamTodayKpiRow';

interface Props {
  teamId?: number;
}

export default function TeamStatsPanel({ teamId }: Props) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TeamStats | null>(null);

  const load = useCallback(async () => {
    if (!teamId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await statsApi.team({ days: 7, teamId }));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const trendOption = useMemo(() => (data ? buildTeamDailyTrendOption(data) : {}), [data]);

  if (!teamId) {
    return <div style={{ color: '#78716C' }}>请先选择团队</div>;
  }

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!data) {
    return <div style={{ color: '#78716C' }}>暂无团队数据</div>;
  }

  return (
    <div>
      <TeamTodayKpiRow data={data} />
      <Card title="近 7 日出勤趋势" size="small">
        <ReactECharts option={trendOption} style={{ height: 360 }} />
      </Card>
    </div>
  );
}
