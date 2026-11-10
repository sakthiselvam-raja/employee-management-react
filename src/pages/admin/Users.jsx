import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints';
import { errorMessage, fileUrl } from '../../api/client';
import SelectedFilePreview from '../../components/SelectedFilePreview';
import { useToast } from '../../components/Toast';
import {
  Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, Field, LinkButton, Modal, PageHeader, PageLoader, Pagination,
} from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const empty = { employeeId: '', firstName: '', middleName: '', lastName: '', email: '' };

function UserFormModal({ open, onClose, user }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(empty);
  const editing = Boolean(user);

  useEffect(() => {
    if (open) setForm(user ? { ...empty, ...user, middleName: user.middleName || '' } : empty);
  }, [open, user]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        employeeId: form.employeeId, firstName: form.firstName, middleName: form.middleName,
        lastName: form.lastName, email: form.email,
      };
      return editing ? adminApi.updateUser(user.id, body) : adminApi.createUser(body);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(editing ? 'User updated' : `User created — default password: ${res.defaultPassword}`);
      onClose();
    },
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit user' : 'Add user'}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-form" loading={save.isPending}>{editing ? 'Save changes' : 'Create user'}</Button>
        </>
      )}
    >
      <form id="user-form" className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Employee ID" required className="sm:col-span-2">
          <input className="input" value={form.employeeId} onChange={set('employeeId')} required placeholder="EMP001" />
        </Field>
        <Field label="First name" required><input className="input" value={form.firstName} onChange={set('firstName')} required /></Field>
        <Field label="Middle name"><input className="input" value={form.middleName} onChange={set('middleName')} /></Field>
        <Field label="Last name" required><input className="input" value={form.lastName} onChange={set('lastName')} required /></Field>
        <Field label="Email ID" required><input className="input" type="email" value={form.email} onChange={set('email')} required /></Field>
        {!editing && (
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-900 sm:col-span-2">
            The account is created with the default password <strong>ism@123</strong>.
          </p>
        )}
        {save.isError && <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>}
      </form>
    </Modal>
  );
}

const CSV_HEADER_ALIASES = {
  employeeid: 'employeeId', empid: 'employeeId', employeecode: 'employeeId', employeeno: 'employeeId',
  firstname: 'firstName', middlename: 'middleName', lastname: 'lastName', surname: 'lastName',
  email: 'email', emailid: 'email', emailaddress: 'email',
};

/** Tells the admin right after choosing the file whether the header row has the required columns. */
function checkCsvHeader(cells) {
  const found = new Set(cells.map((h) => CSV_HEADER_ALIASES[h.toLowerCase().replace(/[^a-z0-9]/g, '')]).filter(Boolean));
  const missing = ['employeeId', 'firstName', 'lastName', 'email'].filter((k) => !found.has(k));
  return missing.length
    ? { ok: false, message: `Missing column(s) in the first row: ${missing.join(', ')}` }
    : { ok: true, message: '✓ Header row looks good — the required columns were found.' };
}

