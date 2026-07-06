import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';import { checkInApi } from '../../api/checkin';
import { leaveApi } from '../../api/leave';
import { statsApi, type AttentionList, type TeamStats } from '../../api/stats';
import { teamsApi } from '../../api/teams';
import { useAuth } from '../../store/AuthContext';
import WelcomeBanner from './components/WelcomeBanner';
import PersonalTodayCards from './components/PersonalTodayCards';
import TeamTodayKpiRow from './components/TeamTodayKpiRow';
import TeamTrendChart from './components/TeamTrendChart';
import AttentionPanel from './components/AttentionPanel';
export default function LeaderHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayCheckIn, setTodayCheckIn] = useState<Awaited<ReturnType<typeof checkInApi.today>> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasTeams, setHasTeams] = useState(false);
  const [teamId, setTeamId] = useState<number | undefined>();
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [attention, setAttention] = useState<AttentionList | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [today, pending, mine] = await Promise.all([
        checkInApi.today().catch(() => null),
        leaveApi.pendingCount().catch(() => ({ count: 0 })),
        teamsApi.myTeams().catch(() => []),
      ]);
      setTodayCheckIn(today);
      setPendingCount(pending.count);
      setHasTeams(mine.length > 0);
      const activeId = user?.teamId ?? mine[0]?.id;
      setTeamId(activeId);

      if (activeId) {
        const [team, att] = await Promise.all([
          statsApi.team({ teamId: activeId, days: 7 }).catch(() => null),
          statsApi.attention(activeId).catch(() => null),
        ]);
        setTeamStats(team);
        setAttention(att);
      } else {
        setTeamStats(null);
        setAttention(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.teamId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !todayCheckIn) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <WelcomeBanner name={user!.name} role="LEADER" />

      {!user?.faceRegistered && (
        <Alert
          type="warning"
          showIcon
          message="您尚未录入人脸"
          description="请前往「人脸录入」完成注册，否则无法在签到机打卡。"
          action={
            <Button size="small" type="primary" onClick={() => navigate('/settings?tab=face')}>
              去录入
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {!hasTeams && (
        <Alert
          type="info"
          showIcon
          message="您尚未创建团队"
          description="请前往「我的团队」申请创建团队，批准后可邀请学员加入。"
          action={
            <Button size="small" type="primary" onClick={() => navigate('/my-team?tab=manage')}>
              我的团队
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {pendingCount > 0 && (
        <Alert
          type="info"
          showIcon
          message={`有 ${pendingCount} 条待审请假`}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/leave-review')}>
              去审核
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <PersonalTodayCards todayCheckIn={todayCheckIn} faceRegistered={!!user?.faceRegistered} />

      {teamId && teamStats ? (
        <div style={{ marginBottom: 16 }}>
          <TeamTodayKpiRow data={teamStats} />
          <TeamTrendChart data={teamStats} />
          <AttentionPanel
            attention={attention}
            maxItems={6}
            extra={
              <Button type="link" size="small" onClick={() => navigate('/my-team?tab=stats')}>
                查看全部
              </Button>
            }
          />
        </div>
      ) : hasTeams ? (
        <Empty description="加载团队数据中…" style={{ marginBottom: 16 }} />
      ) : (
        <Empty
          description="创建团队后可查看团队出勤概况"
          style={{ marginBottom: 16 }}
        >
          <Button type="primary" onClick={() => navigate('/my-team?tab=manage')}>
            前往我的团队
          </Button>
        </Empty>
      )}
    </div>  );
}
