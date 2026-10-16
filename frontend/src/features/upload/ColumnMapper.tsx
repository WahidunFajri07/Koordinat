import { Check, HelpCircle, AlertTriangle } from 'lucide-react';
import { ColumnRole, FileType } from './types';
import { validateColumnMapping } from './utils/parser';

interface ColumnMapperProps {
  headers: string[];
  previewRows: Record<string, string>[];
  columnMapping: Record<string, ColumnRole>;
  fileType: FileType;
  onMappingChange: (column: string, role: ColumnRole) => void;
}

export function ColumnMapper({
  headers,
  previewRows,
  columnMapping,
  fileType,
  onMappingChange,
}: ColumnMapperProps) {
  const validation = validateColumnMapping(fileType, columnMapping);

  const roleOptions: { role: ColumnRole; label: string; desc: string }[] = [
    { role: 'idpel', label: 'ID Pelanggan (idpel)', desc: 'Nomor identitas pelanggan 11-12 digit' },
    { role: 'longitude', label: 'Koordinat X (koordinat_x / Longitude)', desc: 'Derajat bujur (misal 106.8456)' },
    { role: 'latitude', label: 'Koordinat Y (koordinat_y / Latitude)', desc: 'Derajat lintang (misal -6.2088)' },
    { role: 'tglbaca', label: 'Tanggal Baca (tglbaca)', desc: 'Tanggal baca meter pelanggan (misal 05, 12, 20)' },
    { role: 'jenis_pel', label: 'Jenis Pelanggan (jenis_pel)', desc: 'Jenis layanan pelanggan (PASCA, PRABAYAR)' },
    {
      role: 'coordinate_combined',
      label: 'Koordinat Gabungan',
      desc: 'Satu kolom berisi format "lat, lon"',
    },
    { role: 'ignore', label: 'Abaikan Kolom', desc: 'Tidak disertakan dalam proses pemrosesan' },
  ];

  const getRoleBadge = (role: ColumnRole) => {
    switch (role) {
      case 'idpel':
        return 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
      case 'longitude':
        return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      case 'latitude':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'tglbaca':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'jenis_pel':
        return 'bg-violet-100 dark:bg-violet-950 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-800';
      case 'coordinate_combined':
        return 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      case 'ignore':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-4">
      {/* Validation status banners */}
      {!validation.isValid && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl space-y-2 text-amber-800 dark:text-amber-200 text-xs">
          <div className="flex items-center space-x-2 font-bold text-amber-900 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Perlu Penyesuaian Pemetaan Kolom</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl space-y-1 text-blue-800 dark:text-blue-200 text-xs">
          {validation.warnings.map((warn, i) => (
            <p key={i}>ℹ️ {warn}</p>
          ))}
        </div>
      )}

      {/* Grid of columns mapping cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {headers.map((colName) => {
          const currentRole = columnMapping[colName] || 'ignore';
          const sampleValues = previewRows
            .map((r) => r[colName])
            .filter((v) => v !== undefined && v !== '')
            .slice(0, 3);

          return (
            <div
              key={colName}
              className={`border rounded-xl p-4 transition-all bg-white dark:bg-slate-900/80 shadow-sm ${
                currentRole !== 'ignore'
                  ? 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
                  : 'border-slate-200 dark:border-slate-800/80 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="truncate pr-2">
                  <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-200 block truncate">
                    {colName}
                  </span>
                  <span
                    className={`inline-block text-[10px] px-2 py-0.5 mt-1 rounded-md border font-semibold ${getRoleBadge(
                      currentRole
                    )}`}
                  >
                    {roleOptions.find((r) => r.role === currentRole)?.label}
                  </span>
                </div>
              </div>

              {/* Sample values preview */}
              <div className="mt-2 mb-3 bg-slate-50 dark:bg-slate-950/70 rounded-lg p-2 border border-slate-200 dark:border-slate-800/80 text-[11px] font-mono text-slate-600 dark:text-slate-400 space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                  Sampel Nilai:
                </div>
                {sampleValues.length > 0 ? (
                  sampleValues.map((val, idx) => (
                    <div key={idx} className="truncate text-slate-700 dark:text-slate-300">
                      • {val}
                    </div>
                  ))
                ) : (
                  <span className="text-slate-400 italic">Nilai kosong</span>
                )}
              </div>

              {/* Role selection dropdown */}
              <div>
                <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                  Petakan Sebagai:
                </label>
                <select
                  value={currentRole}
                  onChange={(e) => onMappingChange(colName, e.target.value as ColumnRole)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.role} value={opt.role}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Kolom dengan label warna telah otomatis terdeteksi berdasarkan pola data.</span>
        </div>
        {validation.isValid && (
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <Check className="w-3.5 h-3.5" />
            <span>Pemetaan kolom memenuhi syarat</span>
          </div>
        )}
      </div>
    </div>
  );
}
