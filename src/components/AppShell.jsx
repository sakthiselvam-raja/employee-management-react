import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMe, useLogout } from '../hooks/useAuth';
import { cx } from './ui';

const NAV_ICONS = {
  Dashboard: '📊',
  Users: '👥',
  'ZIP uploads': '🗂️',
  Assignments: '📋',
  History: '🕘',
  'My tasks': '✅',
};

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-brand-700 shadow-md shadow-black/20">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h9" /></svg>
      </span>
      <span className="text-base font-semibold tracking-tight text-white">ISM Work Assign</span>
    </div>
  );
}

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
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
            isActive
              ? 'bg-white text-brand-800 shadow-md shadow-black/20'
              : 'text-brand-50/80 hover:bg-white/10 hover:text-white',
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-gradient-to-b from-brand-900 via-brand-800 to-slate-900 px-4 py-5 shadow-xl lg:flex">
        <div className="px-1"><Logo /></div>
        <p className="mt-8 mb-2 px-3 text-[11px] font-semibold tracking-widest text-brand-200/70 uppercase">{portalLabel}</p>
        {links}
        <div className="mt-auto rounded-xl bg-white/10 px-3 py-3 text-xs text-brand-50/80">
          <p className="font-medium text-white">{me?.fullName}</p>
          <p className="text-brand-100/70">{me?.role === 'ADMIN' ? 'Administrator' : me?.employeeId}</p>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 px-4 text-white shadow-md sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <button type="button" className="rounded-md p-1.5 text-white hover:bg-white/15" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Logo />
        </div>
        <p className="hidden text-sm font-medium text-brand-50/90 lg:block">{portalLabel === 'Admin' ? 'Admin panel' : 'Employee panel'}</p>
        <div className="flex items-center gap-3">
          {extraMenu}
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-semibold text-white">{me?.fullName}</p>
            <p className="text-xs leading-tight text-brand-100/80">{me?.role === 'ADMIN' ? 'Administrator' : me?.employeeId}</p>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white hover:text-brand-800"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {open && <div className="bg-gradient-to-b from-brand-900 to-brand-800 px-3 py-3 shadow-lg lg:hidden">{links}</div>}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}