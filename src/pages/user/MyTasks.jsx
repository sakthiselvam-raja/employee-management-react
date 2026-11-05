import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/endpoints';
import { useMe } from '../../hooks/useAuth';
import {
  EmptyState, ErrorBox, PageHeader, PageLoader, STATUS_OPTIONS, StatCard, StatusBadge, statusLabel,
} from '../../components/ui';
import { formatDateTime, formatWorkDate, rangeLabel, todayISO } from '../../utils/format';

export default function MyTasksPage() {
  const { data: me } = useMe();
  const [allDates, setAllDates] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');

  const params = { date: allDates ? undefined : date, status: status || undefined };
  const q = useQuery({ queryKey: ['myAssignments', params], queryFn: () => userApi.assignments(params) });
  const list = q.data || [];
  const count = (s) => list.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title={`Hello, ${me?.firstName || ''}`}
        description={allDates ? 'All work assigned to you' : `Work assigned to you for ${formatWorkDate(date)}`}
        actions={(
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="accent-brand-700" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} /> All dates
            </label>
            {!allDates && <input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
            <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </>
        )}
      />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Pending" value={count('PENDING')} tone="amber" />
        <StatCard label="Processing" value={count('PROCESSING')} tone="sky" />
        <StatCard label="Completed" value={count('COMPLETED')} tone="green" />
      </div>

      {q.isLoading && <PageLoader />}
      {q.isError && <ErrorBox error={q.error} />}
      {q.data && list.length === 0 && (
        <div className="card"><EmptyState icon="☕" title="Nothing assigned" description={allDates ? 'You have no assignments yet.' : 'No work is assigned to you for this date. Try another date or tick “All dates”.'} /></div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((a) => (
          <Link key={a.id} to={`/tasks/${a.id}`} className="card group flex flex-col p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{formatWorkDate(a.workDate)}</p>
                <p className="mt-0.5 line-clamp-1 font-semibold text-slate-900 group-hover:text-brand-700">{a.zipUpload.originalName}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="mt-4 space-y-1.5 text-sm text-slate-600">
              <p>📊 {a.excelFiles.length} Excel sheet(s)</p>
              <p>🖼️ {a.totalImages} image(s){a.imageRanges.length > 0 && <span className="text-slate-400"> — {a.imageRanges.map((r) => `${r.folderName} ${rangeLabel(r)}`).join(', ')}</span>}</p>
              {a.submissionCount > 0 && <p>📤 {a.submissionCount} upload(s) sent</p>}
            </div>
            {a.adminNotes && <p className="mt-3 line-clamp-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">{a.adminNotes}</p>}
            <p className="mt-auto pt-4 text-xs text-slate-400">{a.completedAt ? `Completed ${formatDateTime(a.completedAt)}` : `Assigned ${formatDateTime(a.createdAt)}`}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
