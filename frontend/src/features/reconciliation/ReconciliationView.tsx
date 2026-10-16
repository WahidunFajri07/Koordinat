import { useState, useMemo, useCallback } from 'react';
import {
  Play,
  Download,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Layers,
  Zap,
  Filter,
  Search,
  BarChart3,
  Clock,
  Database,
  ShieldCheck,
  MapPin,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { FileType, ColumnRole } from '../upload/types';
import { parseCsvSnippet, autoDetectAllColumns } from '../upload/utils/parser';
import { runReconciliationPipeline } from './reconciliationEngine';
import type { PipelineState, ReconciliationMatch } from './types';
import type { CandidateMatch } from '../candidates/types';

// ─── Sample data for 1-click demo ──────────────────────────────────

const DEMO_MASTER_CSV = `idpel,koordinat_x,koordinat_y,tglbaca,jenis_pel
531000000001,106.650065,-6.649032,05,PASCA
531000000002,110.918827,-7.398221,12,PRABAYAR
531000000003,107.021633,-6.194077,05,PASCA
531000000004,107.811828,-7.746365,20,PRABAYAR
531000000005,107.693026,-7.752235,15,PASCA
531000000006,106.849201,-6.211044,05,PASCA
531000000007,107.609810,-6.914744,12,PRABAYAR
531000000008,106.812340,-6.223401,20,PASCA
531000000009,112.752088,-7.257472,15,PRABAYAR
531000000010,106.827153,-6.175392,05,PASCA
531000000001,106.650065,-6.649032,12,PASCA
531000000003,107.021633,-6.194077,20,PASCA
531000000011,106.845600,-6.208800,05,PASCA
531000000012,106.849300,-6.211180,12,PRABAYAR
531000000013,106.841225,-6.205435,20,PASCA
531000000014,106.848500,-6.202300,05,PRABAYAR
531000000015,106.843525,-6.214530,15,PASCA`;

const DEMO_PDPJ_CSV = `NO_IDPEL_VALID
531000000003
531000000005
531000000008
531000000010`;

const DEMO_KOSONG_CSV = `KOORDINAT_TITIK
"-6.649040,106.650070"
"-7.398230,110.918835"
"-6.194085,107.021640"
"-6.211050,106.849210"
"-6.208810,106.845610"
"-6.205440,106.841230"
"-6.202305,106.848510"
"-6.914750,107.609815"
"-6.223410,106.812345"
"-7.257480,112.752095"`;

// ─── Helper: parse a demo CSV string into rows + mapping ───────────

function parseDemoFile(csv: string, fileType: FileType) {
  const { headers, previewRows, totalRowsEstimated } = parseCsvSnippet(csv, 1000);
  const mapping = autoDetectAllColumns(headers, previewRows, fileType);
  return { headers, rows: previewRows, totalRows: totalRowsEstimated, mapping };
}

// ─── Helper: parse full CSV into all rows (not just 10 preview) ─────

function parseFullCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rawLines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (rawLines.length === 0) return { headers: [], rows: [] };

  const firstLine = rawLines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        if (inQuote && line[i + 1] === char) {
          cur += char;
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === delimiter && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(rawLines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim()).filter((h) => h.length > 0);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitLine(rawLines[i]).map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;
    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = cols[index] !== undefined ? cols[index] : '';
    });
    rows.push(rowObj);
  }

  return { headers, rows };
}

// ─── Main Component ─────────────────────────────────────────────────

interface UploadedFile {
  file: File | null;
  filename: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  mapping: Record<string, ColumnRole>;
  fileType: FileType;
}

