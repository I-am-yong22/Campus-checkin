import { Card, Col, Row, Statistic } from 'antd';
import type { StatsOverview } from '../../../api/stats';
import { brand, chartColors } from '../../../theme';

interface Props {
  overview: StatsOverview['overview'];
}

export default function PlatformKpiRow({ overview }: Props) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="在册学员/负责人" value={overview.totalUsers} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="已录人脸" value={overview.faceRegistered} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="今日签到" value={overview.todayCheckIns} valueStyle={{ color: chartColors.success }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="今日迟到" value={overview.todayLate} valueStyle={{ color: chartColors.warning }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="今日请假" value={overview.todayOnLeave} valueStyle={{ color: chartColors.secondary }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic
            title="今日缺勤"
            value={overview.todayExempt ? 0 : overview.todayAbsent}
            valueStyle={{ color: chartColors.muted }}
          />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="待审请假" value={overview.pendingLeaves} valueStyle={{ color: brand.primary }} />
        </Card>
      </Col>
      <Col xs={12} sm={8} md={6} lg={3}>
        <Card size="small">
          <Statistic title="团队数" value={overview.teamCount} />
        </Card>
      </Col>
    </Row>
  );
}
