import { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PlusOutlined, ReloadOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../api/admin';
import type { Role, Team, User } from '../../types';
import { avatarSrc } from '../../utils/avatar';

const { Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'USER', label: '普通用户' },
  { value: 'LEADER', label: '项目负责人' },
  { value: 'ADMIN', label: '管理员' },
];

const ROLE_TAG: Record<Role, { color: string; text: string }> = {
  USER: { color: 'blue', text: '普通用户' },
  LEADER: { color: 'gold', text: '负责人' },
  ADMIN: { color: 'red', text: '管理员' },
};

export default function AdminUsers() {
  const [data, setData] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | undefined>();
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await adminApi.listUsers({ page, pageSize, keyword: keyword || undefined, role: roleFilter });
      setData(resp.items);
      setTotal(resp.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi.listTeams().then(setTeams).catch(() => {});
  }, []);

  const teamOptions = teams.map((t) => ({ value: t.id, label: t.name }));

  const onCreate = async () => {
    const values = await createForm.validateFields();
    const res = await adminApi.createUser(values);
    message.success(`创建成功，初始密码：${res.initialPassword}`);
    setCreateOpen(false);
    createForm.resetFields();
    load();
  };

  const onEdit = async () => {
    const values = await editForm.validateFields();
    await adminApi.updateUser(editUser!.id, values);
    message.success('已保存');
    setEditUser(null);
    load();
  };

  const onReset = async (u: User) => {
    const res = await adminApi.resetPassword(u.id);
    Modal.success({ title: '密码已重置', content: `用户 ${u.username} 的新初始密码为：${res.initialPassword}（用户下次登录需修改）` });
  };

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '',
      width: 48,
      render: (_, r) => (
        <Avatar size="small" src={avatarSrc(r.avatarUrl)} icon={<UserOutlined />}>
          {!r.avatarUrl && r.name?.[0]}
        </Avatar>
      ),
    },
    { title: '用户名', dataIndex: 'username' },
    { title: '姓名', dataIndex: 'name' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (r: Role) => <Tag color={ROLE_TAG[r].color}>{ROLE_TAG[r].text}</Tag>,
    },
    { title: '团队', dataIndex: ['team', 'name'], render: (v) => v || '-' },
    { title: '手机号', dataIndex: 'phone', render: (v) => v || '-' },
    {
      title: '人脸',
      dataIndex: 'faceRegistered',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="green">已录入</Tag> : <Tag>未录入</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (v === 'ACTIVE' ? <Tag color="green">正常</Tag> : <Tag color="red">禁用</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, u) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => { setEditUser(u); editForm.setFieldsValue({ name: u.name, role: u.role, teamId: u.teamId, phone: u.phone, status: u.status }); }}>
            编辑
          </Button>
          <Button size="small" onClick={() => onReset(u)}>
            重置密码
          </Button>
          <Popconfirm title="确认删除该用户？" onConfirm={async () => { await adminApi.deleteUser(u.id); message.success('已删除'); load(); }}>
            <Button size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="用户管理"
      extra={
        <Space wrap>
          <Input.Search
            placeholder="搜索用户名/姓名"
            allowClear
            style={{ width: 200 }}
            onSearch={(v) => { setKeyword(v); setPage(1); }}
          />
          <Select
            placeholder="角色筛选"
            allowClear
            style={{ width: 130 }}
            options={ROLE_OPTIONS}
            onChange={(v) => { setRoleFilter(v); setPage(1); }}
          />
          <Button icon={<ReloadOutlined />} onClick={load} />
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            批量导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新增用户
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        scroll={{ x: 900 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 人`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      <Modal title="新增用户" open={createOpen} onOk={onCreate} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={createForm} layout="vertical" initialValues={{ role: 'USER' }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录用户名，唯一" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="初始密码" extra="留空则默认 123456，用户首次登录须修改">
            <Input placeholder="可留空，默认 123456" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="teamId" label="所属团队">
            <Select allowClear options={teamOptions} placeholder="选择团队（管理员可不选）" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑用户" open={!!editUser} onOk={onEdit} onCancel={() => setEditUser(null)} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item name="teamId" label="所属团队">
            <Select allowClear options={teamOptions} placeholder="选择团队" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ value: 'ACTIVE', label: '正常' }, { value: 'DISABLED', label: '禁用' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <ImportModal open={importOpen} teams={teams} onClose={() => setImportOpen(false)} onDone={load} />
    </Card>
  );
}

function ImportModal({ open, teams, onClose, onDone }: { open: boolean; teams: Team[]; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const teamByName = (name: string) => teams.find((t) => t.name === name)?.id;

  const onImport = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      message.warning('请输入要导入的用户');
      return;
    }
    const users = lines.map((line) => {
      const [username, name, role, teamName, phone] = line.split(',').map((s) => s?.trim());
      return {
        username,
        name: name || username,
        role: (role as Role) || 'USER',
        teamId: teamName ? teamByName(teamName) : undefined,
        phone: phone || undefined,
      };
    });
    setLoading(true);
    try {
      const res = await adminApi.importUsers(users);
      Modal.info({
        title: '导入结果',
        width: 520,
        content: (
          <div>
            <p>共 {res.total} 条，成功 {res.successCount} 条，失败 {res.failCount} 条。</p>
            <ul style={{ maxHeight: 240, overflow: 'auto' }}>
              {res.results.map((r: any) => (
                <li key={r.username}>
                  {r.username}：{r.success ? `成功（初始密码 ${r.initialPassword}）` : `失败 - ${r.message}`}
                </li>
              ))}
            </ul>
          </div>
        ),
      });
      setText('');
      onClose();
      onDone();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="批量导入用户" open={open} onOk={onImport} confirmLoading={loading} onCancel={onClose} width={560} destroyOnClose>
      <Text type="secondary">每行一个用户，逗号分隔：用户名,姓名,角色(USER/LEADER/ADMIN),团队名,手机号</Text>
      <Input.TextArea
        rows={10}
        style={{ marginTop: 8 }}
        placeholder={'例如：\nzhangsan,张三,USER,暑期实践一团,13800000000\nlisi,李四,LEADER,暑期实践一团'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>未填密码默认 123456；团队名需与已有团队完全一致，找不到则不分配团队。</Text>
    </Modal>
  );
}
