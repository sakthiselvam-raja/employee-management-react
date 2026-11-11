import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi, urls } from '../../api/endpoints';
import { fileUrl } from '../../api/client';
import AssignmentForm, { takenOn } from '../../components/AssignmentForm';
import ExcelPreviewModal from '../../components/ExcelPreviewModal';
import { AssignmentDetailModal, EditAssignmentModal } from '../../components/AdminModals';
import {
  Button, Card, EmptyState, ErrorBox, LinkButton, PageHeader, PageLoader, Pagination, StatusBadge,
} from '../../components/ui';
import { DeleteUploadModal } from './Uploads';
import { textMatches } from '../../components/UserPicker';
import { formatBytes, formatDateTime, formatWorkDate, freeRanges, rangeLabel, todayISO } from '../../utils/format';

const PALETTE = ['#2563eb', '#0d9488', '#e11d48', '#d97706', '#0284c7', '#7c3aed', '#16a34a', '#db2777', '#475569', '#ca8a04'];
const colorFor = (userId) => PALETTE[userId % PALETTE.length];

/** Horizontal bar showing which image numbers are taken by whom on the selected date */
function Coverage({ folder, ranges }) {
  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100" title="Assigned ranges for the selected date">
      {ranges.map((r) => (
        <div
          key={r.id}
          className="absolute inset-y-0"
          style={{
            left: `${((r.startPosition - 1) / folder.imageCount) * 100}%`,
            width: `${((r.endPosition - r.startPosition + 1) / folder.imageCount) * 100}%`,
            background: colorFor(r.userId),
          }}
          title={rangeLabel(r)}
        />
      ))}
    </div>
  );
}

