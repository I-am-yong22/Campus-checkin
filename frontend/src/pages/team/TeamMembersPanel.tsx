import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Spin,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import { DownloadOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { checkInApi } from '../../api/checkin';
import { exportApi } from '../../api/export';
import { teamsApi, type AttendanceStatus, type TeamMemberRow } from '../../api/teams';
import { useAuth } from '../../store/AuthContext';
import { avatarSrc } from '../../utils/avatar';
import { brand, chartColors } from '../../theme';

const ROLE_TAG: Record<string, { color: string; text: string }> = {
  USER: { color: 'blue', text: '学员' },
  LEADER: { color: 'gold', text: '负责人' },
};

const ATTENDANCE_TAG: Record<AttendanceStatus, { color: string; text: string }> = {
  ON_DUTY: { color: 'processing', text: '在岗' },
  COMPLETED: { color: 'green', text: '已完成' },
  MAKEUP: { color: 'blue', text: '补签' },
  ON_LEAVE: { color: 'purple', text: '请假' },
  ABSENT: { color: 'default', text: '缺勤' },
  EXEMPT: { color: 'cyan', text: '休息日' },
};

interface Props {
  teamId?: number;
  canPickTeam?: boolean;
}

export default function TeamMembersPanel({ teamId, canPickTeam = false }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [date, setDate] = useState<Dayjs>(dayjs());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof teamsApi.members>> | null>(null);
  const [makeupTarget, setMakeupTarget] = useState<TeamMemberRow | null>(null);
  const [makeupForm] = Form.useForm();
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!teamId && canPickTeam) return;
    setLoading(true);
    try {
      const res = await teamsApi.members({
        teamId: teamId || undefined,
        date: date.format('YYYY-MM-DD'),
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [teamId, date, canPickTeam]);

  useEffect(() => {
    load();
  }, [load]);

  const onMakeup = async () => {
    const v = await makeupForm.validateFields();
    await checkInApi.makeup({
      userId: makeupTarget!.id,
      date: date.format('YYYY-MM-DD'),
      remark: v.remark,
    });
    message.success('补签成功');
    setMakeupTarget(null);
    makeupForm.resetFields();
    load();
  };

  const columns: ColumnsType<TeamMemberRow> = useMemo(
    () => [
      {
        title: '',
        width: 48,
        render: (_, r) => (
          <Avatar size="small" src={avatarSrc(r.avatarUrl)} icon={<UserOutlined />}>
            {!r.avatarUrl && r.name?.[0]}
          </Avatar>
        ),
      },
      { title: '姓名', dataIndex: 'name', width: 100 },
      { title: '用户名', dataIndex: 'username', width: 110 },
      {
        title: '角色',
        dataIndex: 'role',
        width: 90,
        render: (v: string) => <Tag color={ROLE_TAG[v]?.color}>{ROLE_TAG[v]?.text || v}</Tag>,
      },
      {
        title: '出勤状态',
        width: 100,
        render: (_, r) => {
          const tag = ATTENDANCE_TAG[r.attendanceStatus];
          return <Tag color={tag?.color}>{tag?.text || r.attendanceStatus}</Tag>;
        },
      },
      {
        title: '签到时间',
        render: (_, r) => (r.checkIn ? dayjs(r.checkIn.checkInAt).format('HH:mm:ss') : '—'),
        width: 100,
      },
      {
        title: '操作',
        width: 90,
        render: (_, r) =>
          r.attendanceStatus === 'ABSENT' ? (
            <Button type="link" size="small" onClick={() => setMakeupTarget(r)}>
              补签
            </Button>
          ) : null,
      },
    ],
    [],
  );

  if (!teamId) {
    return <div style={{ color: '#78716C' }}>请先选择团队</div>;
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 8, color: '#666' }}>查看日期</div>
            <DatePicker
              style={{ width: '100%' }}
              value={date}
              onChange={(v) => v && setDate(v)}
              allowClear={false}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <div style={{ marginBottom: 8, color: '#666' }}>&nbsp;</div>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportApi.teamDaily({
                    teamId,
                    date: date.format('YYYY-MM-DD'),
                  });
                  message.success('导出成功');
                } finally {
                  setExporting(false);
                }
              }}
            >
              导出签到
            </Button>
          </Col>
        </Row>
      </Card>

      {data && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="团队人数" value={data.summary.total} suffix="人" />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic title="缺勤" value={data.summary.absent} valueStyle={{ color: '#999' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data?.members || []}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '暂无成员数据' }}
      />

      <Modal
        title={`补签 - ${makeupTarget?.name}`}
        open={!!makeupTarget}
        onOk={onMakeup}
        onCancel={() => setMakeupTarget(null)}
        destroyOnClose
      >
        <Form form={makeupForm} layout="vertical">
          <Form.Item label="日期">
            <Input value={date.format('YYYY-MM-DD')} disabled />
          </Form.Item>
          <Form.Item name="remark" label="补签原因" rules={[{ required: true, message: '请填写补签原因' }]}>
            <Input.TextArea rows={3} placeholder="如：设备故障、外出公干等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
