import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/endpoints';
import { useToast } from '../../components/Toast';
import { Button, ErrorBox, Field, Modal } from '../../components/ui';

/** Header button + modal so users can replace the default password (ism@123). */
export default function ChangePasswordButton() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [localError, setLocalError] = useState('');

  const change = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => {
      toast.success('Password changed');
      setOpen(false);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setLocalError('New passwords do not match');
      return;
    }
    setLocalError('');
    change.mutate();
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hidden rounded-lg px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100 sm:block">
        Change password
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change password"
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="pw-form" loading={change.isPending}>Update password</Button>
          </>
        )}
      >
        <form id="pw-form" className="space-y-3" onSubmit={submit}>
          <Field label="Current password"><input type="password" className="input" value={form.currentPassword} onChange={set('currentPassword')} required autoComplete="current-password" /></Field>
          <Field label="New password" hint="At least 6 characters"><input type="password" className="input" value={form.newPassword} onChange={set('newPassword')} required minLength={6} autoComplete="new-password" /></Field>
          <Field label="Confirm new password"><input type="password" className="input" value={form.confirm} onChange={set('confirm')} required autoComplete="new-password" /></Field>
          {localError && <ErrorBox>{localError}</ErrorBox>}
          {change.isError && <ErrorBox error={change.error} />}
        </form>
      </Modal>
    </>
  );
}
