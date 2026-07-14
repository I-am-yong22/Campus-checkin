import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  TimePicker,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import {
  formatLeavePeriod,
  leaveApi,
  WRITE_OFF_SCENARIO_LABEL,
} from '../api/leave';
import { useAuth } from '../store/AuthContext';
import type { LeaveRequest, LeaveReviewTarget } from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const TYPE_OPTIONS = [
  { value: '事假', label: '事假' },
  { value: '病假', label: '病假' },
  { value: '其他', label: '其他' },
];

const REVIEW_TARGET_OPTIONS = [
  { value: 'LEADER', label: '项目负责人' },
  { value: 'ADMIN', label: '管理员' },
];

const REVIEW_TARGET_LABEL: Record<LeaveReviewTarget, string> = {
  LEADER: '项目负责人',
  ADMIN: '管理员',
};

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'processing', text: '待审核' },
  APPROVED: { color: 'success', text: '已通过' },
  REJECTED: { color: 'error', text: '已驳回' },
};

export default function Leave() {
  const { user } = useAuth();
  const isLeader = user?.role === 'LEADER';
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const leaveMode = Form.useWatch('leaveMode', form);
  const range = Form.useWatch('range', form) as [Dayjs, Dayjs] | undefined;
  const isSingleDay =
    range?.[0] && range?.[1] && range[0].format('YYYY-MM-DD') === range[1].format('YYYY-MM-DD');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await leaveApi.mine());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async () => {
    const values = await form.validateFields();
    const [start, end] = values.range;
    const single = start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD');
    const mode = single && values.leaveMode === 'HOURLY' ? 'HOURLY' : 'FULL_DAY';

    if (mode === 'HOURLY') {
      const hours = values.durationHours ?? 0;
      const mins = values.durationMinutes ?? 0;
      if (hours * 60 + mins < 60) {
        message.error('按小时请假最少 1 小时');
        return;
      }
    }

    setSubmitting(true);
    try {
      await leaveApi.create({
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        type: values.type,
        reason: values.reason,
        reviewTarget: isLeader ? 'ADMIN' : values.reviewTarget,
        leaveMode: mode,
        ...(mode === 'HOURLY'
          ? {
              startTime: (values.startTime as Dayjs).format('HH:mm'),
              durationHours: values.durationHours ?? 0,
              durationMinutes: values.durationMinutes ?? 0,
            }
          : {}),
      });
      message.success('请假申请已提交');
      setModalOpen(false);
      form.resetFields();
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = async (id: number) => {
    await leaveApi.cancel(id);
    message.success('已撤销申请');
    load();
  };

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: '请假时间',
      render: (_, r) => formatLeavePeriod(r),
    },
    { title: '类型', dataIndex: 'type', width: 80 },
    {
      title: '提交给',
      dataIndex: 'reviewTarget',
      width: 110,
      render: (v: LeaveReviewTarget) => REVIEW_TARGET_LABEL[v] || v,
    },
    {
      title: '事由',
      dataIndex: 'reason',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.text || v}</Tag>,
    },
    {
      title: '核销',
      width: 140,
      render: (_, r) =>
        r.writeOff ? (
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
    {
      title: '审核意见',
      dataIndex: 'reviewComment',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      width: 150,
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      width: 90,
      render: (_, r) =>
        r.status === 'PENDING' ? (
          <Popconfirm title="确定撤销该申请？" onConfirm={() => onCancel(r.id)}>
            <Button type="link" size="small" danger>
              撤销
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  return (
    <Card
      title="请假申请"
      extra={
        <Button type="primary" onClick={() => setModalOpen(true)}>
          新建申请
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无请假记录' }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title="新建请假申请"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={onSubmit}
        confirmLoading={submitting}
        destroyOnClose
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: '事假',
            reviewTarget: 'LEADER',
            leaveMode: 'FULL_DAY',
            durationHours: 1,
            durationMinutes: 0,
          }}
        >
          {isLeader ? (
            <Alert
              type="info"
              showIcon
              message="负责人请假将提交给管理员审批"
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Form.Item
              name="reviewTarget"
              label="提交给"
              rules={[{ required: true, message: '请选择审批人' }]}
            >
              <Select options={REVIEW_TARGET_OPTIONS} />
            </Form.Item>
          )}
          <Form.Item
            name="range"
            label="请假日期"
            rules={[{ required: true, message: '请选择请假日期' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          {isSingleDay && (
            <>
              <Form.Item name="leaveMode" label="请假方式">
                <Radio.Group>
                  <Radio value="FULL_DAY">整天</Radio>
                  <Radio value="HOURLY">按小时</Radio>
                </Radio.Group>
              </Form.Item>
              {leaveMode === 'HOURLY' && (
                <>
                  <Form.Item
                    name="startTime"
                    label="开始时刻"
                    rules={[{ required: true, message: '请选择开始时刻' }]}
                  >
                    <TimePicker format="HH:mm" style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="请假时长（最少 1 小时）" required>
                    <Space>
                      <Form.Item name="durationHours" noStyle>
                        <InputNumber min={0} max={23} addonAfter="小时" />
                      </Form.Item>
                      <Form.Item name="durationMinutes" noStyle>
                        <InputNumber min={0} max={59} addonAfter="分钟" />
                      </Form.Item>
                    </Space>
                  </Form.Item>
                </>
              )}
            </>
          )}
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item
            name="reason"
            label="事由说明"
            rules={[{ required: true, message: '请填写事由' }, { max: 500 }]}
          >
            <TextArea rows={4} placeholder="请简要说明请假原因" showCount maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
