import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi, urls } from '../../api/endpoints';
import { errorMessage, fileUrl } from '../../api/client';
import { useToast } from '../../components/Toast';
import ImageGallery, { ImagePager, pageImages } from '../../components/ImageGallery';
import ExcelPreviewModal from '../../components/ExcelPreviewModal';
import SelectedFilePreview from '../../components/SelectedFilePreview';
import {
  Button, Card, ConfirmModal, ErrorBox, Field, LinkButton, Modal, PageHeader, PageLoader, StatusBadge,
} from '../../components/ui';
import { formatBytes, formatDateTime, formatWorkDate, rangeLabel } from '../../utils/format';

function RangeImagesModal({ assignmentId, range, onClose }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => { setPage(1); }, [range?.id]);
  const q = useQuery({
    queryKey: ['rangeImages', assignmentId, range?.id, page, pageSize],
    queryFn: () => userApi.rangeImages(assignmentId, range.id, page, pageSize),
    enabled: Boolean(range),
    placeholderData: keepPreviousData,
  });
  const { images, total } = pageImages(q.data, page, pageSize);
  return (
    <Modal open={Boolean(range)} onClose={onClose} size="full" title={range ? `${range.folderPath || '(root)'} · images ${rangeLabel(range)}` : ''}
      footer={range && <LinkButton variant="primary" href={fileUrl(urls.user.rangeZip(assignmentId, range.id))}>Download these {range.count} images (ZIP)</LinkButton>}
    >
      {q.isLoading && <PageLoader />}
      {q.isError && <ErrorBox error={q.error} />}
      {q.data && (
        <>
          <ImageGallery
            images={images}
            srcFor={(img) => urls.user.image(assignmentId, img.id)}
            downloadFor={(img) => urls.user.imageDownload(assignmentId, img.id)}
            page={page}
            pageSize={pageSize}
            total={total}
            onPage={setPage}
            loading={q.isFetching}
          />
          <ImagePager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </>
      )}
    </Modal>
  );
}

/**
 * One task = one submission.
 * No `submission` -> add form. With `submission` -> edit form (a new file is optional and replaces the old one).
 */
