import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, urls } from '../../api/endpoints';
import { errorMessage, fileUrl } from '../../api/client';
import { useToast } from '../../components/Toast';
import { AssignmentDetailModal, EditAssignmentModal } from '../../components/AdminModals';
import UserSelect, { userMatches } from '../../components/UserPicker';
import {
  Button, Card, ConfirmModal, EmptyState, ErrorBox, PageHeader, PageLoader, STATUS_OPTIONS, StatusBadge, statusLabel,
} from '../../components/ui';
import { formatDateTime, formatWorkDate, rangeLabel, todayISO } from '../../utils/format';

export default function AssignmentsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState('');

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
  };

  const apiParams = useMemo(() => {
    const p = { status: filters.status || undefined, userId: filters.userId || undefined, zipUploadId: filters.zipUploadId || undefined };
    if (mode === 'day') p.date = filters.date;
    else { p.from = filters.from || undefined; p.to = filters.to || undefined; }
    return p;
  }, [mode, filters.date, filters.from, filters.to, filters.status, filters.userId, filters.zipUploadId]);

  const q = useQuery({ queryKey: ['assignments', apiParams], queryFn: () => adminApi.assignments(apiParams) });
  const usersQ = useQuery({ queryKey: ['users', '', 'all'], queryFn: () => adminApi.users({ status: 'all' }) });
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

  // text search (name / employee ID / email) — matched against the full users list
  const matchIds = useMemo(
    () => (search.trim() ? new Set((usersQ.data || []).filter((u) => userMatches(u, search)).map((u) => u.id)) : null),
    [search, usersQ.data],
  );
  const list = useMemo(() => (q.data || []).filter((a) => !matchIds || matchIds.has(a.user.id)), [q.data, matchIds]);
  const counts = list.reduce((c, a) => ({ ...c, [a.status]: (c[a.status] || 0) + 1 }), {});
  const allSelected = list.length > 0 && selected.size === list.length;

  return (
    <>
      <PageHeader title="Assignments" description="Day-wise work given to users. Change status, reassign, download or delete." />

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
              <input type="date" className="input w-auto" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="From" />
              <span className="pb-2 text-sm text-slate-400">to</span>
              <input type="date" className="input w-auto" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="To" />
            </>
          )}
          <select className="input w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <UserSelect
            className="w-72"
            users={usersQ.data || []}
            value={filters.userId}
            onChange={(id) => setFilter('userId', id)}
            emptyLabel="All users"
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
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm">
          <span className="text-slate-600">{list.length} assignment(s){search.trim() && ` matching “${search.trim()}”`}</span>
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
                      {a.imageRanges.length > 0 && <p className="truncate text-xs">🖼️ {a.imageRanges.map((r) => `${r.folderName} ${rangeLabel(r)}`).join(', ')} <span className="text-slate-400">({a.totalImages})</span></p>}
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