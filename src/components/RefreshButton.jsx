/** Round icon button that reloads the data on the page; the icon spins while loading. */
export default function RefreshButton({ onClick, loading, label = 'Refresh' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={label}
      aria-label={label}
      className="grid h-10 w-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-brand-700 disabled:cursor-wait"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}