function SubmitWork({ assignment, submission, onDone, onCancel }) {
  const toast = useToast();
  const edit = Boolean(submission);
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState(submission?.notes || '');
  const [markCompleted, setMarkCompleted] = useState(false);
  const [progress, setProgress] = useState(0);

  const save = useMutation({
    mutationFn: () => (edit
      ? userApi.updateSubmission(submission.id, { file, notes, markCompleted }, setProgress)
      : userApi.submit(assignment.id, { file, notes, markCompleted }, setProgress)),
    onSuccess: () => {
      toast.success(edit ? 'Submission updated' : (markCompleted ? 'Submitted and marked as completed' : 'Submitted — the admin can now see it'));
      setFile(null);
      setProgress(0);
      if (fileInput.current) fileInput.current.value = '';
      onDone();
    },
    onError: () => setProgress(0),
  });

  const changed = edit ? Boolean(file) || notes.trim() !== (submission.notes || '').trim() || markCompleted : Boolean(file) || Boolean(notes.trim());
  const empty = !file && !notes.trim() && !(edit && submission.hasFile); // a submission needs a file or a note

  return (
    <Card title={edit ? 'Edit your submission' : 'Submit your work'}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field
          label={edit ? 'Replace Excel sheet (optional)' : 'Updated Excel sheet'}
          hint={edit && submission.hasFile ? `Current file: ${submission.originalName}. Choose a new file only if you want to replace it.` : '.xlsx, .xlsm, .xls or .csv'}
        >
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,.xlsm,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-100"
          />
        </Field>
        <SelectedFilePreview file={file} excelLoader={userApi.previewFile} />
        <Field label="Notes for the admin">
          <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you did, issues found, images skipped…" maxLength={5000} />
        </Field>
        {assignment.status !== 'COMPLETED' && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-brand-700" checked={markCompleted} onChange={(e) => setMarkCompleted(e.target.checked)} />
            Mark this task as completed
          </label>
        )}
        {save.isPending && file && (
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div>
        )}
        {save.isError && <ErrorBox error={save.error} />}
        <div className="flex justify-end gap-2">
          {edit && <Button type="button" variant="secondary" onClick={onCancel} disabled={save.isPending}>Cancel</Button>}
          <Button type="submit" loading={save.isPending} disabled={!changed || empty}>{edit ? 'Save changes' : 'Submit'}</Button>
        </div>
      </form>
    </Card>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [range, setRange] = useState(null);
  const [subPreview, setSubPreview] = useState(null);
  const [delSub, setDelSub] = useState(null);
  const [editingSub, setEditingSub] = useState(false);

  const q = useQuery({ queryKey: ['myAssignment', Number(id)], queryFn: () => userApi.assignment(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['myAssignment'] });
    qc.invalidateQueries({ queryKey: ['myAssignments'] });
  };

  const setStatus = useMutation({
    mutationFn: (status) => userApi.setStatus(id, status),
    onSuccess: (_r, status) => { refresh(); toast.success(status === 'COMPLETED' ? 'Marked as completed' : 'Marked as processing'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const deleteSub = useMutation({
    mutationFn: (sid) => userApi.deleteSubmission(sid),
    onSuccess: (r) => { refresh(); setDelSub(null); setEditingSub(false); toast.success(r?.reopened ? 'Submission deleted — the task is open again' : 'Submission deleted'); },
    onError: (e) => { setDelSub(null); toast.error(errorMessage(e)); },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorBox error={q.error} />;

  const { assignment: a, submissions } = q.data;
  const mine = submissions[0]; // newest — a task has a single submission

  return (
    <>
      <PageHeader
        back={<Link to="/emp-portal/tasks" className="mb-1 inline-block text-sm text-slate-500 hover:text-slate-700">← My tasks</Link>}
        title={a.zipUpload.originalName}
        description={`Working date ${formatWorkDate(a.workDate)} · assigned by ${a.assignedBy?.fullName} on ${formatDateTime(a.createdAt)}`}
        actions={(
          <>
            <StatusBadge status={a.status} />
            {a.status !== 'PROCESSING' && (
              <Button variant="secondary" loading={setStatus.isPending && setStatus.variables === 'PROCESSING'} onClick={() => setStatus.mutate('PROCESSING')}>
                {a.status === 'COMPLETED' ? 'Reopen (processing)' : 'Start processing'}
              </Button>
            )}
            {a.status !== 'COMPLETED' && (
              <Button loading={setStatus.isPending && setStatus.variables === 'COMPLETED'} onClick={() => setStatus.mutate('COMPLETED')}>Mark completed</Button>
            )}
          </>
        )}
      />

      {a.adminNotes && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="mb-0.5 text-xs font-semibold uppercase">Instructions from admin</p>
          <p className="whitespace-pre-wrap">{a.adminNotes}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title={`Excel sheets (${a.excelFiles.length})`} bodyClass="" actions={<a className="link text-sm" href={fileUrl(urls.user.assignmentZip(a.id))}>Download everything (ZIP)</a>}>
            {a.excelFiles.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">No Excel sheets assigned.</p>}
            <ul className="divide-y divide-slate-100">
              {a.excelFiles.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">📊 {e.fileName}</p>
                    <p className="truncate text-xs text-slate-500">{e.relativePath} · {formatBytes(e.sizeBytes)}{e.sheetNames.length > 0 && ` · ${e.sheetNames.join(', ')}`}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setPreview(e)}>View</Button>
                    <LinkButton size="sm" href={fileUrl(urls.user.excel(a.id, e.id))}>Download</LinkButton>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={`Images (${a.totalImages})`} bodyClass="">
            {a.imageRanges.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">No images assigned.</p>}
            <ul className="divide-y divide-slate-100">
              {a.imageRanges.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">📁 {r.folderPath || '(root)'}</p>
                    <p className="text-xs text-slate-500">Images {rangeLabel(r)} · {r.count} image(s) of {r.folderImageCount} in folder</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setRange(r)}>View images</Button>
                    <LinkButton size="sm" href={fileUrl(urls.user.rangeZip(a.id, r.id))}>Download ZIP</LinkButton>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* one task = one submission: add it once, then edit or delete it */}
          {!mine && <SubmitWork assignment={a} onDone={refresh} />}
          {mine && editingSub && (
            <SubmitWork assignment={a} submission={mine} onDone={() => { refresh(); setEditingSub(false); }} onCancel={() => setEditingSub(false)} />
          )}
          {mine && !editingSub && (
            <Card
              title="Your submission"
              actions={(
                <span className="flex items-center gap-3">
                  <button type="button" className="link text-sm" onClick={() => setEditingSub(true)}>Edit</button>
                  <button type="button" className="text-sm font-medium text-red-600 hover:underline" onClick={() => setDelSub(mine)}>Delete</button>
                </span>
              )}
              bodyClass="px-5 py-4 text-sm"
            >
              <p className="text-xs text-slate-500">Submitted {formatDateTime(mine.createdAt)}</p>
              {mine.hasFile && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-slate-800">📄 {mine.originalName} <span className="text-xs text-slate-500">({formatBytes(mine.sizeBytes)})</span></p>
                  <span className="flex items-center gap-3">
                    <button type="button" className="link text-xs" onClick={() => setSubPreview(mine)}>Preview</button>
                    <a className="link text-xs" href={fileUrl(urls.user.submission(mine.id))}>Download</a>
                  </span>
                </div>
              )}
              {mine.notes && <p className="mt-2 whitespace-pre-wrap text-slate-600">{mine.notes}</p>}
              {!mine.hasFile && !mine.notes && <p className="text-slate-500">Empty submission.</p>}
            </Card>
          )}

          <Card title="Timeline" bodyClass="px-5 py-4 text-sm space-y-1.5">
            <p><span className="text-slate-500">Assigned:</span> {formatDateTime(a.createdAt)}</p>
            <p><span className="text-slate-500">Started:</span> {formatDateTime(a.startedAt)}</p>
            <p><span className="text-slate-500">Completed:</span> {formatDateTime(a.completedAt)}</p>
          </Card>
        </div>
      </div>

      <ExcelPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.fileName}
        queryKey={['myPreview', a.id, preview?.id]}
        queryFn={() => userApi.excelPreview(a.id, preview.id)}
        downloadPath={preview && urls.user.excel(a.id, preview.id)}
      />
      <ExcelPreviewModal
        open={Boolean(subPreview)}
        onClose={() => setSubPreview(null)}
        title={subPreview?.originalName}
        queryKey={['mySubmissionPreview', subPreview?.id]}
        queryFn={() => userApi.submissionPreview(subPreview.id)}
        downloadPath={subPreview && urls.user.submission(subPreview.id)}
      />
      <ConfirmModal
        open={Boolean(delSub)}
        onClose={() => setDelSub(null)}
        onConfirm={() => deleteSub.mutate(delSub.id)}
        loading={deleteSub.isPending}
        danger
        title="Delete this submission?"
        confirmText="Delete"
        message={delSub?.hasFile ? `“${delSub.originalName}” and its notes will be permanently removed. This cannot be undone.` : 'This note will be permanently removed. This cannot be undone.'}
      />
      <RangeImagesModal assignmentId={a.id} range={range} onClose={() => setRange(null)} />
    </>
  );
}