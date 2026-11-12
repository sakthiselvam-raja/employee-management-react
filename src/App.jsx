import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import { PageLoader } from './components/ui';
import { useMe } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/Dashboard';
import UsersPage from './pages/admin/Users';
import UploadsPage from './pages/admin/Uploads';
import UploadDetailPage from './pages/admin/UploadDetail';
import AssignmentsPage from './pages/admin/Assignments';
import HistoryPage from './pages/admin/History';
import MyTasksPage from './pages/user/MyTasks';
import TaskDetailPage from './pages/user/TaskDetail';
import ChangePasswordButton from './pages/user/ChangePassword';

const adminNav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/uploads', label: 'ZIP uploads' },
  { to: '/admin/assignments', label: 'Assignments' },
  { to: '/admin/history', label: 'History' },
];

// Employee pages live under /emp-portal (login: /emp-portal/login)
const EMP = '/emp-portal';
const userNav = [{ to: `${EMP}/tasks`, label: 'My tasks' }];

/** Old /tasks/:id links keep working */
function LegacyTaskRedirect() {
  const { id } = useParams();
  return <Navigate to={`${EMP}/tasks/${id}`} replace />;
}

function HomeRedirect() {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <PageLoader />;
  if (!me) return <Navigate to={`${EMP}/login`} replace />;
  return <Navigate to={me.role === 'ADMIN' ? '/admin' : `${EMP}/tasks`} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path={`${EMP}`} element={<HomeRedirect />} />
      <Route path={`${EMP}/login`} element={<LoginPage role="USER" />} />
      <Route path="/login" element={<Navigate to={`${EMP}/login`} replace />} />
      <Route path="/admin/login" element={<LoginPage role="ADMIN" />} />

      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route element={<AppShell nav={adminNav} portalLabel="Admin" />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/uploads" element={<UploadsPage />} />
          <Route path="/admin/uploads/:id" element={<UploadDetailPage />} />
          <Route path="/admin/assignments" element={<AssignmentsPage />} />
          <Route path="/admin/history" element={<HistoryPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="USER" />}>
        <Route element={<AppShell nav={userNav} portalLabel="My work" 
        // extraMenu={<ChangePasswordButton />}
         />}>
          <Route path={`${EMP}/tasks`} element={<MyTasksPage />} />
          <Route path={`${EMP}/tasks/:id`} element={<TaskDetailPage />} />
        </Route>
      </Route>

      <Route path="/tasks" element={<Navigate to={`${EMP}/tasks`} replace />} />
      <Route path="/tasks/:id" element={<LegacyTaskRedirect />} />

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}