import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Divider, Empty, Input, List, Space, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { teamWorkflowApi, type TeamInvitation, type TeamInviteCodePreview } from '../../api/teamWorkflow';
import { useAuth } from '../../store/AuthContext';

interface Props {
  onJoined?: () => void;
}

export default function TeamJoinPanel({ onJoined }: Props) {
  const { refresh } = useAuth();
  const [data, setData] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [preview, setPreview] = useState<TeamInviteCodePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await teamWorkflowApi.myInvitations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onAccept = async (id: number) => {
    await teamWorkflowApi.acceptInvitation(id);
    message.success('已加入团队');
    await refresh();
    onJoined?.();
    load();
  };

  const onReject = async (id: number) => {
    await teamWorkflowApi.rejectInvitation(id);
    message.success('已拒绝邀请');
    load();
  };

  const onPreviewCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 6) {
      message.warning('请输入 6 位邀请码');
      return;
    }
    setPreviewLoading(true);
    try {
      setPreview(await teamWorkflowApi.previewInviteCode(code));
    } finally {
      setPreviewLoading(false);
    }
  };

  const onJoinByCode = async () => {
    if (!preview) return;
    setJoinLoading(true);
    try {
      await teamWorkflowApi.joinByInviteCode(preview.code);
      message.success(`已加入「${preview.team.name}」`);
      setPreview(null);
      setCodeInput('');
      await refresh();
      onJoined?.();
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div>
      <Card type="inner" title="邀请码加入" style={{ marginBottom: 16 }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="向项目负责人索取 6 位邀请码，预览团队信息并确认后加入。您可加入多个团队。"
        />
        <Space.Compact style={{ width: '100%', maxWidth: 360, marginBottom: 16 }}>
          <Input
            placeholder="输入 6 位邀请码"
            value={codeInput}
            maxLength={6}
            onChange={(e) => {
              setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setPreview(null);
            }}
            onPressEnter={onPreviewCode}
            style={{ fontFamily: 'monospace', letterSpacing: 2 }}
          />
          <Button type="primary" loading={previewLoading} onClick={onPreviewCode}>
            预览
          </Button>
        </Space.Compact>
        {preview && (
          <Card size="small" style={{ background: '#FFFBF7' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong style={{ fontSize: 16 }}>{preview.team.name}</strong>
              </div>
              {preview.team.description && (
                <div style={{ color: '#78716C' }}>{preview.team.description}</div>
              )}
              {preview.leader && (
                <div>负责人：{preview.leader.name}（{preview.leader.username}）</div>
              )}
              <Button type="primary" loading={joinLoading} onClick={onJoinByCode}>
                确认加入
              </Button>
            </Space>
          </Card>
        )}
      </Card>
      <Divider />
      <div style={{ marginBottom: 8, fontWeight: 500 }}>待处理的点对点邀请</div>
      {data.length === 0 && !loading ? (
        <Empty description="暂无待处理的团队邀请" />
      ) : (
        <List
          loading={loading}
          dataSource={data}
          rowKey="id"
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="accept" type="primary" size="small" onClick={() => onAccept(item.id)}>
                  接受
                </Button>,
                <Button key="reject" size="small" onClick={() => onReject(item.id)}>
                  拒绝
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>邀请加入「{item.team?.name}」</span>
                    <Tag color="processing">待处理</Tag>
                  </Space>
                }
                description={
                  <div>
                    <div>邀请人：{item.inviter?.name}（{item.inviter?.username}）</div>
                    {item.message && <div>留言：{item.message}</div>}
                    <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
