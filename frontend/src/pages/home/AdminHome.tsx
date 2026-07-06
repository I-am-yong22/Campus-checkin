import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { leaveApi } from '../../api/leave';
import { statsApi, type AttentionList, type KioskStatus, type StatsOverview } from '../../api/stats';
import { teamWorkflowApi } from '../../api/teamWorkflow';
import { useAuth } from '../../store/AuthContext';
import WelcomeBanner from './components/WelcomeBanner';
import PlatformKpiRow from './components/PlatformKpiRow';
import KioskStatusCard from './components/KioskStatusCard';
import AttentionPanel from './components/AttentionPanel';
import TeamRateChart from './components/TeamRateChart';
import DailyTrendChart from './components/DailyTrendChart';
import DashboardMasonry from './components/DashboardMasonry';

export default function AdminHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatsOverview | null>(null);
  const [attention, setAttention] = useState<AttentionList | null>(null);
  const [kiosk, setKiosk] = useState<KioskStatus | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [teamApplyCount, setTeamApplyCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, att, k, pending, tc] = await Promise.all([
        statsApi.overview(7).catch(() => null),
        statsApi.attention().catch(() => null),
        statsApi.kiosk().catch(() => null),
        leaveApi.pendingCount().catch(() => ({ count: 0 })),
        teamWorkflowApi.pendingApplicationCount().catch(() => ({ count: 0 })),
      ]);
      setData(overview);
      setAttention(att);
      setKiosk(k);
      setPendingCount(pending.count);
      setTeamApplyCount(tc.count);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const hasTodos = pendingCount > 0 || teamApplyCount > 0;

  return (
    <div>
      <WelcomeBanner name={user!.name} role="ADMIN" />

      {hasTodos && (
        <Alert
          type="info"
          showIcon
          message="待处理事项"
          description={
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {pendingCount > 0 && (
                <Button size="small" onClick={() => navigate('/leave-review')}>
                  待审请假 {pendingCount} 条
                </Button>
              )}
              {teamApplyCount > 0 && (
                <Button size="small" onClick={() => navigate('/admin/teams?tab=applications')}>
                  团队创建申请 {teamApplyCount} 条
                </Button>
              )}
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {data && <PlatformKpiRow overview={data.overview} />}

      {data && (
        <DashboardMasonry
          left={
            <>
              <KioskStatusCard kiosk={kiosk} />
              <TeamRateChart data={data} />
            </>
          }
          right={
            <>
              <AttentionPanel attention={attention} maxItems={8} />
              <DailyTrendChart data={data} />
            </>
          }
        />
      )}
    </div>
  );
}
