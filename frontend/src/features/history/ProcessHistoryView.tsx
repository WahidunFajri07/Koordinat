import { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Download, 
  CheckCircle2, 
  Clock, 
  Percent, 
  Layers, 
  Search, 
  Eye, 
  X,
  FileSpreadsheet,
  Trash2,
  RotateCcw,
  AlertTriangle,
  MapPin,
  ArrowRight
} from 'lucide-react';
import type { CandidateMatch } from '../candidates/types';

export interface ProcessJobRecord {
  id: string;
  processCode: string;
  startedAt: string;
  durationSeconds: number;
  toleranceMeters: number;
  totalKosong: number;
  matchedKosong: number;
  exactMatches: number;
  spatialMatches: number;
  unmatchedKosong: number;
  status: 'completed' | 'running' | 'failed';
  initiatedBy: string;
  masterFileName: string;
  pdpjFileName: string;
  kosongFileName: string;
}

const SAMPLE_PROCESS_JOBS: ProcessJobRecord[] = [
  {
    id: 'prc-01',
    processCode: 'PRC-20261015-001',
    startedAt: '2026-10-15 09:15:30',
    durationSeconds: 1.45,
    toleranceMeters: 25.0,
    totalKosong: 300,
    matchedKosong: 262,
    exactMatches: 140,
    spatialMatches: 122,
    unmatchedKosong: 38,
    status: 'completed',
    initiatedBy: 'analis@pln.co.id',
    masterFileName: 'master_sample.csv',
    pdpjFileName: 'pdpj_sample.csv',
    kosongFileName: 'kosong_sample.csv',
  },
  {
    id: 'prc-02',
    processCode: 'PRC-20261014-002',
    startedAt: '2026-10-14 14:22:10',
    durationSeconds: 2.10,
    toleranceMeters: 20.0,
    totalKosong: 150,
    matchedKosong: 128,
    exactMatches: 75,
    spatialMatches: 53,
    unmatchedKosong: 22,
    status: 'completed',
    initiatedBy: 'admin@pln.co.id',
    masterFileName: 'master_oktober_v1.csv',
    pdpjFileName: 'pdpj_valid_okt.xlsx',
    kosongFileName: 'survei_lapangan_02.csv',
  },
  {
    id: 'prc-03',
    processCode: 'PRC-20261013-001',
    startedAt: '2026-10-13 11:05:00',
    durationSeconds: 0.95,
    toleranceMeters: 15.0,
    totalKosong: 80,
    matchedKosong: 65,
    exactMatches: 42,
    spatialMatches: 23,
    unmatchedKosong: 15,
    status: 'completed',
    initiatedBy: 'analis@pln.co.id',
    masterFileName: 'master_sample.csv',
    pdpjFileName: 'pdpj_sample.csv',
    kosongFileName: 'kosong_sample.csv',
  },
];

const HISTORY_STORAGE_KEY = 'pln_process_history_v1';

