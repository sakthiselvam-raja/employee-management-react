import { useEffect, useMemo, useRef, useState } from 'react';
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