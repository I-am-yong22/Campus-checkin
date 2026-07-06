import { useAuth } from '../store/AuthContext';
import UserHome from './home/UserHome';
import LeaderHome from './home/LeaderHome';
import AdminHome from './home/AdminHome';

export default function Home() {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'ADMIN':
      return <AdminHome />;
    case 'LEADER':
      return <LeaderHome />;
    default:
      return <UserHome />;
  }
}
