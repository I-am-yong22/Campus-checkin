import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { useNavigate } from 'react-router-dom';
import { checkInApi } from '../../api/checkin';
import { teamWorkflowApi } from '../../api/teamWorkflow';
import { teamsApi } from '../../api/teams';
import { useAuth } from '../../store/AuthContext';
import WelcomeBanner from './components/WelcomeBanner';
import PersonalTodayCards from './components/PersonalTodayCards';
export default function UserHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [todayCheckIn, setTodayCheckIn] = useState<Awaited<ReturnType<typeof checkInApi.today>> | null>(null);
  const [inviteCount, setInviteCount] = useState(0);
  const [hasTeams, setHasTeams] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [today, ic, mine] = await Promise.all([
        checkInApi.today().catch(() => null),
        teamWorkflowApi.pendingInvitationCount().catch(() => ({ count: 0 })),
        teamsApi.myTeams().catch(() => []),
      ]);
      setTodayCheckIn(today);
      setInviteCount(ic.count);
      setHasTeams(mine.length > 0);
    } finally {
      setLoading(false);
    }
  }, []);

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
      <WelcomeBanner name={user!.name} role="USER" />

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
          message="尚未加入团队"
          description="可向负责人索取邀请码，在「我的团队」页加入；或等待点对点邀请。"
          action={
            <Button size="small" type="primary" onClick={() => navigate('/my-team?tab=join')}>
              我的团队
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {inviteCount > 0 && (
        <Alert
          type="info"
          showIcon
          message={`您有 ${inviteCount} 条待处理的团队邀请`}
          action={
            <Button size="small" type="primary" onClick={() => navigate('/my-team?tab=join')}>
              去处理
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <PersonalTodayCards todayCheckIn={todayCheckIn} faceRegistered={!!user?.faceRegistered} />
    </div>  );
}
