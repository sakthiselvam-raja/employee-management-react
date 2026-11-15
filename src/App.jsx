import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import { PageLoader } from './components/ui';
import { useMe } from './hooks/useAuth';
import { pageLoaders } from './routePrefetch';
import LoginPage from './pages/LoginPage';
// Pages load on demand (code splitting) — the login screen and layout stay in the first bundle.
const AdminDashboard = lazy(pageLoaders.dashboard);
const UsersPage = lazy(pageLoaders.users);
const UploadsPage = lazy(pageLoaders.uploads);
const UploadDetailPage = lazy(pageLoaders.uploadDetail);
const AssignmentsPage = lazy(pageLoaders.assignments);
const HistoryPage = lazy(pageLoaders.history);
const MyTasksPage = lazy(pageLoaders.myTasks);
const TaskDetailPage = lazy(pageLoaders.taskDetail);
// import ChangePasswordButton from './pages/user/ChangePassword';

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
    <Suspense fallback={<PageLoader />}>
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
    </Suspense>
  );
}