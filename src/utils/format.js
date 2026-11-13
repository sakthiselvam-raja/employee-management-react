export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** "2026-11-05" -> "05 Nov 2026" (no timezone shift) */
export function formatWorkDate(value) {
  if (!value) return '—';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Today's date in the browser's local time as YYYY-MM-DD */
export function todayISO() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// A range is shown by image FILE NAMES (e.g. "IMG_001.jpg – IMG_020.jpg"); numbers are only a fallback.
export const rangeLabel = (r) => {
  if (r.startName && r.endName) return r.startPosition === r.endPosition ? r.startName : `${r.startName} – ${r.endName}`;
  return r.startPosition === r.endPosition ? `#${r.startPosition}` : `${r.startPosition}–${r.endPosition}`;
};

export const folderLabel = (f) => f?.relativePath || f?.folderPath || '(root)';

/** Free (unassigned) gaps in 1..total given taken ranges */
export function freeRanges(total, taken) {
  const sorted = [...taken].sort((a, b) => a.startPosition - b.startPosition);
  const gaps = [];
  let next = 1;
  for (const r of sorted) {
    if (r.startPosition > next) gaps.push({ startPosition: next, endPosition: r.startPosition - 1 });
    next = Math.max(next, r.endPosition + 1);
  }
  if (next <= total) gaps.push({ startPosition: next, endPosition: total });
  return gaps;
}

/** Split 1..total (or a sub-range) into n near-equal consecutive ranges */
export function splitEvenly(start, end, n) {
  const total = end - start + 1;
  const base = Math.floor(total / n);
  let extra = total % n;
  const out = [];
  let s = start;
  for (let i = 0; i < n; i += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    if (size > 0) out.push({ startPosition: s, endPosition: s + size - 1 });
    else out.push(null);
    s += size;
  }
  return out;
}