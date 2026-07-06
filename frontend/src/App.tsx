import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './store/AuthContext';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import RequireAuth from './components/RequireAuth';
import FirstLoginGate from './components/FirstLoginGate';
import Home from './pages/Home';
import MyCheckIns from './pages/MyCheckIns';
import LeavePage from './pages/Leave';
import LeaveReview from './pages/LeaveReview';
import Settings from './pages/Settings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTeamHub from './pages/admin/AdminTeamHub';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import MyTeam from './pages/MyTeam';
import AdminAttendanceTasks from './pages/admin/AdminAttendanceTasks';
import AdminKioskDisplay from './pages/admin/AdminKioskDisplay';
import AdminWorkHours from './pages/admin/AdminWorkHours';

export default function App() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <FirstLoginGate>
              <MainLayout />
            </FirstLoginGate>
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="my-checkins" element={<MyCheckIns />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="leave-review" element={<RequireAuth roles={['LEADER', 'ADMIN']}><LeaveReview /></RequireAuth>} />
        <Route path="team-members" element={<Navigate to="/admin/teams?tab=members" replace />} />
        <Route path="my-team" element={<RequireAuth roles={['USER', 'LEADER']}><MyTeam /></RequireAuth>} />
        <Route path="team-invitations" element={<Navigate to="/my-team?tab=join" replace />} />
        <Route path="leader/team" element={<Navigate to="/my-team?tab=manage" replace />} />
        <Route path="leader-stats" element={<Navigate to="/my-team?tab=stats" replace />} />
        <Route path="face-register" element={<Navigate to="/settings?tab=face" replace />} />
        <Route path="profile" element={<Navigate to="/settings?tab=profile" replace />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin/users" element={<RequireAuth roles={['ADMIN']}><AdminUsers /></RequireAuth>} />
        <Route path="admin/teams" element={<RequireAuth roles={['ADMIN']}><AdminTeamHub /></RequireAuth>} />
        <Route path="admin/audit-logs" element={<RequireAuth roles={['ADMIN']}><AdminAuditLogs /></RequireAuth>} />
        <Route path="admin/team-applications" element={<Navigate to="/admin/teams?tab=applications" replace />} />
        <Route path="admin/attendance-tasks" element={<RequireAuth roles={['ADMIN']}><AdminAttendanceTasks /></RequireAuth>} />
        <Route path="admin/kiosk-display" element={<RequireAuth roles={['ADMIN']}><AdminKioskDisplay /></RequireAuth>} />
        <Route path="admin/work-hours" element={<RequireAuth roles={['ADMIN']}><AdminWorkHours /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
