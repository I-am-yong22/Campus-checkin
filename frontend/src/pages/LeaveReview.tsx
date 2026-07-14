import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  formatLeavePeriod,
  leaveApi,
  WRITE_OFF_SCENARIO_LABEL,
} from '../api/leave';
import type { LeaveRequest } from '../types';

const { TextArea } = Input;

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'processing', text: '待审核' },
  APPROVED: { color: 'success', text: '已通过' },
  REJECTED: { color: 'error', text: '已驳回' },
};

const REVIEW_TARGET_LABEL: Record<string, string> = {
  LEADER: '项目负责人',
  ADMIN: '管理员',
};

export default function LeaveReview() {
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [reviewed, setReviewed] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([leaveApi.pending(), leaveApi.reviewed()]);
      setPending(p);
      setReviewed(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onApprove = async (record: LeaveRequest) => {
    await leaveApi.review(record.id, { status: 'APPROVED' });
    message.success(`已通过 ${record.user?.name} 的请假申请`);
    load();
  };

  const onWriteOff = async (record: LeaveRequest) => {
    await leaveApi.writeOff(record.id);
    message.success(`已核销 ${record.user?.name} 的请假`);
    load();
  };

  const onReject = async () => {
    if (!rejectTarget) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await leaveApi.review(rejectTarget.id, {
        status: 'REJECTED',
        reviewComment: values.reviewComment,
      });
      message.success('已驳回');
      setRejectTarget(null);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const periodColumn = {
    title: '请假时间',
    render: (_: unknown, r: LeaveRequest) => formatLeavePeriod(r),
  };

  const pendingColumns: ColumnsType<LeaveRequest> = [
    { title: '申请人', dataIndex: ['user', 'name'], width: 100 },
    { title: '团队', render: (_, r) => r.user?.team?.name || '—', width: 120 },
    {
      title: '提交给',
      dataIndex: 'reviewTarget',
      width: 100,
      render: (v: string) => REVIEW_TARGET_LABEL[v] || v,
    },
    periodColumn,
    { title: '类型', dataIndex: 'type', width: 80 },
    { title: '事由', dataIndex: 'reason', ellipsis: true },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v) => dayjs(v).format('MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" onClick={() => onApprove(r)}>
            通过
          </Button>
          <Button type="link" size="small" danger onClick={() => setRejectTarget(r)}>
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const reviewedColumns: ColumnsType<LeaveRequest> = [
    { title: '申请人', dataIndex: ['user', 'name'], width: 100 },
    periodColumn,
    { title: '类型', dataIndex: 'type', width: 80 },
    {
      title: '结果',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.text}</Tag>,
    },
    {
      title: '核销',
      width: 150,
      render: (_, r) =>
        r.status === 'APPROVED' && !r.writeOff ? (
          <Popconfirm
            title="确认学员已返岗？核销后按返岗时间截断请假时段。"
            onConfirm={() => onWriteOff(r)}
          >
            <Button type="link" size="small">
              请假核销
            </Button>
          </Popconfirm>
        ) : r.writeOff ? (
          <span>
            {dayjs(r.writeOff.writeOffAt).format('MM-DD HH:mm')}
            <br />
            <Tag style={{ marginTop: 4 }}>
              {WRITE_OFF_SCENARIO_LABEL[r.writeOff.scenario] || r.writeOff.scenario}
            </Tag>
          </span>
        ) : (
          '—'
        ),
    },
    { title: '审核人', render: (_, r) => r.reviewer?.name || '—', width: 100 },
    { title: '意见', dataIndex: 'reviewComment', ellipsis: true, render: (v) => v || '—' },
    {
      title: '审核时间',
      dataIndex: 'reviewedAt',
      width: 160,
      render: (v) => (v ? dayjs(v).format('MM-DD HH:mm') : '—'),
    },
  ];

  return (
    <Card title="请假审核">
      <Tabs
        items={[
          {
            key: 'pending',
            label: `待审核 (${pending.length})`,
            children: (
              <Table
                rowKey="id"
                loading={loading}
                columns={pendingColumns}
                dataSource={pending}
                pagination={false}
                locale={{ emptyText: '暂无待审核申请' }}
                scroll={{ x: 1000 }}
              />
            ),
          },
          {
            key: 'reviewed',
            label: '已处理',
            children: (
              <Table
                rowKey="id"
                loading={loading}
                columns={reviewedColumns}
                dataSource={reviewed}
                pagination={{ pageSize: 10 }}
                locale={{ emptyText: '暂无已处理记录' }}
                scroll={{ x: 1100 }}
              />
            ),
          },
        ]}
      />

      <Modal
        title={`驳回 — ${rejectTarget?.user?.name}`}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          form.resetFields();
        }}
        onOk={onReject}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="reviewComment" label="驳回原因（选填）" rules={[{ max: 200 }]}>
            <TextArea rows={3} placeholder="可填写驳回说明" showCount maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
