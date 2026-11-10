import { useEffect, useMemo, useRef, useState } from 'react';
import { cx } from './ui';
import { folderLabel } from '../utils/format';

/**
 * Searchable folder picker (replaces the plain <select>).
 * folders: upload.imageFolders; freeCount(folder) -> number of images still free on the chosen date (optional)
 */
export default function FolderSelect({ folders, value, onChange, freeCount, placeholder = 'Choose folder…' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const selected = folders.find((f) => String(f.id) === String(value));
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? folders.filter((f) => folderLabel(f).toLowerCase().includes(t)) : folders;
  }, [folders, q]);

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        className="input flex w-full items-center justify-between gap-2 text-left"
        onClick={() => { setOpen((o) => !o); setQ(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cx('min-w-0 truncate', !selected && 'text-slate-400')}>
          {selected ? `📁 ${folderLabel(selected)}` : placeholder}
        </span>
        <span className="shrink-0 text-xs text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {folders.length > 6 && (
            <div className="border-b border-slate-100 p-2">
              <input autoFocus type="search" className="input py-1.5" placeholder="Search folder…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {list.length === 0 && <li className="px-3 py-3 text-center text-sm text-slate-500">No folder found</li>}
            {list.map((f) => {
              const free = freeCount ? freeCount(f) : null;
              const active = String(f.id) === String(value);
              return (
                <li key={f.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50', active && 'bg-brand-50')}
                    onClick={() => { onChange(String(f.id)); setOpen(false); }}
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-slate-800">📁 {folderLabel(f)}</span>
                    <span className="shrink-0 text-right text-xs text-slate-500">
                      {f.imageCount} images
                      {free !== null && <span className={cx('block', free === 0 ? 'text-amber-700' : 'text-emerald-700')}>{free} free</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}