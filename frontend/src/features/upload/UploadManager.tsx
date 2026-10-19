import { useState } from 'react';
import { 
  Database, 
  ShieldCheck, 
  MapPin, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw, 
  SlidersHorizontal,
  Table,
  Layers,
  Sparkles,
  Play
} from 'lucide-react';
import { FileType, ColumnRole, FileUploadState } from './types';
import { UploadZone } from './UploadZone';
import { PreviewTable } from './PreviewTable';
import { ColumnMapper } from './ColumnMapper';
import { 
  computeFileHashSha256, 
  parseCsvSnippet, 
  autoDetectAllColumns, 
  validateColumnMapping 
} from './utils/parser';
import { runReconciliationPipeline } from '../reconciliation/reconciliationEngine';
import type { CandidateMatch } from '../candidates/types';
import type { ProcessJobRecord } from '../history/ProcessHistoryView';
import { useAuth } from '../auth/AuthContext';

// Sample synthetic data synchronized with candidat mockData - Jakarta Menteng region
const SAMPLE_MASTER_CSV = `idpel,koordinat_x,koordinat_y,tglbaca,jenis_pel
531000000471,106.845600,-6.208800,05,PASCA
531000000389,106.849320,-6.211180,12,PASCA
531000000607,106.841225,-6.205435,05,PASCA
531000000877,106.848500,-6.202300,20,PASCA
531000000930,106.843525,-6.214530,15,PASCA
531000000135,106.851000,-6.218500,10,PRABAYAR`;

const SAMPLE_PDPJ_CSV = `NO_IDPEL_VALID
531000000135`;

const SAMPLE_KOSONG_CSV = `KOORDINAT_TITIK
"-6.208800,106.845600"
"-6.211050,106.849210"
"-6.205400,106.841200"
"-6.202300,106.848500"
"-6.214500,106.843500"`;

const SAMPLE_TIDAK_DITEMUKAN_CSV = `idpel,koordinat
881000000101,"-6.218500,106.851000"
881000000102,"-6.207200,106.854000"`;

interface UploadManagerProps {
  onAllFilesReady?: (datasets: Record<FileType, FileUploadState | null>) => void;
  onNavigateToMatching?: () => void;
}

// Keep track of the last processed hash combo to prevent accidental duplicate runs in quick succession
let lastProcessedKey = '';
let lastProcessedTime = 0;

