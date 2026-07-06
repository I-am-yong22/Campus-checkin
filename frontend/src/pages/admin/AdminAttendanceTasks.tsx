import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import {
  attendanceApi,
  type AttendanceTask,
  type PlatformAttendanceRule,
} from '../../api/attendance';

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  DRAFT: { color: 'default', text: '草稿' },
  PUBLISHED: { color: 'green', text: '已发布' },
  CANCELLED: { color: 'red', text: '已取消' },
};

export default function AdminAttendanceTasks() {
  const [platformRule, setPlatformRule] = useState<PlatformAttendanceRule | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [month, setMonth] = useState(dayjs());
  const [data, setData] = useState<AttendanceTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<AttendanceTask | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  const loadPlatformRule = useCallback(async () => {
    const rule = await attendanceApi.getPlatformRule();
    setPlatformRule(rule);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await attendanceApi.listTasks({ month: month.format('YYYY-MM') });
      setData(list);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    loadPlatformRule();
    load();
  }, [load, loadPlatformRule]);

  const openRuleEdit = () => {
    if (!platformRule) return;
    ruleForm.setFieldsValue({
      startTime: dayjs(platformRule.startTime, 'HH:mm'),
      lateTime: dayjs(platformRule.lateTime, 'HH:mm'),
      endTime: dayjs(platformRule.endTime, 'HH:mm'),
      checkOutStart: dayjs(platformRule.checkOutStart, 'HH:mm'),
      checkOutEnd: dayjs(platformRule.checkOutEnd, 'HH:mm'),
      enabled: platformRule.enabled,
    });
    setRuleOpen(true);
  };

  const onSavePlatformRule = async () => {
    const v = await ruleForm.validateFields();
    await attendanceApi.updatePlatformRule({
      startTime: v.startTime.format('HH:mm'),
      lateTime: v.lateTime.format('HH:mm'),
      endTime: v.endTime.format('HH:mm'),
      checkOutStart: v.checkOutStart.format('HH:mm'),
      checkOutEnd: v.checkOutEnd.format('HH:mm'),
      enabled: v.enabled,
    });
    message.success('平台默认规则已更新');
    setRuleOpen(false);
    loadPlatformRule();
  };

  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(),
      checkInStart: dayjs(platformRule?.startTime || '08:00', 'HH:mm'),
      lateTime: dayjs(platformRule?.lateTime || '09:00', 'HH:mm'),
      checkInEnd: dayjs(platformRule?.endTime || '10:00', 'HH:mm'),
      checkOutStart: dayjs(platformRule?.checkOutStart || '17:00', 'HH:mm'),
      checkOutEnd: dayjs(platformRule?.checkOutEnd || '18:00', 'HH:mm'),
    });
    setCreateOpen(true);
  };

  const onCreate = async () => {
    const v = await form.validateFields();
    await attendanceApi.createTask({
      date: v.date.format('YYYY-MM-DD'),
      checkInStart: v.checkInStart.format('HH:mm'),
      lateTime: v.lateTime.format('HH:mm'),
      checkInEnd: v.checkInEnd.format('HH:mm'),
      checkOutStart: v.checkOutStart.format('HH:mm'),
      checkOutEnd: v.checkOutEnd.format('HH:mm'),
      note: v.note,
    });
    message.success('全平台出勤任务已创建（草稿）');
    setCreateOpen(false);
    load();
  };

  const openEdit = (t: AttendanceTask) => {
    setEditTask(t);
    editForm.setFieldsValue({
      checkInStart: dayjs(t.checkInStart, 'HH:mm'),
      lateTime: dayjs(t.lateTime, 'HH:mm'),
      checkInEnd: dayjs(t.checkInEnd, 'HH:mm'),
      checkOutStart: dayjs(t.checkOutStart, 'HH:mm'),
      checkOutEnd: dayjs(t.checkOutEnd, 'HH:mm'),
      note: t.note,
    });
  };

  const onSaveEdit = async () => {
    const v = await editForm.validateFields();
    await attendanceApi.updateTask(editTask!.id, {
      checkInStart: v.checkInStart.format('HH:mm'),
      lateTime: v.lateTime.format('HH:mm'),
      checkInEnd: v.checkInEnd.format('HH:mm'),
      checkOutStart: v.checkOutStart.format('HH:mm'),
      checkOutEnd: v.checkOutEnd.format('HH:mm'),
      note: v.note,
    });
    message.success('已保存');
    setEditTask(null);
    load();
  };

  const columns: ColumnsType<AttendanceTask> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '签到时段',
      render: (_, r) => `${r.checkInStart}–${r.checkInEnd}（${r.lateTime} 后迟到）`,
    },
    {
      title: '签退时段',
      render: (_, r) => `${r.checkOutStart}–${r.checkOutEnd}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => {
        const t = STATUS_TAG[v];
        return <Tag color={t?.color}>{t?.text || v}</Tag>;
      },
    },
    { title: '备注', dataIndex: 'note', render: (v) => v || '—' },
    {
      title: '操作',
      width: 220,
      render: (_, r) => (
        <Space wrap>
          {r.status === 'DRAFT' && (
            <>
              <Button size="small" onClick={() => openEdit(r)}>编辑</Button>
              <Popconfirm title="发布后当日将覆盖平台默认规则，全团队生效" onConfirm={async () => {
                await attendanceApi.publishTask(r.id);
                message.success('已发布');
                load();
              }}>
                <Button size="small" type="primary">发布</Button>
              </Popconfirm>
            </>
          )}
          {r.status === 'PUBLISHED' && (
            <Popconfirm title="确认取消该日出勤任务？" onConfirm={async () => {
              await attendanceApi.cancelTask(r.id);
              message.success('已取消');
              load();
            }}>
              <Button size="small" danger>取消</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title="平台默认规则"
        style={{ marginBottom: 16 }}
        extra={<Button onClick={openRuleEdit} disabled={!platformRule}>编辑默认规则</Button>}
      >
        {platformRule ? (
          <Space direction="vertical" size={4}>
            <span>
              签到：{platformRule.startTime}–{platformRule.endTime}（{platformRule.lateTime} 后迟到）
            </span>
            <span>
              签退：{platformRule.checkOutStart}–{platformRule.checkOutEnd}
              {!platformRule.enabled && '（已停用）'}
            </span>
            <span style={{ color: '#999', fontSize: 12 }}>
              签到机与全员打卡均使用此规则；按日任务发布后可覆盖当日时段。
            </span>
          </Space>
        ) : (
          '加载中…'
        )}
      </Card>

      <Card
        title="全平台出勤任务"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建任务
          </Button>
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
        </Space>

        <Table rowKey="id" loading={loading} columns={columns} dataSource={data} scroll={{ x: 900 }} />
      </Card>

      <Modal title="编辑平台默认规则" open={ruleOpen} onOk={onSavePlatformRule} onCancel={() => setRuleOpen(false)} destroyOnClose width={520}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="startTime" label="签到开始" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lateTime" label="迟到时间点" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="endTime" label="签到截止" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutStart" label="签退开始" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutEnd" label="签退截止" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新建全平台出勤任务" open={createOpen} onOk={onCreate} onCancel={() => setCreateOpen(false)} destroyOnClose width={520}>
        <Form form={form} layout="vertical">
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkInStart" label="签到开始" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lateTime" label="迟到时间点" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkInEnd" label="签到截止" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutStart" label="签退开始" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutEnd" label="签退截止" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="如：外出实训、加班任务；含「免打卡」则当日全员免出勤" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`编辑任务 - ${editTask?.date}`} open={!!editTask} onOk={onSaveEdit} onCancel={() => setEditTask(null)} destroyOnClose width={520}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="checkInStart" label="签到开始" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lateTime" label="迟到时间点" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkInEnd" label="签到截止" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutStart" label="签退开始" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="checkOutEnd" label="签退截止" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

