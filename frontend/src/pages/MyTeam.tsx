import { useEffect, useMemo } from 'react';
import { Card, Empty, Spin, Tabs } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TeamScopeSelect from '../components/TeamScopeSelect';
import { useTeamScope } from '../hooks/useTeamScope';
import { useAuth } from '../store/AuthContext';
import TeamMembersPanel from './team/TeamMembersPanel';
import TeamMembersList from './team/TeamMembersList';
import TeamJoinPanel from './team/TeamJoinPanel';
import TeamManagePanel from './team/TeamManagePanel';
import TeamStatsPanel from './team/TeamStatsPanel';

export default function MyTeam() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isLeader = user?.role === 'LEADER';
  const isUser = user?.role === 'USER';
  const {
    teams,
    activeTeamId,
    activeTeam,
    setActiveTeamId,
    hasTeams,
    loading,
    refreshTeams,
  } = useTeamScope();

  const tab = params.get('tab') || 'members';

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      navigate('/admin/teams', { replace: true });
    }
  }, [user?.role, navigate]);

  const items = useMemo(() => {
    const list = [
      {
        key: 'members',
        label: '成员',
        children: (
          <TeamMembersList
            teamId={activeTeamId}
            canLeave={isUser && !!activeTeam?.isMember}
            onLeft={refreshTeams}
          />
        ),
      },
    ];

    if (isUser) {
      list.push({
        key: 'join',
        label: '加入团队',
        children: <TeamJoinPanel onJoined={refreshTeams} />,
      });
    }

    if (isLeader) {
      list.push(
        {
          key: 'attendance',
          label: '出勤看板',
          children: <TeamMembersPanel teamId={activeTeamId} canPickTeam={false} />,
        },
        {
          key: 'manage',
          label: '团队管理',
          children: <TeamManagePanel />,
        },
        {
          key: 'stats',
          label: '团队统计',
          children: <TeamStatsPanel teamId={activeTeamId} />,
        },
      );
    }

    return list;
  }, [activeTeamId, activeTeam?.isMember, isLeader, isUser, refreshTeams]);

  if (loading && !hasTeams) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card title="我的团队">
      {hasTeams ? (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8, color: '#666' }}>选择团队</div>
            <TeamScopeSelect
              teams={teams.map((t) => ({
                ...t,
                name: t.isOwner ? `${t.name}（负责）` : t.name,
              }))}
              value={activeTeamId}
              onChange={setActiveTeamId}
              loading={loading}
              style={{ maxWidth: 420 }}
            />
          </Card>
          <Tabs
            activeKey={tab}
            onChange={(key) => setParams({ tab: key })}
            items={items}
          />
        </>
      ) : (
        <Empty description="您还没有任何团队">
          {isLeader && (
            <div style={{ marginTop: 16 }}>
              <TeamManagePanel applyOnly />
            </div>
          )}
          {isUser && (
            <div style={{ marginTop: 16 }}>
              <TeamJoinPanel onJoined={refreshTeams} />
            </div>
          )}
        </Empty>
      )}
    </Card>
  );
}
