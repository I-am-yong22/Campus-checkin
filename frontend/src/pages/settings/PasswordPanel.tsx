import { useEffect } from 'react';
import { Alert, Button, Form, Input, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../store/AuthContext';

export default function PasswordPanel() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const forceChangePwd = user?.mustChangePassword;
  const [pwdForm] = Form.useForm();

  useEffect(() => {
    if (forceChangePwd) {
      message.warning('首次登录请先修改初始密码');
    }
  }, [forceChangePwd]);

  const onFinishPwd = async (values: { oldPassword: string; newPassword: string; confirm: string }) => {
    if (values.newPassword !== values.confirm) {
      message.error('两次输入的新密码不一致');
      return;
    }
    await api.post('/auth/change-password', {
      oldPassword: values.oldPassword,
      newPassword: values.newPassword,
    });
    message.success('密码修改成功');
    pwdForm.resetFields();
    await refresh();
    if (forceChangePwd) {
      const needFace = user?.role === 'USER' || user?.role === 'LEADER';
      navigate(needFace ? '/settings?tab=face' : '/');
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      {forceChangePwd && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="首次登录，请修改初始密码后继续录入人脸。" />
      )}
      <Form form={pwdForm} layout="vertical" onFinish={onFinishPwd}>
        <Form.Item name="oldPassword" label="原密码" rules={[{ required: true, message: '请输入原密码' }]}>
          <Input.Password placeholder="原密码 / 初始密码" />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 6, message: '至少 6 位' }]}>
          <Input.Password placeholder="新密码" />
        </Form.Item>
        <Form.Item name="confirm" label="确认新密码" rules={[{ required: true, message: '请再次输入新密码' }]}>
          <Input.Password placeholder="确认新密码" />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          保存密码
        </Button>
      </Form>
    </div>
  );
}
