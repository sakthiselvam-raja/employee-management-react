import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useLogin, useMe } from '../hooks/useAuth';
import { errorMessage } from '../api/client';
import { Button, Field, PageLoader } from '../components/ui';
import BrandLogo from '../components/BrandLogo';

/** Separate login screens: /admin/login (role ADMIN) and /login (role USER). */
export default function LoginPage({ role }) {
  const isAdmin = role === 'ADMIN';
  const { data: me, isLoading } = useMe();
  const login = useLogin(role);
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ id: '', password: '' });
  const [showPw, setShowPw] = useState(false);

  if (isLoading) return <PageLoader />;
  if (me) return <Navigate to={me.role === 'ADMIN' ? '/admin' : '/tasks'} replace />;

  const submit = (e) => {
    e.preventDefault();
    const body = isAdmin
      ? { username: form.id, password: form.password }
      : { identifier: form.id, password: form.password };
    login.mutate(body, {
      onSuccess: () => {
        const from = location.state?.from;
        const home = isAdmin ? '/admin' : '/tasks';
        navigate(from && from.startsWith(home) ? from : home, { replace: true });
      },
    });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className={`relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex ${isAdmin ? 'bg-[#0b1730]' : 'bg-gradient-to-br from-brand-900 via-brand-800 to-[#0b1730]'}`}>
        <BrandLogo onDark className="self-start" />
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold">
            {isAdmin ? 'Upload batches, split the work, track every file.' : 'Your assigned sheets and images, all in one place.'}
          </h2>
          <p className="mt-3 text-white/70">
            {isAdmin
              ? 'Upload ZIP batches, assign Excel sheets and image ranges to your team by date, and follow progress until everything is complete.'
              : 'See what has been assigned to you for each working day, download your files and send back your updated Excel sheet with notes.'}
          </p>
        </div>
        <p className="text-xs text-white/50">{isAdmin ? 'Administrator portal' : 'Employee portal'}</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 h-80 w-80 rounded-full bg-white/5" />
      </div>

      <div className="flex flex-col items-center justify-center bg-white px-4 py-12">
        <BrandLogo className="mb-8 lg:hidden" />
        <form onSubmit={submit} className="w-full max-w-sm">
          <p className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${isAdmin ? 'bg-[#0b1730] text-white' : 'bg-brand-50 text-brand-800'}`}>
            {isAdmin ? 'Admin' : 'Employee'}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">{isAdmin ? 'Admin sign in' : 'Sign in to your tasks'}</h1>
          <p className="mt-1 mb-6 text-sm text-slate-500">
            {isAdmin ? 'Use the administrator username and password.' : 'Use your Employee ID or email. New accounts start with the default password given by your admin.'}
          </p>

          <div className="space-y-4">
            <Field label={isAdmin ? 'Username' : 'Employee ID or email'}>
              <input
                className="input"
                autoFocus
                autoComplete="username"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder={isAdmin ? 'admin' : 'EMP001 or name@company.com'}
                required
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <input
                  className="input pr-16"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-slate-500 hover:bg-slate-100">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>

            {login.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage(login.error, 'Login failed')}</p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={login.isPending}>Sign in</Button>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            {isAdmin ? <>Not an admin? <Link to="/login" className="link">Employee login</Link></> : <>Administrator? <Link to="/admin/login" className="link">Admin login</Link></>}
          </p>
        </form>
      </div>
    </div>
  );
}