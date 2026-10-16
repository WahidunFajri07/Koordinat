import { useState } from 'react';
import { Copy, Check, Hash, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { ColumnRole, FileUploadState } from './types';
import { formatBytes } from './utils/parser';

interface PreviewTableProps {
  uploadState: FileUploadState;
  onSheetChange?: (sheet: string) => void;
}

export function PreviewTable({ uploadState, onSheetChange }: PreviewTableProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  const copyHashToClipboard = () => {
    if (!uploadState.fileHashSha256) return;
    navigator.clipboard.writeText(uploadState.fileHashSha256);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const getRoleBadge = (role: ColumnRole) => {
    switch (role) {
      case 'idpel':
        return 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
      case 'latitude':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'longitude':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      case 'tglbaca':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'jenis_pel':
        return 'bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-800';
      case 'coordinate_combined':
        return 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      case 'ignore':
        return 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700/80';
    }
  };

  return (
    <div className="space-y-4">
      {/* File Metadata Overview Bar */}
      <div className="bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {uploadState.originalFilename}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono">
                {formatBytes(uploadState.fileSizeBytes)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span>{uploadState.headers.length} Kolom</span>
              <span>•</span>
              <span>Estimasi {uploadState.totalRowsEstimated.toLocaleString('id-ID')} Baris</span>
            </div>
          </div>
        </div>

        {/* SHA-256 Hash Badge */}
        <div className="flex items-center gap-2 bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg text-xs font-mono shadow-sm">
          <Hash className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-slate-600 dark:text-slate-400 text-[11px] max-w-[140px] truncate" title={uploadState.fileHashSha256}>
            {uploadState.fileHashSha256 ? `${uploadState.fileHashSha256.slice(0, 12)}...` : 'Menghitung...'}
          </span>
          <button
            onClick={copyHashToClipboard}
            className="text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors ml-1 p-1"
            title="Salin SHA-256"
          >
            {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Duplicate file warning if detected */}
      {uploadState.isDuplicate && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl flex items-center space-x-2 text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>
            Peringatan: Hash file SHA-256 ini identik dengan file yang pernah diunggah sebelumnya.
          </span>
        </div>
      )}

      {/* Sheet selection if multi-sheet Excel */}
      {uploadState.sheetNames && uploadState.sheetNames.length > 1 && onSheetChange && (
        <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Pilih Lembar Kerja (Sheet):</span>
          <div className="flex gap-1">
            {uploadState.sheetNames.map((sheet) => (
              <button
                key={sheet}
                onClick={() => onSheetChange(sheet)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  uploadState.selectedSheet === sheet
                    ? 'bg-cyan-600 text-white font-medium'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {sheet}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pratinjau 10 Baris Pertama Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950/60 shadow-sm">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-300">
            Pratinjau Data (Maksimal 10 Baris Pertama)
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Menampilkan {uploadState.previewRows.length} dari estimasi {uploadState.totalRowsEstimated} baris
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                <th className="py-2.5 px-3 text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500 w-12 text-center border-r border-slate-200 dark:border-slate-800/80">
                  #
                </th>
                {uploadState.headers.map((header) => {
                  const role = uploadState.columnMapping[header] || 'ignore';
                  return (
                    <th key={header} className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800/60 last:border-r-0">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{header}</span>
                        <span
                          className={`inline-block text-[9px] px-1.5 py-0.5 rounded border uppercase font-mono max-w-fit font-semibold ${getRoleBadge(
                            role
                          )}`}
                        >
                          {role}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-[11px]">
              {uploadState.previewRows.length > 0 ? (
                uploadState.previewRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                    <td className="py-2 px-3 text-slate-400 dark:text-slate-500 text-center border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
                      {rowIdx + 1}
                    </td>
                    {uploadState.headers.map((header) => {
                      const val = row[header];
                      return (
                        <td
                          key={header}
                          className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate max-w-xs border-r border-slate-200 dark:border-slate-800/40 last:border-r-0"
                          title={val}
                        >
                          {val !== undefined && val !== '' ? (
                            val
                          ) : (
                            <span className="text-slate-400 italic">null</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={uploadState.headers.length + 1} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    Tidak ada baris data ditemukan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
