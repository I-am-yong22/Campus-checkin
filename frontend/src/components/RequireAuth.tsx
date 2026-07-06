import { Navigate, useLocation } from 'react-router-dom';
import { Result } from 'antd';
import { useAuth } from '../store/AuthContext';
import type { Role } from '../types';

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

export default function RequireAuth({ children, roles }: Props) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Result status="403" title="403" subTitle="抱歉，你没有权限访问该页面。" />;
  }

  return <>{children}</>;
}
