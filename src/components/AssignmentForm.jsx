import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/endpoints';
import { useToast } from './Toast';
import { Button, ErrorBox, Field, cx } from './ui';
import { freeRanges, rangeLabel, todayISO } from '../utils/format';
import { RemoteUserSelect } from './UserPicker';
import FolderSelect from './FolderSelect';

let rowKey = 1;
const newRow = (r = {}) => ({ key: rowKey++, imageFolderId: r.imageFolderId ?? '', startPosition: r.startPosition ?? '', endPosition: r.endPosition ?? '' });

/** Ranges taken by OTHER assignments on the given date */
export function takenOn(folder, date, excludeAssignmentId) {
  return folder.ranges.filter((r) => r.workDate === date && r.assignmentId !== excludeAssignmentId);
}

/**
 * Create or edit an assignment.
 * upload: GET /admin/uploads/:id result; initial: serialized assignment (edit mode)
 * prefill: { imageFolderId, startPosition, endPosition } for quick-assign from a folder row
 */
export default function AssignmentForm({ upload, initial, defaultDate, prefill, onDone, onCancel }) {
  const qc = useQueryClient();
  const toast = useToast();
  const editing = Boolean(initial);

  const [userId, setUserId] = useState('');
  const [workDate, setWorkDate] = useState(defaultDate || todayISO());
  const [excelIds, setExcelIds] = useState(new Set());
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false); // show validation messages after the first submit

  useEffect(() => {
    if (initial) {
      setUserId(String(initial.user.id));
      setWorkDate(initial.workDate);
      setExcelIds(new Set(initial.excelFiles.map((e) => e.id)));
      const existing = initial.imageRanges.map((r) => newRow({ imageFolderId: r.folderId, startPosition: r.startPosition, endPosition: r.endPosition }));
      setRows(existing.length || !upload.imageFolders.length ? existing : [newRow()]);
      setNotes(initial.adminNotes || '');
    } else {
      setUserId('');
      setExcelIds(new Set());
      setRows(prefill ? [newRow(prefill)] : (upload.imageFolders.length ? [newRow()] : []));
      setNotes('');
      if (defaultDate) setWorkDate(defaultDate);
    }
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, prefill, defaultDate]);

  const folderMap = useMemo(() => new Map(upload.imageFolders.map((f) => [f.id, f])), [upload]);
  const addRange = () => setRows((rs) => [...rs, newRow()]);

  /** Validate every range row. A completely empty row is ignored (Excel-only assignments are allowed). */
  const validation = useMemo(() => {
    const rowErr = new Map();
    const valid = [];
    rows.forEach((r) => {
      const untouched = !r.imageFolderId && r.startPosition === '' && r.endPosition === '';
      if (untouched) return;
      const folder = folderMap.get(Number(r.imageFolderId));
      const start = Number(r.startPosition);
      const end = Number(r.endPosition);
      let msg = '';
      if (!folder) msg = 'Choose a folder.';
      else if (r.startPosition === '' || r.endPosition === '') msg = 'Enter both From and To image numbers.';
      else if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) msg = 'Image numbers must be whole numbers of 1 or more.';
      else if (start > end) msg = '“From” cannot be greater than “To”.';
      else if (end > folder.imageCount) msg = `This folder has only ${folder.imageCount} images.`;
      else {
        const clash = takenOn(folder, workDate, initial?.id).find((t) => start <= t.endPosition && t.startPosition <= end);
        if (clash) msg = `Images ${rangeLabel(clash)} are already assigned on this date.`;
        else if (valid.some((v) => v.folderId === folder.id && start <= v.end && v.start <= end)) msg = 'This range overlaps another range in this form.';
      }
      if (msg) rowErr.set(r.key, msg);
      else valid.push({ folderId: folder.id, start, end });
    });
    const formErr = !rowErr.size && !excelIds.size && !valid.length
      ? 'Select at least one Excel sheet, or enter an image range (folder, From and To).'
      : '';
    return { rowErr, formErr };
  }, [rows, excelIds, workDate, folderMap, initial]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        userId: Number(userId),
        zipUploadId: upload.id,
        workDate,
        excelFileIds: [...excelIds],
        imageRanges: rows.filter((r) => r.imageFolderId).map((r) => ({
          imageFolderId: Number(r.imageFolderId),
          startPosition: Number(r.startPosition),
          endPosition: Number(r.endPosition),
        })),
        adminNotes: notes,
      };
      return editing ? adminApi.updateAssignment(initial.id, body) : adminApi.createAssignment(body);
    },
    onSuccess: () => {
      ['upload', 'uploads', 'assignments', 'dashboard', 'assignment'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(editing ? 'Assignment updated' : 'Work assigned');
      if (!editing) {
        setUserId('');
        setExcelIds(new Set());
        setRows(upload.imageFolders.length ? [newRow()] : []);
        setNotes('');
        setSubmitted(false);
      }
      onDone?.();
    },
  });

  const toggleExcel = (id) => {
    const next = new Set(excelIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExcelIds(next);
  };

  const updateRow = (key, patch) => setRows((rs) => rs.map((r) => {
    if (r.key !== key) return r;
    const merged = { ...r, ...patch };
    // When a folder is chosen, suggest its first free range for this date
    if (patch.imageFolderId !== undefined && patch.imageFolderId) {
      const folder = folderMap.get(Number(patch.imageFolderId));
      const gap = folder && freeRanges(folder.imageCount, takenOn(folder, workDate, initial?.id))[0];
      merged.startPosition = gap ? gap.startPosition : 1;
      merged.endPosition = gap ? gap.endPosition : folder?.imageCount ?? '';
    }
    return merged;
  }));

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (validation.rowErr.size || validation.formErr) return;
        save.mutate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Assign to <span className="text-red-500">*</span></span>
          <RemoteUserSelect value={userId} onChange={setUserId} selectedUser={initial?.user} status="active" />
          <span className="mt-1 block text-xs text-slate-500">Search by name, employee ID or email — results are paged.</span>
        </div>
        <Field label="Working date" required>
          <input type="date" className="input" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Excel sheets <span className="font-normal text-slate-400">({excelIds.size} selected)</span></p>
        {upload.excelFiles.length === 0 ? (
          <p className="text-sm text-slate-500">This ZIP has no Excel files.</p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {upload.excelFiles.map((e) => {
              return (
                <label key={e.id} className={cx('flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50', excelIds.has(e.id) && 'bg-brand-50/60')}>
                  <input type="checkbox" className="mt-0.5 accent-brand-700" checked={excelIds.has(e.id)} onChange={() => toggleExcel(e.id)} />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate text-slate-800">{e.relativePath}</span>
                    {e.sheetNames.length > 0 && <span className="block truncate text-xs text-slate-500">Sheets: {e.sheetNames.join(', ')}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Image ranges</p>
          <Button size="sm" variant="secondary" onClick={addRange} disabled={!upload.imageFolders.length}>+ Add range</Button>
        </div>
        {rows.length === 0 && <p className="text-sm text-slate-500">{upload.imageFolders.length ? 'No image range added.' : 'This ZIP has no image folders.'}</p>}
        {rows.length > 0 && <p className="mb-2 text-xs text-slate-500">Leave the range empty to assign only Excel sheets.</p>}
        <div className="space-y-2">
          {rows.map((r) => {
            const folder = folderMap.get(Number(r.imageFolderId));
            const gaps = folder ? freeRanges(folder.imageCount, takenOn(folder, workDate, initial?.id)) : [];
            return (
              <div key={r.key} className="rounded-lg border border-slate-200 p-3">
                <div className="space-y-3">
                  <div>
                    <span className="mb-1 block text-sm font-medium text-slate-700">Folder</span>
                    <FolderSelect
                      folders={upload.imageFolders}
                      value={r.imageFolderId}
                      onChange={(v) => updateRow(r.key, { imageFolderId: v })}
                      freeCount={(f) => f.imageCount - takenOn(f, workDate, initial?.id).reduce((n, t) => n + t.endPosition - t.startPosition + 1, 0)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Field label="From" className="min-w-0 flex-1">
                      <input type="number" className="input" min={1} max={folder?.imageCount} value={r.startPosition} onChange={(e) => updateRow(r.key, { startPosition: e.target.value })} />
                    </Field>
                    <Field label="To" className="min-w-0 flex-1">
                      <input type="number" className="input" min={1} max={folder?.imageCount} value={r.endPosition} onChange={(e) => updateRow(r.key, { endPosition: e.target.value })} />
                    </Field>
                    <Button variant="subtleDanger" className="shrink-0" onClick={() => setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((x) => x.key !== r.key)))}>{rows.length === 1 ? 'Clear' : 'Remove'}</Button>
                  </div>
                </div>
                {submitted && validation.rowErr.get(r.key) && <p className="mt-2 text-xs font-medium text-red-600">{validation.rowErr.get(r.key)}</p>}
                {folder && (
                  <p className="mt-2 text-xs text-slate-500">
                    {gaps.length
                      ? <>Free on this date: {gaps.map((g) => (
                        <button key={g.startPosition} type="button" className="link mr-2" onClick={() => updateRow(r.key, { startPosition: g.startPosition, endPosition: g.endPosition })}>{rangeLabel(g)}</button>
                      ))}</>
                      : <span className="text-amber-700">All {folder.imageCount} images in this folder are already assigned on this date.</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Field label="Notes for the user" hint="Optional instructions shown on the user's task page.">
        <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </Field>

      {submitted && validation.formErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{validation.formErr}</p>}
      {save.isError && <ErrorBox error={save.error} />}

      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={save.isPending} disabled={!userId}>{editing ? 'Save changes' : 'Assign work'}</Button>
      </div>
    </form>
  );
}