export default function UploadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const [date, setDate] = useState(todayISO());
  const [dayPage, setDayPage] = useState(1);
  const DAY_PAGE_SIZE = 10;
  const [prefill, setPrefill] = useState(null);
  const [preview, setPreview] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [folderQ, setFolderQ] = useState('');
  const [excelQ, setExcelQ] = useState('');

  const q = useQuery({ queryKey: ['upload', Number(id)], queryFn: () => adminApi.upload(id) });
  const usersQ = useQuery({ queryKey: ['users', '', 'active'], queryFn: () => adminApi.users({ status: 'active' }) });
  // only the selected date's assignments for this ZIP, one page at a time
  const assignQ = useQuery({
    queryKey: ['assignments', { zipUploadId: Number(id), date, page: dayPage }],
    queryFn: () => adminApi.assignmentsPage({ zipUploadId: id, date, page: dayPage, pageSize: DAY_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const u = q.data;
  const dayAssignments = assignQ.data?.assignments || [];
  const dayTotal = assignQ.data?.total ?? 0;
  useEffect(() => {
    if (assignQ.data && dayPage > assignQ.data.pages) setDayPage(assignQ.data.pages);
  }, [assignQ.data, dayPage]);

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorBox error={q.error} />;

  const quickAssign = (folder) => {
    const gap = freeRanges(folder.imageCount, takenOn(folder, date))[0];
    setPrefill({ imageFolderId: folder.id, startPosition: gap?.startPosition ?? 1, endPosition: gap?.endPosition ?? folder.imageCount });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const s = u.assignmentSummary;
  const excelList = u.excelFiles.filter((e) => textMatches(`${e.relativePath} ${e.sheetNames.join(' ')}`, excelQ));
  const folders = u.imageFolders.filter((f) => textMatches(f.relativePath || '(root)', folderQ));

  return (
    <>
      <PageHeader
        back={<Link to="/admin/uploads" className="mb-1 inline-block text-sm text-slate-500 hover:text-slate-700">← ZIP uploads</Link>}
        title={u.originalName}
        description={`Uploaded ${formatDateTime(u.createdAt)} by ${u.uploadedBy.fullName} (${u.uploadedByRole === 'ADMIN' ? 'Admin' : 'User'})`}
        actions={(
          <>
            <LinkButton variant="primary" href={fileUrl(urls.admin.uploadSubmissionsZip(u.id))}>Download submission files only</LinkButton>
            <LinkButton href={fileUrl(urls.admin.uploadZip(u.id))}>Download all + submissions</LinkButton>
            <Button variant="subtleDanger" onClick={() => setDeleting(true)}>Delete</Button>
          </>
        )}
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Excel sheets</p><p className="text-xl font-semibold">{u.excelFiles.length}</p></div>
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Image folders</p><p className="text-xl font-semibold">{u.imageFolders.length}</p></div>
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Total images</p><p className="text-xl font-semibold">{u.totalImages}</p></div>
        <div className="card px-4 py-3"><p className="text-xs text-slate-500">Size / files</p><p className="text-xl font-semibold">{formatBytes(u.sizeBytes)}</p><p className="text-xs text-slate-500">{u.totalFiles} files extracted</p></div>
        <div className="card px-4 py-3">
          <p className="text-xs text-slate-500">Assignments</p>
          <p className="text-xl font-semibold">{s.COMPLETED}/{s.total} <span className="text-sm font-normal text-slate-500">done</span></p>
          {s.allCompleted && <p className="text-xs text-emerald-700">All completed — ready to download or delete</p>}
        </div>
      </div>
      <p className="mb-6 font-mono text-xs break-all text-slate-400">Stored: {u.zipPath} · Extracted to: {u.extractPath}</p>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
        <span className="text-sm font-medium text-brand-900">Working date</span>
        <input type="date" className="input w-auto" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setDayPage(1); } }} />
        <span className="text-sm text-brand-900">{dayTotal} assignment(s) on {formatWorkDate(date)} — coverage below is for this date.</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-3">
          {/* Image folders */}
          <Card
            title={`Image folders (${folderQ.trim() ? `${folders.length} of ${u.imageFolders.length}` : u.imageFolders.length})`}
            bodyClass=""
            actions={u.imageFolders.length > 0 && (
              <input type="search" className="input w-56 py-1.5" placeholder="Search folder name…" value={folderQ} onChange={(e) => setFolderQ(e.target.value)} />
            )}
          >
            {u.imageFolders.length === 0 && <EmptyState title="No image folders in this ZIP" icon="🖼️" />}
            {u.imageFolders.length > 0 && folders.length === 0 && <EmptyState title="No folder matches your search" icon="🔍" />}
            <ul className="divide-y divide-slate-100">
              {folders.map((f) => {
                const taken = takenOn(f, date);
                const assignedCount = taken.reduce((n, r) => n + r.endPosition - r.startPosition + 1, 0);
                return (
                  <li key={f.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">📁 {f.relativePath || '(root)'}</p>
                        <p className="text-xs text-slate-500">{f.imageCount} images · {assignedCount} assigned · {f.imageCount - assignedCount} free on this date</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" onClick={() => quickAssign(f)} disabled={assignedCount >= f.imageCount}>Assign range</Button>
                      </div>
                    </div>
                    <div className="mt-3"><Coverage folder={f} ranges={taken} /></div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Excel files */}
          <Card title={`Excel sheets (${excelQ.trim() ? `${excelList.length} of ${u.excelFiles.length}` : u.excelFiles.length})`} bodyClass="">
            {u.excelFiles.length === 0 && <EmptyState title="No Excel files in this ZIP" icon="📊" />}
            {u.excelFiles.length > 0 && (
              <div className="border-b border-slate-100 px-5 py-3">
                <input
                  type="search"
                  className="input"
                  placeholder="Search Excel file or sheet name…"
                  value={excelQ}
                  onChange={(e) => setExcelQ(e.target.value)}
                  aria-label="Search Excel sheets"
                />
              </div>
            )}
            {excelList.length === 0 && u.excelFiles.length > 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">No Excel file matches “{excelQ}”.</p>}
            <ul className="divide-y divide-slate-100">
              {excelList.map((e) => {
                return (
                  <li key={e.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">📊 {e.relativePath}</p>
                      <p className="text-xs text-slate-500">
                        {formatBytes(e.sizeBytes)}{e.sheetNames.length > 0 && ` · ${e.sheetNames.length} sheet(s): ${e.sheetNames.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setPreview(e)}>Preview</Button>
                      <LinkButton size="sm" href={fileUrl(urls.admin.excel(e.id))}>Download</LinkButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div ref={formRef} className="scroll-mt-20">
            <Card title="Assign work">
              {usersQ.isLoading && <PageLoader />}
              {usersQ.data?.length === 0 && (
                <EmptyState icon="👥" title="No active users" description="Create users first." action={<Button onClick={() => navigate('/admin/users')}>Go to Users</Button>} />
              )}
              {usersQ.data?.length > 0 && (
                <AssignmentForm upload={u} defaultDate={date} prefill={prefill} onDone={() => setPrefill(null)} />
              )}
            </Card>
          </div>

          <Card title={`Assignments on ${formatWorkDate(date)}`} bodyClass="">
            {dayAssignments.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing assigned from this ZIP on this date.</p>}
            <ul className="divide-y divide-slate-100">
              {dayAssignments.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 px-5 py-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => setDetailId(a.id)}>
                    <p className="truncate text-sm font-medium text-slate-900 hover:text-brand-700">{a.user.fullName}</p>
                    <p className="text-xs font-medium text-brand-700">Employee ID: {a.user.employeeId}</p>
                    <p className="text-xs text-slate-500">
                      {a.excelFiles.length} Excel · {a.totalImages} images
                      {a.imageRanges.length > 0 && ` (${a.imageRanges.map((r) => `${r.folderName} ${rangeLabel(r)}`).join(', ')})`}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={a.status} />
                    <button type="button" className="link text-xs" onClick={() => setEditing(a)}>Edit</button>
                  </div>
                </li>
              ))}
            </ul>
            {assignQ.data && <Pagination page={dayPage} pageSize={assignQ.data.pageSize} total={assignQ.data.total} onChange={setDayPage} />}
          </Card>
        </div>
      </div>

      <ExcelPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.relativePath}
        queryKey={['preview', 'excel', preview?.id]}
        queryFn={() => adminApi.excelPreview(preview.id)}
        downloadPath={preview && urls.admin.excel(preview.id)}
      />
      <AssignmentDetailModal id={detailId} onClose={() => setDetailId(null)} onEdit={(a) => { setDetailId(null); setEditing(a); }} />
      <EditAssignmentModal assignment={editing} onClose={() => setEditing(null)} />
      {deleting && <DeleteUploadModal upload={u} onClose={() => setDeleting(false)} onDeleted={() => navigate('/admin/uploads')} />}
    </>
  );
}