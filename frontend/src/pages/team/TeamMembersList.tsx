import { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, Empty, List, Popconfirm, Spin, Tag, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { teamsApi } from '../../api/teams';
import { useAuth } from '../../store/AuthContext';
import { avatarSrc } from '../../utils/avatar';

const ROLE_TAG: Record<string, { color: string; text: string }> = {
  USER: { color: 'blue', text: '学员' },
  LEADER: { color: 'gold', text: '负责人' },
};

interface Props {
  teamId?: number;
  canLeave?: boolean;
  onLeft?: () => void;
}

export default function TeamMembersList({ teamId, canLeave, onLeft }: Props) {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof teamsApi.peers>> | null>(null);

  const load = useCallback(async () => {
    if (!teamId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await teamsApi.peers({ teamId }));
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const onLeave = async () => {
    if (!teamId) return;
    setLeaving(true);
    try {
      await teamsApi.leaveTeam(teamId);
      message.success('已退出团队');
      await refresh();
      onLeft?.();
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!data?.team) {
    return <Empty description="请选择团队或加入团队" />;
  }

  return (
    <div>
      {data.team.description && (
        <p style={{ color: '#666', marginBottom: 16 }}>{data.team.description}</p>
      )}
      <List
        dataSource={data.members}
        rowKey="id"
        renderItem={(m) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <Avatar src={avatarSrc(m.avatarUrl)} icon={<UserOutlined />}>
                  {!m.avatarUrl && m.name?.[0]}
                </Avatar>
              }
              title={
                <span>
                  {m.name}
                  {m.id === user?.id && (
                    <Tag style={{ marginLeft: 8 }} color="processing">
                      我
                    </Tag>
                  )}
                  <Tag style={{ marginLeft: 8 }} color={ROLE_TAG[m.role]?.color}>
                    {ROLE_TAG[m.role]?.text || m.role}
                  </Tag>
                </span>
              }
              description={
                <span>
                  @{m.username} · {m.faceRegistered ? '已录脸' : '未录脸'}
                </span>
              }
            />
          </List.Item>
        )}
      />
      {canLeave && (
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Popconfirm
            title={`确定退出「${data.team.name}」？`}
            description="退出后仍可加入其他团队。"
            onConfirm={onLeave}
            okText="退出"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: leaving }}
          >
            <Button danger loading={leaving}>
              退出该团队
            </Button>
          </Popconfirm>
        </div>
      )}
    </div>
  );
}
