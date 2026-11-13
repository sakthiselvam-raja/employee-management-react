import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/endpoints';
import { formatBytes } from '../utils/format';
import { Card, ErrorBox } from './ui';

// The uploaded ZIP is deleted after extraction, so the files of a ZIP now live only in "extracted".
// The ZIP row only appears for old uploads whose ZIP is still on disk.
const PARTS = [
  { key: 'extracted', label: 'Uploaded ZIP contents (images & Excel)', color: 'bg-sky-500' },
  { key: 'submissions', label: 'Submission files (uploaded by users)', color: 'bg-emerald-500' },
  { key: 'zips', label: 'Old ZIP files not yet deleted', color: 'bg-brand-600', onlyIfAny: true },
];

/** File storage + PostgreSQL database size, shown on the admin dashboard. */
export default function StorageUsageCard() {
  const q = useQuery({ queryKey: ['dashboard', 'storage'], queryFn: adminApi.dashboardStorage, staleTime: 60_000 });
  const d = q.data;
  const parts = d ? PARTS.filter((p) => !p.onlyIfAny || (d.files[p.key]?.count ?? 0) > 0) : PARTS;

  return (
    <Card title="Storage &amp; database">
      {q.isLoading && <p className="text-sm text-slate-500">Calculating sizes…</p>}
      {q.isError && <ErrorBox error={q.error} />}
      {d && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Files */}
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Uploaded + submission files</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{formatBytes(d.totalBytes)}</p>
            <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
              {parts.map((p) => (
                <div key={p.key} className={p.color} style={{ width: `${d.totalBytes ? ((d.files[p.key]?.bytes || 0) / d.totalBytes) * 100 : 0}%` }} />
              ))}
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {parts.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${p.color}`} />{p.label} <span className="text-xs text-slate-400">({d.files[p.key]?.count ?? 0})</span></span>
                  <span className="font-medium text-slate-800 tabular-nums">{formatBytes(d.files[p.key]?.bytes || 0)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Database */}
          <div>
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">Database size</p>
            {d.database ? (
              <>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{formatBytes(d.database.appBytes ?? d.database.bytes)}</p>
                <p className="text-xs text-slate-500">
                  App data (tables + indexes){d.database.rows !== undefined && ` · ${d.database.rows.toLocaleString()} rows in ${d.database.tables} tables`}
                </p>
                <p className="mt-1 text-xs text-slate-400" title="Includes PostgreSQL's own system tables, so it is never zero even for an empty database">
                  Whole database on disk: {formatBytes(d.database.bytes)} · PostgreSQL · {d.database.name}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Database size is not available.</p>
            )}
          </div>

        </div>
      )}
    </Card>
  );
}