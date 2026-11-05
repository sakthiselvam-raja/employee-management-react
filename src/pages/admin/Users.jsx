import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/endpoints';
import { errorMessage } from '../../api/client';
import { useToast } from '../../components/Toast';
import {
  Badge, Button, Card, ConfirmModal, EmptyState, ErrorBox, Field, Modal, PageHeader, PageLoader,
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
            The account is created with the default password <strong>ism@123</strong>. The user can change it after logging in.
          </p>
        )}
        {save.isError && <div className="sm:col-span-2"><ErrorBox error={save.error} /></div>}
      </form>
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
  const [confirm, setConfirm] = useState(null); // { type, user }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const q = useQuery({ queryKey: ['users', debounced, status], queryFn: () => adminApi.users({ search: debounced, status }) });

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
        actions={<Button onClick={() => setEditing({})}>+ Add user</Button>}
      />

      <Card bodyClass="">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
          <input className="input sm:max-w-xs" placeholder="Search name, employee ID, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {q.isLoading && <PageLoader />}
        {q.isError && <div className="p-4"><ErrorBox error={q.error} /></div>}
        {q.data?.length === 0 && (
          <EmptyState icon="👥" title={debounced ? 'No users match your search' : 'No users yet'} description={debounced ? undefined : 'Add your first employee to start assigning work.'} />
        )}

        {q.data?.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="th">Employee ID</th><th className="th">Name</th><th className="th">Email</th>
                  <th className="th">Status</th><th className="th">Assignments</th><th className="th">Last login</th><th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.map((u) => (
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
                        <Button size="sm" variant="ghost" onClick={() => setConfirm({ type: 'reset', user: u })}>Reset password</Button>
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
      </Card>

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
