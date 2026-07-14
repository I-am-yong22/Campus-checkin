import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, DatePicker, Row, Space, Statistic, Table, Tag, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import { checkInApi } from '../api/checkin';
import { exportApi } from '../api/export';
import type { CheckIn } from '../types';
import { brand, chartColors } from '../theme';

const STATUS_TAG: Record<string, { color: string; text: string }> = {
  NORMAL: { color: 'green', text: '正常' },
  LATE: { color: 'orange', text: '迟到' },
  MAKEUP: { color: 'blue', text: '补签' },
};

export default function MyCheckIns() {
  const [data, setData] = useState<CheckIn[]>([]);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof checkInApi.workHoursSummary>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState<Dayjs>(dayjs());
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = month.format('YYYY-MM');
      const [list, sum] = await Promise.all([
        checkInApi.mine(m),
        checkInApi.workHoursSummary(m),
      ]);
      setData(list);
      setSummary(sum);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<CheckIn> = [
    { title: '日期', dataIndex: 'date' },
    {
      title: '签到时间',
      dataIndex: 'checkInAt',
      render: (v) => dayjs(v).format('HH:mm:ss'),
    },
    {
      title: '签退时间',
      dataIndex: 'checkOutAt',
      render: (v) => (v ? dayjs(v).format('HH:mm:ss') : '—'),
    },
    {
      title: '有效工时(分钟)',
      key: 'effectiveWorkMinutes',
      render: (_, r) => {
        if (!r.checkOutAt) return '—';
        const eff = r.effectiveWorkMinutes;
        const raw = r.workMinutes;
        if (eff == null && raw == null) return '—';
        if (raw != null && eff != null && raw !== eff) {
          return (
            <span>
              {eff}
              <span style={{ color: chartColors.muted, marginLeft: 6, fontSize: 12 }}>
                (原{raw})
              </span>
            </span>
          );
        }
        return eff ?? raw ?? '—';
      },
    },
    {
      title: '签到状态',
      dataIndex: 'status',
      render: (v: string) => <Tag color={STATUS_TAG[v]?.color}>{STATUS_TAG[v]?.text || v}</Tag>,
    },
    {
      title: '相似度(距离)',
      dataIndex: 'matchScore',
      render: (v: number) => v?.toFixed(3),
    },
  ];

  return (
    <Card
      title="我的签到与工时"
      extra={
        <Space>
          <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportApi.userMonthly({ month: month.format('YYYY-MM') });
                message.success('导出成功');
              } finally {
                setExporting(false);
              }
            }}
          >
            导出 CSV
          </Button>
        </Space>
      }
    >
      {summary && (
        <>
          <p style={{ marginBottom: 16, color: chartColors.muted, fontSize: 13 }}>
            工时已扣除与已通过请假时段重叠的部分；请假日无签到签退不计工时。按小时请假核销后，以核销时刻为实际返岗，超时部分计入请假扣除。
          </p>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title={`${summary.month} 累计工时`}
                  value={summary.totalMinutes}
                  suffix="分钟"
                  valueStyle={{ color: brand.primary, fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="签到工时"
                  value={summary.checkInMinutes}
                  suffix="分钟"
                  valueStyle={{ fontSize: 20, color: brand.primary }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="有效天数"
                  value={summary.completedDays}
                  suffix="天"
                  valueStyle={{ fontSize: 20 }}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="签到记录"
                  value={summary.recordCount}
                  suffix="条"
                  valueStyle={{ fontSize: 20, color: chartColors.muted }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={data}
        pagination={{ pageSize: 31 }}
        locale={{ emptyText: '本月暂无签到记录' }}
      />
    </Card>
  );
}