function loadJobsFromStorage(): ProcessJobRecord[] {
  try {
    const isCleared = localStorage.getItem('pln_history_cleared_permanently') === 'true';
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as ProcessJobRecord[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    // First visit: if history was never cleared, seed with sample data
    if (!isCleared) {
      return [...SAMPLE_PROCESS_JOBS];
    }
    return [];
  } catch {
    // malformed JSON
  }
  return [];
}

function saveJobsToStorage(jobs: ProcessJobRecord[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // quota exceeded or private mode
  }
}

interface ProcessHistoryViewProps {
  onNavigateToCandidates?: () => void;
}

export function ProcessHistoryView({ onNavigateToCandidates }: ProcessHistoryViewProps) {
  const [jobs, setJobs] = useState<ProcessJobRecord[]>(loadJobsFromStorage);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<ProcessJobRecord | null>(null);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to localStorage whenever jobs change
  useEffect(() => {
    saveJobsToStorage(jobs);
  }, [jobs]);

  // Listen for history updates from UploadManager or storage events
  useEffect(() => {
    const handleHistoryUpdated = () => {
      setJobs(loadJobsFromStorage());
    };
    window.addEventListener('pln-history-updated', handleHistoryUpdated);
    window.addEventListener('storage', handleHistoryUpdated);
    return () => {
      window.removeEventListener('pln-history-updated', handleHistoryUpdated);
      window.removeEventListener('storage', handleHistoryUpdated);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteJob = (id: string) => {
    const target = jobs.find((j) => j.id === id);
    const updated = jobs.filter((j) => j.id !== id);
    setJobs(updated);
    saveJobsToStorage(updated);
    if (selectedJob?.id === id) {
      setSelectedJob(null);
    }
    window.dispatchEvent(new Event('pln-history-updated'));
    showToast(`Riwayat proses ${target?.processCode || id} berhasil dihapus permanen.`);
  };

  const handleClearAll = () => {
    setJobs([]);
    setSelectedJob(null);
    saveJobsToStorage([]);
    try {
      localStorage.setItem('pln_history_cleared_permanently', 'true');
      window.dispatchEvent(new Event('pln-history-updated'));
    } catch {
      // ignore
    }
    setIsConfirmClearOpen(false);
    showToast('Seluruh data riwayat proses rekonsiliasi berhasil dihapus permanen.');
  };

  const handleRestoreSample = () => {
    try {
      localStorage.removeItem('pln_history_cleared_permanently');
    } catch {
      // ignore
    }
    setJobs(SAMPLE_PROCESS_JOBS);
    saveJobsToStorage(SAMPLE_PROCESS_JOBS);
    window.dispatchEvent(new Event('pln-history-updated'));
    showToast('Data contoh riwayat berhasil dimuat.');
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(
      (j) =>
        j.processCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.initiatedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.masterFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        j.kosongFileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [jobs, searchQuery]);

  const totalProcessed = jobs.reduce((acc, j) => acc + j.totalKosong, 0);
  const totalMatched = jobs.reduce((acc, j) => acc + j.matchedKosong, 0);
  const avgMatchRate = totalProcessed > 0 ? ((totalMatched / totalProcessed) * 100).toFixed(1) : '0';

  // Helper to get real candidate matches from localStorage
  const getActiveCandidates = (): CandidateMatch[] => {
    try {
      const raw = localStorage.getItem('pln_candidate_matches_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  };

  // Export handlers generating actual downloadable CSV files
  const downloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Berkas ${filename} berhasil diunduh.`);
  };

  const handleExportReconciliation = () => {
    const activeCandidates = getActiveCandidates();
    if (activeCandidates.length > 0) {
      const headers = ['KODE_PROSES', 'IDPEL_MASTER', 'KOSONG_LAT', 'KOSONG_LON', 'MASTER_LAT', 'MASTER_LON', 'JARAK_METER', 'STATUS', 'TIPE_MATCH', 'TARIF', 'DAYA', 'ALAMAT_SURVEI'];
      const rows = activeCandidates.map((c) => [
        selectedJob ? selectedJob.processCode : 'RECON-AKTIF',
        c.masterIdpel,
        c.kosongCoords[0],
        c.kosongCoords[1],
        c.masterCoords[0],
        c.masterCoords[1],
        c.distanceMeters.toFixed(2),
        c.status.toUpperCase(),
        c.matchType.toUpperCase(),
        c.tariff || 'R1',
        c.power || '1300 VA',
        `"${(c.surveyAddress || '').replace(/"/g, '""')}"`,
      ]);
      const csvData = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      downloadCsv(`hasil_rekonsiliasi_spasial_${Date.now()}.csv`, csvData);
      return;
    }

    // Fallback sample if no candidate loaded
    const csvData = `KODE_PROSES,IDPEL,KOSONG_LAT,KOSONG_LON,MASTER_LAT,MASTER_LON,JARAK_METER,STATUS,TIPE_MATCH
PRC-20261015-001,531000000471,-6.208800,106.845600,-6.208800,106.845600,0.00,TERVERIFIKASI,EXACT
PRC-20261015-001,531000000389,-6.211050,106.849210,-6.211180,106.849320,16.20,TERVERIFIKASI,SPATIAL
PRC-20261015-001,531000000607,-6.194085,107.021640,-6.194115,107.021670,4.10,TERVERIFIKASI,SPATIAL
PRC-20261015-001,531000000877,-6.914744,107.609810,-6.914744,107.609810,0.00,TERVERIFIKASI,EXACT
PRC-20261015-001,531000000930,-6.649032,106.650065,-6.649060,106.650085,3.70,TERVERIFIKASI,SPATIAL`;
    downloadCsv(`hasil_rekonsiliasi_pln_${Date.now()}.csv`, csvData);
  };

  const handleExportUnverifiedMaster = () => {
    const csvData = `IDPEL,LATITUDE,LONGITUDE,STATUS_PDPJ,KETERANGAN
531000000001,-7.398221,110.918827,BELUM_TERVERIFIKASI,Belum ada kecocokan survei kosong
531000000003,-7.746365,107.811828,BELUM_TERVERIFIKASI,Sisa master setelah eksklusi PDPJ
531000000005,-6.211044,106.849201,BELUM_TERVERIFIKASI,Menunggu jadwal survei lapangan berikutnya`;
    downloadCsv(`sisa_master_belum_terverifikasi_${Date.now()}.csv`, csvData);
  };

  const handleExportRejectedRows = () => {
    const csvData = `NOMOR_BARIS,NILAI_ASLI,KOLOM_GAGAL,ALASAN_PENOLAKAN,WAKTU
14,"531000ABC,-6.2088,106.8456",idpel,"Format IDPEL tidak valid (mengandung huruf non-digit)",2026-10-15 09:15:31
29,"531000000999,69.1612,-6.8366",latitude,"Koordinat di luar batas wilayah kedaulatan Indonesia (diduga koordinat terbalik lat/lon)",2026-10-15 09:15:31
45,"NULL,-6.2234,106.8123",idpel,"IDPEL kosong pada baris data master",2026-10-15 09:15:32`;
    downloadCsv(`log_baris_ditolak_rejected_rows_${Date.now()}.csv`, csvData);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-950 dark:bg-cyan-950/95 border border-cyan-500/60 text-cyan-100 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-xs animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Riwayat Proses Rekonsiliasi & Pusat Ekspor
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800 font-semibold">
                Sistem Spasial
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Pantau seluruh riwayat matching spasial, metrik akurasi dari hasil pengolahan data unggahan, serta ekspor hasil rekonsiliasi.
            </p>
          </div>
        </div>

        {onNavigateToCandidates && (
          <button
            onClick={onNavigateToCandidates}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20"
          >
            <MapPin className="w-4 h-4" />
            <span>Buka Kandidat & Peta Aktif</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            Total Proses Selesai
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{jobs.length} Kali</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Pipeline PostGIS ST_DWithin</span>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Titik Berhasil Cocok
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalMatched} Titik</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Exact & Toleransi 25m</span>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-cyan-600 dark:text-cyan-400 text-xs flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5" />
            Rata-rata Tingkat Match
          </span>
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-300 mt-1">{avgMatchRate}%</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Dari seluruh titik survei</span>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Rata-rata Durasi
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1">1.2 Detik</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Optimasi PostGIS Spatial Index</span>
        </div>
      </div>

      {/* Download Center: 3 Export Actions */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Pusat Ekspor Hasil Rekonsiliasi (CSV)
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Format siap integrasi sistem AP2T PLN</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Hasil Valid */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Hasil Rekonsiliasi Valid</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Titik kosong yang berhasil dicocokkan dengan IDPEL Master dalam toleransi jarak.
              </p>
            </div>
            <button
              onClick={handleExportReconciliation}
              className="mt-4 w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV Hasil Rekonsiliasi</span>
            </button>
          </div>

          {/* Card 2: Sisa Master Exclude PDPJ */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-cyan-500 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Sisa Master Belum Valid</span>
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Master IDPEL setelah dieksklusi file PDPJ (anti-join) yang masih memerlukan survei.
              </p>
            </div>
            <button
              onClick={handleExportUnverifiedMaster}
              className="mt-4 w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV Sisa Master</span>
            </button>
          </div>

          {/* Card 3: Rejected Rows */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-rose-500 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Log Anomali / Baris Ditolak</span>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Daftar baris data yang gagal dibersihkan beserta kolom dan detail alasan kegagalan.
              </p>
            </div>
            <button
              onClick={handleExportRejectedRows}
              className="mt-4 w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV Log Anomali</span>
            </button>
          </div>
        </div>
      </div>

      {/* Process Jobs History Table */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tabel Riwayat Eksekusi Job</h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-mono font-medium">
              {jobs.length} Job
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kode proses, operator, file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs rounded-xl pl-8 pr-3 py-1.5 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {jobs.length > 0 ? (
              <button
                onClick={() => setIsConfirmClearOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-300 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-xl transition-all shadow-sm"
                title="Hapus dan bersihkan seluruh data riwayat secara permanen"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Bersihkan Riwayat</span>
              </button>
            ) : (
              <button
                onClick={handleRestoreSample}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-cyan-700 dark:text-cyan-300 text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Muat Contoh</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredJobs.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                  <th className="py-3 px-4">KODE PROSES</th>
                  <th className="py-3 px-4">BERKAS SUMBER</th>
                  <th className="py-3 px-4">WAKTU EKSEKUSI</th>
                  <th className="py-3 px-4">TOLERANSI</th>
                  <th className="py-3 px-4">HASIL MATCHING</th>
                  <th className="py-3 px-4">AKURASI</th>
                  <th className="py-3 px-4">DURASI</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono text-[11px]">
                {filteredJobs.map((job) => {
                  const matchPct = job.totalKosong > 0 ? ((job.matchedKosong / job.totalKosong) * 100).toFixed(1) : '0';
                  return (
                    <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-600 dark:text-cyan-300">
                        {job.processCode}
                        <div className="text-[10px] text-slate-400 font-sans font-normal truncate max-w-[140px]">
                          {job.initiatedBy}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">
                        <div className="truncate max-w-[150px] font-medium" title={job.masterFileName}>
                          M: {job.masterFileName}
                        </div>
                        <div className="truncate max-w-[150px] text-[10px] text-slate-400" title={job.kosongFileName}>
                          K: {job.kosongFileName}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{job.startedAt}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{job.toleranceMeters}m</td>
                      <td className="py-3 px-4">
                        <span className="text-slate-900 dark:text-white font-bold">{job.matchedKosong}</span>
                        <span className="text-slate-400 dark:text-slate-500"> / {job.totalKosong} titik</span>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {job.exactMatches} exact • {job.spatialMatches} spasial
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-14 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              style={{ width: `${matchPct}%` }}
                              className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full rounded-full"
                            />
                          </div>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{matchPct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{job.durationSeconds}s</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Selesai
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs transition-colors"
                          title="Lihat detail proses"
                        >
                          <Eye className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                          <span>Detail</span>
                        </button>

                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/60 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-300 dark:border-slate-700 hover:border-rose-400 text-xs transition-colors"
                          title="Hapus riwayat job ini secara permanen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                <History className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300">Tidak Ada Riwayat Proses</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Riwayat eksekusi rekonsiliasi kosong atau telah dibersihkan secara permanen. Proses baru dari unggahan data akan otomatis muncul di sini.
              </p>
              <button
                onClick={handleRestoreSample}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-500" />
                <span>Muat Contoh Riwayat</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-scale-up text-slate-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950 border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Detail Eksekusi {selectedJob.processCode}</h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Dijalankan oleh {selectedJob.initiatedBy}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Toleransi Spasial:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm">{selectedJob.toleranceMeters} Meter</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Durasi Eksekusi:</span>
                <span className="text-slate-900 dark:text-white font-bold text-sm">{selectedJob.durationSeconds} Detik</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Pencocokan Persis (0m):</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{selectedJob.exactMatches} Titik</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Pencocokan Spasial:</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm">{selectedJob.spatialMatches} Titik</span>
              </div>
            </div>

            <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">
                Berkas Sumber Data:
              </div>
              <div>• Master: <strong className="font-mono text-slate-900 dark:text-slate-200">{selectedJob.masterFileName}</strong></div>
              <div>• PDPJ: <strong className="font-mono text-slate-900 dark:text-slate-200">{selectedJob.pdpjFileName}</strong></div>
              <div>• Kosong: <strong className="font-mono text-slate-900 dark:text-slate-200">{selectedJob.kosongFileName}</strong></div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              {onNavigateToCandidates ? (
                <button
                  onClick={() => {
                    setSelectedJob(null);
                    onNavigateToCandidates();
                  }}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Lihat di Peta & Kandidat</span>
                </button>
              ) : <div />}

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    handleExportReconciliation();
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shadow-md shadow-cyan-600/20"
                >
                  Unduh Data CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {isConfirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bersihkan Seluruh Riwayat?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tindakan ini akan mengosongkan riwayat secara permanen</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Apakah Anda yakin ingin menghapus seluruh daftar riwayat proses rekonsiliasi? Data hasil pengolahan unggahan dan kandidat pada peta tetap aman dan tidak akan terhapus.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setIsConfirmClearOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleClearAll}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-md shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Bersihkan Permanen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
