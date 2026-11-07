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
          />
          <ImagePager page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
        </>
      )}
    </Modal>
  );
}

function SubmitWork({ assignment, onSubmitted }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(false);
  const [progress, setProgress] = useState(0);

  const submit = useMutation({
    mutationFn: () => userApi.submit(assignment.id, { file, notes, markCompleted }, setProgress),
    onSuccess: () => {
      toast.success(markCompleted ? 'Submitted and marked as completed' : 'Submitted — the admin can now see it');
      setFile(null);
      setNotes('');
      setMarkCompleted(false);
      setProgress(0);
      if (fileInput.current) fileInput.current.value = '';
      onSubmitted();
    },
    onError: () => setProgress(0),
  });

  return (
    <Card title="Submit your work">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}>
        <Field label="Updated Excel sheet" hint=".xlsx, .xlsm, .xls or .csv">
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
        {submit.isPending && file && (
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div>
        )}
        {submit.isError && <ErrorBox error={submit.error} />}
        <div className="flex justify-end">
          <Button type="submit" loading={submit.isPending} disabled={!file && !notes.trim()}>Submit</Button>
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
    onSuccess: () => { refresh(); setDelSub(null); toast.success('Submission deleted'); },
    onError: (e) => { setDelSub(null); toast.error(errorMessage(e)); },
  });

  if (q.isLoading) return <PageLoader />;
  if (q.isError) return <ErrorBox error={q.error} />;

  const { assignment: a, submissions } = q.data;

  return (
    <>
      <PageHeader
        back={<Link to="/tasks" className="mb-1 inline-block text-sm text-slate-500 hover:text-slate-700">← My tasks</Link>}
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
          <SubmitWork assignment={a} onSubmitted={refresh} />

          <Card title={`Your submissions (${submissions.length})`} bodyClass="">
            {submissions.length === 0 && <p className="px-5 py-6 text-sm text-slate-500">Nothing submitted yet.</p>}
            <ul className="divide-y divide-slate-100">
              {submissions.map((s) => (
                <li key={s.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{formatDateTime(s.createdAt)}</span>
                    <span className="flex items-center gap-3">
                      {s.hasFile && <button type="button" className="link text-xs" onClick={() => setSubPreview(s)}>Preview</button>}
                      {s.hasFile && <a className="link text-xs" href={fileUrl(urls.user.submission(s.id))}>Download</a>}
                      <button type="button" className="text-xs font-medium text-red-600 hover:underline" onClick={() => setDelSub(s)}>Delete</button>
                    </span>
                  </div>
                  {s.hasFile && <p className="mt-0.5 truncate text-slate-800">📄 {s.originalName} <span className="text-xs text-slate-500">({formatBytes(s.sizeBytes)})</span></p>}
                  {s.notes && <p className="mt-1 whitespace-pre-wrap text-slate-600">{s.notes}</p>}
                </li>
              ))}
            </ul>
          </Card>

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