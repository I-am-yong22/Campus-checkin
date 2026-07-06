import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api/admin';
import { teamWorkflowApi } from '../../api/teamWorkflow';
import TeamScopeSelect from '../../components/TeamScopeSelect';
import type { Team } from '../../types';
import TeamApplicationsPanel from './team/TeamApplicationsPanel';
import TeamsManagePanel from './team/TeamsManagePanel';
import TeamAttendancePanel from './team/TeamAttendancePanel';

type TabKey = 'applications' | 'manage' | 'members';

export default function AdminTeamHub() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as TabKey) || 'manage';
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const teamIdParam = params.get('teamId');
  const teamIdFromUrl = teamIdParam ? Number(teamIdParam) : undefined;
  const activeTeamId =
    teamIdFromUrl && teams.some((t) => t.id === teamIdFromUrl)
      ? teamIdFromUrl
      : teams[0]?.id;

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const list = await adminApi.listTeams();
      setTeams(list);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  const loadPendingCount = useCallback(async () => {
    const res = await teamWorkflowApi.pendingApplicationCount().catch(() => ({ count: 0 }));
    setPendingCount(res.count);
  }, []);

  useEffect(() => {
    loadTeams();
    loadPendingCount();
  }, [loadTeams, loadPendingCount]);

  const setTab = (key: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', key);
    if (key === 'members' && activeTeamId) {
      next.set('teamId', String(activeTeamId));
    } else {
      next.delete('teamId');
    }
    setParams(next);
  };

  const setTeamId = (id: number) => {
    const next = new URLSearchParams(params);
    next.set('tab', 'members');
    next.set('teamId', String(id));
    setParams(next);
  };

  const items = useMemo(
    () => [
      {
        key: 'applications',
        label: (
          <span>
            创建审核
            {pendingCount > 0 && (
              <Badge count={pendingCount} size="small" style={{ marginLeft: 8 }} />
            )}
          </span>
        ),
        children: (
          <TeamApplicationsPanel
            onChanged={() => {
              loadPendingCount();
              loadTeams();
            }}
          />
        ),
      },
      {
        key: 'manage',
        label: '团队列表',
        children: <TeamsManagePanel onTeamsChanged={loadTeams} />,
      },
      {
        key: 'members',
        label: '团队成员',
        children: activeTeamId ? (
          <TeamAttendancePanel teamId={activeTeamId} />
        ) : (
          <Empty description="暂无团队">
            <Button type="primary" onClick={() => setTab('manage')}>
              去创建团队
            </Button>
          </Empty>
        ),
      },
    ],
    [pendingCount, activeTeamId, loadPendingCount, loadTeams],
  );

  return (
    <Card title="团队管理">
      {tab === 'members' && teams.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: '#666' }}>选择团队</div>
          <TeamScopeSelect
            teams={teams}
            value={activeTeamId}
            onChange={setTeamId}
            loading={teamsLoading}
            style={{ maxWidth: 420 }}
          />
        </Card>
      )}
      <Tabs activeKey={tab} onChange={setTab} items={items} />
    </Card>
  );
}