export function ReconciliationView() {
  // File states for all 3 inputs
  const [files, setFiles] = useState<Record<FileType, UploadedFile | null>>({
    master: null,
    pdpj: null,
    kosong: null,
  });

  const [toleranceMeters, setToleranceMeters] = useState(5);
  const [pipelineResult, setPipelineResult] = useState<PipelineState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('upload');
  const [matchFilter, setMatchFilter] = useState('');
  const [showOnlyRank1, setShowOnlyRank1] = useState(true);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── File handling ──────────────────────────────────────────────

  const handleFileUpload = useCallback(async (fileType: FileType, file: File) => {
    try {
      const text = await file.text();
      const { headers, rows } = parseFullCsv(text);
      const previewRows = rows.slice(0, 10);
      const mapping = autoDetectAllColumns(headers, previewRows, fileType);

      setFiles((prev) => ({
        ...prev,
        [fileType]: {
          file,
          filename: file.name,
          headers,
          rows,
          totalRows: rows.length,
          mapping,
          fileType,
        },
      }));
      showToast(`File ${file.name} berhasil dimuat (${rows.length.toLocaleString('id-ID')} baris)`);
    } catch {
      showToast('Gagal membaca file. Pastikan format CSV valid.');
    }
  }, [showToast]);

  const handleLoadDemo = useCallback(() => {
    const masterData = parseDemoFile(DEMO_MASTER_CSV, 'master');
    const pdpjData = parseDemoFile(DEMO_PDPJ_CSV, 'pdpj');
    const kosongData = parseDemoFile(DEMO_KOSONG_CSV, 'kosong');

    setFiles({
      master: {
        file: null,
        filename: 'demo_master.csv',
        headers: masterData.headers,
        rows: masterData.rows,
        totalRows: masterData.totalRows,
        mapping: masterData.mapping,
        fileType: 'master',
      },
      pdpj: {
        file: null,
        filename: 'demo_pdpj.csv',
        headers: pdpjData.headers,
        rows: pdpjData.rows,
        totalRows: pdpjData.totalRows,
        mapping: pdpjData.mapping,
        fileType: 'pdpj',
      },
      kosong: {
        file: null,
        filename: 'demo_kosong.csv',
        headers: kosongData.headers,
        rows: kosongData.rows,
        totalRows: kosongData.totalRows,
        mapping: kosongData.mapping,
        fileType: 'kosong',
      },
    });

    setPipelineResult(null);
    showToast('Data demo berhasil dimuat untuk ketiga file. Siap diproses!');
  }, [showToast]);

  const handleMappingChange = useCallback((fileType: FileType, column: string, role: ColumnRole) => {
    setFiles((prev) => {
      const f = prev[fileType];
      if (!f) return prev;
      return {
        ...prev,
        [fileType]: {
          ...f,
          mapping: { ...f.mapping, [column]: role },
        },
      };
    });
  }, []);

  const handleResetFile = useCallback((fileType: FileType) => {
    setFiles((prev) => ({ ...prev, [fileType]: null }));
    setPipelineResult(null);
  }, []);

  const handleResetAll = useCallback(() => {
    setFiles({ master: null, pdpj: null, kosong: null });
    setPipelineResult(null);
  }, []);

  // ─── Run Pipeline ─────────────────────────────────────────────

  const allFilesReady = files.master && files.pdpj && files.kosong;

  const handleRunPipeline = useCallback(() => {
    if (!files.master || !files.pdpj || !files.kosong) return;

    setIsProcessing(true);
    setPipelineResult(null);

    // Use requestAnimationFrame to let the UI update before heavy computation
    requestAnimationFrame(() => {
      setTimeout(() => {
        const result = runReconciliationPipeline(
          files.master!.rows,
          files.master!.mapping,
          files.pdpj!.rows,
          files.pdpj!.mapping,
          files.kosong!.rows,
          files.kosong!.mapping,
          toleranceMeters
        );

        setPipelineResult(result);
        setIsProcessing(false);
        setExpandedSection('results');

        // Bridge results to candidate list/map
        if (result.stage === 'complete') {
          try {
            const bridged: CandidateMatch[] = result.matches.map((m) => {
              const dist = Number(m.distanceMeters);
              const isValidByTolerance = dist <= toleranceMeters;
              return {
                id: m.id,
                kosongId: `kosong-${m.kosong.rowIndex}`,
                kosongCoords: [m.kosong.latitude, m.kosong.longitude],
                surveyAddress: m.kosong.raw?.alamatlengkap || m.kosong.raw?.alamat || '',
                masterId: `master-${m.master.rowIndex}`,
                masterIdpel: m.master.idpel,
                masterCoords: [m.master.latitude, m.master.longitude],
                distanceMeters: dist,
                matchType: dist === 0 ? 'exact' : 'spatial',
                rank: m.rank,
                status: isValidByTolerance ? 'valid' : 'unresolved',
                validatedBy: isValidByTolerance ? `Sistem Deteksi Spasial (≤ ${toleranceMeters}m)` : undefined,
                validatedAt: isValidByTolerance ? new Date().toLocaleString('id-ID') : undefined,
                tariff: m.master.raw?.tarif || '',
                power: m.master.raw?.daya || '',
              };
            });
            localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(bridged));
            window.dispatchEvent(new Event('pln-candidates-updated'));
          } catch {
            // ignore storage issues
          }
        }

        if (result.stage === 'complete') {
          showToast(
            `Pipeline selesai dalam ${result.stats.processingTimeMs}ms — ${result.stats.totalMatchCandidates} kandidat ditemukan`
          );
        } else {
          showToast(`Error: ${result.errorMessage || 'Gagal memproses pipeline'}`);
        }
      }, 50);
    });
  }, [files, toleranceMeters, showToast]);

  // ─── Export CSV ─────────────────────────────────────────────────

  const handleExportCsv = useCallback(() => {
    if (!pipelineResult || pipelineResult.matches.length === 0) {
      showToast('Tidak ada hasil untuk diekspor.');
      return;
    }

    const headers = [
      'IDPEL_MASTER',
      'MASTER_LAT',
      'MASTER_LON',
      'KOSONG_LAT',
      'KOSONG_LON',
      'JARAK_METER',
      'RANK',
    ];

    const csvRows = pipelineResult.matches.map((m) => [
      m.master.idpel,
      m.master.latitude.toFixed(6),
      m.master.longitude.toFixed(6),
      m.kosong.latitude.toFixed(6),
      m.kosong.longitude.toFixed(6),
      m.distanceMeters.toFixed(2),
      m.rank.toString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n');

    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `rekonsiliasi_hasil_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Berhasil mengekspor ${pipelineResult.matches.length} hasil rekonsiliasi.`);
  }, [pipelineResult, showToast]);

  // ─── Filtered matches ──────────────────────────────────────────

  const filteredMatches = useMemo(() => {
    if (!pipelineResult) return [];
    let list = pipelineResult.matches;
    if (showOnlyRank1) {
      list = list.filter((m) => m.rank === 1);
    }
    if (matchFilter) {
      const q = matchFilter.toLowerCase();
      list = list.filter(
        (m) =>
          m.master.idpel.toLowerCase().includes(q) ||
          m.distanceMeters.toFixed(2).includes(q)
      );
    }
    return list;
  }, [pipelineResult, matchFilter, showOnlyRank1]);

  // ─── Counts ─────────────────────────────────────────────────────

  const uploadedCount = [files.master, files.pdpj, files.kosong].filter(Boolean).length;

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-cyan-950 border border-cyan-500/50 text-cyan-200 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 text-xs animate-slide-up max-w-md">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" />
            Pipeline Rekonsiliasi
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Master (dedup) → Exclude PDPJ → Cocokkan Koordinat Kosong
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800/80 text-cyan-300 text-xs font-medium rounded-lg transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Muat Data Demo</span>
          </button>
          {uploadedCount > 0 && (
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-medium rounded-lg transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Semua</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1: Upload & Column Mapping
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'upload' ? null : 'upload')}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              1
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-white">Unggah & Pemetaan Kolom</h3>
              <p className="text-[11px] text-slate-400">
                {uploadedCount}/3 file telah dimuat
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {uploadedCount === 3 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Lengkap
              </span>
            )}
            {expandedSection === 'upload' ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </button>

        {expandedSection === 'upload' && (
          <div className="px-4 pb-5 space-y-4 border-t border-slate-800">
            {/* 3 file upload cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <FileUploadCard
                fileType="master"
                label="Data Master"
                description="Gabungan Pasca + Prabayar (ACMT RBM + LPB)"
                icon={<Database className="w-4 h-4" />}
                accentColor="cyan"
                uploadedFile={files.master}
                onFileUpload={handleFileUpload}
                onMappingChange={handleMappingChange}
                onReset={handleResetFile}
              />
              <FileUploadCard
                fileType="pdpj"
                label="Data PDPJ"
                description="IDPEL yang sudah terverifikasi valid"
                icon={<ShieldCheck className="w-4 h-4" />}
                accentColor="emerald"
                uploadedFile={files.pdpj}
                onFileUpload={handleFileUpload}
                onMappingChange={handleMappingChange}
                onReset={handleResetFile}
              />
              <FileUploadCard
                fileType="kosong"
                label="Koordinat Kosong"
                description="IDPEL kosong & tidak ditemukan"
                icon={<MapPin className="w-4 h-4" />}
                accentColor="amber"
                uploadedFile={files.kosong}
                onFileUpload={handleFileUpload}
                onMappingChange={handleMappingChange}
                onReset={handleResetFile}
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2: Pipeline Controls
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Jalankan Pipeline</h3>
              <p className="text-[11px] text-slate-400">
                Dedup → Exclude PDPJ → Spatial Match
              </p>
            </div>
          </div>

          <button
            disabled={!allFilesReady || isProcessing}
            onClick={handleRunPipeline}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              allFilesReady && !isProcessing
                ? 'bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 text-slate-950 shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{isProcessing ? 'Memproses...' : 'Proses Rekonsiliasi'}</span>
          </button>
        </div>

        {/* Tolerance slider */}
        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-cyan-400" />
              Toleransi Radius Pencocokan:
            </span>
            <span className="text-cyan-400 font-bold font-mono">{toleranceMeters} Meter</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={toleranceMeters}
            onChange={(e) => setToleranceMeters(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>1m</span>
            <span>5m (Default)</span>
            <span>50m</span>
            <span>100m</span>
          </div>
        </div>

        {/* Pipeline visualization */}
        {!pipelineResult && allFilesReady && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg">
              <Database className="w-3 h-3 text-cyan-400" />
              <span>Master ({files.master?.totalRows.toLocaleString('id-ID')})</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>− PDPJ ({files.pdpj?.totalRows.toLocaleString('id-ID')})</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg">
              <MapPin className="w-3 h-3 text-amber-400" />
              <span>∩ Kosong ({files.kosong?.totalRows.toLocaleString('id-ID')})</span>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3: Results
         ═══════════════════════════════════════════════════════════ */}
      {pipelineResult && pipelineResult.stage === 'complete' && (
        <div className="space-y-5">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard
              label="Master Awal"
              value={pipelineResult.stats.masterRawCount}
              color="cyan"
              icon={<Database className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Duplikat Dihapus"
              value={pipelineResult.stats.masterDuplicatesRemoved}
              color="amber"
              icon={<Layers className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="PDPJ Dieksklusi"
              value={pipelineResult.stats.pdpjExcludedCount}
              color="emerald"
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Master Tersisa"
              value={pipelineResult.stats.masterAfterExcludeCount}
              color="blue"
              icon={<Filter className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Kosong Cocok"
              value={pipelineResult.stats.matchedKosongCount}
              color="teal"
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Tidak Cocok"
              value={pipelineResult.stats.unmatchedKosongCount}
              color="rose"
              icon={<XCircle className="w-3.5 h-3.5" />}
            />
          </div>

          {/* Pipeline flow summary */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">Ringkasan Pipeline</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                <span className="font-mono">{pipelineResult.stats.processingTimeMs}ms</span>
              </div>
            </div>

            {/* Visual flow */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <FlowNode
                label="Master"
                count={pipelineResult.stats.masterRawCount}
                color="cyan"
              />
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <FlowNode
                label="Dedup"
                count={pipelineResult.stats.masterDedupCount}
                color="blue"
                badge={`−${pipelineResult.stats.masterDuplicatesRemoved}`}
              />
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <FlowNode
                label="− PDPJ"
                count={pipelineResult.stats.masterAfterExcludeCount}
                color="emerald"
                badge={`−${pipelineResult.stats.pdpjExcludedCount}`}
              />
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <FlowNode
                label={`∩ Kosong (≤${pipelineResult.toleranceMeters}m)`}
                count={pipelineResult.stats.matchedKosongCount}
                color="amber"
                badge={`dari ${pipelineResult.stats.kosongCount}`}
              />
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <FlowNode
                label="Kandidat"
                count={pipelineResult.stats.totalMatchCandidates}
                color="teal"
              />
            </div>
          </div>

          {/* Match Results Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white">
                  Hasil Pencocokan ({filteredMatches.length} kandidat)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari IDPEL..."
                    value={matchFilter}
                    onChange={(e) => setMatchFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 w-40 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Toggle rank 1 only */}
                <button
                  onClick={() => setShowOnlyRank1(!showOnlyRank1)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors ${
                    showOnlyRank1
                      ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                  <span>Hanya Rank #1</span>
                </button>

                {/* Export */}
                <button
                  onClick={handleExportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold rounded-lg border border-slate-700 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-10">
                    <th className="py-2.5 px-3 text-[11px] font-mono text-slate-500 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400">IDPEL Master</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400">Master (Lat, Lon)</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400">Kosong (Lat, Lon)</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 text-right">Jarak (m)</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold text-slate-400 text-center">Rank</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {filteredMatches.length > 0 ? (
                    filteredMatches.map((m, idx) => (
                      <MatchRow key={m.id} match={m} index={idx} />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Tidak ada hasil ditemukan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmatched Koordinat Kosong */}
          {pipelineResult.unmatchedKosong.length > 0 && (
            <div className="bg-slate-900/60 border border-amber-800/40 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-300">
                  Koordinat Kosong Tidak Ditemukan ({pipelineResult.unmatchedKosong.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Titik koordinat berikut tidak memiliki Master pelanggan dalam radius {toleranceMeters}m.
              </p>
              <div className="flex flex-wrap gap-2">
                {pipelineResult.unmatchedKosong.slice(0, 20).map((k, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono px-2 py-1 bg-amber-950/40 border border-amber-800/60 text-amber-300 rounded-lg"
                  >
                    ({k.latitude.toFixed(4)}, {k.longitude.toFixed(4)})
                  </span>
                ))}
                {pipelineResult.unmatchedKosong.length > 20 && (
                  <span className="text-[10px] text-slate-500">
                    ...dan {pipelineResult.unmatchedKosong.length - 20} lainnya
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error state */}
      {pipelineResult && pipelineResult.stage === 'error' && (
        <div className="bg-rose-950/30 border border-rose-800/60 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-rose-400" />
            <span className="text-sm font-bold text-rose-300">Pipeline Gagal</span>
          </div>
          <p className="text-xs text-rose-200/70">{pipelineResult.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────

function FileUploadCard({
  fileType,
  label,
  description,
  icon,
  accentColor,
  uploadedFile,
  onFileUpload,
  onMappingChange,
  onReset,
}: {
  fileType: FileType;
  label: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  uploadedFile: UploadedFile | null;
  onFileUpload: (fileType: FileType, file: File) => void;
  onMappingChange: (fileType: FileType, column: string, role: ColumnRole) => void;
  onReset: (fileType: FileType) => void;
}) {
  const [showMapping, setShowMapping] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const accentClasses: Record<string, { border: string; text: string; bg: string }> = {
    cyan: { border: 'border-cyan-500/60', text: 'text-cyan-400', bg: 'bg-cyan-950' },
    emerald: { border: 'border-emerald-500/60', text: 'text-emerald-400', bg: 'bg-emerald-950' },
    amber: { border: 'border-amber-500/60', text: 'text-amber-400', bg: 'bg-amber-950' },
  };
  const accent = accentClasses[accentColor] || accentClasses.cyan;

  const roleOptions: { role: ColumnRole; label: string }[] = [
    { role: 'idpel', label: 'ID Pelanggan' },
    { role: 'longitude', label: 'Longitude (X)' },
    { role: 'latitude', label: 'Latitude (Y)' },
    { role: 'coordinate_combined', label: 'Koordinat Gabungan' },
    { role: 'tglbaca', label: 'Tanggal Baca' },
    { role: 'jenis_pel', label: 'Jenis Pelanggan' },
    { role: 'ignore', label: 'Abaikan' },
  ];

  if (uploadedFile) {
    return (
      <div className={`border ${accent.border} rounded-xl p-4 bg-slate-900/80 space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={accent.text}>{icon}</span>
            <span className="text-xs font-bold text-white">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Siap
            </span>
            <button
              onClick={() => onReset(fileType)}
              className="p-1 text-rose-400 hover:bg-rose-950/50 rounded-md transition-colors"
              title="Hapus file"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-3 h-3 text-slate-500" />
            <span className="truncate font-medium text-slate-300">{uploadedFile.filename}</span>
          </div>
          <div className="text-[10px]">
            {uploadedFile.totalRows.toLocaleString('id-ID')} baris • {uploadedFile.headers.length} kolom
          </div>
        </div>

        {/* Column mapping toggle */}
        <button
          onClick={() => setShowMapping(!showMapping)}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 transition-colors"
        >
          {showMapping ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>{showMapping ? 'Sembunyikan' : 'Lihat'} Pemetaan Kolom</span>
        </button>

        {showMapping && (
          <div className="space-y-2 border-t border-slate-800 pt-2">
            {uploadedFile.headers.map((col) => {
              const role = uploadedFile.mapping[col] || 'ignore';
              return (
                <div key={col} className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-300 truncate max-w-[100px]" title={col}>
                    {col}
                  </span>
                  <select
                    value={role}
                    onChange={(e) => onMappingChange(fileType, col, e.target.value as ColumnRole)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-cyan-400"
                  >
                    {roleOptions.map((opt) => (
                      <option key={opt.role} value={opt.role}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Upload zone (not yet uploaded)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onFileUpload(fileType, file);
      }}
      className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group ${
        isDragOver
          ? `${accent.border} ${accent.bg}/30 scale-[1.01]`
          : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600'
      }`}
      onClick={() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) onFileUpload(fileType, file);
        };
        input.click();
      }}
    >
      <div className="space-y-2">
        <div className={`w-10 h-10 rounded-xl ${accent.bg} ${accent.text} flex items-center justify-center mx-auto border border-slate-700 group-hover:scale-110 transition-transform`}>
          {icon}
        </div>
        <div className="text-sm font-bold text-white">{label}</div>
        <p className="text-[11px] text-slate-400">{description}</p>
        <div className="text-[10px] text-slate-500">Tarik file atau klik untuk unggah (.csv)</div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    teal: 'text-teal-400',
    rose: 'text-rose-400',
  };
  const textColor = colorClasses[color] || 'text-slate-400';

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1">
      <div className={`flex items-center gap-1 text-xs ${textColor}`}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold text-white font-mono">
        {value.toLocaleString('id-ID')}
      </div>
    </div>
  );
}

function FlowNode({
  label,
  count,
  color,
  badge,
}: {
  label: string;
  count: number;
  color: string;
  badge?: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'bg-cyan-950/60 border-cyan-800/60 text-cyan-300',
    blue: 'bg-blue-950/60 border-blue-800/60 text-blue-300',
    emerald: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300',
    amber: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
    teal: 'bg-teal-950/60 border-teal-800/60 text-teal-300',
  };
  const cls = colorClasses[color] || colorClasses.cyan;

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${cls}`}>
      <span className="font-medium">{label}</span>
      <span className="font-bold font-mono">{count.toLocaleString('id-ID')}</span>
      {badge && (
        <span className="text-[9px] px-1 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
          {badge}
        </span>
      )}
    </div>
  );
}

function MatchRow({ match, index }: { match: ReconciliationMatch; index: number }) {
  const distClass =
    match.distanceMeters === 0
      ? 'text-emerald-300'
      : match.distanceMeters <= 10
      ? 'text-cyan-300'
      : 'text-amber-300';

  return (
    <tr className="hover:bg-slate-900/60 transition-colors">
      <td className="py-2 px-3 text-slate-500 text-center border-r border-slate-800/60">
        {index + 1}
      </td>
      <td className="py-2 px-3 text-white font-bold">{match.master.idpel}</td>
      <td className="py-2 px-3 text-slate-400">
        {match.master.latitude.toFixed(5)}, {match.master.longitude.toFixed(5)}
      </td>
      <td className="py-2 px-3 text-slate-400">
        {match.kosong.latitude.toFixed(5)}, {match.kosong.longitude.toFixed(5)}
      </td>
      <td className={`py-2 px-3 text-right font-bold ${distClass}`}>
        {match.distanceMeters === 0 ? '0.00 (Exact)' : match.distanceMeters.toFixed(2)}
      </td>
      <td className="py-2 px-3 text-center">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-bold">
          #{match.rank}
        </span>
      </td>
    </tr>
  );
}
