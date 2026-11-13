import { useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/endpoints';
import { cx } from './ui';

/**
 * Pick an image of a folder by its FILE NAME (search as you type).
 * folderId: the folder; position / name: current choice (name is looked up when missing)
 * minPosition / maxPosition: only list images from / up to this position (keeps "To" after "From")
 * onPick({ position, name })
 */
export default function ImageNameSelect({ folderId, position, name, onPick, minPosition, maxPosition, placeholder = 'Choose image…', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [dq, setDq] = useState(''); // debounced search text
  const box = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  // name of the chosen image when only its position is known (quick assign, edit mode)
  const nameQ = useQuery({
    queryKey: ['imageName', folderId, position],
    queryFn: () => adminApi.folderImages(folderId, position, position, 1, 5),
    enabled: Boolean(folderId && position && !name),
    staleTime: 5 * 60_000,
  });
  const shownName = name || nameQ.data?.images?.[0]?.fileName;

  const list = useInfiniteQuery({
    queryKey: ['imageNames', folderId, dq, minPosition ?? null, maxPosition ?? null],
    queryFn: ({ pageParam }) => adminApi.folderImages(folderId, minPosition || undefined, maxPosition || undefined, pageParam, 30, dq || undefined),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: open && Boolean(folderId),
  });
  const images = list.data?.pages.flatMap((p) => p.images) ?? [];

  return (
    <div className="relative min-w-0" ref={box}>
      <button
        type="button"
        disabled={disabled || !folderId}
        className="input flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => { setOpen((o) => !o); setQ(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={shownName || undefined}
      >
        <span className={cx('min-w-0 truncate', !shownName && 'text-slate-400')}>{shownName || (position ? 'Loading…' : placeholder)}</span>
        <span className="shrink-0 text-xs text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input autoFocus type="search" className="input py-1.5" placeholder="Search image name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search image name" />
          </div>
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {list.isLoading && <li className="px-3 py-3 text-center text-sm text-slate-500">Loading…</li>}
            {!list.isLoading && images.length === 0 && <li className="px-3 py-3 text-center text-sm text-slate-500">No image found</li>}
            {images.map((img) => (
              <li key={img.id} role="option" aria-selected={img.position === position}>
                <button
                  type="button"
                  className={cx('block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50', img.position === position && 'bg-brand-50 font-medium')}
                  onClick={() => { onPick({ position: img.position, name: img.fileName }); setOpen(false); }}
                >
                  {img.fileName}
                </button>
              </li>
            ))}
            {list.hasNextPage && (
              <li className="px-3 py-2 text-center">
                <button type="button" className="link text-xs" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                  {list.isFetchingNextPage ? 'Loading…' : 'Show more images'}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}