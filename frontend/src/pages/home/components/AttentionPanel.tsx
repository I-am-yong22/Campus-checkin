import { Card, Col, List, Row, Tag } from 'antd';
import type { AttentionList } from '../../../api/stats';

interface Props {
  attention: AttentionList | null;
  maxItems?: number;
  extra?: React.ReactNode;
}

export default function AttentionPanel({ attention, maxItems, extra }: Props) {
  const limit = maxItems ?? attention?.absentToday.length ?? 0;
  const absent = attention?.absentToday.slice(0, limit) ?? [];
  const noFace = attention?.noFace.slice(0, limit) ?? [];

  return (
    <Card
      title={`今日待关注（${attention?.date ?? '—'}）`}
      className="home-dashboard-card"
      extra={extra}
    >
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <List
            size="small"
            header={<span>未签到且未请假（{attention?.absentToday.length ?? 0}）</span>}
            dataSource={absent}
            locale={{ emptyText: '无' }}
            renderItem={(item) => (
              <List.Item>
                {item.name}
                <Tag style={{ marginLeft: 8 }}>{item.teamName ?? '—'}</Tag>
              </List.Item>
            )}
          />
        </Col>
        <Col xs={24} md={12}>
          <List
            size="small"
            header={<span>未录脸（{attention?.noFace.length ?? 0}）</span>}
            dataSource={noFace}
            locale={{ emptyText: '无' }}
            renderItem={(item) => (
              <List.Item>
                {item.name}
                <Tag style={{ marginLeft: 8 }}>{item.teamName ?? '—'}</Tag>
              </List.Item>
            )}
          />
        </Col>
      </Row>
    </Card>
  );
}
