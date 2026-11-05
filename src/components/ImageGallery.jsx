import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileUrl } from '../api/client';
import { formatBytes } from '../utils/format';

/**
 * Thumbnail grid + full-screen viewer.
 * images: [{ id, position, fileName, sizeBytes }]
 * srcFor(img) / downloadFor(img): API paths (without /api prefix)
 */
export default function ImageGallery({ images, srcFor, downloadFor }) {
  const [index, setIndex] = useState(-1);
  const current = index >= 0 ? images[index] : null;

  const close = useCallback(() => setIndex(-1), []);
  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : i)), []);
  const next = useCallback(() => setIndex((i) => (i < images.length - 1 ? i + 1 : i)), [images.length]);

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((img, i) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setIndex(i)}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-left hover:border-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <div className="aspect-[4/3] overflow-hidden bg-slate-100">
              <img src={fileUrl(srcFor(img))} alt={img.fileName} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <span className="rounded bg-slate-200 px-1 text-[11px] font-semibold text-slate-700 tabular-nums">#{img.position}</span>
              <span className="truncate text-xs text-slate-600">{img.fileName}</span>
            </div>
          </button>
        ))}
      </div>

      {current && createPortal(
        <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95 text-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">#{current.position} · {current.fileName}</p>
              <p className="text-xs text-slate-400">{index + 1} of {images.length} · {formatBytes(current.sizeBytes)}</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={fileUrl(downloadFor(current))} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Download</a>
              <button type="button" onClick={close} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">Close</button>
            </div>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-14 pb-6">
            <img src={fileUrl(srcFor(current))} alt={current.fileName} className="max-h-full max-w-full object-contain" />
            <button type="button" onClick={prev} disabled={index === 0} className="absolute left-3 rounded-full bg-white/10 p-3 hover:bg-white/20 disabled:opacity-30" aria-label="Previous">‹</button>
            <button type="button" onClick={next} disabled={index === images.length - 1} className="absolute right-3 rounded-full bg-white/10 p-3 hover:bg-white/20 disabled:opacity-30" aria-label="Next">›</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
