import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/endpoints';
import { useToast } from './Toast';
import { Button, ErrorBox, Field, cx } from './ui';
import { folderLabel, freeRanges, rangeLabel, todayISO } from '../utils/format';

let rowKey = 1;
const newRow = (r = {}) => ({ key: rowKey++, imageFolderId: r.imageFolderId ?? '', startPosition: r.startPosition ?? '', endPosition: r.endPosition ?? '' });

/** Ranges taken by OTHER assignments on the given date */
export function takenOn(folder, date, excludeAssignmentId) {
  return folder.ranges.filter((r) => r.workDate === date && r.assignmentId !== excludeAssignmentId);
}

/**
 * Create or edit an assignment.
 * upload: GET /admin/uploads/:id result; users: active users; initial: serialized assignment (edit mode)
 * prefill: { imageFolderId, startPosition, endPosition } for quick-assign from a folder row
 */
export default function AssignmentForm({ upload, users, initial, defaultDate, prefill, onDone, onCancel }) {
  const qc = useQueryClient();
  const toast = useToast();
  const editing = Boolean(initial);

  const [userId, setUserId] = useState('');
  const [workDate, setWorkDate] = useState(defaultDate || todayISO());
  const [excelIds, setExcelIds] = useState(new Set());
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (initial) {
      setUserId(String(initial.user.id));
      setWorkDate(initial.workDate);
      setExcelIds(new Set(initial.excelFiles.map((e) => e.id)));
      setRows(initial.imageRanges.map((r) => newRow({ imageFolderId: r.folderId, startPosition: r.startPosition, endPosition: r.endPosition })));
      setNotes(initial.adminNotes || '');
    } else {
      setUserId('');
      setExcelIds(new Set());
      setRows(prefill ? [newRow(prefill)] : []);
      setNotes('');
      if (defaultDate) setWorkDate(defaultDate);
    }
  }, [initial, prefill, defaultDate]);

  const folderMap = useMemo(() => new Map(upload.imageFolders.map((f) => [f.id, f])), [upload]);

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
        setRows([]);
        setNotes('');
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

  const selectedUser = users.find((u) => String(u.id) === String(userId));
  const userList = selectedUser || !initial ? users : [initial.user, ...users];

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assign to" required>
          <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Select a user…</option>
            {userList.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.employeeId})</option>)}
          </select>
        </Field>
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
              const others = e.assignedTo.filter((a) => a.workDate === workDate && a.assignmentId !== initial?.id);
              return (
                <label key={e.id} className={cx('flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50', excelIds.has(e.id) && 'bg-brand-50/60')}>
                  <input type="checkbox" className="mt-0.5 accent-brand-700" checked={excelIds.has(e.id)} onChange={() => toggleExcel(e.id)} />
                  <span className="min-w-0 text-sm">
                    <span className="block truncate text-slate-800">{e.relativePath}</span>
                    {e.sheetNames.length > 0 && <span className="block truncate text-xs text-slate-500">Sheets: {e.sheetNames.join(', ')}</span>}
                    {others.length > 0 && <span className="block text-xs text-amber-700">Also with: {others.map((a) => a.userName).join(', ')}</span>}
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
          <Button size="sm" variant="secondary" onClick={() => setRows((rs) => [...rs, newRow()])} disabled={!upload.imageFolders.length}>+ Add range</Button>
        </div>
        {rows.length === 0 && <p className="text-sm text-slate-500">{upload.imageFolders.length ? 'No image range added.' : 'This ZIP has no image folders.'}</p>}
        <div className="space-y-2">
          {rows.map((r) => {
            const folder = folderMap.get(Number(r.imageFolderId));
            const gaps = folder ? freeRanges(folder.imageCount, takenOn(folder, workDate, initial?.id)) : [];
            return (
              <div key={r.key} className="rounded-lg border border-slate-200 p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end">
                  <Field label="Folder">
                    <select className="input" value={r.imageFolderId} onChange={(e) => updateRow(r.key, { imageFolderId: e.target.value })} required>
                      <option value="">Choose folder…</option>
                      {upload.imageFolders.map((f) => <option key={f.id} value={f.id}>{folderLabel(f)} ({f.imageCount} images)</option>)}
                    </select>
                  </Field>
                  <Field label="From">
                    <input type="number" className="input" min={1} max={folder?.imageCount} value={r.startPosition} onChange={(e) => updateRow(r.key, { startPosition: e.target.value })} required />
                  </Field>
                  <Field label="To">
                    <input type="number" className="input" min={1} max={folder?.imageCount} value={r.endPosition} onChange={(e) => updateRow(r.key, { endPosition: e.target.value })} required />
                  </Field>
                  <Button variant="subtleDanger" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>Remove</Button>
                </div>
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

      {save.isError && <ErrorBox error={save.error} />}

      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Assign work'}</Button>
      </div>
    </form>
  );
}
