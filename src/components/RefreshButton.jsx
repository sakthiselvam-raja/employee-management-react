import LastUpdated from './LastUpdated';

/**
 * Round icon button that reloads the data on the page; the icon spins while loading.
 * updatedAt (ms timestamp, e.g. react-query's dataUpdatedAt): shows "Last updated 10:32:05 AM" (time of the last API call) beside the button.
 */
export default function RefreshButton({ onClick, loading, label = 'Refresh', updatedAt }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LastUpdated updatedAt={updatedAt} loading={loading} className="hidden text-xs text-slate-500 sm:inline" />
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
    </span>
  );
}