import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, urls } from '../api/endpoints';
import { errorMessage, fileUrl } from '../api/client';
import { useToast } from './Toast';
import ImageGallery, { ImagePager, pageImages } from './ImageGallery';
import ExcelPreviewModal from './ExcelPreviewModal';
import AssignmentForm from './AssignmentForm';
import {
  Badge, Button, ErrorBox, LinkButton, Modal, PageLoader, Pagination, STATUS_OPTIONS, StatusBadge, statusLabel,
} from './ui';
import { formatBytes, formatDateTime, formatWorkDate, rangeLabel, splitEvenly, freeRanges } from '../utils/format';
import { takenOn } from './AssignmentForm';
import { userMatches } from './UserPicker';

/** Browse images of a folder (optionally only a range) as admin */
export function FolderImagesModal({ target, onClose }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [target?.folderId, target?.from, target?.to]);
  const q = useQuery({
    queryKey: ['folderImages', target?.folderId, target?.from, target?.to, page, pageSize],
    queryFn: () => adminApi.folderImages(target.folderId, target.from, target.to, page, pageSize),
    enabled: Boolean(target),
    placeholderData: keepPreviousData,
  });
  const { images, total } = pageImages(q.data, page, pageSize);
  return (
    <Modal open={Boolean(target)} onClose={onClose} size="full" title={target?.title || 'Images'}>
      {q.isLoading && <PageLoader />}
      {q.isError && <ErrorBox error={q.error} />}
      {q.data && (
        <>
          <ImageGallery images={images} srcFor={(i) => urls.admin.image(i.id)} downloadFor={(i) => urls.admin.imageDownload(i.id)} page={page} pageSize={pageSize} total={total} onPage={setPage} loading={q.isFetching} />
          <ImagePager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </>
      )}
    </Modal>
  );
}

