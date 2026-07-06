import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { teamsApi } from '../api/teams';
import { teamWorkflowApi, type InviteCandidate, type TeamCreationRequest, type TeamInvitation, type TeamInviteCode } from '../api/teamWorkflow';
import TeamScopeSelect from '../components/TeamScopeSelect';
import { useTeamScope } from '../hooks/useTeamScope';

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'processing', text: '待审核' },
  APPROVED: { color: 'success', text: '已通过' },
  REJECTED: { color: 'error', text: '已驳回' },
};

const INVITE_TAG: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'processing', text: '待接受' },
  APPROVED: { color: 'success', text: '已加入' },
  REJECTED: { color: 'error', text: '已拒绝' },
};

export default function LeaderTeamWorkflow({ embedded, applyOnly }: { embedded?: boolean; applyOnly?: boolean } = {}) {
  const {
    teams,
    activeTeamId,
    activeTeam,
    setActiveTeamId,
    hasTeams,
    loading: scopeLoading,
    refreshTeams,
    isLeader,
  } = useTeamScope();
  const ownerTeams = teams.filter((t) => t.isOwner);
  const canManageActive = !!activeTeam?.isOwner;
  const [applications, setApplications] = useState<TeamCreationRequest[]>([]);
  const [sent, setSent] = useState<TeamInvitation[]>([]);
  const [candidates, setCandidates] = useState<InviteCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyForm] = Form.useForm();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm] = Form.useForm();
  const [keyword, setKeyword] = useState('');
  const [inviteCode, setInviteCode] = useState<TeamInviteCode | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Awaited<ReturnType<typeof teamsApi.peers>>['members']>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const loadInviteCode = useCallback(async () => {
    if (!canManageActive || !activeTeamId) {
      setInviteCode(null);
      return;
    }
    setCodeLoading(true);
    try {
      setInviteCode(await teamWorkflowApi.myInviteCode(activeTeamId));
    } finally {
      setCodeLoading(false);
    }
  }, [canManageActive, activeTeamId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [apps, sentList] = await Promise.all([
        teamWorkflowApi.myApplications(),
        hasTeams && activeTeamId && canManageActive
          ? teamWorkflowApi.sentInvitations(activeTeamId)
          : Promise.resolve([]),
      ]);
      setApplications(apps);
      setSent(sentList);
    } finally {
      setLoading(false);
    }
  }, [canManageActive, activeTeamId]);

  const loadCandidates = useCallback(async (kw?: string) => {
    if (!canManageActive || !activeTeamId) return;
    const list = await teamWorkflowApi.inviteCandidates(kw, activeTeamId);
    setCandidates(list);
  }, [canManageActive, activeTeamId]);

  const loadTeamMembers = useCallback(async () => {
    if (!hasTeams || !activeTeamId) {
      setTeamMembers([]);
      return;
    }
    setMembersLoading(true);
    try {
      const data = await teamsApi.peers({ teamId: activeTeamId });
      setTeamMembers(data.members);
    } finally {
      setMembersLoading(false);
    }
  }, [canManageActive, activeTeamId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadInviteCode();
  }, [loadInviteCode]);

  useEffect(() => {
    loadTeamMembers();
  }, [loadTeamMembers]);

  useEffect(() => {
    if (canManageActive && activeTeamId) loadCandidates(keyword);
  }, [canManageActive, activeTeamId, keyword, loadCandidates]);

  const onApply = async () => {
    const v = await applyForm.validateFields();
    await teamWorkflowApi.createApplication({
      name: v.name,
      description: v.description,
      reason: v.reason,
    });
    message.success('申请已提交，请等待管理员审核');
    applyForm.resetFields();
    load();
  };

  const onInvite = async () => {
    const v = await inviteForm.validateFields();
    await teamWorkflowApi.sendInvitation({ inviteeId: v.inviteeId, message: v.message }, activeTeamId);
    message.success('邀请已发送');
    setInviteOpen(false);
    inviteForm.resetFields();
    load();
    loadCandidates(keyword);
    loadTeamMembers();
  };

  const onCancelInvite = async (id: number) => {
    await teamWorkflowApi.cancelInvitation(id);
    message.success('已撤销邀请');
    load();
    loadCandidates(keyword);
  };

  const onRemoveMember = async (memberId: number) => {
    setRemovingId(memberId);
    try {
      await teamsApi.removeMember(memberId, activeTeamId);
      message.success('已移出团队');
      loadTeamMembers();
      loadCandidates(keyword);
    } finally {
      setRemovingId(null);
    }
  };

  const onCreateInviteCode = async () => {
    const created = await teamWorkflowApi.createInviteCode(activeTeamId);
    setInviteCode(created);
    message.success('邀请码已生成');
  };

  const onRegenerateInviteCode = async () => {
    const created = await teamWorkflowApi.regenerateInviteCode(activeTeamId);
    setInviteCode(created);
    message.success('邀请码已重新生成');
  };

  const onDisableInviteCode = async () => {
    await teamWorkflowApi.disableInviteCode(activeTeamId);
    setInviteCode(null);
    message.success('邀请码已禁用');
  };

  const onCopyInviteCode = async () => {
    if (!inviteCode?.code) return;
    try {
      await navigator.clipboard.writeText(inviteCode.code);
      message.success('邀请码已复制');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const pendingApply = applications.some((a) => a.status === 'PENDING');

  const appColumns: ColumnsType<TeamCreationRequest> = [
    { title: '团队名称', dataIndex: 'name' },
    { title: '申请说明', dataIndex: 'reason', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: string) => <Tag color={STATUS_TAG[s]?.color}>{STATUS_TAG[s]?.text || s}</Tag>,
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '审核意见',
      render: (_, r) => r.reviewComment || '—',
    },
  ];

  const sentColumns: ColumnsType<TeamInvitation> = [
    { title: '受邀用户', render: (_, r) => `${r.invitee?.name}（${r.invitee?.username}）` },
    { title: '留言', dataIndex: 'message', render: (v) => v || '—', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: string) => <Tag color={INVITE_TAG[s]?.color}>{INVITE_TAG[s]?.text || s}</Tag>,
    },
    {
      title: '发出时间',
      dataIndex: 'createdAt',
      render: (v) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      render: (_, r) =>
        r.status === 'PENDING' ? (
          <Button type="link" size="small" danger onClick={() => onCancelInvite(r.id)}>
            撤销
          </Button>
        ) : null,
    },
  ];

  const applyTab = (
    <div>
      {!pendingApply && (
        <Card title="申请创建团队" style={{ marginBottom: 16 }}>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              hasTeams
                ? '您可继续申请创建新的团队，批准后在上方切换团队进行管理。'
                : '向管理员提交团队创建申请，批准后即可邀请学员加入。'
            }
          />
          <Form form={applyForm} layout="vertical" onFinish={onApply}>
            <Form.Item name="name" label="团队名称" rules={[{ required: true, message: '请输入团队名称' }]}>
              <Input placeholder="如：暑期实践二团" maxLength={50} />
            </Form.Item>
            <Form.Item name="description" label="团队说明">
              <Input.TextArea rows={2} placeholder="可选" maxLength={500} />
            </Form.Item>
            <Form.Item
              name="reason"
              label="申请理由"
              rules={[{ required: true, message: '请说明创建团队的原因' }]}
            >
              <Input.TextArea rows={3} placeholder="请简要说明创建团队的目的与计划" maxLength={500} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              提交申请
            </Button>
          </Form>
        </Card>
      )}
      {hasTeams && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          message={`您当前负责 ${ownerTeams.length} 个团队，可在「邀请成员」标签页切换团队并管理成员。`}
        />
      )}
      {pendingApply && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="您有待审核的团队创建申请，请耐心等待管理员处理。" />
      )}
      <Card title="我的申请记录">
        <Table rowKey="id" loading={loading} columns={appColumns} dataSource={applications} pagination={false} />
      </Card>
    </div>
  );

  const teamScopeBar =
    !embedded && hasTeams && activeTeamId ? (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, color: '#666' }}>当前团队</div>
        <TeamScopeSelect
          teams={teams}
          value={activeTeamId}
          onChange={setActiveTeamId}
          loading={scopeLoading}
          style={{ maxWidth: 360 }}
        />
        {!canManageActive && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="当前团队为您加入的团队，管理功能请在您负责的团队下操作。"
          />
        )}
      </Card>
    ) : null;

  const inviteTab = (
    <div>
      {ownerTeams.length === 0 ? (
        <Alert type="info" showIcon message="请先申请创建团队并获得管理员批准，之后方可邀请成员。" />
      ) : !canManageActive ? (
        <Alert type="info" showIcon message="请切换到您负责的团队，再进行邀请与管理。" />
      ) : (
        <>
          {teamScopeBar}
          <Card title={`团队邀请码${activeTeam ? ` · ${activeTeam.name}` : ''}`} style={{ marginBottom: 16 }} loading={codeLoading}>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="生成邀请码后，学员可在「团队邀请」页输入邀请码加入团队（与点对点邀请并存）。"
            />
            {inviteCode ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: 4,
                      fontFamily: 'monospace',
                      color: '#FF6B35',
                    }}
                  >
                    {inviteCode.code}
                  </span>
                  <Button onClick={onCopyInviteCode}>复制</Button>
                </div>
                <Space wrap>
                  <Button onClick={onRegenerateInviteCode}>重新生成</Button>
                  <Button danger onClick={onDisableInviteCode}>
                    禁用
                  </Button>
                </Space>
              </Space>
            ) : (
              <Space direction="vertical">
                <span style={{ color: '#78716C' }}>尚未生成邀请码</span>
                <Button type="primary" onClick={onCreateInviteCode}>
                  生成邀请码
                </Button>
              </Space>
            )}
          </Card>
          <Card title="当前团队成员" style={{ marginBottom: 16 }} loading={membersLoading}>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={teamMembers}
              locale={{ emptyText: '暂无成员' }}
              columns={[
                { title: '姓名', dataIndex: 'name' },
                { title: '用户名', dataIndex: 'username' },
                {
                  title: '角色',
                  dataIndex: 'role',
                  render: (role: string) =>
                    role === 'LEADER' ? <Tag color="gold">负责人</Tag> : <Tag color="blue">学员</Tag>,
                },
                {
                  title: '操作',
                  render: (_, r) =>
                    r.role === 'USER' ? (
                      <Popconfirm
                        title={`确定将「${r.name}」移出团队？`}
                        description="移出后该学员需重新通过邀请加入。"
                        okText="移出"
                        cancelText="取消"
                        okButtonProps={{ danger: true, loading: removingId === r.id }}
                        onConfirm={() => onRemoveMember(r.id)}
                      >
                        <Button type="link" size="small" danger loading={removingId === r.id}>
                          移出团队
                        </Button>
                      </Popconfirm>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          </Card>
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input.Search
              placeholder="搜索用户名/姓名"
              allowClear
              onSearch={setKeyword}
              style={{ width: 240 }}
            />
            <Button type="primary" onClick={() => { inviteForm.resetFields(); setInviteOpen(true); }}>
              邀请成员
            </Button>
          </div>
          <Table
            rowKey="id"
            size="small"
            style={{ marginBottom: 16 }}
            dataSource={candidates}
            pagination={false}
            columns={[
              { title: '姓名', dataIndex: 'name' },
              { title: '用户名', dataIndex: 'username' },
              {
                title: '状态',
                render: (_, r) =>
                  r.pendingInvite ? <Tag color="processing">已邀请待回复</Tag> : <Tag>可邀请</Tag>,
              },
              {
                title: '操作',
                render: (_, r) => (
                  <Button
                    type="link"
                    size="small"
                    disabled={r.pendingInvite}
                    onClick={() => {
                      inviteForm.setFieldsValue({ inviteeId: r.id });
                      setInviteOpen(true);
                    }}
                  >
                    邀请
                  </Button>
                ),
              },
            ]}
          />
          <Card title="已发出的邀请">
            <Table rowKey="id" loading={loading} columns={sentColumns} dataSource={sent} pagination={false} />
          </Card>
        </>
      )}
      <Modal title="邀请成员加入团队" open={inviteOpen} onOk={onInvite} onCancel={() => setInviteOpen(false)} destroyOnClose>
        <Form form={inviteForm} layout="vertical">
          <Form.Item name="inviteeId" label="选择学员" rules={[{ required: true, message: '请选择学员' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择尚未加入团队的学员"
              options={candidates
                .filter((c) => !c.pendingInvite)
                .map((c) => ({ value: c.id, label: `${c.name}（${c.username}）` }))}
            />
          </Form.Item>
          <Form.Item name="message" label="邀请留言">
            <Input.TextArea rows={2} placeholder="可选" maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  if (applyOnly) {
    return applyTab;
  }

  const body = (
    <Tabs
      items={[
        { key: 'apply', label: '创建申请', children: applyTab },
        { key: 'invite', label: '邀请成员', children: inviteTab, disabled: ownerTeams.length === 0 },
      ]}
    />
  );

  if (embedded) {
    return body;
  }

  return <Card title="团队管理">{body}</Card>;
}
