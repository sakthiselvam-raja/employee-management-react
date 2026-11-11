import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, urls } from '../../api/endpoints';
import { errorMessage, fileUrl } from '../../api/client';
import { useToast } from '../../components/Toast';
import {
  Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, LinkButton, PageHeader, PageLoader, Spinner, cx,
} from '../../components/ui';
import { formatBytes, formatDateTime } from '../../utils/format';

function UploadBox() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const limitsQ = useQuery({ queryKey: ['uploadLimits'], queryFn: adminApi.uploadLimits, staleTime: 30_000, refetchOnWindowFocus: true });
  const limits = limitsQ.data;

  // problem with the chosen file, found before anything is sent
  const fileProblem = (() => {
    if (!file || !limits) return null;
    if (file.size > limits.maxZipBytes) return `This ZIP is ${formatBytes(file.size)}. The server accepts up to ${formatBytes(limits.maxZipBytes)}.`;
    const need = file.size * limits.diskFactor;
    if (limits.freeDiskBytes !== null && limits.freeDiskBytes < need) return `Not enough free disk space on the server: about ${formatBytes(need)} needed, ${formatBytes(limits.freeDiskBytes)} free.`;
    return null;
  })();

  const upload = useMutation({
    mutationFn: () => adminApi.uploadZip(file, setProgress),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['uploads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      const s = res.summary;
      toast.success(`Extracted ${s.totalFiles} files: ${s.excelFiles} Excel, ${s.imageFolders} image folders, ${s.totalImages} images`);
      setFile(null);
      setProgress(0);
      navigate(`/admin/uploads/${res.upload.id}`);
    },
    onError: () => setProgress(0),
  });

  const pick = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.zip')) {
      toast.error('Please choose a .zip file');
      return;
    }
    upload.reset();
    setFile(f);
  };

  const extracting = upload.isPending && progress >= 100;

  return (
    <Card title="Upload a ZIP batch">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        onClick={() => !upload.isPending && input.current?.click()}
        className={cx(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-500 hover:bg-slate-50',
        )}
      >
        <input ref={input} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <div className="mb-2 text-3xl">🗜️</div>
        {file ? (
          <>
            <p className="font-medium text-slate-800">{file.name}</p>
            <p className="text-sm text-slate-500">{formatBytes(file.size)}</p>
          </>
        ) : (
          <>
            <p className="font-medium text-slate-700">Drop a ZIP file here, or click to choose</p>
            <p className="mt-1 text-sm text-slate-500">Folders, Excel sheets (.xlsx, .xls, .csv) and images are detected automatically.</p>
            {limits && (
              <p className="mt-1 text-xs text-slate-400">
                Maximum {formatBytes(limits.maxZipBytes)} per ZIP{limits.freeDiskBytes !== null && ` · ${formatBytes(limits.freeDiskBytes)} free on the server`}
              </p>
            )}
          </>
        )}
      </div>

      {upload.isPending && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span className="flex items-center gap-1.5">{extracting && <Spinner className="h-3.5 w-3.5" />}{extracting ? 'Extracting and indexing files on the server…' : 'Uploading…'}</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={cx('h-full rounded-full bg-brand-600 transition-all', extracting && 'animate-pulse')} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {upload.isPending && (
        <p className="mt-2 text-xs text-amber-700">Large ZIPs take a while. Keep this tab open until the upload and extraction finish.</p>
      )}
      {fileProblem && !upload.isPending && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fileProblem}</p>}
      {upload.isError && <div className="mt-4"><ErrorBox error={upload.error} /></div>}

      <div className="mt-4 flex justify-end gap-2">
        {file && !upload.isPending && <Button variant="secondary" onClick={() => setFile(null)}>Clear</Button>}
        <Button disabled={!file || Boolean(fileProblem)} loading={upload.isPending} onClick={() => upload.mutate()}>Upload & extract</Button>
      </div>
    </Card>
  );
}

export function DeleteUploadModal({ upload, onClose, onDeleted }) {
  const qc = useQueryClient();
  const toast = useToast();
  const unfinished = upload ? upload.assignmentSummary.total - upload.assignmentSummary.COMPLETED : 0;
  const del = useMutation({
    mutationFn: () => adminApi.deleteUpload(upload.id, unfinished > 0),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uploads'] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Upload and all its files were deleted');
      onClose();
      onDeleted?.();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <ConfirmModal
      open={Boolean(upload)}
      onClose={onClose}
      title="Delete upload"
      danger
      confirmText={unfinished ? 'Delete anyway' : 'Delete'}
      loading={del.isPending}
      onConfirm={() => del.mutate()}
      message={upload && `This removes "${upload.originalName}", its extracted files, its ${upload.assignmentSummary.total} assignment(s) and every file users submitted for them.`}
    >
      {unfinished > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          ⚠️ {unfinished} assignment(s) are not completed yet. Download the files first if you need them.
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">A record of this deletion stays in History → Activity log.</p>
    </ConfirmModal>
  );
}

export default function UploadsPage() {
  const q = useQuery({ queryKey: ['uploads'], queryFn: adminApi.uploads });
  const [toDelete, setToDelete] = useState(null);

  return (
    <>
      <PageHeader title="ZIP uploads" description="Upload batches of Excel sheets and image folders, then assign them to users." />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1"><UploadBox /></div>

        <Card title="Uploaded batches" className="xl:col-span-2" bodyClass="">
          {q.isLoading && <PageLoader />}
          {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
          {q.data?.length === 0 && <EmptyState title="No ZIP uploaded yet" description="Upload your first batch on the left." />}
          <ul className="divide-y divide-slate-100">
            {q.data?.map((u) => {
              const s = u.assignmentSummary;
              return (
                <li key={u.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <Link to={`/admin/uploads/${u.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-700">{u.originalName}</Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateTime(u.createdAt)} · by {u.uploadedBy.fullName} ({u.uploadedByRole === 'ADMIN' ? 'Admin' : 'User'}) · {formatBytes(u.sizeBytes)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone="brand">{u.excelCount} Excel</Badge>
                      <Badge tone="brand">{u.folderCount} image folders</Badge>
                      <Badge tone="brand">{u.imageCount} images</Badge>
                      {s.total === 0 ? <Badge>Not assigned</Badge> : s.allCompleted
                        ? <Badge tone="green">All {s.total} completed</Badge>
                        : <Badge tone="amber">{s.COMPLETED}/{s.total} completed</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link to={`/admin/uploads/${u.id}`} className="inline-flex items-center rounded-lg bg-brand-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-800">Open & assign</Link>
                    <LinkButton size="sm" href={fileUrl(urls.admin.uploadZip(u.id))}>Download</LinkButton>
                    <Button size="sm" variant="subtleDanger" onClick={() => setToDelete(u)}>Delete</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <DeleteUploadModal upload={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}