/** Full details of one assignment, incl. user submissions (Excel + notes) */
export function AssignmentDetailModal({ id, onClose, onEdit }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [browse, setBrowse] = useState(null);
  const [subPage, setSubPage] = useState(1);
  const SUB_SIZE = 5;
  useEffect(() => { setSubPage(1); }, [id]);
  const q = useQuery({
    queryKey: ['assignment', id, subPage],
    queryFn: () => adminApi.assignment(id, subPage, SUB_SIZE),
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  });
  const a = q.data?.assignment;
  // server paginates the submissions; if it returned all of them, cut the page here
  const subTotal = q.data ? (q.data.submissionTotal ?? q.data.submissions.length) : 0;
  const subRows = q.data ? (q.data.submissionTotal !== undefined ? q.data.submissions : q.data.submissions.slice((subPage - 1) * SUB_SIZE, subPage * SUB_SIZE)) : [];

  const status = useMutation({
    mutationFn: (s) => adminApi.setAssignmentStatus(id, s),
    onSuccess: () => {
      ['assignment', 'assignments', 'upload', 'uploads', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success('Status updated');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Modal open={Boolean(id)} onClose={onClose} size="lg" title={a ? `Assignment #${a.id}` : 'Assignment'}
      footer={a && (
        <>
          <LinkButton href={fileUrl(urls.admin.assignmentZip(a.id))}>Download all (ZIP)</LinkButton>
          {onEdit && <Button variant="secondary" onClick={() => onEdit(a)}>Edit / reassign</Button>}
          <Button onClick={onClose}>Close</Button>
        </>
      )}
    >
      {q.isLoading && <PageLoader />}
      {q.isError && <ErrorBox error={q.error} />}
      {a && (
        <div className="space-y-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <div><dt className="text-xs text-slate-500">User</dt><dd className="font-medium">{a.user.fullName}</dd><dd className="text-xs text-slate-500">{a.user.employeeId}</dd></div>
            <div><dt className="text-xs text-slate-500">Working date</dt><dd className="font-medium">{formatWorkDate(a.workDate)}</dd></div>
            <div><dt className="text-xs text-slate-500">ZIP</dt><dd className="truncate font-medium">{a.zipUpload.originalName}</dd></div>
            <div><dt className="text-xs text-slate-500">Assigned by</dt><dd>{a.assignedBy?.fullName}</dd><dd className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Started</dt><dd>{formatDateTime(a.startedAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Completed</dt><dd>{formatDateTime(a.completedAt)}</dd></div>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            <StatusBadge status={a.status} />
            <select className="input ml-auto w-auto py-1.5" value={a.status} disabled={status.isPending} onChange={(e) => status.mutate(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>Set {statusLabel(s)}</option>)}
            </select>
          </div>

          {a.adminNotes && <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700"><span className="text-xs font-medium text-slate-500">Notes to user: </span>{a.adminNotes}</p>}

          <section>
            <h4 className="mb-2 font-semibold text-slate-800">Excel sheets ({a.excelFiles.length})</h4>
            {a.excelFiles.length === 0 && <p className="text-slate-500">None</p>}
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {a.excelFiles.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">{e.relativePath}</span>
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className="link text-xs" onClick={() => setPreview({ kind: 'excel', id: e.id, name: e.fileName })}>Preview</button>
                    <a className="link text-xs" href={fileUrl(urls.admin.excel(e.id))}>Download</a>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 font-semibold text-slate-800">Image ranges ({a.totalImages} images)</h4>
            {a.imageRanges.length === 0 && <p className="text-slate-500">None</p>}
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {a.imageRanges.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate">{r.folderPath || '(root)'} · <strong>{rangeLabel(r)}</strong> <span className="text-slate-500">({r.count} of {r.folderImageCount})</span></span>
                  <button type="button" className="link shrink-0 text-xs" onClick={() => setBrowse({ folderId: r.folderId, from: r.startPosition, to: r.endPosition, title: `${r.folderPath || '(root)'} · images ${rangeLabel(r)}` })}>View images</button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 font-semibold text-slate-800">User submissions ({subTotal})</h4>
            {subTotal === 0 && <p className="text-slate-500">The user has not uploaded anything yet.</p>}
            <ul className="space-y-2">
              {subRows.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{formatDateTime(s.createdAt)} · {s.uploadedBy?.fullName} <Badge>{s.uploadedByRole === 'USER' ? 'User' : 'Admin'}</Badge></span>
                    {s.hasFile && (
                      <span className="flex gap-2">
                        <button type="button" className="link text-xs" onClick={() => setPreview({ kind: 'submission', id: s.id, name: s.originalName })}>Preview</button>
                        <a className="link text-xs" href={fileUrl(urls.admin.submission(s.id))}>Download</a>
                      </span>
                    )}
                  </div>
                  {s.hasFile && <p className="mt-1 text-slate-800">📄 {s.originalName} <span className="text-xs text-slate-500">({formatBytes(s.sizeBytes)})</span></p>}
                  {s.storagePath && <p className="font-mono text-[11px] text-slate-400">{s.storagePath}</p>}
                  {s.notes && <p className="mt-1 whitespace-pre-wrap text-slate-700">{s.notes}</p>}
                </li>
              ))}
            </ul>
            <Pagination page={subPage} pageSize={SUB_SIZE} total={subTotal} onChange={setSubPage} />
          </section>
        </div>
      )}

      <ExcelPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.name}
        queryKey={['preview', preview?.kind, preview?.id]}
        queryFn={() => (preview.kind === 'excel' ? adminApi.excelPreview(preview.id) : adminApi.submissionPreview(preview.id))}
        downloadPath={preview && (preview.kind === 'excel' ? urls.admin.excel(preview.id) : urls.admin.submission(preview.id))}
      />
      <FolderImagesModal target={browse} onClose={() => setBrowse(null)} />
    </Modal>
  );
}

/** Edit an assignment — loads the ZIP details the form needs */
export function EditAssignmentModal({ assignment, onClose }) {
  const uploadQ = useQuery({
    queryKey: ['upload', assignment?.zipUpload.id],
    queryFn: () => adminApi.upload(assignment.zipUpload.id),
    enabled: Boolean(assignment),
  });

  return (
    <Modal open={Boolean(assignment)} onClose={onClose} size="lg" title={assignment ? `Edit assignment #${assignment.id}` : ''}>
      {uploadQ.isLoading && <PageLoader />}
      {uploadQ.isError && <ErrorBox error={uploadQ.error} />}
      {uploadQ.data && (
        <>
          <p className="mb-4 text-xs text-slate-500">Changing the user resets the status to Pending.</p>
          <AssignmentForm upload={uploadQ.data} initial={assignment} onDone={onClose} onCancel={onClose} />
        </>
      )}
    </Modal>
  );
}

/**
 * Split one folder evenly between several users for a date.
 * Example: 20 images, 2 users -> 1–10 and 11–20. Creates one assignment per user.
 */
export function SplitFolderModal({ upload, folder, date, users, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [picked, setPicked] = useState([]);
  const [excelIds, setExcelIds] = useState([]);
  const [workDate, setWorkDate] = useState(date);
  const [userQ, setUserQ] = useState('');

  const free = folder ? freeRanges(folder.imageCount, takenOn(folder, workDate)) : [];
  const [gapIndex, setGapIndex] = useState(0);
  const gap = free[gapIndex] || free[0];
  const parts = gap && picked.length ? splitEvenly(gap.startPosition, gap.endPosition, picked.length) : [];

  const run = useMutation({
    mutationFn: async () => {
      const results = [];
      for (let i = 0; i < picked.length; i += 1) {
        if (!parts[i]) continue;
        // sequential so overlap checks see previous inserts
        // eslint-disable-next-line no-await-in-loop
        results.push(await adminApi.createAssignment({
          userId: picked[i],
          zipUploadId: upload.id,
          workDate,
          excelFileIds: excelIds,
          imageRanges: [{ imageFolderId: folder.id, ...parts[i] }],
        }));
      }
      return results;
    },
    onSuccess: (res) => {
      ['upload', 'uploads', 'assignments', 'dashboard'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(`Created ${res.length} assignments`);
      onClose();
    },
    onError: (e) => {
      ['upload', 'assignments'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.error(errorMessage(e));
    },
  });

  const toggle = (list, setList, id) => setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  return (
    <Modal open={Boolean(folder)} onClose={onClose} size="lg" title={folder ? `Split "${folder.relativePath || '(root)'}" between users` : ''}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!parts.filter(Boolean).length} loading={run.isPending} onClick={() => run.mutate()}>Create {parts.filter(Boolean).length} assignments</Button>
        </>
      )}
    >
      {folder && (
        <div className="space-y-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Working date</span>
              <input type="date" className="input" value={workDate} onChange={(e) => { setWorkDate(e.target.value); setGapIndex(0); }} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Images to split</span>
              <select className="input" value={gapIndex} onChange={(e) => setGapIndex(Number(e.target.value))} disabled={!free.length}>
                {free.length === 0 && <option>Nothing free on this date</option>}
                {free.map((g, i) => <option key={g.startPosition} value={i}>Images {rangeLabel(g)} ({g.endPosition - g.startPosition + 1})</option>)}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-1 font-medium text-slate-700">Users (in order) — {picked.length} selected</p>
            <input
              type="search"
              className="input mb-2"
              placeholder="Search by name, employee ID or email…"
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
            />
            <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
              {users.filter((u) => userMatches(u, userQ)).length === 0 && <p className="col-span-full px-2 py-1 text-slate-500">No matching users</p>}
              {users.filter((u) => userMatches(u, userQ)).map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                  <input type="checkbox" className="accent-brand-700" checked={picked.includes(u.id)} onChange={() => toggle(picked, setPicked, u.id)} />
                  <span className="truncate">{u.fullName} <span className="text-xs text-slate-500">({u.employeeId})</span></span>
                </label>
              ))}
            </div>
          </div>

          {upload.excelFiles.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-slate-700">Also give every user these Excel sheets (optional)</p>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {upload.excelFiles.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                    <input type="checkbox" className="accent-brand-700" checked={excelIds.includes(e.id)} onChange={() => toggle(excelIds, setExcelIds, e.id)} />
                    <span className="truncate">{e.relativePath}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {parts.length > 0 && (
            <div className="rounded-lg bg-brand-50 p-3">
              <p className="mb-1 font-medium text-brand-900">Preview</p>
              <ul className="space-y-0.5 text-brand-900">
                {picked.map((uid, i) => {
                  const u = users.find((x) => x.id === uid);
                  return <li key={uid}>{u?.fullName}: {parts[i] ? `images ${rangeLabel(parts[i])}` : <span className="text-amber-700">nothing left (more users than images)</span>}</li>;
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}