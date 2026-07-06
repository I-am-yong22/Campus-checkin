import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../api/client';
import { useAuth } from '../store/AuthContext';
import BrandLogo from '../components/BrandLogo';

const { Title, Text } = Typography;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setLoginError(null);
    try {
      const user = await login(values.username, values.password);
      message.success('登录成功');
      const needFace = user.role === 'USER' || user.role === 'LEADER';
      if (user.mustChangePassword) {
        navigate('/settings?tab=password');
      } else if (needFace && !user.faceRegistered) {
        navigate('/settings?tab=face');
      } else {
        navigate('/');
      }
    } catch (error) {
      setLoginError(getApiErrorMessage(error, '登录失败，请稍后重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-header">
          <div className="auth-header__logo">
            <BrandLogo size={52} showText={false} />
          </div>
          <Title level={3} className="auth-header__title">
            校园人脸打卡
          </Title>
          <Text type="secondary">暑期团体打卡 · 人脸识别签到</Text>
        </div>
        {loginError && (
          <Alert
            type="error"
            showIcon
            message={loginError}
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setLoginError(null)}
          />
        )}
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoFocus />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          账号由管理员统一创建。首次登录需修改密码并录入人脸。
        </Text>
      </Card>
    </div>
  );
}
