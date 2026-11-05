import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useMe, useLogout } from '../hooks/useAuth';
import { cx } from './ui';

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-700 text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 7h14M5 12h14M5 17h9" /></svg>
      </span>
      <span className="font-semibold text-slate-900">ISM Work Assign</span>
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
    <nav className="flex flex-col gap-0.5">
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) => cx(
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
          )}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-60">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-4 lg:flex">
        <div className="px-2"><Logo /></div>
        <p className="mt-6 mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{portalLabel}</p>
        {links}
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <button type="button" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Logo />
        </div>
        <div className="hidden lg:block" />
        <div className="flex items-center gap-3">
          {extraMenu}
          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-medium text-slate-800">{me?.fullName}</p>
            <p className="text-xs leading-tight text-slate-500">{me?.role === 'ADMIN' ? 'Administrator' : me?.employeeId}</p>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {open && <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">{links}</div>}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
