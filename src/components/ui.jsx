import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ---------- Button ---------- */
const variants = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100',
  subtleDanger: 'text-red-600 hover:bg-red-50',
};
const sizes = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-4 py-2.5 text-sm' };

export function Button({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant], sizes[size], className,
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Same look as Button but a link (used for downloads) */
export function LinkButton({ variant = 'secondary', size = 'md', className, children, ...props }) {
  return (
    <a
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </a>
  );
}

/* ---------- Form ---------- */
export function Field({ label, error, hint, required, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

/* ---------- Feedback ---------- */
export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={cx('animate-spin text-current', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ error, children }) {
  const msg = children || error?.response?.data?.message || error?.message || 'Something went wrong';
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</div>;
}

export function EmptyState({ title, description, action, icon = '📂' }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 text-3xl" aria-hidden="true">{icon}</div>
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Badges ---------- */
const statusStyles = {
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  PROCESSING: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  COMPLETED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
};
const statusText = { PENDING: 'Pending', PROCESSING: 'Processing', COMPLETED: 'Completed' };
export const STATUS_OPTIONS = ['PENDING', 'PROCESSING', 'COMPLETED'];
export const statusLabel = (s) => statusText[s] || s;

export function StatusBadge({ status }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', statusStyles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {statusText[status] || status}
    </span>
  );
}

export function Badge({ children, tone = 'slate', className }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    brand: 'bg-brand-50 text-brand-800',
    red: 'bg-red-50 text-red-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
  };
  return <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;
}

/* ---------- Layout ---------- */
export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClass = 'p-5' }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
          {typeof title === 'string' ? <h2 className="font-semibold text-slate-900">{title}</h2> : title}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, tone = 'slate', sub }) {
  const tones = {
    slate: ['text-slate-900', 'border-l-slate-400'],
    amber: ['text-amber-700', 'border-l-amber-500'],
    sky: ['text-sky-700', 'border-l-sky-500'],
    green: ['text-emerald-700', 'border-l-emerald-500'],
    brand: ['text-brand-700', 'border-l-brand-600'],
  };
  const [text, accent] = tones[tone] || tones.slate;
  return (
    <div className={cx('card border-l-4 px-5 py-4', accent)}>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={cx('mt-1 text-2xl font-bold tabular-nums', text)}>{value ?? '—'}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md', closeOnOutsideClick = false, headerActions }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl', full: 'max-w-7xl' };
  const screen = size === 'screen'; // fills the whole browser window

  return createPortal(
    <div className={cx('fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40', screen ? 'p-0' : 'p-4 sm:p-8')} onMouseDown={(e) => closeOnOutsideClick && e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={cx('w-full bg-white shadow-xl', screen ? 'flex h-screen flex-col rounded-none' : cx('rounded-xl', widths[size]))}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="min-w-0 truncate text-base font-semibold text-slate-900">{title}</h3>
          <div className="flex shrink-0 items-center gap-1">
          {headerActions}
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
          </button>
          </div>
        </div>
        <div className={cx('px-5 py-4', screen && 'min-h-0 flex-1 overflow-auto')}>{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', danger, loading, children }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmText}</Button>
        </>
      )}
    >
      <p className="text-sm text-slate-600">{message}</p>
      {children}
    </Modal>
  );
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          className={cx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap',
            value === t.value ? 'border-brand-700 text-brand-800' : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
      <span>Page {page} of {pages} · {total} records</span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </div>
    </div>
  );
}