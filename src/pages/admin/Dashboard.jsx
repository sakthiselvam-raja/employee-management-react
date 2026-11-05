import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi, urls } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import { Card, EmptyState, ErrorBox, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { formatDateTime, formatWorkDate, todayISO } from '../../utils/format';

function ProgressBar({ p }) {
  const pct = (n) => (p.total ? (n / p.total) * 100 : 0);
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="bg-emerald-500" style={{ width: `${pct(p.COMPLETED)}%` }} />
      <div className="bg-sky-500" style={{ width: `${pct(p.PROCESSING)}%` }} />
      <div className="bg-amber-400" style={{ width: `${pct(p.PENDING)}%` }} />
    </div>
  );
}

export default function AdminDashboard() {
  const [date, setDate] = useState(todayISO());
  const q = useQuery({ queryKey: ['dashboard', date], queryFn: () => adminApi.dashboard(date) });
  const d = q.data;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Work status for ${formatWorkDate(date)}`}
        actions={<input type="date" className="input w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}
      />

      {q.isLoading && <PageLoader />}
      {q.isError && <ErrorBox error={q.error} />}

      {d && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Active users" value={d.stats.activeUsers} sub={`${d.stats.totalUsers} total`} />
            <StatCard label="ZIP uploads" value={d.stats.uploads} />
            <StatCard label="Assignments" value={d.stats.assignments} tone="brand" sub="for this date" />
            <StatCard label="Pending" value={d.stats.PENDING} tone="amber" />
            <StatCard label="Processing" value={d.stats.PROCESSING} tone="sky" />
            <StatCard label="Completed" value={d.stats.COMPLETED} tone="green" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card
              title="Progress by user"
              className="xl:col-span-2"
              bodyClass=""
              actions={<Link to={`/admin/assignments?date=${date}`} className="link text-sm">Manage assignments →</Link>}
            >
              {d.perUser.length === 0 ? (
                <EmptyState
                  title="Nothing assigned for this date"
                  description="Open a ZIP upload and assign Excel sheets and image ranges to users."
                  action={<Link to="/admin/uploads" className="link text-sm">Go to ZIP uploads</Link>}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead><tr><th className="th">User</th><th className="th">Tasks</th><th className="th">Images</th><th className="th">Excel</th><th className="th w-1/3">Status</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.perUser.map((p) => (
                        <tr key={p.user.id}>
                          <td className="td"><p className="font-medium text-slate-800">{p.user.fullName}</p><p className="text-xs text-slate-500">{p.user.employeeId}</p></td>
                          <td className="td tabular-nums">{p.total}</td>
                          <td className="td tabular-nums">{p.images}</td>
                          <td className="td tabular-nums">{p.excel}</td>
                          <td className="td">
                            <ProgressBar p={p} />
                            <p className="mt-1 text-xs text-slate-500">{p.COMPLETED} done · {p.PROCESSING} processing · {p.PENDING} pending</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card title="Latest submissions" bodyClass="divide-y divide-slate-100">
              {d.recentSubmissions.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No user uploads yet.</p>}
              {d.recentSubmissions.map((s) => (
                <div key={s.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{s.uploadedBy?.fullName}</p>
                      <p className="truncate text-xs text-slate-500">{s.zipName} · work date {formatWorkDate(s.workDate)}</p>
                    </div>
                    {s.hasFile && <a className="link shrink-0 text-xs" href={fileUrl(urls.admin.submission(s.id))}>Download</a>}
                  </div>
                  {s.originalName && <p className="mt-1 truncate text-xs text-slate-600">📄 {s.originalName}</p>}
                  {s.notes && <p className="mt-1 line-clamp-2 text-xs text-slate-600">“{s.notes}”</p>}
                  <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(s.createdAt)}</p>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
