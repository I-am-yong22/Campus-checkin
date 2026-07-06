import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  TimePicker,
  message,
} from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../api/admin';
import {
  kioskDisplayApi,
  type BirthdayShow,
  type CarouselSlide,
  type KioskCountdown,
  type MissionBoard,
} from '../../api/kioskDisplay';
import type { Team, User } from '../../types';

export default function AdminKioskDisplay() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [carousel, setCarousel] = useState<CarouselSlide[]>([]);
  const [countdowns, setCountdowns] = useState<KioskCountdown[]>([]);
  const [boards, setBoards] = useState<MissionBoard[]>([]);
  const [birthdays, setBirthdays] = useState<BirthdayShow[]>([]);
  const [birthdayMonth, setBirthdayMonth] = useState(dayjs());

  const [carouselOpen, setCarouselOpen] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  const [carouselForm] = Form.useForm();
  const [countdownForm] = Form.useForm();
  const [boardForm] = Form.useForm();
  const [birthdayForm] = Form.useForm();

  useEffect(() => {
    adminApi.listTeams().then(setTeams);
    adminApi.listUsers({ pageSize: 500 }).then((r) => setUsers(r.items));
  }, []);

  const loadCarousel = useCallback(async () => {
    setCarousel(await kioskDisplayApi.listCarousel());
  }, []);
  const loadCountdowns = useCallback(async () => {
    setCountdowns(await kioskDisplayApi.listCountdowns());
  }, []);
  const loadBoards = useCallback(async () => {
    setBoards(await kioskDisplayApi.listMissionBoards());
  }, []);
  const loadBirthdays = useCallback(async () => {
    setBirthdays(await kioskDisplayApi.listBirthdays(birthdayMonth.format('YYYY-MM')));
  }, [birthdayMonth]);

  useEffect(() => {
    loadCarousel();
    loadCountdowns();
    loadBoards();
  }, [loadCarousel, loadCountdowns, loadBoards]);

  useEffect(() => {
    loadBirthdays();
  }, [loadBirthdays]);

  const carouselCols: ColumnsType<CarouselSlide> = [
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    { title: '标题', dataIndex: 'title' },
    { title: '图片 URL', dataIndex: 'imageUrl', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              carouselForm.setFieldsValue(row);
              setCarouselOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => kioskDisplayApi.deleteCarousel(row.id).then(loadCarousel)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const countdownCols: ColumnsType<KioskCountdown> = [
    { title: '标题', dataIndex: 'title' },
    {
      title: '目标时间',
      dataIndex: 'targetAt',
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              countdownForm.setFieldsValue({
                ...row,
                targetAt: dayjs(row.targetAt),
              });
              setCountdownOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => kioskDisplayApi.deleteCountdown(row.id).then(loadCountdowns)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const boardCols: ColumnsType<MissionBoard> = [
    { title: '标题', dataIndex: 'title' },
    {
      title: '团队',
      dataIndex: ['team', 'name'],
      render: (_, r) => r.team?.name || '—',
    },
    {
      title: '截止',
      dataIndex: 'deadlineAt',
      render: (v) => (v ? dayjs(v).format('MM-DD HH:mm') : '—'),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              boardForm.setFieldsValue({
                ...row,
                deadlineAt: row.deadlineAt ? dayjs(row.deadlineAt) : undefined,
              });
              setBoardOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => kioskDisplayApi.deleteMissionBoard(row.id).then(loadBoards)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const birthdayCols: ColumnsType<BirthdayShow> = [
    {
      title: '日期',
      dataIndex: 'date',
    },
    {
      title: '寿星',
      render: (_, r) => r.user?.name || r.userId,
    },
    { title: '开始展示', dataIndex: 'startTime' },
    { title: '祝福语', dataIndex: 'message', ellipsis: true },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v) => (v ? '是' : '否'),
    },
    {
      title: '操作',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => {
              birthdayForm.setFieldsValue({
                ...row,
                date: dayjs(row.date),
                startTime: dayjs(row.startTime, 'HH:mm'),
              });
              setBirthdayOpen(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => kioskDisplayApi.deleteBirthday(row.id).then(loadBirthdays)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const saveCarousel = async () => {
    const v = await carouselForm.validateFields();
    await kioskDisplayApi.saveCarousel(v);
    message.success('已保存');
    setCarouselOpen(false);
    loadCarousel();
  };

  const saveCountdown = async () => {
    const v = await countdownForm.validateFields();
    await kioskDisplayApi.saveCountdown({
      ...v,
      targetAt: v.targetAt.toISOString(),
    });
    message.success('已保存');
    setCountdownOpen(false);
    loadCountdowns();
  };

  const saveBoard = async () => {
    const v = await boardForm.validateFields();
    await kioskDisplayApi.saveMissionBoard({
      ...v,
      deadlineAt: v.deadlineAt ? v.deadlineAt.toISOString() : undefined,
    });
    message.success('已保存');
    setBoardOpen(false);
    loadBoards();
  };

  const saveBirthday = async () => {
    const v = await birthdayForm.validateFields();
    await kioskDisplayApi.saveBirthday({
      ...v,
      date: v.date.format('YYYY-MM-DD'),
      startTime: v.startTime.format('HH:mm'),
    });
    message.success('已保存');
    setBirthdayOpen(false);
    loadBirthdays();
  };

  return (
    <div>
      <Card title="打卡机待机展示" bordered={false}>
        <p style={{ marginBottom: 16, color: '#78716c' }}>
          配置打卡机非出勤时段的全屏轮播：轮播图、倒计时、团队任务看板、生日庆祝。保存后打卡机约 30 秒内自动刷新。
        </p>
        <Tabs
          items={[
            {
              key: 'carousel',
              label: '轮播图',
              children: (
                <>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ marginBottom: 12 }}
                    onClick={() => {
                      carouselForm.resetFields();
                      carouselForm.setFieldsValue({ enabled: true, sortOrder: carousel.length });
                      setCarouselOpen(true);
                    }}
                  >
                    新增轮播
                  </Button>
                  <Table rowKey="id" columns={carouselCols} dataSource={carousel} pagination={false} size="small" />
                </>
              ),
            },
            {
              key: 'countdown',
              label: '倒计时',
              children: (
                <>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ marginBottom: 12 }}
                    onClick={() => {
                      countdownForm.resetFields();
                      countdownForm.setFieldsValue({ enabled: true, sortOrder: countdowns.length });
                      setCountdownOpen(true);
                    }}
                  >
                    新增倒计时
                  </Button>
                  <Table rowKey="id" columns={countdownCols} dataSource={countdowns} pagination={false} size="small" />
                </>
              ),
            },
            {
              key: 'mission',
              label: '任务看板',
              children: (
                <>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ marginBottom: 12 }}
                    onClick={() => {
                      boardForm.resetFields();
                      boardForm.setFieldsValue({
                        enabled: true,
                        sortOrder: boards.length,
                        gaps: [{ deliverable: '', assignees: '' }],
                        progress: [{ label: '', percent: 0 }],
                      });
                      setBoardOpen(true);
                    }}
                  >
                    新增看板
                  </Button>
                  <Table rowKey="id" columns={boardCols} dataSource={boards} pagination={false} size="small" />
                </>
              ),
            },
            {
              key: 'birthday',
              label: '生日庆祝',
              children: (
                <>
                  <Space style={{ marginBottom: 12 }}>
                    <DatePicker picker="month" value={birthdayMonth} onChange={(d) => d && setBirthdayMonth(d)} />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        birthdayForm.resetFields();
                        birthdayForm.setFieldsValue({
                          enabled: true,
                          date: dayjs(),
                          startTime: dayjs('09:00', 'HH:mm'),
                        });
                        setBirthdayOpen(true);
                      }}
                    >
                      新增生日展示
                    </Button>
                  </Space>
                  <Table rowKey="id" columns={birthdayCols} dataSource={birthdays} pagination={false} size="small" />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="轮播图" open={carouselOpen} onOk={saveCarousel} onCancel={() => setCarouselOpen(false)} destroyOnClose>
        <Form form={carouselForm} layout="vertical">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="轮播图1" />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片 URL（留空则灰色占位）">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="倒计时" open={countdownOpen} onOk={saveCountdown} onCancel={() => setCountdownOpen(false)} destroyOnClose>
        <Form form={countdownForm} layout="vertical">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="暑期实践结束" />
          </Form.Item>
          <Form.Item name="targetAt" label="目标时间" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="任务看板"
        open={boardOpen}
        onOk={saveBoard}
        onCancel={() => setBoardOpen(false)}
        width={720}
        destroyOnClose
      >
        <Form form={boardForm} layout="vertical">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="teamId" label="关联团队">
            <Select allowClear placeholder="可选">
              {teams.map((t) => (
                <Select.Option key={t.id} value={t.id}>
                  {t.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="deadlineAt" label="截止时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="headline" label="概要说明（可多行）">
            <Input.TextArea rows={4} placeholder="距离比赛结束不足4小时，缺：..." />
          </Form.Item>
          <Form.Item label="缺项清单">
            <Form.List name="gaps">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...rest} name={[name, 'deliverable']} rules={[{ required: true, message: '交付物' }]}>
                        <Input placeholder="交付物" style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'assignees']} rules={[{ required: true, message: '负责人' }]}>
                        <Input placeholder="负责人（逗号分隔）" style={{ width: 220 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    添加缺项
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item label="完成进度">
            <Form.List name="progress">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item {...rest} name={[name, 'label']} rules={[{ required: true }]}>
                        <Input placeholder="标签" style={{ width: 120 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'percent']} rules={[{ required: true }]}>
                        <InputNumber min={0} max={100} addonAfter="%" style={{ width: 120 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ percent: 0 })} block icon={<PlusOutlined />}>
                    添加进度项
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="生日庆祝" open={birthdayOpen} onOk={saveBirthday} onCancel={() => setBirthdayOpen(false)} destroyOnClose>
        <Form form={birthdayForm} layout="vertical">
          <Form.Item name="id" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="userId" label="寿星" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={users.map((u) => ({ value: u.id, label: `${u.name}（${u.username}）` }))}
            />
          </Form.Item>
          <Form.Item name="date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="开始展示时间"
            rules={[{ required: true }]}
            extra="到达该时间后，打卡机将全屏展示生日庆祝（优先于打卡页面），直至当日结束"
          >
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="message" label="祝福语">
            <Input.TextArea rows={2} placeholder="祝你生日快乐！" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
