import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, urls } from '../../api/endpoints';
import { errorMessage, fileUrl } from '../../api/client';
import { useToast } from '../../components/Toast';
import { AssignmentDetailModal, EditAssignmentModal } from '../../components/AdminModals';
import { RemoteUserSelect } from '../../components/UserPicker';
import RefreshButton from '../../components/RefreshButton';
import {
  Button, Card, ConfirmModal, EmptyState, ErrorBox, LinkButton, PageHeader, PageLoader, Pagination, STATUS_OPTIONS, StatusBadge, statusLabel,
} from '../../components/ui';
import { folderLabel, formatDateTime, formatWorkDate, rangeLabel, todayISO } from '../../utils/format';

const addMonthISO = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const mode = params.get('mode') || 'day'; // day | range
  const filters = {
    date: params.get('date') || todayISO(),
    from: params.get('from') || '',
    to: params.get('to') || '',
    status: params.get('status') || '',
    userId: params.get('userId') || '',
    zipUploadId: params.get('zipUploadId') || '',
  };
  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setSelected(new Set());
    setPage(1);
  };

  // date range: at most one month between start and end
  const setRange = (key, value) => {
    const next = new URLSearchParams(params);
    let from = key === 'from' ? value : filters.from;
    let to = key === 'to' ? value : filters.to;
    if (from && key === 'from' && (!to || to < from || to > addMonthISO(from, 1))) to = addMonthISO(from, 1);
    if (to && key === 'to' && from && (from > to || addMonthISO(from, 1) < to)) from = addMonthISO(to, -1);
    if (from) next.set('from', from); else next.delete('from');
    if (to) next.set('to', to); else next.delete('to');
    setParams(next, { replace: true });
    setSelected(new Set());
    setPage(1);
  };
  const resetFilters = () => {
    setParams(new URLSearchParams(), { replace: true });
    setSearch('');
    setSelected(new Set());
    setPage(1);
  };
  const filtersActive = Boolean(mode !== 'day' || params.get('date') || filters.status || filters.userId || filters.zipUploadId || search);

  const apiParams = useMemo(() => {
    const p = {
      status: filters.status || undefined,
      userId: filters.userId || undefined,
      zipUploadId: filters.zipUploadId || undefined,
      search: debounced || undefined,
      page,
      pageSize: PAGE_SIZE,
    };
    if (mode === 'day') p.date = filters.date;
    else { p.from = filters.from || undefined; p.to = filters.to || undefined; }
    return p;
  }, [mode, filters.date, filters.from, filters.to, filters.status, filters.userId, filters.zipUploadId, debounced, page]);

  const q = useQuery({
    queryKey: ['assignments', apiParams],
    queryFn: () => adminApi.assignmentsPage(apiParams),
    placeholderData: keepPreviousData,
  });

  // after deleting the last row of a page, step back
  useEffect(() => {
    if (q.data && page > q.data.pages) setPage(q.data.pages);
  }, [q.data, page]);
  const uploadsQ = useQuery({ queryKey: ['uploads'], queryFn: adminApi.uploads });

  const refresh = () => ['assignments', 'assignment', 'upload', 'uploads', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const setStatus = useMutation({
    mutationFn: ({ id, status }) => adminApi.setAssignmentStatus(id, status),
    onSuccess: () => { refresh(); toast.success('Status updated'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const bulk = useMutation({
    mutationFn: (status) => adminApi.bulkStatus([...selected], status),
    onSuccess: (r) => { refresh(); setSelected(new Set()); toast.success(`${r.updated} assignment(s) updated`); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const del = useMutation({
    mutationFn: (id) => adminApi.deleteAssignment(id),
    onSuccess: () => { refresh(); setDeleting(null); toast.success('Assignment deleted'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const list = q.data?.assignments || [];
  const counts = q.data?.counts || {};
  const allSelected = list.length > 0 && selected.size === list.length;

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Day-wise work given to users. Change status, reassign, download or delete."
        actions={(
          <>
            <LinkButton
              href={fileUrl(urls.admin.assignmentsExport({ ...apiParams, page: undefined, pageSize: undefined }))}
              title="Download every assignment matching the current filters as an Excel file"
            >
              ⬇ Export Excel
            </LinkButton>
            <RefreshButton onClick={() => q.refetch()} loading={q.isFetching} />
          </>
        )}
      />

      <Card bodyClass="">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
          <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            {[['day', 'One day'], ['range', 'Date range']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setFilter('mode', v === 'day' ? '' : v)} className={`px-3 py-2 ${mode === v ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{l}</button>
            ))}
          </div>
          {mode === 'day' ? (
            <input type="date" className="input w-auto" value={filters.date} onChange={(e) => setFilter('date', e.target.value)} />
          ) : (
            <>
              <input type="date" className="input w-auto" value={filters.from} max={filters.to || undefined} onChange={(e) => setRange('from', e.target.value)} aria-label="Start date" title="Start date" />
              <span className="pb-2 text-sm text-slate-400">to</span>
              <input type="date" className="input w-auto" value={filters.to} min={filters.from || undefined} max={filters.from ? addMonthISO(filters.from, 1) : undefined} onChange={(e) => setRange('to', e.target.value)} aria-label="End date" title="End date (max one month after start)" />
              <span className="pb-2 text-xs text-slate-400">max 1 month</span>
            </>
          )}
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <RemoteUserSelect
            className="w-72"
            status="all"
            value={filters.userId}
            onChange={(id) => setFilter('userId', id)}
            placeholder="All users — type to pick one"
          />
          <input
            type="search"
            className="input w-60"
            placeholder="Search name, employee ID, email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }}
            aria-label="Search assignments by user"
          />
          <select className="input w-auto max-w-56" value={filters.zipUploadId} onChange={(e) => setFilter('zipUploadId', e.target.value)}>
            <option value="">All ZIPs</option>
            {uploadsQ.data?.map((u) => <option key={u.id} value={u.id}>{u.originalName}</option>)}
          </select>
          <Button variant="secondary" onClick={resetFilters} disabled={!filtersActive} title="Clear all filters and go back to today">↺ Reset filters</Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm">
          <span className="text-slate-600">{q.data?.total ?? 0} assignment(s){debounced && ` matching “${debounced}”`}</span>
          {STATUS_OPTIONS.map((s) => counts[s] ? <span key={s} className="flex items-center gap-1"><StatusBadge status={s} /> {counts[s]}</span> : null)}
          {selected.size > 0 && (
            <span className="ml-auto flex items-center gap-2">
              <span className="text-slate-600">{selected.size} selected — set to:</span>
              {STATUS_OPTIONS.map((s) => <Button key={s} size="sm" variant="secondary" loading={bulk.isPending && bulk.variables === s} onClick={() => bulk.mutate(s)}>{statusLabel(s)}</Button>)}
            </span>
          )}
        </div>

        {q.isLoading && <PageLoader />}
        {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
        {q.data && list.length === 0 && <EmptyState icon="🗓️" title="No assignments found" description="Try another date or filter, or assign work from a ZIP upload." />}

        {list.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="th w-8"><input type="checkbox" className="accent-brand-700" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(list.map((a) => a.id)))} /></th>
                  <th className="th">Date</th><th className="th">User</th><th className="th">Files</th><th className="th">Status</th>
                  <th className="th">User uploads</th><th className="th">Completed</th><th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((a) => (
                  <tr key={a.id} className={selected.has(a.id) ? 'bg-brand-50/40' : ''}>
                    <td className="td">
                      <input type="checkbox" className="accent-brand-700" checked={selected.has(a.id)} onChange={() => {
                        const n = new Set(selected);
                        if (n.has(a.id)) n.delete(a.id); else n.add(a.id);
                        setSelected(n);
                      }} />
                    </td>
                    <td className="td whitespace-nowrap">{formatWorkDate(a.workDate)}</td>
                    <td className="td"><p className="font-medium text-slate-800">{a.user.fullName}</p><p className="text-xs text-slate-500">{a.user.employeeId}</p></td>
                    <td className="td max-w-xs">
                      <p className="truncate text-xs text-slate-500" title={a.zipUpload.originalName}>{a.zipUpload.originalName}</p>
                      {a.excelFiles.length > 0 && <p className="truncate text-xs" title={a.excelFiles.map((e) => e.relativePath).join('\n')}>📊 {a.excelFiles.map((e) => e.fileName).join(', ')}</p>}
                      {a.imageRanges.map((r) => (
                        <p key={r.id} className="truncate text-xs" title={`${folderLabel(r)} · images ${rangeLabel(r)}`}>
                          📁 <span className="font-medium text-slate-700">{folderLabel(r)}</span> <span className="text-slate-500">· {rangeLabel(r)} ({r.count})</span>
                        </p>
                      ))}
                    </td>
                    <td className="td">
                      <select
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs"
                        value={a.status}
                        disabled={setStatus.isPending}
                        onChange={(e) => setStatus.mutate({ id: a.id, status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                      </select>
                      <div className="mt-1"><StatusBadge status={a.status} /></div>
                    </td>
                    <td className="td tabular-nums">{a.submissionCount ? <button type="button" className="link" onClick={() => setDetailId(a.id)}>{a.submissionCount} upload(s)</button> : <span className="text-slate-400">—</span>}</td>
                    <td className="td text-xs whitespace-nowrap">{formatDateTime(a.completedAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailId(a.id)}>View</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Edit</Button>
                        <a className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100" href={fileUrl(urls.admin.assignmentZip(a.id))}>Download</a>
                        <Button size="sm" variant="subtleDanger" onClick={() => setDeleting(a)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onChange={(n) => { setPage(n); setSelected(new Set()); }} />}
      </Card>

      <AssignmentDetailModal id={detailId} onClose={() => setDetailId(null)} onEdit={(a) => { setDetailId(null); setEditing(a); }} />
      <EditAssignmentModal assignment={editing} onClose={() => setEditing(null)} />
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        danger
        title="Delete assignment"
        confirmText="Delete"
        loading={del.isPending}
        onConfirm={() => del.mutate(deleting.id)}
        message={deleting && `Delete ${deleting.user.fullName}'s assignment for ${formatWorkDate(deleting.workDate)}? Files the user uploaded for it are deleted too. The original ZIP files are kept.`}
      >
        {deleting && deleting.status !== 'COMPLETED' && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">This assignment is still {statusLabel(deleting.status).toLowerCase()}.</p>
        )}
      </ConfirmModal>
    </>
  );
}