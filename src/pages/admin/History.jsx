import { Fragment, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, urls } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import {
  Badge, Card, EmptyState, ErrorBox, PageHeader, PageLoader, Pagination, STATUS_OPTIONS, StatusBadge, Tabs, statusLabel,
} from '../../components/ui';
import { formatBytes, formatDateTime, formatWorkDate, rangeLabel } from '../../utils/format';

function FilesTab() {
  const [page, setPage] = useState(1);
  const [who, setWho] = useState('all');
  const [open, setOpen] = useState(null);
  const q = useQuery({ queryKey: ['history', 'files', page, who], queryFn: () => adminApi.historyFiles({ page, pageSize: 20, uploadedBy: who }) });

  return (
    <Card bodyClass="">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <select className="input w-auto" value={who} onChange={(e) => { setWho(e.target.value); setPage(1); }}>
          <option value="all">Uploaded by anyone</option>
          <option value="ADMIN">Uploaded by Admin (ZIP files)</option>
          <option value="USER">Uploaded by Users (Excel re-uploads)</option>
        </select>
      </div>
      {q.isLoading && <PageLoader />}
      {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
      {q.data?.rows.length === 0 && <EmptyState title="No uploads yet" />}
      {q.data?.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/60">
              <tr><th className="th">Uploaded</th><th className="th">Type</th><th className="th">Original name</th><th className="th">Stored as / path</th><th className="th">Uploaded by</th><th className="th">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.rows.map((r) => (
                <Fragment key={r.key}>
                  <tr>
                    <td className="td text-xs whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td className="td">{r.kind === 'ZIP' ? <Badge tone="brand">ZIP</Badge> : <Badge tone="amber">Excel re-upload</Badge>}</td>
                    <td className="td max-w-[14rem]">
                      <p className="truncate font-medium text-slate-800" title={r.originalName}>{r.originalName}</p>
                      <p className="text-xs text-slate-500">{formatBytes(r.sizeBytes)}</p>
                    </td>
                    <td className="td max-w-[18rem]">
                      <p className="truncate font-mono text-[11px] text-slate-600" title={r.storedName}>{r.storedName}</p>
                      <p className="truncate font-mono text-[11px] text-slate-400" title={r.storagePath}>{r.storagePath}</p>
                    </td>
                    <td className="td"><p>{r.uploadedBy.fullName}</p><Badge>{r.uploadedByRole === 'ADMIN' ? 'Admin' : 'User'}</Badge></td>
                    <td className="td text-xs">
                      {r.kind === 'ZIP' ? (
                        <button type="button" className="link" onClick={() => setOpen(open === r.key ? null : r.key)}>
                          {r.excelFiles.length} Excel · {r.imageFolders.length} folders {open === r.key ? '▲' : '▼'}
                        </button>
                      ) : (
                        <>
                          <p>Assignment #{r.assignmentId} · {formatWorkDate(r.workDate)}</p>
                          <p className="text-slate-500">{r.zipName}</p>
                          <a className="link" href={fileUrl(urls.admin.submission(r.id))}>Download</a>
                          {r.notes && <p className="mt-1 line-clamp-2 text-slate-600">“{r.notes}”</p>}
                        </>
                      )}
                    </td>
                  </tr>
                  {open === r.key && (
                    <tr className="bg-slate-50/60">
                      <td colSpan={6} className="px-6 py-4 text-xs">
                        <p className="mb-2 font-mono text-slate-500">Extracted to: {r.extractPath}</p>
                        <div className="grid gap-6 md:grid-cols-2">
                          <div>
                            <p className="mb-1 font-semibold text-slate-700">Excel sheets</p>
                            {r.excelFiles.length === 0 && <p className="text-slate-500">None</p>}
                            <ul className="space-y-0.5">{r.excelFiles.map((e) => <li key={e.relativePath}>📊 {e.relativePath}{e.sheetNames.length > 0 && <span className="text-slate-500"> — {e.sheetNames.join(', ')}</span>}</li>)}</ul>
                          </div>
                          <div>
                            <p className="mb-1 font-semibold text-slate-700">Image folders</p>
                            {r.imageFolders.length === 0 && <p className="text-slate-500">None</p>}
                            <ul className="space-y-0.5">{r.imageFolders.map((f) => <li key={f.relativePath}>📁 {f.relativePath || '(root)'} — {f.imageCount} images</li>)}</ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
    </Card>
  );
}

function AssignmentsTab() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [from, setFrom] = useState(thirtyDaysAgo);
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = { from: from || undefined, to: to || undefined, status: status || undefined, page, pageSize: 20 };
  const q = useQuery({
    queryKey: ['assignments', 'history', params],
    queryFn: () => adminApi.assignmentsPage(params),
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.assignments;

  return (
    <Card bodyClass="">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 text-sm">
        <span className="text-slate-500">From</span><input type="date" className="input w-auto" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <span className="text-slate-500">to</span><input type="date" className="input w-auto" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>
      {q.isLoading && <PageLoader />}
      {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
      {rows?.length === 0 && <EmptyState title="No assignments in this period" />}
      {rows?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/60">
              <tr><th className="th">Work date</th><th className="th">Assigned user</th><th className="th">ZIP</th><th className="th">Excel sheets</th><th className="th">Image folders / ranges</th><th className="th">Status</th><th className="th">Assigned</th><th className="th">Completed</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="td whitespace-nowrap">{formatWorkDate(a.workDate)}</td>
                  <td className="td"><p className="font-medium">{a.user.fullName}</p><p className="text-xs text-slate-500">{a.user.employeeId} · {a.user.email}</p></td>
                  <td className="td max-w-[12rem] truncate text-xs">{a.zipUpload.originalName}</td>
                  <td className="td text-xs">{a.excelFiles.map((e) => <p key={e.id} className="truncate">{e.relativePath}</p>)}</td>
                  <td className="td text-xs">{a.imageRanges.map((r) => <p key={r.id}>{r.folderPath || '(root)'}: {rangeLabel(r)} <span className="text-slate-400">({r.count})</span></p>)}</td>
                  <td className="td"><StatusBadge status={a.status} /></td>
                  <td className="td text-xs whitespace-nowrap">{formatDateTime(a.createdAt)}<br /><span className="text-slate-500">by {a.assignedBy?.fullName}</span></td>
                  <td className="td text-xs whitespace-nowrap">{formatDateTime(a.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
    </Card>
  );
}

const actionLabels = {
  LOGIN: 'Login', ZIP_UPLOADED: 'ZIP uploaded', ZIP_DELETED: 'ZIP deleted', ZIP_DOWNLOADED: 'ZIP downloaded',
  ASSIGNMENT_CREATED: 'Assignment created', ASSIGNMENT_UPDATED: 'Assignment updated', ASSIGNMENT_REASSIGNED: 'Reassigned',
  ASSIGNMENT_DELETED: 'Assignment deleted', STATUS_CHANGED: 'Status changed', STATUS_CHANGED_BULK: 'Bulk status change',
  SUBMISSION_UPLOADED: 'User uploaded file/notes', SUBMISSION_DELETED: 'User deleted a submission', USER_CREATED: 'User created', USER_UPDATED: 'User updated',
  USER_ACTIVATED: 'User activated', USER_DEACTIVATED: 'User deactivated', USER_DELETED: 'User deleted',
  USER_PASSWORD_RESET: 'Password reset', PASSWORD_CHANGED: 'Password changed',
};

/**
 * The "Activity log" tab is hidden for now. The backend keeps recording every action
 * (logins, uploads, assignments, deletions…), so nothing is lost — set this to true to show the tab again.
 */
const SHOW_ACTIVITY_LOG = false;

function ActivityTab() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [open, setOpen] = useState(null);
  const q = useQuery({ queryKey: ['history', 'activity', page, action], queryFn: () => adminApi.historyActivity({ page, pageSize: 25, action: action || undefined }) });

  return (
    <Card bodyClass="">
      <div className="border-b border-slate-100 p-4">
        <select className="input w-auto" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
          <option value="">All actions</option>
          {q.data?.actions.map((a) => <option key={a} value={a}>{actionLabels[a] || a}</option>)}
        </select>
      </div>
      {q.isLoading && <PageLoader />}
      {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
      {q.data?.rows.length === 0 && <EmptyState title="No activity recorded" />}
      <ul className="divide-y divide-slate-100">
        {q.data?.rows.map((r) => (
          <li key={r.id} className="px-5 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="w-40 shrink-0 text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
              <Badge tone={r.action.includes('DELETE') ? 'red' : r.action.includes('STATUS') ? 'amber' : 'brand'}>{actionLabels[r.action] || r.action}</Badge>
              <span className="text-slate-700">{r.actor ? `${r.actor.fullName} (${r.actorRole === 'ADMIN' ? 'Admin' : r.actor.employeeId})` : 'System'}</span>
              {r.entityId && <span className="text-xs text-slate-400">{r.entityType} #{r.entityId}</span>}
              {r.details && <button type="button" className="link ml-auto text-xs" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Details'}</button>}
            </div>
            {open === r.id && <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(r.details, null, 2)}</pre>}
          </li>
        ))}
      </ul>
      {q.data && <Pagination page={page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
    </Card>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState('files');
  return (
    <>
      <PageHeader title="History" description="Every upload, assignment and change — kept even after files are deleted (Activity log)." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'files', label: 'Upload history' },
          { value: 'assignments', label: 'Assignment history' },
          ...(SHOW_ACTIVITY_LOG ? [{ value: 'activity', label: 'Activity log' }] : []),
        ]}
      />
      {tab === 'files' && <FilesTab />}
      {tab === 'assignments' && <AssignmentsTab />}
      {SHOW_ACTIVITY_LOG && tab === 'activity' && <ActivityTab />}
    </>
  );
}