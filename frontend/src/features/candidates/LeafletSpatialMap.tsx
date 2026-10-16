import { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { 
  Search, 
  ChevronDown, 
  Download, 
  Maximize2, 
  Minimize2, 
  Layers,
  MapPin,
  CheckCircle2,
  XCircle,
  Compass
} from 'lucide-react';
import { CandidateMatch } from './types';

interface LeafletSpatialMapProps {
  matches: CandidateMatch[];
  selectedMatchId?: string;
  onSelectMatch: (match: CandidateMatch) => void;
  onValidateMatch: (id: string, status: 'valid' | 'invalid') => void;
  heightClass?: string;
}

export function LeafletSpatialMap({
  matches,
  selectedMatchId,
  onSelectMatch,
  onValidateMatch,
  heightClass = 'h-[620px]',
}: LeafletSpatialMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer groups for precise control
  const kosongMarkersRef = useRef<L.LayerGroup | null>(null);
  const masterMarkersRef = useRef<L.LayerGroup | null>(null);
  const distanceLinesRef = useRef<L.LayerGroup | null>(null);
  const toleranceCirclesRef = useRef<L.LayerGroup | null>(null);

  // Controls & filter states tailored to reconciliation business needs
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'unresolved' | 'valid' | 'invalid'>('all');
  const [selectedDistanceRange, setSelectedDistanceRange] = useState<'all' | 'exact' | 'under5' | 'under10' | 'under25'>('under5');
  const [selectedPower, setSelectedPower] = useState('all');

  // Layer toggle checkboxes
  const [showKosongLayer, setShowKosongLayer] = useState(true);
  const [showMasterLayer, setShowMasterLayer] = useState(true);
  const [showDistanceLines, setShowDistanceLines] = useState(true);
  const [showToleranceCircles, setShowToleranceCircles] = useState(true);

  // Active match selected
  const activeMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) || matches[0] || null;
  }, [matches, selectedMatchId]);

  // Filtered candidate matches
  const filteredMatches = useMemo(() => {
    return matches.filter((item) => {
      // Status filter
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;

      // Distance range filter (default: under5 - 5 meters tolerance)
      if (selectedDistanceRange === 'exact' && item.distanceMeters > 0.01) return false;
      if (selectedDistanceRange === 'under5' && item.distanceMeters > 5.0) return false;
      if (selectedDistanceRange === 'under10' && item.distanceMeters > 10) return false;
      if (selectedDistanceRange === 'under25' && item.distanceMeters > 25) return false;

      // Power filter
      if (selectedPower !== 'all' && item.power !== selectedPower) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchIdpel = item.masterIdpel.toLowerCase().includes(q);
        const matchKosong = item.kosongId.toLowerCase().includes(q);
        const matchAddr = item.surveyAddress.toLowerCase().includes(q);
        if (!matchIdpel && !matchKosong && !matchAddr) return false;
      }

      return true;
    });
  }, [matches, selectedStatus, selectedDistanceRange, selectedPower, searchQuery]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const initialCenter: [number, number] = matches[0]
      ? matches[0].kosongCoords
      : [-6.2088, 106.8456];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 15,
      zoomControl: true,
    });

    // Real OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Rekonsiliasi PLN',
    }).addTo(map);

    // Create Layer Groups
    toleranceCirclesRef.current = L.layerGroup().addTo(map);
    distanceLinesRef.current = L.layerGroup().addTo(map);
    masterMarkersRef.current = L.layerGroup().addTo(map);
    kosongMarkersRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Markers, Vectors, and Tolerance Radius Rings
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const kosongGroup = kosongMarkersRef.current;
    const masterGroup = masterMarkersRef.current;
    const linesGroup = distanceLinesRef.current;
    const circlesGroup = toleranceCirclesRef.current;

    if (!kosongGroup || !masterGroup || !linesGroup || !circlesGroup) return;

    kosongGroup.clearLayers();
    masterGroup.clearLayers();
    linesGroup.clearLayers();
    circlesGroup.clearLayers();

    filteredMatches.forEach((match) => {
      const isSelected = activeMatch?.id === match.id;

      // Color scheme according to PLN Reconciliation state
      let statusColor = '#f59e0b'; // Amber for unresolved
      if (match.status === 'valid') statusColor = '#10b981'; // Emerald for valid
      if (match.status === 'invalid') statusColor = '#ef4444'; // Red for rejected

      // A. Titik Survei Kosong (Target)
      if (showKosongLayer) {
        const kosongMarker = L.circleMarker(match.kosongCoords, {
          radius: isSelected ? 8.5 : 6,
          fillColor: '#f59e0b',
          color: '#ffffff',
          weight: isSelected ? 3 : 1.5,
          opacity: 1,
          fillOpacity: 0.95,
        });

        kosongMarker.bindTooltip(
          `<div style="font-family: monospace; font-size: 11px;">
            <strong>Titik Survei: ${match.kosongId}</strong><br/>
            <span>Coords: ${match.kosongCoords[0].toFixed(5)}, ${match.kosongCoords[1].toFixed(5)}</span>
          </div>`,
          { direction: 'top', offset: [0, -5] }
        );

        kosongMarker.on('click', () => {
          onSelectMatch(match);
        });

        kosongMarker.addTo(kosongGroup);
      }

      // B. Titik Kandidat Master IDPEL
      if (showMasterLayer) {
        const masterMarker = L.circleMarker(match.masterCoords, {
          radius: isSelected ? 9.5 : 7,
          fillColor: statusColor,
          color: isSelected ? '#ffffff' : '#ffffff',
          weight: isSelected ? 3.5 : 2,
          opacity: 1,
          fillOpacity: 0.95,
        });

        masterMarker.bindTooltip(
          `<div style="font-family: monospace; font-size: 11px;">
            <strong>Master IDPEL: ${match.masterIdpel}</strong><br/>
            <span>Status: ${match.status.toUpperCase()}</span><br/>
            <span>Jarak: ${match.distanceMeters.toFixed(1)} meter</span>
          </div>`,
          { direction: 'bottom', offset: [0, 5] }
        );

        // Rich interactive popup with quick validation buttons
        masterMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 230px;">
            <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 3px; display: flex; justify-content: space-between; align-items: center;">
              <span>IDPEL: ${match.masterIdpel}</span>
              <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: ${statusColor}; color: white; text-transform: uppercase; font-weight: bold;">
                ${match.status === 'valid' ? 'Valid' : match.status === 'invalid' ? 'Ditolak' : 'Menunggu'}
              </span>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">
              ${match.surveyAddress}
            </div>
            <table style="width: 100%; font-size: 11px; margin-bottom: 10px; border-collapse: collapse;">
              <tr><td style="color: #64748b;">Jarak Geodesik:</td><td style="font-weight: bold; color: ${match.distanceMeters === 0 ? '#10b981' : '#0284c7'};">${match.distanceMeters.toFixed(2)} Meter</td></tr>
              <tr><td style="color: #64748b;">Tipe Pencocokan:</td><td style="font-weight: bold; text-transform: uppercase;">${match.matchType}</td></tr>
              <tr><td style="color: #64748b;">Tarif / Daya:</td><td>${match.tariff} / ${match.power}</td></tr>
              <tr><td style="color: #64748b;">Koordinat Survei:</td><td style="font-family: monospace; font-size: 10px;">${match.kosongCoords[0].toFixed(5)}, ${match.kosongCoords[1].toFixed(5)}</td></tr>
              <tr><td style="color: #64748b;">Koordinat Master:</td><td style="font-family: monospace; font-size: 10px;">${match.masterCoords[0].toFixed(5)}, ${match.masterCoords[1].toFixed(5)}</td></tr>
            </table>
          </div>
        `);

        masterMarker.on('click', () => {
          onSelectMatch(match);
        });

        masterMarker.addTo(masterGroup);
      }

      // C. Garis Jarak / Vektor Match
      if (showDistanceLines && match.distanceMeters > 0) {
        L.polyline([match.kosongCoords, match.masterCoords], {
          color: isSelected ? '#06b6d4' : '#64748b',
          weight: isSelected ? 3.5 : 2,
          dashArray: '5, 5',
          opacity: isSelected ? 1 : 0.7,
        }).addTo(linesGroup);
      }

      // D. Lingkaran Radius Toleransi ST_DWithin (5 Meter Geodesik Default)
      if (showToleranceCircles && isSelected) {
        const circle = L.circle(match.kosongCoords, {
          radius: 5, // 5 meters standard tolerance
          color: '#06b6d4',
          weight: 2,
          dashArray: '4, 4',
          fillColor: '#06b6d4',
          fillOpacity: 0.15,
        });
        circle.bindTooltip(`Radius Toleransi Default: 5 Meter (${match.distanceMeters.toFixed(1)}m)`, {
          direction: 'top',
          offset: [0, -5],
        });
        circle.addTo(circlesGroup);
      }
    });
  }, [
    filteredMatches, 
    activeMatch, 
    showKosongLayer, 
    showMasterLayer, 
    showDistanceLines, 
    showToleranceCircles, 
    onSelectMatch, 
    onValidateMatch
  ]);

  // Pan to selected match coordinates
  useEffect(() => {
    if (!activeMatch || !mapInstanceRef.current) return;
    mapInstanceRef.current.panTo(activeMatch.kosongCoords, { animate: true, duration: 0.5 });
  }, [activeMatch]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 200);
  };

  // Reset view to bounds of all points
  const handleFitAll = () => {
    if (!mapInstanceRef.current || filteredMatches.length === 0) return;
    const bounds = L.latLngBounds(filteredMatches.map((m) => m.kosongCoords));
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  };

  // Export visible valid/reconciled matches to CSV
  const handleExportCsv = () => {
    const validItems = filteredMatches.filter((m) => m.status === 'valid');
    const itemsToExport = validItems.length > 0 ? validItems : filteredMatches;

    const headers = [
      'IDPEL_MASTER',
      'ID_TITIK_KOSONG',
      'KOSONG_LATITUDE',
      'KOSONG_LONGITUDE',
      'MASTER_LATITUDE',
      'MASTER_LONGITUDE',
      'JARAK_METER',
      'STATUS_VALIDASI',
      'TARIF',
      'DAYA',
      'ALAMAT_SURVEI'
    ];

    const rows = itemsToExport.map((m) => [
      m.masterIdpel,
      m.kosongId,
      m.kosongCoords[0],
      m.kosongCoords[1],
      m.masterCoords[0],
      m.masterCoords[1],
      m.distanceMeters.toFixed(2),
      m.status,
      m.tariff,
      m.power,
      `"${m.surveyAddress}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.download = `rekonsiliasi_spasial_pln_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-300 shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : heightClass
      }`}
    >
      {/* Top Floating Reconciliation Filter Bar */}
      <div className="absolute top-3 left-14 right-3 z-[1000] flex flex-wrap items-center gap-2 pointer-events-none">
        {/* Search input for IDPEL or Survey Point */}
        <div className="pointer-events-auto relative flex-1 min-w-[200px] max-w-xs bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 px-3 py-2 flex items-center space-x-2">
          <input
            type="text"
            placeholder="Cari IDPEL atau ID Titik Survei..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          <Search className="w-4 h-4 text-cyan-600 shrink-0" />
        </div>

        {/* Status Dropdown */}
        <div className="pointer-events-auto relative">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="appearance-none bg-white/95 backdrop-blur-md text-slate-700 text-xs font-semibold rounded-xl px-3.5 py-2.5 pr-8 border border-slate-200/80 shadow-lg focus:outline-none cursor-pointer"
          >
            <option value="all">Semua Status ⌵</option>
            <option value="unresolved">Menunggu Validasi</option>
            <option value="valid">Tervalidasi Cocok</option>
            <option value="invalid">Ditolak / Anomali</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Distance Range Filter */}
        <div className="pointer-events-auto relative">
          <select
            value={selectedDistanceRange}
            onChange={(e) => setSelectedDistanceRange(e.target.value as any)}
            className="appearance-none bg-white/95 backdrop-blur-md text-slate-700 text-xs font-semibold rounded-xl px-3.5 py-2.5 pr-8 border border-slate-200/80 shadow-lg focus:outline-none cursor-pointer"
          >
            <option value="under5">Jarak ≤ 5m (Default) ⌵</option>
            <option value="exact">Exact Match (0m)</option>
            <option value="under10">Jarak ≤ 10 Meter</option>
            <option value="under25">Jarak ≤ 25 Meter</option>
            <option value="all">Semua Jarak Toleransi</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Power / Daya Filter */}
        <div className="pointer-events-auto relative">
          <select
            value={selectedPower}
            onChange={(e) => setSelectedPower(e.target.value)}
            className="appearance-none bg-white/95 backdrop-blur-md text-slate-700 text-xs font-semibold rounded-xl px-3.5 py-2.5 pr-8 border border-slate-200/80 shadow-lg focus:outline-none cursor-pointer"
          >
            <option value="all">Daya ⌵</option>
            <option value="900 VA">900 VA</option>
            <option value="1300 VA">1300 VA</option>
            <option value="2200 VA">2200 VA</option>
            <option value="3500 VA">3500 VA</option>
            <option value="4500 VA">4500 VA</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Fit Bounds Button */}
        <button
          onClick={handleFitAll}
          className="pointer-events-auto flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-white/95 hover:bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-lg text-xs font-bold transition-all"
        >
          <Compass className="w-3.5 h-3.5 text-emerald-600" />
          <span>Fokus Semua Titik</span>
        </button>

        {/* Export Button */}
        <button
          onClick={handleExportCsv}
          className="pointer-events-auto flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 shadow-lg text-xs font-bold transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh CSV</span>
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="pointer-events-auto flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-white/95 hover:bg-slate-100 text-cyan-700 border border-cyan-300 shadow-lg text-xs font-bold transition-all"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span>{isFullscreen ? 'Tutup Fullscreen' : 'Buka Fullscreen'}</span>
        </button>
      </div>

      {/* Floating Layer Controls (Top Right) */}
      <div className="absolute top-16 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-slate-200 text-xs w-56 pointer-events-auto">
        <div className="flex items-center space-x-1.5 font-bold text-slate-800 pb-2 mb-2 border-b border-slate-200">
          <Layers className="w-3.5 h-3.5 text-cyan-600" />
          <span>Layer Rekonsiliasi Spasial</span>
        </div>

        <div className="space-y-2.5">
          {/* Layer 1: Titik Kosong */}
          <label className="flex items-center space-x-2.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showKosongLayer}
              onChange={(e) => setShowKosongLayer(e.target.checked)}
              className="rounded border-slate-300 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500 border border-white shadow-sm" />
            <span className="font-medium text-[11px]">Titik Survei Kosong</span>
          </label>

          {/* Layer 2: Master Pelanggan */}
          <label className="flex items-center space-x-2.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showMasterLayer}
              onChange={(e) => setShowMasterLayer(e.target.checked)}
              className="rounded border-slate-300 text-emerald-500 focus:ring-0 cursor-pointer"
            />
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border border-white shadow-sm" />
            <span className="font-medium text-[11px]">Kandidat Master IDPEL</span>
          </label>

          {/* Layer 3: Garis Jarak */}
          <label className="flex items-center space-x-2.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showDistanceLines}
              onChange={(e) => setShowDistanceLines(e.target.checked)}
              className="rounded border-slate-300 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <div className="w-4 h-1 border-b-2 border-dashed border-cyan-500" />
            <span className="font-medium text-[11px]">Garis Hubung Jarak (m)</span>
          </label>

          {/* Layer 4: Radius Toleransi */}
          <label className="flex items-center space-x-2.5 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
            <input
              type="checkbox"
              checked={showToleranceCircles}
              onChange={(e) => setShowToleranceCircles(e.target.checked)}
              className="rounded border-slate-300 text-cyan-500 focus:ring-0 cursor-pointer"
            />
            <div className="w-3.5 h-3.5 rounded-full border border-cyan-500 bg-cyan-100/60" />
            <span className="font-medium text-[11px]">Radius Toleransi 5m</span>
          </label>
        </div>
      </div>

      {/* Floating Bottom Quick Action Panel for Active Candidate */}
      {activeMatch && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-800 text-white flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">IDPEL Master: {activeMatch.masterIdpel}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono border ${
                    activeMatch.status === 'valid'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : activeMatch.status === 'invalid'
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}
                >
                  {activeMatch.status === 'valid' ? 'Valid' : activeMatch.status === 'invalid' ? 'Ditolak' : 'Menunggu'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono">
                  Jarak: {activeMatch.distanceMeters.toFixed(1)}m
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeMatch.surveyAddress}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onValidateMatch(activeMatch.id, 'invalid')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMatch.status === 'invalid'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-800 hover:bg-rose-950 text-rose-300 border border-slate-700 hover:border-rose-800'
              }`}
            >
              <XCircle className="w-4 h-4" />
              <span>Tolak Match</span>
            </button>

            <button
              onClick={() => onValidateMatch(activeMatch.id, 'valid')}
              className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeMatch.status === 'valid'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Validasi Cocok</span>
            </button>
          </div>
        </div>
      )}

      {/* Map Leaflet Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
