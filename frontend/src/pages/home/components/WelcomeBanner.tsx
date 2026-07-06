import { Card, Typography } from 'antd';
import type { Role } from '../../../types';

const { Title, Paragraph } = Typography;

const COPY: Record<Role, string> = {
  USER: '每日请到现场签到机完成人脸签到与签退；如需请假，请到「请假申请」提交。',
  LEADER: '请按时完成个人签到，并关注团队成员出勤与请假审核。',
  ADMIN: '今日平台运营一览：出勤数据、待办事项与签到机状态如下。',
};

interface Props {
  name: string;
  role: Role;
}

export default function WelcomeBanner({ name, role }: Props) {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Title level={4} style={{ marginBottom: 8 }}>
        你好，{name}
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {COPY[role]}
      </Paragraph>
    </Card>
  );
}
