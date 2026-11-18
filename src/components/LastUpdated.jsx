import { useRef } from 'react';

/**
 * "Last updated 10:32:05 AM" — the time of the last API call that returned data
 * (react-query's dataUpdatedAt changes on EVERY successful call: first load, Refresh button, reload after a change).
 * Switching browser tabs makes no API call, so the time stays the same until the next call.
 */
export default function LastUpdated({ updatedAt, loading = false, className }) {
  const last = useRef(0); // keep the previous time while a new call is running (updatedAt is 0 for a brand-new query)
  if (updatedAt) last.current = updatedAt;
  if (!last.current) return null;

  return (
    <span className={className} aria-live="polite">
      {loading ? 'Updating…' : `Last updated ${new Date(last.current).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
    </span>
  );
}