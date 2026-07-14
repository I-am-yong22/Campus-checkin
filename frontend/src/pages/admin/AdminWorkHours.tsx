import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'antd';
import { DownloadOutlined, TrophyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { adminApi } from '../../api/admin';
import { exportApi } from '../../api/export';
import { statsApi, type WorkHoursLeaderboard } from '../../api/stats';
import type { Team } from '../../types';
import { brand, chartColors } from '../../theme';

const RANK_COLORS = ['gold', 'default', 'orange'] as const;

export default function AdminWorkHours() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState<number | undefined>();
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [data, setData] = useState<WorkHoursLeaderboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    adminApi.listTeams().then((list) => {
      setTeams(list);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await statsApi.workHoursLeaderboard({
        month: month.format('YYYY-MM'),
        teamId,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [month, teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<WorkHoursLeaderboard['leaderboard'][0]> = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 72,
      render: (rank: number) =>
        rank <= 3 ? (
          <Tag icon={<TrophyOutlined />} color={RANK_COLORS[rank - 1]}>
            {rank}
          </Tag>
        ) : (
          rank
        ),
    },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '用户名', dataIndex: 'username', width: 110 },
    { title: '团队', dataIndex: 'teamName', render: (v) => v || '—' },
    {
      title: '合计工时(分钟)',
      dataIndex: 'totalMinutes',
      sorter: (a, b) => a.totalMinutes - b.totalMinutes,
      defaultSortOrder: 'descend',
      render: (v: number) => (
        <span style={{ fontWeight: v > 0 ? 600 : undefined, color: v > 0 ? brand.primary : undefined }}>
          {v}
        </span>
      ),
    },
    {
      title: '有效天数',
      dataIndex: 'completedDays',
      width: 100,
      render: (v: number) => `${v} 天`,
    },
  ];

  return (
    <Card
      title="工时排行榜"
      extra={
        <Button
          icon={<DownloadOutlined />}
          loading={exporting}
          disabled={!teamId}
          onClick={async () => {
            if (!teamId) {
              message.warning('导出明细请先选择团队');
              return;
            }
            setExporting(true);
            try {
              await exportApi.workHours({
                teamId,
                month: month.format('YYYY-MM'),
              });
              message.success('导出成功');
            } finally {
              setExporting(false);
            }
          }}
        >
          导出团队明细
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
        <Select
          allowClear
          placeholder="全部团队"
          style={{ width: 200 }}
          value={teamId}
          onChange={setTeamId}
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />
        <span style={{ color: chartColors.muted, fontSize: 13 }}>
          工时已扣除与已通过请假时段重叠的部分。
        </span>
      </Space>

      <Table
        rowKey="userId"
        loading={loading}
        columns={columns}
        dataSource={data?.leaderboard || []}
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '本月暂无工时数据' }}
      />
    </Card>
  );
}
