import { useCallback, useEffect, useState } from 'react';
import { Card, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { auditApi, type AuditLogRow } from '../../api/audit';

const ACTION_LABEL: Record<string, string> = {
  LOGIN: '登录',
  CHECKIN_MAKEUP: '补签',
  LEAVE_REVIEW: '请假审核',
  USER_DISABLE: '禁用用户',
  USER_RESET_PASSWORD: '重置密码',
  CHECKIN_RULE_UPDATE: '签到规则变更',
  CALENDAR_EXEMPTION_CREATE: '新增休息日',
  CALENDAR_EXEMPTION_DELETE: '删除休息日',
  TEAM_APPLICATION_APPROVE: '批准团队创建',
  TEAM_APPLICATION_REJECT: '驳回团队创建',
  TEAM_INVITE_SEND: '发送团队邀请',
  TEAM_INVITE_ACCEPT: '接受团队邀请',
  TEAM_INVITE_REJECT: '拒绝团队邀请',
  TEAM_INVITE_CANCEL: '撤销团队邀请',
  TEAM_LEAVE: '退出团队',
  TEAM_MEMBER_REMOVE: '移出团队成员',
};

export default function AdminAuditLogs() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ total: number; items: AuditLogRow[] }>({ total: 0, items: [] });
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({ page, pageSize: 20, action });
      setData({ total: res.total, items: res.items });
    } finally {
      setLoading(false);
    }
  }, [page, action]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<AuditLogRow> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 170,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作人',
      render: (_, r) => (r.user ? `${r.user.name}（${r.user.username}）` : '—'),
      width: 160,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 120,
      render: (v: string) => ACTION_LABEL[v] || v,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: true,
      render: (v) => {
        if (!v) return '—';
        try {
          const obj = JSON.parse(v);
          return Object.entries(obj)
            .map(([k, val]) => `${k}: ${val}`)
            .join('；');
        } catch {
          return v;
        }
      },
    },
  ];

  return (
    <Card
      title="操作审计日志"
      extra={
        <Select
          allowClear
          placeholder="筛选操作类型"
          style={{ width: 180 }}
          value={action}
          onChange={(v) => {
            setAction(v);
            setPage(1);
          }}
          options={Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))}
        />
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data.items}
        pagination={{
          current: page,
          pageSize: 20,
          total: data.total,
          onChange: setPage,
        }}
      />
    </Card>
  );
}
