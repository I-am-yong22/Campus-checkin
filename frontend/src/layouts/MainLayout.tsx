import { useState } from 'react';
import { Layout, Menu, Dropdown, Avatar, Grid } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  FileTextOutlined,
  AuditOutlined,
  TeamOutlined,
  UserOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuOutlined,
  TrophyOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import type { Role } from '../types';
import { avatarSrc } from '../utils/avatar';
import BrandLogo from '../components/BrandLogo';
import { brand } from '../theme';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

interface MenuDef {
  key: string;
  icon: React.ReactNode;
  label: string;
  roles: Role[];
}

const MENU_BY_KEY: Record<string, MenuDef> = {
  '/': { key: '/', icon: <HomeOutlined />, label: '首页', roles: ['USER', 'LEADER', 'ADMIN'] },
  '/my-checkins': { key: '/my-checkins', icon: <CalendarOutlined />, label: '我的签到', roles: ['USER', 'LEADER'] },
  '/leave': { key: '/leave', icon: <FileTextOutlined />, label: '请假申请', roles: ['USER', 'LEADER'] },
  '/my-team': { key: '/my-team', icon: <TeamOutlined />, label: '我的团队', roles: ['USER', 'LEADER'] },
  '/team-invitations': { key: '/team-invitations', icon: <TeamOutlined />, label: '团队邀请', roles: ['USER'] },
  '/leader/team': { key: '/leader/team', icon: <SettingOutlined />, label: '团队管理', roles: ['LEADER'] },
  '/leader-stats': { key: '/leader-stats', icon: <BarChartOutlined />, label: '团队统计', roles: ['LEADER'] },
  '/leave-review': { key: '/leave-review', icon: <AuditOutlined />, label: '请假审核', roles: ['LEADER', 'ADMIN'] },
  '/admin/teams': { key: '/admin/teams', icon: <SettingOutlined />, label: '团队管理', roles: ['ADMIN'] },
  '/admin/attendance-tasks': { key: '/admin/attendance-tasks', icon: <CalendarOutlined />, label: '出勤任务', roles: ['ADMIN'] },
  '/admin/work-hours': { key: '/admin/work-hours', icon: <TrophyOutlined />, label: '工时排行榜', roles: ['ADMIN'] },
  '/admin/users': { key: '/admin/users', icon: <UserOutlined />, label: '用户管理', roles: ['ADMIN'] },
  '/admin/audit-logs': { key: '/admin/audit-logs', icon: <AuditOutlined />, label: '审计日志', roles: ['ADMIN'] },
  '/admin/kiosk-display': { key: '/admin/kiosk-display', icon: <DesktopOutlined />, label: '待机展示', roles: ['ADMIN'] },
  '/settings': { key: '/settings', icon: <SettingOutlined />, label: '设置', roles: ['USER', 'LEADER', 'ADMIN'] },
};

/** 各角色侧边栏顺序：相关功能相邻排列 */
const MENU_ORDER: Record<Role, string[]> = {
  USER: ['/', '/my-checkins', '/leave', '/my-team', '/settings'],
  LEADER: ['/', '/my-checkins', '/leave', '/my-team', '/leave-review', '/settings'],
  ADMIN: [
    '/',
    '/leave-review',
    '/admin/teams',
    '/admin/attendance-tasks',
    '/admin/work-hours',
    '/admin/users',
    '/admin/audit-logs',
    '/admin/kiosk-display',
    '/settings',
  ],
};

function menusForRole(role: Role) {
  return MENU_ORDER[role]
    .map((key) => MENU_BY_KEY[key])
    .filter((m): m is MenuDef => !!m && m.roles.includes(role));
}

const ROLE_LABEL: Record<Role, string> = {
  USER: '普通用户',
  LEADER: '项目负责人',
  ADMIN: '管理员',
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [collapsed, setCollapsed] = useState(false);

  const items = (user ? menusForRole(user.role) : []).map((m) => ({
    key: m.key,
    icon: m.icon,
    label: m.label,
  }));

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => {
        navigate(key);
        if (isMobile) setCollapsed(true);
      }}
    />
  );

  return (
    <Layout className="app-shell">
      {!isMobile && (
        <Sider
          theme="light"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{ borderRight: `1px solid ${brand.border}` }}
        >
          <div className="app-sider-brand">
            <BrandLogo size={28} collapsed={collapsed} />
          </div>
          {menu}
        </Sider>
      )}
      <Layout className="app-main">
        <Header className="app-header" style={{ padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <Dropdown overlay={menu} trigger={['click']}>
                <MenuOutlined style={{ fontSize: 18, color: brand.text }} />
              </Dropdown>
            )}
            {isMobile ? (
              <BrandLogo size={24} />
            ) : (
              <span className="app-header__title" />
            )}
          </div>
          <Dropdown
            menu={{
              items: [
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: logout },
              ],
            }}
          >
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar
                src={avatarSrc(user?.avatarUrl)}
                style={{ background: user?.avatarUrl ? undefined : brand.primary }}
                icon={<UserOutlined />}
              />
              <span>
                {user?.name}（{user ? ROLE_LABEL[user.role] : ''}）
              </span>
            </div>
          </Dropdown>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
