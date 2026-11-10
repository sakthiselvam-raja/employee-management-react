import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMe, useLogout } from '../hooks/useAuth';
import { cx } from './ui';
import BrandLogo from './BrandLogo';

const NAV_ICONS = {
  Dashboard: '📊',
  Users: '👥',
  'ZIP uploads': '🗂️',
  Assignments: '📋',
  History: '🕘',
  'My tasks': '✅',
};

/**
 * Shared layout for both portals.
 * nav: [{ to, label, end? }]
 */
export default function AppShell({ nav, portalLabel, extraMenu }) {
  const { data: me } = useMe();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) => cx(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-600 text-white shadow-sm shadow-black/30'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <span className="w-5 text-center text-base leading-none">{NAV_ICONS[item.label] || '•'}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#0b1730] px-4 py-5 shadow-xl lg:flex">
        <div className="px-1"><BrandLogo onDark /></div>
        <p className="mt-8 mb-2 px-3 text-[11px] font-semibold tracking-widest text-slate-400 uppercase">{portalLabel}</p>
        {links}
        <div className="mt-auto rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-slate-300">
          <p className="font-medium text-white">{me?.fullName}</p>
          <p className="text-slate-400">{me?.role === 'ADMIN' ? 'Administrator' : me?.employeeId}</p>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 text-slate-800 shadow-sm sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <button type="button" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <BrandLogo />
        </div>
        <p className="hidden text-sm font-semibold text-slate-600 lg:block">{portalLabel === 'Admin' ? 'Admin panel' : 'Employee panel'}</p>
        <div className="flex items-center gap-3">
          {extraMenu}
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-semibold text-slate-900">{me?.fullName}</p>
            <p className="text-xs leading-tight text-slate-500">{me?.role === 'ADMIN' ? 'Administrator' : me?.employeeId}</p>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-800"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {open && <div className="bg-[#0b1730] px-3 py-3 shadow-lg lg:hidden">{links}</div>}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}