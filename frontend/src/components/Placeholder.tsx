import { Card, Empty } from 'antd';

export default function Placeholder({ title }: { title: string }) {
  return (
    <Card title={title}>
      <Empty description={`${title} · 功能开发中`} />
    </Card>
  );
}
