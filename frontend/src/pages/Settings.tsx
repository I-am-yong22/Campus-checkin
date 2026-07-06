import { useMemo } from 'react';
import { Card, Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import ProfilePanel from './settings/ProfilePanel';
import PasswordPanel from './settings/PasswordPanel';
import FaceRegisterPanel from './settings/FaceRegisterPanel';

type TabKey = 'profile' | 'password' | 'face';

export default function Settings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const needFace = user?.role === 'USER' || user?.role === 'LEADER';
  const tabParam = params.get('tab');
  const validTabs: TabKey[] = needFace ? ['profile', 'password', 'face'] : ['profile', 'password'];
  const activeTab: TabKey = validTabs.includes(tabParam as TabKey) ? (tabParam as TabKey) : 'profile';

  const items = useMemo(() => {
    const list = [
      { key: 'profile', label: '个人资料', children: <ProfilePanel /> },
      { key: 'password', label: '修改密码', children: <PasswordPanel /> },
    ];
    if (needFace) {
      list.push({ key: 'face', label: '人脸录入', children: <FaceRegisterPanel /> });
    }
    return list;
  }, [needFace]);

  return (
    <Card title="设置">
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setParams({ tab: key })}
        items={items}
      />
    </Card>
  );
}
