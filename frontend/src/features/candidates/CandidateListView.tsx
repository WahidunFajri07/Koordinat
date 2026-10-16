import { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Search, 
  Sliders, 
  MapPin, 
  Check, 
  Download,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { CandidateMatch, CandidateFilters } from './types';
import { INITIAL_CANDIDATE_MATCHES } from './mockData';
import { SpatialMap } from './SpatialMap';
import { LeafletSpatialMap } from './LeafletSpatialMap';
import { useAuth } from '../auth/AuthContext';

function sanitizeCandidateMatches(list: CandidateMatch[]): CandidateMatch[] {
  return list.map((m) => {
    const dist = typeof m.distanceMeters === 'number' ? m.distanceMeters : parseFloat(String(m.distanceMeters)) || 0;
    // Aturan Bisnis: Kandidat dengan jarak <= 5.0 meter otomatis terdeteksi valid (kecuali jika ditolak analis)
    if (dist <= 5.0 && m.status !== 'invalid') {
      return {
        ...m,
        distanceMeters: dist,
        status: 'valid' as const,
        validatedBy: m.validatedBy || 'Sistem Deteksi Spasial (≤ 5m)',
        validatedAt: m.validatedAt || new Date().toLocaleString('id-ID'),
      };
    }
    return {
      ...m,
      distanceMeters: dist,
    };
  });
}

function loadCandidateMatches(): CandidateMatch[] {
  try {
    const raw = localStorage.getItem('pln_candidate_matches_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as CandidateMatch[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const sanitized = sanitizeCandidateMatches(parsed);
        try {
          localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(sanitized));
        } catch {
          // ignore
        }
        return sanitized;
      }
    }
  } catch {
    // fallback to sample
  }
  const defaultList = sanitizeCandidateMatches(INITIAL_CANDIDATE_MATCHES);
  try {
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(defaultList));
  } catch {
    // ignore
  }
  return defaultList;
}

