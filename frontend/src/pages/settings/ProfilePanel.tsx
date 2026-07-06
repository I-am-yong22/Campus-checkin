import { useEffect, useState } from 'react';
import { Avatar, Button, Descriptions, Form, Input, Space, Upload, message } from 'antd';
import { CameraOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { profileApi } from '../../api/profile';
import { useAuth } from '../../store/AuthContext';
import { avatarSrc } from '../../utils/avatar';

export default function ProfilePanel() {
  const { user, refresh } = useAuth();
  const [profileForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({ name: user.name });
    }
  }, [user, profileForm]);

  const onSaveProfile = async () => {
    const { name } = await profileForm.validateFields();
    setSavingProfile(true);
    try {
      await profileApi.updateProfile(name.trim());
      message.success('资料已保存');
      await refresh();
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadProps: UploadProps = {
    showUploadList: false,
    accept: 'image/jpeg,image/png,image/webp',
    beforeUpload: async (file) => {
      setUploading(true);
      try {
        await profileApi.uploadAvatar(file);
        message.success('头像已更新');
        await refresh();
      } finally {
        setUploading(false);
      }
      return false;
    },
  };

  const onRemoveAvatar = async () => {
    setUploading(true);
    try {
      await profileApi.removeAvatar();
      message.success('头像已移除');
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'center' }}>
        <Avatar
          size={80}
          src={avatarSrc(user?.avatarUrl)}
          icon={<UserOutlined />}
          style={{ flexShrink: 0 }}
        />
        <Space wrap>
          <Upload {...uploadProps}>
            <Button icon={<CameraOutlined />} loading={uploading}>
              更换头像
            </Button>
          </Upload>
          {user?.avatarUrl && (
            <Button icon={<DeleteOutlined />} onClick={onRemoveAvatar} loading={uploading}>
              移除头像
            </Button>
          )}
        </Space>
      </div>

      <Form form={profileForm} layout="vertical" onFinish={onSaveProfile}>
        <Form.Item
          name="name"
          label="显示姓名"
          rules={[
            { required: true, message: '请输入姓名' },
            { max: 20, message: '最多 20 个字符' },
          ]}
        >
          <Input placeholder="在系统中显示的姓名" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={savingProfile}>
          保存资料
        </Button>
      </Form>

      <Descriptions column={1} style={{ marginTop: 24 }}>
        <Descriptions.Item label="用户名">{user?.username}</Descriptions.Item>
        <Descriptions.Item label="角色">
          {user?.role === 'ADMIN' ? '管理员' : user?.role === 'LEADER' ? '项目负责人' : '普通用户'}
        </Descriptions.Item>
        <Descriptions.Item label="所属团队">{user?.team?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="人脸录入">{user?.faceRegistered ? '已录入' : '未录入'}</Descriptions.Item>
      </Descriptions>
    </div>
  );
}
