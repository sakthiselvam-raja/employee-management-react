import { useState } from 'react';
import { Link } from 'react-router-dom';
import RefreshButton from '../../components/RefreshButton';
import { useQuery } from '@tanstack/react-query';
import { userApi } from '../../api/endpoints';
import { useMe } from '../../hooks/useAuth';
import {
  Button, EmptyState, ErrorBox, PageHeader, PageLoader, STATUS_OPTIONS, StatCard, StatusBadge, statusLabel,
} from '../../components/ui';
import { folderLabel, formatDateTime, formatWorkDate, rangeLabel, todayISO } from '../../utils/format';

// colour bar on top of a card, by status
const ACCENT = { PENDING: 'border-t-amber-400', PROCESSING: 'border-t-sky-500', COMPLETED: 'border-t-emerald-500' };

export default function MyTasksPage() {
  const { data: me } = useMe();
  const [allDates, setAllDates] = useState(true); // "All dates" is ticked by default
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');

  const params = { date: allDates ? undefined : date, status: status || undefined };
  const q = useQuery({ queryKey: ['myAssignments', params], queryFn: () => userApi.assignments(params), staleTime: 0, refetchOnMount: 'always' }); // always reload when the page opens
  const list = q.data || [];
  const count = (s) => list.filter((a) => a.status === s).length;

  return (
    <>
      <PageHeader
        title={`Hello, ${me?.firstName || ''}`}
        description={allDates ? 'All work assigned to you' : `Work assigned to you for ${formatWorkDate(date)}`}
        actions={(
          <>
            <RefreshButton onClick={() => q.refetch()} loading={q.isFetching} updatedAt={q.dataUpdatedAt} />
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
          <Link
            key={a.id}
            to={`/emp-portal/tasks/${a.id}`}
            className={`card group flex flex-col overflow-hidden border-t-4 transition-all duration-500 hover:-translate-y-1 hover:shadow-lg ${ACCENT[a.status] || 'border-t-slate-300'}`}
          >
            <div className="flex-1 p-5">
              {/* date + status */}
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  📅 {formatWorkDate(a.workDate)}
                </span>
                <StatusBadge status={a.status} />
              </div>

              {/* ZIP name */}
              <h3 className="mt-3 flex items-center gap-2 text-base font-semibold text-slate-900 transition-colors group-hover:text-brand-700">
                <span aria-hidden="true">📦</span>
                <span className="line-clamp-1">{a.zipUpload.originalName}</span>
              </h3>

              {/* numbers */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <p className="text-lg font-semibold text-slate-900 tabular-nums">{a.excelFiles.length}</p>
                  <p className="text-[11px] text-slate-500">📊 Excel</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <p className="text-lg font-semibold text-slate-900 tabular-nums">{a.totalImages}</p>
                  <p className="text-[11px] text-slate-500">🖼️ Images</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-2 py-2.5">
                  <p className="text-lg font-semibold text-slate-900 tabular-nums">{a.submissionCount}</p>
                  <p className="text-[11px] text-slate-500">📤 Sent</p>
                </div>
              </div>

              {/* folders */}
              {a.imageRanges.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">Image folders</p>
                  {a.imageRanges.slice(0, 2).map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2" title={`${folderLabel(r)} · ${rangeLabel(r)}`}>
                      <p className="truncate text-sm font-medium text-slate-800">📁 {folderLabel(r)}</p>
                      <p className="truncate text-xs text-slate-500">{rangeLabel(r)} · {r.count} image(s)</p>
                    </div>
                  ))}
                  {a.imageRanges.length > 2 && <p className="text-xs text-slate-400">+ {a.imageRanges.length - 2} more folder(s)</p>}
                </div>
              )}

              {a.adminNotes && (
                <p className="mt-4 line-clamp-2 rounded-lg border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">Admin note: </span>{a.adminNotes}
                </p>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs">
              <span className="text-slate-500">{a.completedAt ? `Completed ${formatDateTime(a.completedAt)}` : `Assigned ${formatDateTime(a.createdAt)}`}</span>
              <span className="font-medium text-brand-700 transition-transform duration-300 group-hover:translate-x-1">Open task →</span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}