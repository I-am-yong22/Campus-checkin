import { Card, Col, Row, Statistic } from 'antd';
import dayjs from 'dayjs';
import { checkInApi } from '../../../api/checkin';

type TodayCheckIn = Awaited<ReturnType<typeof checkInApi.today>>;
import { brand, chartColors } from '../../../theme';

const PHASE_LABEL: Record<string, string> = {
  NONE: '未签到',
  ON_DUTY: '在岗',
  COMPLETED: '已完成',
};

interface Props {
  todayCheckIn: TodayCheckIn | null;
  faceRegistered: boolean;
}

export default function PersonalTodayCards({ todayCheckIn, faceRegistered }: Props) {
  const phase = todayCheckIn?.phase || 'NONE';
  const phaseColor =
    phase === 'COMPLETED' ? chartColors.success : phase === 'ON_DUTY' ? brand.primary : chartColors.muted;

  const subText = todayCheckIn?.record
    ? [
        `签到 ${dayjs(todayCheckIn.record.checkInAt).format('HH:mm')}`,
        todayCheckIn.record.checkOutAt
          ? `签退 ${dayjs(todayCheckIn.record.checkOutAt).format('HH:mm')}`
          : null,
        todayCheckIn.record.workMinutes != null ? `工时 ${todayCheckIn.record.workMinutes} 分钟` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : todayCheckIn?.effectiveRule
      ? `签到 ${todayCheckIn.effectiveRule.checkInStart}–${todayCheckIn.effectiveRule.checkInEnd} · 签退 ${todayCheckIn.effectiveRule.checkOutStart}–${todayCheckIn.effectiveRule.checkOutEnd}`
      : '\u00A0';

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="stretch">
      <Col xs={12} md={12} style={{ display: 'flex' }}>
        <Card style={{ width: '100%' }}>
          <Statistic
            title={`今日出勤（${todayCheckIn?.date || '—'}）`}
            value={PHASE_LABEL[phase] || '—'}
            valueStyle={{ color: phaseColor, fontSize: 16 }}
          />
          <div style={{ height: 20, marginTop: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{subText}</div>
        </Card>
      </Col>
      <Col xs={12} md={12} style={{ display: 'flex' }}>
        <Card style={{ width: '100%' }}>
          <Statistic
            title="人脸录入"
            value={faceRegistered ? '已录入' : '未录入'}
            valueStyle={{ fontSize: 16, color: faceRegistered ? chartColors.success : chartColors.warning }}
          />
          <div style={{ height: 20, marginTop: 4 }}>{'\u00A0'}</div>
        </Card>
      </Col>
    </Row>
  );
}
