import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fileUrl } from '../api/client';
import { ErrorBox, LinkButton, Modal, PageLoader, Tabs } from './ui';

/**
 * Shows the first rows of each sheet.
 * queryKey/queryFn load { fileName, sheets?: [{name, rows, truncated, totalRows}], unsupported? }
 */
export default function ExcelPreviewModal({ open, onClose, title, queryKey, queryFn, downloadPath }) {
  const [sheet, setSheet] = useState(0);
  const q = useQuery({ queryKey, queryFn, enabled: open, staleTime: 60_000 });
  const data = q.data;
  const current = data?.sheets?.[sheet];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || data?.fileName || 'Excel preview'}
      size="full"
      footer={downloadPath && <LinkButton href={fileUrl(downloadPath)} variant="primary">Download file</LinkButton>}
    >
      {q.isLoading && <PageLoader label="Reading spreadsheet…" />}
      {q.isError && <ErrorBox error={q.error} />}
      {data?.unsupported && <ErrorBox>{data.unsupported}</ErrorBox>}
      {data?.sheets && (
        <>
          {data.sheets.length > 1 && (
            <Tabs value={sheet} onChange={setSheet} tabs={data.sheets.map((s, i) => ({ value: i, label: s.name }))} />
          )}
          {current && (current.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">This sheet is empty.</p>
          ) : (
            <div className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-xs">
                <tbody>
                  {current.rows.map((row, r) => (
                    <tr key={r} className={r === 0 ? 'sticky top-0 bg-slate-100 font-semibold' : 'odd:bg-white even:bg-slate-50'}>
                      <td className="border-r border-slate-200 px-2 py-1 text-right text-slate-400 tabular-nums">{r + 1}</td>
                      {row.map((cell, c) => (
                        <td key={c} className="max-w-[18rem] truncate border-r border-slate-100 px-2 py-1 whitespace-nowrap" title={cell}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {current?.truncated && (
            <p className="mt-2 text-xs text-slate-500">Showing the first {current.rows.length} of {current.totalRows} rows. Download the file to see everything.</p>
          )}
        </>
      )}
    </Modal>
  );
}
