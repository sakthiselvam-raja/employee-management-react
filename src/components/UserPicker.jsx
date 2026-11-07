import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/endpoints';
import { cx } from './ui';

export const userLabel = (u) => `${u.fullName} (${u.employeeId})`;

/** Every word typed must appear somewhere in `text` (case-insensitive). */
export function textMatches(text, query) {
  const tokens = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = String(text || '').toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

/** Search a user by name, Employee ID or email. */
export function userMatches(u, query) {
  return textMatches(`${u.fullName || ''} ${u.employeeId || ''} ${u.email || ''}`, query);
}

const MAX_SHOWN = 100;

/**
 * Searchable user dropdown (works well with hundreds of users).
 * value / onChange use the user id as a string ('' = nobody).
 * emptyLabel: when given, an extra first option such as "All users" clears the selection.
 */
export default function UserSelect({
  users, value, onChange, emptyLabel, placeholder = 'Search by name, employee ID or email…', className, disabled,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  const selected = users.find((u) => String(u.id) === String(value));
  const matches = useMemo(() => users.filter((u) => userMatches(u, query)), [users, query]);

  const options = useMemo(() => [
    ...(emptyLabel && !query.trim() ? [{ id: '', empty: true }] : []),
    ...matches.slice(0, MAX_SHOWN).map((u) => ({ id: String(u.id), user: u })),
  ], [emptyLabel, query, matches]);

  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (id) => { onChange(id); setOpen(false); setQuery(''); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open) { e.preventDefault(); if (options[active]) choose(options[active].id); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  const display = open ? query : (selected ? userLabel(selected) : '');

  return (
    <div ref={boxRef} className={cx('relative', className)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        className="input pr-8"
        disabled={disabled}
        value={display}
        placeholder={emptyLabel && !selected ? emptyLabel : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown}
      />
      {selected && !disabled && (
        <button
          type="button"
          aria-label="Clear selection"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1 text-slate-400 hover:text-slate-700"
          onClick={() => choose('')}
        >
          ×
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full min-w-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No matching users</p>}
          {options.map((o, i) => (
            <button
              key={o.id || 'all'}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); choose(o.id); }}
              onMouseEnter={() => setActive(i)}
              className={cx(
                'block w-full px-3 py-1.5 text-left text-sm',
                i === active ? 'bg-brand-50' : 'hover:bg-slate-50',
                String(value) === o.id && 'font-medium text-brand-800',
              )}
            >
              {o.empty ? emptyLabel : (
                <>
                  <span className="block truncate text-slate-900">{o.user.fullName} <span className="text-xs text-slate-500">({o.user.employeeId})</span></span>
                  {o.user.email && <span className="block truncate text-xs text-slate-500">{o.user.email}</span>}
                </>
              )}
            </button>
          ))}
          {matches.length > MAX_SHOWN && (
            <p className="border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">Showing first {MAX_SHOWN} of {matches.length} — keep typing to narrow down.</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Searchable, PAGINATED user dropdown for large user lists (hundreds / thousands).
 * Users are searched and paged on the server, so nothing big is loaded up front.
 * value is the user id as a string; onChange(id, user). selectedUser = fallback to show the current user's label.
 */
export function RemoteUserSelect({
  value, onChange, selectedUser, status = 'active', pageSize = 20, className, disabled,
  placeholder = 'Search by name, employee ID or email…',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState(null);
  const boxRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const q = useQuery({
    queryKey: ['users', 'picker', status, debounced, page, pageSize],
    queryFn: () => adminApi.usersPage({ status, search: debounced || undefined, page, limit: pageSize }),
    enabled: open,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const selected = [picked, selectedUser].find((u) => u && value !== '' && String(u.id) === String(value)) || null;
  const choose = (user) => { setPicked(user); onChange(user ? String(user.id) : '', user); setOpen(false); setQuery(''); };
  const data = q.data;

  return (
    <div ref={boxRef} className={cx('relative', className)}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        className="input pr-8"
        disabled={disabled}
        value={open ? query : (selected ? userLabel(selected) : (value ? `User #${value}` : ''))}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setPage(1); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setQuery(''); } if (e.key === 'Enter') e.preventDefault(); }}
      />
      {(selected || value) && !disabled && (
        <button type="button" aria-label="Clear selection" className="absolute top-1/2 right-2 -translate-y-1/2 rounded px-1 text-slate-400 hover:text-slate-700" onClick={() => choose(null)}>×</button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-auto py-1">
            {q.isLoading && <p className="px-3 py-2 text-sm text-slate-500">Loading users…</p>}
            {q.isError && <p className="px-3 py-2 text-sm text-red-600">Could not load users</p>}
            {data && data.users.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No matching users</p>}
            {data?.users.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); choose(u); }}
                className={cx('block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50', String(value) === String(u.id) && 'bg-brand-50 font-medium')}
              >
                <span className="block truncate text-slate-900">{u.fullName} <span className="text-xs text-slate-500">({u.employeeId})</span></span>
                {u.email && <span className="block truncate text-xs text-slate-500">{u.email}</span>}
              </button>
            ))}
          </div>
          {data && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
              <span>{data.total} user(s){q.isFetching && ' · updating…'}</span>
              <span className="flex items-center gap-1">
                <button type="button" disabled={data.page <= 1} onMouseDown={(e) => { e.preventDefault(); setPage((n) => Math.max(n - 1, 1)); }} className="rounded px-2 py-0.5 hover:bg-slate-100 disabled:opacity-40">‹ Prev</button>
                <span>Page {data.page} of {data.pages}</span>
                <button type="button" disabled={data.page >= data.pages} onMouseDown={(e) => { e.preventDefault(); setPage((n) => n + 1); }} className="rounded px-2 py-0.5 hover:bg-slate-100 disabled:opacity-40">Next ›</button>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}