import { useState } from 'react';
import { ShieldCheck, Search, ShieldAlert, Eye, Activity } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface MockAuditLogItem {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  ip_address: string;
  created_at: string;
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
}

const SAMPLE_LOGS: MockAuditLogItem[] = [
  {
    id: 'log-01',
    user_email: 'analis@pln.co.id',
    action: 'candidate.validate',
    entity_type: 'match_candidate',
    entity_id: 'cand-uuid-101',
    ip_address: '192.168.1.15',
    created_at: '2026-10-15 08:30:12',
    before_state: { idpel: '******000001', status: 'unresolved' },
    after_state: { idpel: '******000001', status: 'valid', validated_by: 'Budi Santoso' },
  },
  {
    id: 'log-02',
    user_email: 'analis@pln.co.id',
    action: 'upload.create',
    entity_type: 'upload_file',
    entity_id: 'upl-uuid-202',
    ip_address: '192.168.1.15',
    created_at: '2026-10-15 08:15:00',
    before_state: {},
    after_state: { filename: 'master_sample.csv', total_rows: 1000, file_hash: '3a4b5c...89' },
  },
  {
    id: 'log-03',
    user_email: 'admin@pln.co.id',
    action: 'config.update',
    entity_type: 'system_config',
    entity_id: 'cfg-uuid-303',
    ip_address: '10.0.0.1',
    created_at: '2026-10-14 16:45:22',
    before_state: { key: 'default_match_tolerance_meters', value: '25.0' },
    after_state: { key: 'default_match_tolerance_meters', value: '20.0' },
  },
];

export function AuditLogViewer() {
  const { user, canAccess } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<MockAuditLogItem | null>(null);

  if (!canAccess('audit')) {
    return (
      <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-2xl p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Akses Ditolak (403 Forbidden)</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Halaman Log Audit hanya dapat diakses oleh peran <strong>Admin</strong> atau <strong>Auditor</strong>.
          Peran Anda saat ini adalah: <span className="uppercase text-cyan-600 dark:text-cyan-400 font-semibold">{user.role}</span>.
        </p>
        <p className="text-xs text-slate-500">
          Silakan ganti peran di profil dropdown pada navbar atas untuk menguji simulasi izin RBAC.
        </p>
      </div>
    );
  }

  const filteredLogs = SAMPLE_LOGS.filter(
    (log) =>
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.user_email.toLowerCase().includes(search.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Log Audit Sistem
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pencatatan mutasi data, snapshot before/after (IDPEL di-masking), IP address, dan identitas pengguna.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari aksi, entitas, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 w-64 shadow-sm"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/80 font-mono text-[11px]">
              <tr>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Aksi</th>
                <th className="py-3 px-4">Entitas</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{log.created_at}</td>
                  <td className="py-3 px-4 text-slate-900 dark:text-white font-medium font-sans">{log.user_email}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{log.entity_type}</td>
                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{log.ip_address}</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                      title="Lihat snapshot before/after"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500" />
                  Detail Audit Snapshot #{selectedLog.id}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aksi: {selectedLog.action} oleh {selectedLog.user_email}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕ Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase block mb-1">State Sebelum (Before)</span>
                <pre className="text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.before_state, null, 2)}
                </pre>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase block mb-1">State Sesudah (After)</span>
                <pre className="text-emerald-700 dark:text-emerald-300 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedLog.after_state, null, 2)}
                </pre>
              </div>
            </div>

            <div className="text-[11px] text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40 p-2.5 rounded-lg">
              🛡️ <strong>Perlindungan IDPEL:</strong> ID Pelanggan otomatis disanitasi menggunakan masking format (hanya 6 digit terakhir yang terlihat) untuk mematuhi regulasi privasi data.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
