import { useEffect, useState } from 'react';
import { formatBytes } from '../utils/format';
import { Button, Modal, Pagination, Tabs } from './ui';

const MAX_SERVER_PREVIEW_BYTES = 20 * 1024 * 1024; // same limit as the server
const PREVIEW_ROWS = 8;
const MAX_CSV_BYTES = 10 * 1024 * 1024; // CSV is read in the browser up to this size
const PAGE_SIZES = [25, 50, 100];

/** Small RFC-4180 CSV reader (quotes, CRLF, BOM, comma / semicolon / tab). */
export function parseCsvText(input) {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const first = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => first.split(ch).length - 1;
  const delim = count(';') > count(',') ? ';' : (count('\t') > count(',') ? '\t' : ',');
  const rows = [];
  let cells = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += c;
    } else if (c === '"' && field === '') inQuotes = true;
    else if (c === delim) { cells.push(field); field = ''; }
    else if (c === '\n') { cells.push(field); rows.push(cells); cells = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || cells.length) { cells.push(field); rows.push(cells); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const extOf = (name) => (name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '');

/**
 * Shows what the person just picked in a file input: name, size and the first rows.
 *  - .csv  -> read in the browser
 *  - .xlsx / .xlsm -> excelLoader(file) (server preview), skipped when no loader is given
 * headerCheck(headerCells) -> { ok, message } optionally validates the first row (CSV).
 */
export default function SelectedFilePreview({ file, excelLoader, headerCheck, inline = false }) {
  const [state, setState] = useState({ status: 'idle' });
  const [sheet, setSheet] = useState(0);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const want = inline || open; // the file is only read when it is actually needed

  useEffect(() => { setOpen(false); setPage(1); }, [file]);

  useEffect(() => {
    let cancelled = false;
    setSheet(0);
    if (!file) { setState({ status: 'idle' }); return undefined; }
    if (!want) { setState({ status: 'idle' }); return undefined; }
    const ext = extOf(file.name);

    const run = async () => {
      try {
        if (ext === '.csv') {
          const text = await file.slice(0, MAX_CSV_BYTES).text();
          const rows = parseCsvText(text);
          const partial = file.size > MAX_CSV_BYTES;
          if (!cancelled) setState({ status: 'ready', sheets: [{ name: 'CSV', rows, totalRows: rows.length, truncated: partial, partial }] });
        } else if (ext === '.xls') {
          if (!cancelled) setState({ status: 'note', message: 'Preview is not available for old .xls files, but the file can still be submitted.' });
        } else if (!excelLoader) {
          if (!cancelled) setState({ status: 'note', message: 'Preview is not available for this file type.' });
        } else if (file.size > MAX_SERVER_PREVIEW_BYTES) {
          if (!cancelled) setState({ status: 'note', message: 'File is too large to preview, but it can still be submitted.' });
        } else {
          setState({ status: 'loading' });
          const res = await excelLoader(file);
          if (cancelled) return;
          if (res.unsupported) setState({ status: 'note', message: res.unsupported });
          else setState({ status: 'ready', sheets: res.sheets || [] });
        }
      } catch {
        if (!cancelled) setState({ status: 'note', message: 'Could not read this file for preview.' });
      }
    };
    run();
    return () => { cancelled = true; };
  }, [file, excelLoader, want]);

  if (!file) return null;
  const current = state.sheets?.[sheet];
  const header = current?.rows?.[0];
  const check = header && headerCheck ? headerCheck(header) : null;

  // ---- modal pagination (data rows only; row 1 stays as the table header) ----
  const dataRows = current ? current.rows.slice(1) : [];
  const pages = Math.max(1, Math.ceil(dataRows.length / pageSize));
  const safePage = Math.min(page, pages);
  const pageRows = dataRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstRowNo = (safePage - 1) * pageSize + 2; // sheet row number of the first row on this page

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-medium text-slate-800">📄 {file.name} <span className="text-xs font-normal text-slate-500">({formatBytes(file.size)})</span></p>
        <Button size="sm" variant="secondary" onClick={() => { setOpen(true); setPage(1); }}>👁 View</Button>
      </div>

      {inline && state.status === 'loading' && <p className="mt-2 text-xs text-slate-500">Reading file…</p>}
      {inline && state.status === 'note' && <p className="mt-2 text-xs text-slate-500">{state.message}</p>}
      {inline && check && (
        <p className={`mt-2 rounded-md px-2 py-1 text-xs ${check.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{check.message}</p>
      )}
      {inline && state.status === 'ready' && current && current.rows.length > 0 && (
        <div className="mt-2 max-h-48 overflow-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-xs">
            <tbody>
              {current.rows.slice(0, PREVIEW_ROWS + 1).map((row, r) => (
                <tr key={r} className={r === 0 ? 'bg-slate-100 font-semibold' : 'odd:bg-white even:bg-slate-50'}>
                  {row.map((cell, c) => (
                    <td key={c} className="max-w-[12rem] truncate border-r border-slate-100 px-2 py-1 whitespace-nowrap" title={cell}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={file.name}
        size="full"
        footer={<Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>}
      >
        {state.status === 'loading' && <p className="py-10 text-center text-sm text-slate-500">Reading file…</p>}
        {state.status === 'note' && <p className="py-10 text-center text-sm text-slate-500">{state.message}</p>}

        {state.status === 'ready' && (
          <>
            {state.sheets.length > 1 && (
              <Tabs value={sheet} onChange={(v) => { setSheet(v); setPage(1); }} tabs={state.sheets.map((s, i) => ({ value: i, label: s.name }))} />
            )}
            {check && (
              <p className={`mb-3 rounded-md px-3 py-2 text-sm ${check.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{check.message}</p>
            )}
            {current && current.rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">This sheet is empty.</p>}
            {current && current.rows.length > 0 && (
              <>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {current.rows.length - 1} data row(s){current.truncated && ' (preview limit reached — the file contains more rows)'}
                  </span>
                  <label className="flex items-center gap-1.5">
                    Rows per page
                    <select className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 bg-slate-100 font-semibold">
                      <tr>
                        <td className="border-r border-slate-200 px-2 py-1 text-right text-slate-400">1</td>
                        {current.rows[0].map((cell, c) => (
                          <td key={c} className="max-w-[18rem] truncate border-r border-slate-200 px-2 py-1 whitespace-nowrap" title={cell}>{cell}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, r) => (
                        <tr key={r} className="odd:bg-white even:bg-slate-50">
                          <td className="border-r border-slate-200 px-2 py-1 text-right text-slate-400 tabular-nums">{firstRowNo + r}</td>
                          {row.map((cell, c) => (
                            <td key={c} className="max-w-[18rem] truncate border-r border-slate-100 px-2 py-1 whitespace-nowrap" title={cell}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={safePage} pageSize={pageSize} total={dataRows.length} onChange={setPage} />
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}