export function CandidateListView() {
  const { user, canAccess } = useAuth();
  const [matches, setMatches] = useState<CandidateMatch[]>(loadCandidateMatches);
  const [selectedMatchId, setSelectedMatchId] = useState<string>(() => {
    const loaded = loadCandidateMatches();
    return loaded[0]?.id || '';
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Default max distance set to 5 meters per business requirement
  const [filters, setFilters] = useState<CandidateFilters>({
    status: 'all',
    search: '',
    maxDistance: 5,
    matchType: 'all',
  });
  const [mapViewMode, setMapViewMode] = useState<'leaflet' | 'tolerance'>('leaflet');

  useEffect(() => {
    const onCandidatesUpdated = () => {
      try {
        const raw = localStorage.getItem('pln_candidate_matches_v1');
        if (raw) {
          const parsed = JSON.parse(raw) as CandidateMatch[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const sanitized = sanitizeCandidateMatches(parsed);
            setMatches(sanitized);
            setSelectedMatchId((prev) => {
              if (sanitized.some((p) => p.id === prev)) return prev;
              return sanitized[0]?.id || '';
            });
          }
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener('pln-candidates-updated', onCandidatesUpdated);
    window.addEventListener('storage', onCandidatesUpdated);
    return () => {
      window.removeEventListener('pln-candidates-updated', onCandidatesUpdated);
      window.removeEventListener('storage', onCandidatesUpdated);
    };
  }, []);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) || matches[0] || null,
    [matches, selectedMatchId]
  );

  // Filter matches
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filters.status !== 'all' && m.status !== filters.status) return false;
      if (m.distanceMeters > filters.maxDistance) return false;
      if (filters.matchType !== 'all' && m.matchType !== filters.matchType) return false;

      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchIdpel = m.masterIdpel.toLowerCase().includes(query);
        const matchAddr = m.surveyAddress.toLowerCase().includes(query);
        if (!matchIdpel && !matchAddr) return false;
      }

      return true;
    });
  }, [matches, filters]);

  // Status counters
  const stats = useMemo(() => {
    const total = matches.length;
    const valid = matches.filter((m) => m.status === 'valid').length;
    const invalid = matches.filter((m) => m.status === 'invalid').length;
    const unresolved = matches.filter((m) => m.status === 'unresolved').length;
    return { total, valid, invalid, unresolved };
  }, [matches]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleValidate = (id: string, status: 'valid' | 'invalid') => {
    if (!canAccess('validate')) {
      showToast('Akses Dibatasi: Peran Anda tidak memiliki izin untuk memvalidasi kandidat.');
      return;
    }

    setMatches((prev) => {
      const next = prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status,
              validatedBy: user.email,
              validatedAt: new Date().toLocaleString('id-ID'),
            }
          : m
      );
      try {
        localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    const target = matches.find((m) => m.id === id);
    const label = status === 'valid' ? 'Validasi Disetujui' : 'Kandidat Ditolak';
    showToast(`${label} untuk IDPEL ${target?.masterIdpel}`);
  };

  const handleExportValidatedCsv = () => {
    const validItems = matches.filter((m) => m.status === 'valid');
    if (validItems.length === 0) {
      showToast('Belum ada kandidat yang divalidasi sebagai Valid untuk diekspor.');
      return;
    }

    const headers = [
      'IDPEL_MASTER',
      'KOSONG_LATITUDE',
      'KOSONG_LONGITUDE',
      'MASTER_LATITUDE',
      'MASTER_LONGITUDE',
      'JARAK_METER',
      'TIPE_MATCH',
      'TARIF',
      'DAYA',
      'DIVALIDASI_OLEH',
      'TANGGAL_VALIDASI',
    ];

    const rows = validItems.map((m) => [
      m.masterIdpel,
      m.kosongCoords[0],
      m.kosongCoords[1],
      m.masterCoords[0],
      m.masterCoords[1],
      m.distanceMeters.toFixed(2),
      m.matchType,
      m.tariff,
      m.power,
      m.validatedBy || user.email,
      m.validatedAt || new Date().toISOString(),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `hasil_rekonsiliasi_valid_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Berhasil mengunduh ${validItems.length} data rekonsiliasi tervalidasi.`);
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

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-slate-500 dark:text-slate-400 text-xs">Total Kandidat Spasial</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Toleransi ST_DWithin 5m (Default)</span>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-emerald-600 dark:text-emerald-400 text-xs">Tervalidasi Cocok (≤ 5m)</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300 mt-1">{stats.valid}</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Siap diekspor ke Master</span>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-amber-600 dark:text-amber-400 text-xs">Perlu Review (&gt; 5m)</span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1">{stats.unresolved}</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Melebihi toleransi default</span>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-rose-600 dark:text-rose-400 text-xs">Ditolak / Anomali</span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-300 mt-1">{stats.invalid}</div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Tidak sesuai survei</span>
        </div>
      </div>

      {/* Main Grid: Left = List & Filters, Right = Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Controls & Candidates List */}
        <div className="lg:col-span-5 space-y-4">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari IDPEL atau nama jalan..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              {[
                { key: 'all', label: `Semua (${stats.total})` },
                { key: 'valid', label: `Valid (${stats.valid})` },
                { key: 'unresolved', label: `Review (${stats.unresolved})` },
                { key: 'invalid', label: `Ditolak (${stats.invalid})` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilters({ ...filters, status: t.key as any })}
                  className={`flex-1 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                    filters.status === t.key
                      ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tolerance Distance Slider with 5m Default */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-cyan-500" />
                  Maksimal Toleransi Jarak:
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-cyan-600 dark:text-cyan-400 font-bold font-mono text-xs">
                    {filters.maxDistance} Meter
                  </span>
                  {filters.maxDistance !== 5 && (
                    <button
                      onClick={() => setFilters({ ...filters, maxDistance: 5 })}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-mono hover:underline"
                      title="Kembalikan ke toleransi default 5 meter"
                    >
                      Reset 5m
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={filters.maxDistance}
                onChange={(e) => setFilters({ ...filters, maxDistance: Number(e.target.value) })}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                <button type="button" onClick={() => setFilters({ ...filters, maxDistance: 0 })} className="hover:text-cyan-500">0m (Exact)</button>
                <button type="button" onClick={() => setFilters({ ...filters, maxDistance: 5 })} className="hover:text-cyan-500 font-bold text-cyan-600 dark:text-cyan-400">5m (Default)</button>
                <button type="button" onClick={() => setFilters({ ...filters, maxDistance: 10 })} className="hover:text-cyan-500">10m</button>
                <button type="button" onClick={() => setFilters({ ...filters, maxDistance: 25 })} className="hover:text-cyan-500">25m</button>
                <button type="button" onClick={() => setFilters({ ...filters, maxDistance: 50 })} className="hover:text-cyan-500">50m</button>
              </div>
            </div>
          </div>

          {/* Candidate Items List */}
          <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
            {filteredMatches.length > 0 ? (
              filteredMatches.map((item) => {
                const isSelected = selectedMatch?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMatchId(item.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-50/70 dark:bg-slate-800/95 border-cyan-500 shadow-md shadow-cyan-500/10 scale-[1.01]'
                        : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold flex items-center justify-center border border-slate-200 dark:border-slate-700">
                          #{item.rank}
                        </span>
                        <div>
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block">
                            {item.masterIdpel}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {item.surveyAddress}
                          </span>
                        </div>
                      </div>

                      {/* Distance Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                          item.distanceMeters === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : item.distanceMeters <= 5
                            ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {item.distanceMeters === 0 ? '0.0m (Exact)' : `${item.distanceMeters.toFixed(1)}m`}
                      </span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{item.tariff}/{item.power}</span>
                        <span>•</span>
                        <span
                          className={`capitalize font-bold ${
                            item.status === 'valid'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : item.status === 'invalid'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {item.status === 'valid' ? 'Tervalidasi' : item.status === 'invalid' ? 'Ditolak' : 'Menunggu Review'}
                        </span>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleValidate(item.id, 'valid')}
                          title="Validasi Cocok"
                          className={`p-1.5 rounded-lg border transition-colors ${
                            item.status === 'valid'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 hover:text-emerald-700 dark:hover:text-emerald-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleValidate(item.id, 'invalid')}
                          title="Tolak Match"
                          className={`p-1.5 rounded-lg border transition-colors ${
                            item.status === 'invalid'
                              ? 'bg-rose-600 text-white border-rose-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-950 hover:text-rose-700 dark:hover:text-rose-400 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-500 text-xs space-y-2">
                <AlertCircle className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-600" />
                <p>Tidak ada kandidat cocok dalam radius toleransi {filters.maxDistance} meter.</p>
                {filters.maxDistance < 25 && (
                  <button
                    onClick={() => setFilters({ ...filters, maxDistance: 25 })}
                    className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold underline mt-1"
                  >
                    Perluas toleransi ke 25 meter
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): Spatial Map & Action Header */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Peta Spasial Jaringan & Klaster (Toleransi 5m)</h3>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center space-x-2">
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 flex items-center space-x-1 text-xs">
                <button
                  onClick={() => setMapViewMode('leaflet')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    mapViewMode === 'leaflet'
                      ? 'bg-cyan-600 text-white font-bold shadow'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Peta Klaster & JTR (OSM)
                </button>
                <button
                  onClick={() => setMapViewMode('tolerance')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    mapViewMode === 'tolerance'
                      ? 'bg-cyan-600 text-white font-bold shadow'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Inspektur Toleransi 5m
                </button>
              </div>

              <button
                onClick={() => {
                  const fresh = sanitizeCandidateMatches(INITIAL_CANDIDATE_MATCHES);
                  setMatches(fresh);
                  setSelectedMatchId(fresh[0]?.id || '');
                  try {
                    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(fresh));
                    window.dispatchEvent(new Event('pln-candidates-updated'));
                  } catch {
                    // ignore
                  }
                  showToast('Data kandidat berhasil disinkronkan ke default toleransi 5m (5 kandidat valid).');
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all shadow-sm"
                title="Reset dan sinkronkan data ke toleransi 5m default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset 5m</span>
              </button>

              <button
                onClick={handleExportValidatedCsv}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-cyan-700 dark:text-cyan-300 text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor ({stats.valid})</span>
              </button>
            </div>
          </div>

          {/* Interactive Map Component based on mode */}
          {mapViewMode === 'leaflet' ? (
            <LeafletSpatialMap
              matches={matches}
              selectedMatchId={selectedMatch?.id}
              onSelectMatch={(m) => {
                setSelectedMatchId(m.id);
                showToast(`Memilih titik kandidat IDPEL: ${m.masterIdpel} (${m.distanceMeters.toFixed(1)}m)`);
              }}
              onValidateMatch={(id, status) => {
                handleValidate(id, status);
              }}
            />
          ) : (
            <SpatialMap
              selectedMatch={selectedMatch}
              allMatches={filteredMatches}
              onSelectMatch={(m) => setSelectedMatchId(m.id)}
            />
          )}

          {/* Selected Candidate Action Card */}
          {selectedMatch && (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Konfirmasi Rekonsiliasi IDPEL {selectedMatch.masterIdpel}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Menghubungkan titik survei kosong [{selectedMatch.kosongCoords.join(', ')}] dengan pelanggan Master.
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-[11px] font-mono font-bold block ${
                    selectedMatch.distanceMeters <= 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {selectedMatch.distanceMeters.toFixed(2)} Meter
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                    {selectedMatch.distanceMeters <= 5 ? 'Dalam Toleransi 5m' : 'Luar Toleransi 5m'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-1">
                <button
                  onClick={() => handleValidate(selectedMatch.id, 'invalid')}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedMatch.status === 'invalid'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                      : 'bg-rose-50 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-slate-700'
                  }`}
                >
                  <XCircle className="w-4 h-4" />
                  <span>Tolak (Tidak Valid)</span>
                </button>

                <button
                  onClick={() => handleValidate(selectedMatch.id, 'valid')}
                  className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedMatch.status === 'valid'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Validasi & Tautkan IDPEL</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
