import { useCallback, useEffect, useState } from 'react';

import {

  Button,

  DatePicker,

  Form,

  Input,

  Modal,

  Popconfirm,

  Space,

  Table,

  message,

} from 'antd';

import { PlusOutlined } from '@ant-design/icons';

import dayjs from 'dayjs';

import type { ColumnsType } from 'antd/es/table';

import { adminApi } from '../../../api/admin';

import { calendarApi, type CalendarExemption } from '../../../api/calendar';

import type { Team } from '../../../types';



interface TeamRow extends Team {

  memberCount: number;

}



interface Props {

  onTeamsChanged?: () => void;

}



export default function TeamsManagePanel({ onTeamsChanged }: Props) {

  const [data, setData] = useState<TeamRow[]>([]);

  const [loading, setLoading] = useState(false);

  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const [exemptTeam, setExemptTeam] = useState<TeamRow | null>(null);

  const [exemptions, setExemptions] = useState<CalendarExemption[]>([]);

  const [exemptOpen, setExemptOpen] = useState(false);

  const [form] = Form.useForm();

  const [exemptForm] = Form.useForm();



  const load = useCallback(async () => {

    setLoading(true);

    try {

      const teams = await adminApi.listTeams();

      setData(teams as TeamRow[]);

    } finally {

      setLoading(false);

    }

  }, []);



  useEffect(() => {

    load();

  }, [load]);



  const notifyChanged = () => {

    load();

    onTeamsChanged?.();

  };



  const loadExemptions = useCallback(async (teamId: number) => {

    const list = await calendarApi.list({ teamId });

    setExemptions(list);

  }, []);



  const openCreate = () => {

    form.resetFields();

    setEditTeam(null);

    setCreateOpen(true);

  };



  const openEdit = (t: TeamRow) => {

    setEditTeam(t);

    form.setFieldsValue({ name: t.name, description: t.description });

    setCreateOpen(true);

  };



  const onSave = async () => {

    const v = await form.validateFields();

    if (editTeam) {

      await adminApi.updateTeam(editTeam.id, v);

      message.success('已保存');

    } else {

      await adminApi.createTeam(v);

      message.success('团队已创建');

    }

    setCreateOpen(false);

    notifyChanged();

  };



  const openExempt = async (t: TeamRow) => {

    setExemptTeam(t);

    await loadExemptions(t.id);

  };



  const onAddExempt = async () => {

    const v = await exemptForm.validateFields();

    await calendarApi.create({

      teamId: exemptTeam!.id,

      date: v.date.format('YYYY-MM-DD'),

      reason: v.reason,

    });

    message.success('休息日已添加');

    setExemptOpen(false);

    exemptForm.resetFields();

    loadExemptions(exemptTeam!.id);

  };



  const columns: ColumnsType<TeamRow> = [

    { title: 'ID', dataIndex: 'id', width: 60 },

    { title: '团队名称', dataIndex: 'name' },

    { title: '说明', dataIndex: 'description', render: (v) => v || '-' },

    { title: '成员数', dataIndex: 'memberCount', width: 90 },

    {

      title: '操作',

      key: 'action',

      width: 240,

      render: (_, t) => (

        <Space wrap>

          <Button size="small" onClick={() => openEdit(t)}>编辑</Button>

          <Button size="small" onClick={() => openExempt(t)}>休息日</Button>

          <Popconfirm title="确认删除该团队？" onConfirm={async () => { await adminApi.deleteTeam(t.id); message.success('已删除'); notifyChanged(); }}>

            <Button size="small" danger>删除</Button>

          </Popconfirm>

        </Space>

      ),

    },

  ];



  const exemptColumns: ColumnsType<CalendarExemption> = [

    { title: '日期', dataIndex: 'date', width: 120 },

    { title: '范围', render: (_, r) => (r.teamId ? exemptTeam?.name : '全局') },

    { title: '原因', dataIndex: 'reason', render: (v) => v || '—' },

    {

      title: '操作',

      width: 80,

      render: (_, r) => (

        <Popconfirm

          title="确认删除该休息日？"

          onConfirm={async () => {

            await calendarApi.remove(r.id);

            message.success('已删除');

            loadExemptions(exemptTeam!.id);

          }}

        >

          <Button size="small" danger>删除</Button>

        </Popconfirm>

      ),

    },

  ];



  return (

    <>

      <div style={{ marginBottom: 16, textAlign: 'right' }}>

        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>

          新增团队

        </Button>

      </div>

      <Table rowKey="id" loading={loading} columns={columns} dataSource={data} scroll={{ x: 700 }} />



      <Modal title={editTeam ? '编辑团队' : '新增团队'} open={createOpen} onOk={onSave} onCancel={() => setCreateOpen(false)} destroyOnClose>

        <Form form={form} layout="vertical">

          <Form.Item name="name" label="团队名称" rules={[{ required: true, message: '请输入团队名称' }]}>

            <Input />

          </Form.Item>

          <Form.Item name="description" label="说明">

            <Input.TextArea rows={3} />

          </Form.Item>

        </Form>

      </Modal>



      <Modal

        title={`休息日配置 - ${exemptTeam?.name || ''}`}

        open={!!exemptTeam}

        onCancel={() => setExemptTeam(null)}

        footer={null}

        width={640}

        destroyOnClose

      >

        <div style={{ marginBottom: 12 }}>

          <Button type="primary" onClick={() => { exemptForm.resetFields(); setExemptOpen(true); }}>

            添加团队休息日

          </Button>

          <span style={{ marginLeft: 12, color: '#999', fontSize: 12 }}>

            全局休息日请在数据库或后续全局配置中添加（teamId 为空）

          </span>

        </div>

        <Table

          rowKey="id"

          size="small"

          columns={exemptColumns}

          dataSource={exemptions.filter((e) => e.teamId === exemptTeam?.id || e.teamId === null)}

          pagination={false}

        />

      </Modal>



      <Modal title="添加休息日" open={exemptOpen} onOk={onAddExempt} onCancel={() => setExemptOpen(false)} destroyOnClose>

        <Form form={exemptForm} layout="vertical">

          <Form.Item name="date" label="日期" rules={[{ required: true, message: '请选择日期' }]}>

            <DatePicker style={{ width: '100%' }} />

          </Form.Item>

          <Form.Item name="reason" label="原因">

            <Input placeholder="如：周末、外出集体活动" />

          </Form.Item>

        </Form>

      </Modal>

    </>

  );

}


