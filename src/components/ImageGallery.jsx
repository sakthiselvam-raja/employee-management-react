import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileUrl } from '../api/client';
import { formatBytes } from '../utils/format';

/** Plain <img> (the browser loads the API URL directly) with a placeholder + spinner until it has loaded. */
function GalleryImage({ src, alt, className, wrapClassName = '', skeleton = false, label = '', lazy = false }) {
  const [state, setState] = useState('loading'); // loading | ready | failed
  return (
    <span className={`${wrapClassName} relative flex items-center justify-center`}>
      {state === 'loading' && skeleton && <span className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden="true" />}
      <img
        src={src}
        crossOrigin="use-credentials"
        alt={alt}
        draggable={false}
        loading={lazy ? 'lazy' : undefined}
        onLoad={() => setState('ready')}
        onError={() => setState('failed')}
        className={`${className || ''} transition-opacity duration-300 ${state === 'ready' ? 'opacity-100' : 'opacity-0'}`}
      />
      {state === 'loading' && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2" role="status">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
          {label && <span className="text-sm text-slate-300">{label}</span>}
          <span className="sr-only">Loading image</span>
        </span>
      )}
      {state === 'failed' && <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-slate-500">Could not load image</span>}
    </span>
  );
}

/**
 * Thumbnail grid + full-screen viewer.
 * images: [{ id, position, fileName, sizeBytes }]
 * srcFor(img) / downloadFor(img): API paths (without /api prefix)
 * page / pageSize / total / onPage (optional): when given, the full-screen viewer keeps going across pages
 */
export default function ImageGallery({ images, srcFor, downloadFor, page = 1, pageSize = 0, total = 0, onPage, loading = false }) {
  const [index, setIndex] = useState(-1);
  const current = index >= 0 ? images[index] : null;

  const paged = typeof onPage === 'function' && total > 0 && pageSize > 0;
  const totalPages = paged ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const pending = useRef(null); // { edge, from } — waiting for the next/previous page to load

  const close = useCallback(() => setIndex(-1), []);
  const prev = useCallback(() => {
    if (index > 0) setIndex(index - 1);
    else if (paged && page > 1) { pending.current = { edge: 'last', from: images }; onPage(page - 1); }
  }, [index, paged, page, images, onPage]);
  const next = useCallback(() => {
    if (index < images.length - 1) setIndex(index + 1);
    else if (paged && page < totalPages) { pending.current = { edge: 'first', from: images }; onPage(page + 1); }
  }, [index, images, paged, page, totalPages, onPage]);

  // the other page arrived: open its first / last image
  useEffect(() => {
    const p = pending.current;
    if (p && images !== p.from && images.length) {
      pending.current = null;
      setIndex(p.edge === 'last' ? images.length - 1 : 0);
    }
  }, [images]);

  const hasPrev = index > 0 || (paged && page > 1);
  const hasNext = index < images.length - 1 || (paged && page < totalPages);
  const position = paged ? (page - 1) * pageSize + index + 1 : index + 1;
  const overall = paged ? total : images.length;

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [current, close, prev, next]);

  if (!images.length) return <p className="py-6 text-center text-sm text-slate-500">No images in this range.</p>;

  return (
    <>
      <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-white/70 pt-16" role="status">
          <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
            Loading images…
          </span>
        </div>
      )}
      <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 ${loading ? 'opacity-60' : ''}`}>
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left hover:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <div className="aspect-[4/3] overflow-hidden bg-slate-100">
              <GalleryImage src={fileUrl(srcFor(img))} alt={img.fileName} wrapClassName="h-full w-full bg-slate-100" skeleton lazy className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <span className="rounded bg-slate-200 px-1 text-[11px] font-semibold text-slate-700 tabular-nums">#{img.position}</span>
              <span className="truncate text-xs text-slate-600">{img.fileName}</span>
            </div>
          </button>
        ))}
      </div>
      </div>

      {current && createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 text-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">#{current.position} · {current.fileName}</p>
              <p className="text-xs text-slate-400">{position} of {overall} · {formatBytes(current.sizeBytes)}</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={fileUrl(downloadFor(current))} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Download</a>
              <button type="button" onClick={close} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Close</button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-14 pb-6">
            <GalleryImage key={current.id} src={fileUrl(srcFor(current))} alt={current.fileName} wrapClassName="min-h-[50vh] min-w-[50vw]" label="Loading image…" className="max-h-[80vh] max-w-full object-contain" />
            <button type="button" onClick={prev} disabled={!hasPrev} className="absolute left-3 rounded-full bg-white/10 p-3 hover:bg-white/20 disabled:opacity-30" aria-label="Previous">‹</button>
            <button type="button" onClick={next} disabled={!hasNext} className="absolute right-3 rounded-full bg-white/10 p-3 hover:bg-white/20 disabled:opacity-30" aria-label="Next">›</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export const IMAGE_PAGE_SIZES = [10, 20, 50, 100]; // default per page: 10

/**
 * Works with a paginated API response ({ images, total }). If the server returned every image
 * (no `total`), the page is cut here instead, so paging works either way.
 */
export function pageImages(data, page, pageSize) {
  if (!data) return { images: [], total: 0 };
  if (typeof data.total === 'number') return { images: data.images, total: data.total };
  return { images: data.images.slice((page - 1) * pageSize, page * pageSize), total: data.images.length };
}

/** "Showing 1–12 of 20 images" + page size + First / Previous / Next / Last. */
export function ImagePager({ page, pageSize, total, onPage, onPageSize, showPageSize = false }) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = 'rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40';
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
      <span>Showing {from}–{to} of {total} images</span>
      <div className="flex flex-wrap items-center gap-2">
        {/* page size is fixed at 10; pass showPageSize to bring the "Per page" box back */}
        {showPageSize && onPageSize && (
          <label className="flex items-center gap-1.5 text-xs">
          Per page
          <select className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {IMAGE_PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          </label>
        )}
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(1)}>« First</button>
        <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Previous</button>
        <label className="flex items-center gap-1.5 text-xs">
          Go to page
          {pages <= 200 ? (
            <select className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm" value={page} onChange={(e) => onPage(Number(e.target.value))} aria-label="Jump to page">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : (
            <input
              type="number"
              min={1}
              max={pages}
              defaultValue={page}
              key={page}
              className="w-20 rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') onPage(Math.min(pages, Math.max(1, Number(e.target.value) || 1))); }}
              aria-label="Jump to page"
            />
          )}
          <span>of {pages}</span>
        </label>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next ›</button>
        <button type="button" className={btn} disabled={page >= pages} onClick={() => onPage(pages)}>Last »</button>
      </div>
    </div>
  );
}