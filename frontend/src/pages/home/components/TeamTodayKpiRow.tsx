import { Card, Col, Row, Statistic } from 'antd';
import type { TeamStats } from '../../../api/stats';
import { brand, chartColors } from '../../../theme';

interface Props {
  data: TeamStats;
}

export default function TeamTodayKpiRow({ data }: Props) {
  const t = data.today;
  return (
    <Card className="home-dashboard-card" title={`团队概况 · ${data.team.name}`} style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col xs={8} sm={4}>
          <Statistic title="团队人数" value={data.memberCount} />
        </Col>
        <Col xs={8} sm={4}>
          <Statistic title="今日正常" value={t.checkedIn} valueStyle={{ color: chartColors.success }} />
        </Col>
        <Col xs={8} sm={4}>
          <Statistic title="今日迟到" value={t.late} valueStyle={{ color: chartColors.warning }} />
        </Col>
        <Col xs={8} sm={4}>
          <Statistic title="今日补签" value={t.makeup} valueStyle={{ color: brand.primary }} />
        </Col>
        <Col xs={8} sm={4}>
          <Statistic title="今日请假" value={t.onLeave} valueStyle={{ color: chartColors.secondary }} />
        </Col>
        <Col xs={8} sm={4}>
          <Statistic title="今日缺勤" value={t.absent} valueStyle={{ color: chartColors.muted }} />
        </Col>
      </Row>
    </Card>
  );
}