export function UploadManager({ onAllFilesReady, onNavigateToMatching }: UploadManagerProps) {
  const { user } = useAuth();
  const [selectedFileType, setSelectedFileType] = useState<FileType>('master');
  const [activeSubTab, setActiveSubTab] = useState<'preview' | 'mapping'>('preview');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // File state dictionary for all 4 required files
  const [fileStates, setFileStates] = useState<Record<FileType, FileUploadState | null>>({
    master: null,
    pdpj: null,
    idpel_kosong: null,
    idpel_tidak_ditemukan: null,
  });

  const currentState = fileStates[selectedFileType];

  // Helper to update current file state
  const updateCurrentState = (partial: Partial<FileUploadState>) => {
    setFileStates((prev) => {
      const current = prev[selectedFileType];
      if (!current) return prev;
      return {
        ...prev,
        [selectedFileType]: {
          ...current,
          ...partial,
        },
      };
    });
  };

  // Process a selected or dropped file
  const handleProcessFile = async (file: File) => {
    updateCurrentState({ status: 'reading' });
    try {
      const hash = await computeFileHashSha256(file);
      const textSnippet = await file.text();
      const { headers, previewRows, totalRowsEstimated } = parseCsvSnippet(textSnippet, 10);
      const { previewRows: fullRows } = parseCsvSnippet(textSnippet, 50000);
      const detectedMapping = autoDetectAllColumns(headers, previewRows, selectedFileType);

      const newState: FileUploadState = {
        file,
        uploadId: crypto.randomUUID ? crypto.randomUUID() : `upl-${Date.now()}`,
        fileType: selectedFileType,
        originalFilename: file.name,
        fileSizeBytes: file.size,
        fileHashSha256: hash,
        headers,
        previewRows,
        fullRows,
        rawText: textSnippet,
        sheetNames: ['Sheet1'],
        selectedSheet: 'Sheet1',
        columnMapping: detectedMapping,
        isDuplicate: false,
        status: 'ready',
        totalRowsEstimated,
      };

      const updatedStates = {
        ...fileStates,
        [selectedFileType]: newState,
      };

      setFileStates(updatedStates);

      // Try uploading to backend API in background if server is available
      tryUploadToBackend(file, selectedFileType, detectedMapping, newState.uploadId);

      setActiveSubTab('preview');
      showToast(`Berkas ${file.name} berhasil dibaca dan pratinjau siap.`);

      // Automatically trigger candidate bridging if master & kosong are ready
      processAndBridgeCandidateMatches(updatedStates);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses file';
      showToast(`Error: ${msg}`);
    }
  };

  // Attempt backend API upload
  const tryUploadToBackend = async (
    file: File,
    type: FileType,
    mapping: Record<string, ColumnRole>,
    uploadId: string
  ) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      let endpoint = `/api/v1/upload/${type}`;
      if (type === 'idpel_kosong') {
        endpoint = '/api/v1/upload/kosong?sub_type=idpel_kosong';
      } else if (type === 'idpel_tidak_ditemukan') {
        endpoint = '/api/v1/upload/kosong?sub_type=idpel_tidak_ditemukan';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        const serverUploadId = json.upload_id || uploadId;
        await fetch(`/api/v1/upload/${serverUploadId}/mapping`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ mapping }),
        });
      }
    } catch {
      // Backend is offline or mock mode: continues smoothly in client mode
    }
  };

  // Load sample synthetic CSV with 1 click
  const handleLoadSample = (type: FileType) => {
    let content = SAMPLE_MASTER_CSV;
    let filename = 'master_sample.csv';
    if (type === 'pdpj') {
      content = SAMPLE_PDPJ_CSV;
      filename = 'pdpj_sample.csv';
    } else if (type === 'idpel_kosong') {
      content = SAMPLE_KOSONG_CSV;
      filename = 'idpel_kosong_sample.csv';
    } else if (type === 'idpel_tidak_ditemukan') {
      content = SAMPLE_TIDAK_DITEMUKAN_CSV;
      filename = 'idpel_tidak_ditemukan_sample.csv';
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const file = new File([blob], filename, { type: 'text/csv' });
    handleProcessFile(file);
  };

  // Handle column role change
  const handleMappingChange = (column: string, role: ColumnRole) => {
    if (!currentState) return;
    const newMapping = {
      ...currentState.columnMapping,
      [column]: role,
    };
    updateCurrentState({ columnMapping: newMapping });
  };

  // Reset current file
  const handleResetFile = () => {
    setFileStates((prev) => ({
      ...prev,
      [selectedFileType]: null,
    }));
  };

  // Helper to run matching pipeline and bridge candidate matches to spatial map & history
  const processAndBridgeCandidateMatches = (
    currentStates: Record<FileType, FileUploadState | null>,
    forceRun = false
  ): number => {
    const master = currentStates.master;
    const kosong = currentStates.idpel_kosong || currentStates.idpel_tidak_ditemukan;

    // Validasi apakah sub-type sudah terisi jika kosong
    if (!kosong) return 0;

    const pdpj = currentStates.pdpj;

    if (!master || !kosong) return 0;

    // Throttle identical consecutive triggers
    const key = `${master.fileHashSha256}_${pdpj?.fileHashSha256 || 'none'}_${kosong.fileHashSha256}`;
    const now = Date.now();
    if (!forceRun && key === lastProcessedKey && now - lastProcessedTime < 2500) {
      return 0;
    }
    lastProcessedKey = key;
    lastProcessedTime = now;

    const masterRows = (master.fullRows && master.fullRows.length > 0) ? master.fullRows : master.previewRows;
    const kosongRows = (kosong.fullRows && kosong.fullRows.length > 0) ? kosong.fullRows : kosong.previewRows;
    const pdpjRows = pdpj ? ((pdpj.fullRows && pdpj.fullRows.length > 0) ? pdpj.fullRows : pdpj.previewRows) : [];

    const result = runReconciliationPipeline(
      masterRows,
      master.columnMapping,
      pdpjRows,
      pdpj ? pdpj.columnMapping : {},
      kosongRows,
      kosong.columnMapping,
      5
    );

    if (result.stage === 'complete') {
      // 1. Prepare candidate matches for spatial map (<= 5.0m automatically detected as valid)
      const bridged: CandidateMatch[] = result.matches.map((m, idx) => {
        const dist = Number(m.distanceMeters);
        const isValidByTolerance = dist <= 5.0;
        return {
          id: m.id || `recon-${idx + 1}`,
          kosongId: `kosong-${m.kosong.rowIndex}`,
          kosongCoords: [m.kosong.latitude, m.kosong.longitude],
          surveyAddress:
            m.kosong.raw?.alamatlengkap ||
            m.kosong.raw?.alamat ||
            `Titik Survei ${m.kosong.latitude.toFixed(5)}, ${m.kosong.longitude.toFixed(5)}`,
          masterId: `master-${m.master.rowIndex}`,
          masterIdpel: m.master.idpel,
          masterCoords: [m.master.latitude, m.master.longitude],
          distanceMeters: dist,
          matchType: dist === 0 ? 'exact' : 'spatial',
          rank: m.rank,
          status: isValidByTolerance ? 'valid' : 'unresolved',
          validatedBy: isValidByTolerance ? 'Sistem Deteksi Spasial (≤ 5m)' : undefined,
          validatedAt: isValidByTolerance ? new Date().toLocaleString('id-ID') : undefined,
          tariff: m.master.raw?.tarif || 'R1',
          power: m.master.raw?.daya || '1300 VA',
        };
      });

      try {
        localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(bridged));
        window.dispatchEvent(new Event('pln-candidates-updated'));

        const exactMatches = result.matches.filter((m) => m.distanceMeters === 0).length;
        const spatialMatches = result.matches.length - exactMatches;

        // 2. Prepare real process history record from actual uploaded data
        const newJob: ProcessJobRecord = {
          id: `prc-${Date.now()}`,
          processCode: `PRC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
          startedAt: new Date().toLocaleString('id-ID'),
          durationSeconds: parseFloat((result.stats.processingTimeMs / 1000).toFixed(2)) || 0.85,
          toleranceMeters: 5.0,
          totalKosong: result.stats.kosongCount,
          matchedKosong: result.stats.matchedKosongCount,
          exactMatches,
          spatialMatches,
          unmatchedKosong: result.stats.unmatchedKosongCount,
          validatedKosong: bridged.filter((m) => m.status === 'valid').length,
          status: 'completed',
          initiatedBy: user.email || 'analis@pln.co.id',
          masterFileName: master.originalFilename,
          pdpjFileName: pdpj?.originalFilename || '-',
          kosongFileName: `${kosong.originalFilename} (${kosong.fileType})`,
        };

        // Link every candidate to its source process so history can count validated points per process
        for (const m of bridged) {
          m.processId = newJob.processCode;
        }

        const existingRaw = localStorage.getItem('pln_process_history_v1');
        let existingList: ProcessJobRecord[] = [];
        try {
          if (existingRaw) {
            const parsed = JSON.parse(existingRaw);
            if (Array.isArray(parsed)) existingList = parsed;
          }
        } catch {
          existingList = [];
        }

        // If history was previously cleared, exclude initial mock samples so only real new jobs are kept
        const isCleared = localStorage.getItem('pln_history_cleared_permanently') === 'true';
        if (isCleared) {
          existingList = existingList.filter((j) => !['prc-01', 'prc-02', 'prc-03'].includes(j.id));
        }

        // Prepend newJob so the newest process is always displayed first
        const updatedHistory = [newJob, ...existingList];
        localStorage.setItem('pln_process_history_v1', JSON.stringify(updatedHistory));
        window.dispatchEvent(new Event('pln-history-updated'));
      } catch {
        // ignore storage restrictions
      }
      return bridged.length;
    }
    return 0;
  };

  // Confirm and save mapping
  const handleConfirmAndProcess = () => {
    if (!currentState) return;
    const validation = validateColumnMapping(selectedFileType, currentState.columnMapping);
    if (!validation.isValid) {
      showToast('Harap sesuaikan pemetaan kolom yang belum valid.');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const updatedStates = {
        ...fileStates,
        [selectedFileType]: { ...currentState, status: 'completed' as const },
      };
      setFileStates(updatedStates);

      const count = processAndBridgeCandidateMatches(updatedStates, true);
      if (count > 0) {
        showToast(
          `Data ${selectedFileType.toUpperCase()} dikonfirmasi. ${count} kandidat pencocokan spasial siap di peta & riwayat tersimpan!`
        );
      } else {
        showToast(`Data ${selectedFileType.toUpperCase()} berhasil dikonfirmasi dan siap direkonsiliasi.`);
      }

      if (onAllFilesReady) {
        onAllFilesReady(updatedStates);
      }
    }, 350);
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const completedCount = Object.values(fileStates).filter(
    (s) => s !== null && (s.status === 'ready' || s.status === 'completed')
  ).length;

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-950 dark:bg-cyan-950/95 border border-cyan-500/60 text-cyan-100 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-xs animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top File Type Stepper / Selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Step 1: Master */}
        <button
          onClick={() => setSelectedFileType('master')}
          className={`text-left p-4 rounded-xl border transition-all ${
            selectedFileType === 'master'
              ? 'bg-cyan-50/60 dark:bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-500/10'
              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              1. Master Pelanggan
            </span>
            {fileStates.master ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Siap
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Belum Ada
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">Pasca & Prabayar</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {fileStates.master ? fileStates.master.originalFilename : 'idpel, koordinat_x, koordinat_y, tglbaca, jenis_pel'}
          </p>
        </button>

        {/* Step 2: PDPJ */}
        <button
          onClick={() => setSelectedFileType('pdpj')}
          className={`text-left p-4 rounded-xl border transition-all ${
            selectedFileType === 'pdpj'
              ? 'bg-emerald-50/60 dark:bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-500/10'
              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              2. Data PDPJ
            </span>
            {fileStates.pdpj ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Siap
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Belum Ada
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">Eksklusi Terverifikasi</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {fileStates.pdpj ? fileStates.pdpj.originalFilename : 'Left anti-join dengan Master'}
          </p>
        </button>

        {/* Step 3: IDPEL Kosong */}
        <button
          onClick={() => setSelectedFileType('idpel_kosong')}
          className={`text-left p-4 rounded-xl border transition-all ${
            selectedFileType === 'idpel_kosong'
              ? 'bg-amber-50/60 dark:bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10'
              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              3. IDPEL Kosong
            </span>
            {fileStates.idpel_kosong ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Siap
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Belum Ada
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">IDPEL Kosong</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {fileStates.idpel_kosong ? fileStates.idpel_kosong.originalFilename : 'Survei koordinat saja'}
          </p>
        </button>

        {/* Step 4: IDPEL Tidak Ditemukan */}
        <button
          onClick={() => setSelectedFileType('idpel_tidak_ditemukan')}
          className={`text-left p-4 rounded-xl border transition-all ${
            selectedFileType === 'idpel_tidak_ditemukan'
              ? 'bg-amber-50/60 dark:bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10'
              : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              4. IDPEL Tidak Ditemukan
            </span>
            {fileStates.idpel_tidak_ditemukan ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Siap
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Belum Ada
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">IDPEL Tidak Ditemukan</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {fileStates.idpel_tidak_ditemukan ? fileStates.idpel_tidak_ditemukan.originalFilename : 'IDPEL + Koordinat'}
          </p>
        </button>
      </div>

      {/* Main Dynamic View: Either UploadZone or Preview/Mapping */}
      {!currentState ? (
        <div className="space-y-4">
          <UploadZone
            fileType={selectedFileType}
            onFileSelected={handleProcessFile}
            onLoadSample={() => handleLoadSample(selectedFileType)}
          />

          {/* Quick Demo loader helper */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3 text-xs text-slate-600 dark:text-slate-400">
              <Sparkles className="w-4 h-4 text-cyan-500" />
              <span>
                Ingin mencoba langsung tanpa upload manual? Gunakan tombol contoh data sintetis yang telah disiapkan.
              </span>
            </div>
            <button
              onClick={() => handleLoadSample(selectedFileType)}
              className="text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 rounded-lg border border-slate-300 dark:border-slate-700 transition-colors"
            >
              Muat Data Contoh {selectedFileType.toUpperCase()}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveSubTab('preview')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSubTab === 'preview'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Pratinjau Data (10 Baris)</span>
              </button>

              <button
                onClick={() => setActiveSubTab('mapping')}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeSubTab === 'mapping'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Pemetaan Kolom</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetFile}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/60 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ganti File</span>
              </button>

              <button
                disabled={isProcessing}
                onClick={handleConfirmAndProcess}
                className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-md shadow-cyan-500/20"
              >
                {isProcessing ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Konfirmasi & Simpan</span>
              </button>
            </div>
          </div>

          {/* Subtab Content */}
          {activeSubTab === 'preview' ? (
            <PreviewTable uploadState={currentState} />
          ) : (
            <ColumnMapper
              headers={currentState.headers}
              previewRows={currentState.previewRows}
              columnMapping={currentState.columnMapping}
              fileType={selectedFileType}
              onMappingChange={handleMappingChange}
            />
          )}
        </div>
      )}

      {/* Global Status & Quick Navigation */}
      <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-xs">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <span className="text-slate-600 dark:text-slate-300">
            Status Berkas: <strong className="text-slate-900 dark:text-white">{completedCount} dari 3</strong> berkas telah diunggah dan siap.
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {fileStates.master && fileStates.kosong && (
            <button
              onClick={() => {
                const count = processAndBridgeCandidateMatches(fileStates, true);
                showToast(`Pencocokan spasial selesai dieksekusi! ${count} kandidat siap.`);
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-cyan-800 dark:text-cyan-200 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950 dark:hover:bg-cyan-900 border border-cyan-300 dark:border-cyan-800 transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Jalankan Ulang Rekonsiliasi</span>
            </button>
          )}

          {onNavigateToMatching && (
            <button
              onClick={() => {
                processAndBridgeCandidateMatches(fileStates);
                onNavigateToMatching();
              }}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all shadow-md group"
            >
              <span>Buka Halaman Pencocokan Spasial</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