function BulkUploadModal({ open, onClose }) {
  const qc = useQueryClient();
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);

  const upload = useMutation({
    mutationFn: () => adminApi.bulkCreateUsers(file, setProgress),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      if (res.createdCount) toast.success(`${res.createdCount} user(s) created — default password: ${res.defaultPassword}`);
    },
  });

  useEffect(() => {
    if (open) { setFile(null); setProgress(0); upload.reset(); if (inputRef.current) inputRef.current.value = ''; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const result = upload.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Bulk upload users (CSV)"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
          {!result && <Button onClick={() => upload.mutate()} disabled={!file} loading={upload.isPending}>Upload &amp; create users</Button>}
        </>
      )}
    >
      {!result && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <span>Columns: <strong>employeeId, firstName, middleName, lastName, email</strong> (middleName is optional).</span>
            <LinkButton size="sm" href={fileUrl('/admin/users/csv-template')} download>⬇ Download sample CSV</LinkButton>
          </div>

          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
              onChange={(e) => { setFile(e.target.files?.[0] || null); upload.reset(); }}
            />
            <div className="mt-3"><SelectedFilePreview file={file} headerCheck={checkCsvHeader} inline /></div>
            <p className="mt-2 text-xs text-slate-500">
              Every new account gets the default password <strong>ism@123</strong>. Rows with an existing Employee ID or email are skipped. Up to 2000 users per file.
            </p>
          </div>

          {upload.isPending && (
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {upload.isError && <ErrorBox error={upload.error} />}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-semibold text-slate-800">{result.total}</div><div className="text-xs text-slate-500">Rows in file</div></div>
            <div className="rounded-lg bg-emerald-50 p-3"><div className="text-2xl font-semibold text-emerald-700">{result.createdCount}</div><div className="text-xs text-emerald-700">Created</div></div>
            <div className="rounded-lg bg-red-50 p-3"><div className="text-2xl font-semibold text-red-700">{result.failedCount}</div><div className="text-xs text-red-700">Skipped / failed</div></div>
          </div>

          {result.createdCount > 0 && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {result.createdCount} user(s) created. Default password: <strong>{result.defaultPassword}</strong>
            </p>
          )}

          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50"><tr><th className="th">CSV row</th><th className="th">Employee ID</th><th className="th">Email</th><th className="th">Reason</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {result.errors.map((e, i) => (
                    <tr key={`${e.row}-${i}`}>
                      <td className="td tabular-nums">{e.row}</td>
                      <td className="td font-mono text-xs">{e.employeeId || '—'}</td>
                      <td className="td">{e.email || '—'}</td>
                      <td className="td text-red-700">{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('all');
  const [editing, setEditing] = useState(null); // null closed, {} new, user edit
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // { type, user }
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({
    queryKey: ['users', 'list', debounced, status, page],
    queryFn: () => adminApi.usersPage({ search: debounced || undefined, status, page, limit: PAGE_SIZE, sort: 'recent' }),
    placeholderData: keepPreviousData,
  });
  const rows = q.data?.users;

  // after deleting the last user on a page, step back
  useEffect(() => {
    if (q.data && page > q.data.pages) setPage(q.data.pages);
  }, [q.data, page]);

  const action = useMutation({
    mutationFn: ({ type, user }) => {
      if (type === 'reset') return adminApi.resetPassword(user.id);
      if (type === 'toggle') return adminApi.setUserStatus(user.id, !user.isActive);
      return adminApi.deleteUser(user.id);
    },
    onSuccess: (_res, { type, user }) => {
      qc.invalidateQueries({ queryKey: ['users'] });
      const msg = {
        reset: `Password for ${user.fullName} reset to ism@123`,
        toggle: `${user.fullName} ${user.isActive ? 'deactivated' : 'activated'}`,
        delete: `${user.fullName} deleted`,
      };
      toast.success(msg[type]);
      setConfirm(null);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const confirmText = confirm && {
    reset: { title: 'Reset password', message: `Reset ${confirm.user.fullName}'s password to the default (ism@123)?`, btn: 'Reset password' },
    toggle: confirm.user.isActive
      ? { title: 'Deactivate user', message: `${confirm.user.fullName} will not be able to log in. Their history is kept.`, btn: 'Deactivate', danger: true }
      : { title: 'Activate user', message: `Allow ${confirm.user.fullName} to log in again?`, btn: 'Activate' },
    delete: { title: 'Delete user', message: `Permanently delete ${confirm.user.fullName}? This cannot be undone.`, btn: 'Delete', danger: true },
  }[confirm.type];

  return (
    <>
      <PageHeader
        title="Users"
        description="Create employee accounts and manage access."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setBulkOpen(true)}>⬆ Bulk upload (CSV)</Button>
            <Button onClick={() => setEditing({})}>+ Add user</Button>
          </div>
        )}
      />

      <Card bodyClass="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <input className="input sm:max-w-xs" placeholder="Search name, employee ID, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input sm:w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {q.isLoading && <PageLoader />}
        {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
        {rows?.length === 0 && (
          <EmptyState icon="👥" title={debounced ? 'No users match your search' : 'No users yet'} description={debounced ? undefined : 'Add your first employee to start assigning work.'} />
        )}

        {rows?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="th">Employee ID</th><th className="th">Name</th><th className="th">Email</th>
                  <th className="th">Status</th><th className="th">Assignments</th><th className="th">Last login</th><th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'bg-slate-50/70 text-slate-500'}>
                    <td className="td font-mono text-xs">{u.employeeId}</td>
                    <td className="td font-medium text-slate-800">{u.fullName}</td>
                    <td className="td">{u.email}</td>
                    <td className="td">{u.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
                    <td className="td tabular-nums">{u.assignmentCount}</td>
                    <td className="td text-xs">{formatDateTime(u.lastLoginAt)}</td>
                    <td className="td">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>Edit</Button>
                        {/* Reset password hidden (frontend only) */}
                        <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: 'toggle', user: u })}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>
                        {u.assignmentCount === 0 && (
                          <Button size="sm" variant="subtleDanger" onClick={() => setConfirm({ type: 'delete', user: u })}>Delete</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && <Pagination page={page} pageSize={q.data.limit} total={q.data.total} onChange={setPage} />}
      </Card>

      <BulkUploadModal open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <UserFormModal open={editing !== null} user={editing?.id ? editing : null} onClose={() => setEditing(null)} />

      <ConfirmModal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirmText?.title}
        message={confirmText?.message}
        confirmText={confirmText?.btn}
        danger={confirmText?.danger}
        loading={action.isPending}
        onConfirm={() => action.mutate(confirm)}
      />
    </>
  );
}