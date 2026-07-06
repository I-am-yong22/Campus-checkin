import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';

// 首次登录强制：1) 改密码 2) 录入人脸
export default function FirstLoginGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <>{children}</>;

  const path = location.pathname;
  const tab = new URLSearchParams(location.search).get('tab');
  const onSettings = path === '/settings';

  if (user.mustChangePassword && (!onSettings || tab !== 'password')) {
    return <Navigate to="/settings?tab=password" replace state={{ forceChangePwd: true }} />;
  }

  // 仅需要刷脸签到的角色（普通用户/负责人）才强制录入人脸；管理员无需录脸
  const needFace = user.role === 'USER' || user.role === 'LEADER';
  if (needFace && !user.mustChangePassword && !user.faceRegistered && (!onSettings || tab !== 'face')) {
    return <Navigate to="/settings?tab=face" replace state={{ firstTime: true }} />;
  }

  return <>{children}</>;
}
