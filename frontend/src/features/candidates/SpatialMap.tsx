import { useState } from 'react';
import { 
  MapPin, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Navigation, 
  Layers,
  Info
} from 'lucide-react';
import { CandidateMatch } from './types';

interface SpatialMapProps {
  selectedMatch: CandidateMatch | null;
  allMatches?: CandidateMatch[];
  onSelectMatch?: (match: CandidateMatch) => void;
}

export function SpatialMap({ selectedMatch, allMatches = [], onSelectMatch }: SpatialMapProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite' | 'grid'>('dark');

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex flex-col shadow-2xl select-none">
      {/* Top Map Toolbar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center space-x-2 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 shadow-lg">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-white">Peta Spasial PostGIS ST_DWithin</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            EPSG:4326
          </span>
        </div>

        {/* Map style switcher */}
        <div className="pointer-events-auto flex items-center space-x-1 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1 shadow-lg text-xs">
          <button
            onClick={() => setMapStyle('dark')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              mapStyle === 'dark' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Vektor Gelap
          </button>
          <button
            onClick={() => setMapStyle('grid')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              mapStyle === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Grid Toleransi
          </button>
          <button
            onClick={() => setMapStyle('satellite')}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              mapStyle === 'satellite' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Citra Satelit
          </button>
        </div>
      </div>

      {/* Floating Zoom & Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col space-y-1 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1 shadow-xl">
        <button
          onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Perbesar Peta"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Perkecil Peta"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Reset Sudut Pandang"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Map Interactive Canvas / Viewport */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing ${
          mapStyle === 'satellite'
            ? 'bg-gradient-to-br from-slate-950 via-emerald-950/20 to-slate-900'
            : mapStyle === 'grid'
            ? 'bg-slate-950 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px]'
            : 'bg-slate-950 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem]'
        }`}
      >
        <div
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className="w-full h-full flex items-center justify-center relative"
        >
          {/* Spatial Concentric Radius Rings (Tolerance Circle: 5 meters visualizer) */}
          <div className="absolute w-72 h-72 rounded-full border border-cyan-500/25 bg-cyan-500/5 animate-pulse flex items-center justify-center pointer-events-none">
            <div className="absolute w-40 h-40 rounded-full border border-dashed border-emerald-500/35 bg-emerald-500/5" />
            <div className="absolute top-1 text-[10px] font-mono text-cyan-400 bg-slate-950/85 px-2 py-0.5 rounded-full border border-cyan-800">
              Toleransi Default: 5 Meter (ST_DWithin)
            </div>
            <div className="absolute top-16 text-[9px] font-mono text-emerald-400 bg-slate-950/85 px-1.5 py-0.5 rounded-full border border-emerald-800">
              Toleransi Presisi: 0 - 2.5 Meter
            </div>
          </div>

          {/* SVG Distance Vector Line if a candidate is selected */}
          {selectedMatch && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
              <line
                x1="45%"
                y1="50%"
                x2="55%"
                y2="45%"
                stroke={selectedMatch.distanceMeters === 0 ? '#10b981' : '#06b6d4'}
                strokeWidth="2.5"
                strokeDasharray={selectedMatch.distanceMeters === 0 ? 'none' : '4 3'}
              />
            </svg>
          )}

          {/* Center Point A: Titik Survei Kosong */}
          <div className="absolute left-[45%] top-[50%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-amber-500/30 border border-amber-400 animate-ping absolute inset-0" />
              <div className="w-9 h-9 rounded-full bg-amber-600 border-2 border-white shadow-xl shadow-amber-500/50 flex items-center justify-center relative z-10">
                <MapPin className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="mt-1 bg-slate-900/90 border border-amber-500/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap">
              {selectedMatch && selectedMatch.kosongCoords
                ? `Titik Kosong (${selectedMatch.kosongCoords[0].toFixed(4)}, ${selectedMatch.kosongCoords[1].toFixed(4)})`
                : 'Titik Survei Kosong'}
            </div>
          </div>

          {/* Center Point B: Kandidat Master Pelanggan */}
          {selectedMatch && (
            <div className="absolute left-[55%] top-[45%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-cyan-500/30 border border-cyan-400 absolute inset-0" />
                <div className="w-9 h-9 rounded-full bg-cyan-600 border-2 border-white shadow-xl shadow-cyan-500/50 flex items-center justify-center relative z-10">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="mt-1 bg-slate-900/90 border border-cyan-500/50 text-cyan-300 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap">
                Master IDPEL: {selectedMatch.masterIdpel} ({selectedMatch.distanceMeters.toFixed(1)}m)
              </div>
            </div>
          )}

          {/* Surrounding background points if multiple matches exist */}
          {allMatches.slice(0, 5).map((m, idx) => {
            if (selectedMatch && m.id === selectedMatch.id) return null;
            const offsetX = 35 + (idx * 8);
            const offsetY = 30 + (idx * 7);
            return (
              <div
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMatch?.(m);
                }}
                style={{ left: `${offsetX}%`, top: `${offsetY}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center space-x-1 bg-slate-900/70 border border-slate-700 hover:border-cyan-400 rounded-full px-2 py-1 text-[9px] text-slate-300 cursor-pointer transition-all hover:scale-105"
              >
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span className="font-mono">{m.masterIdpel.slice(-4)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Detail Strip */}
      {selectedMatch ? (
        <div className="bg-slate-900/95 border-t border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">IDPEL: {selectedMatch.masterIdpel}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                    selectedMatch.distanceMeters === 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                  }`}
                >
                  {selectedMatch.matchType === 'exact' ? 'Exact Match (0m)' : `Jarak Spasial ${selectedMatch.distanceMeters.toFixed(1)}m`}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">{selectedMatch.surveyAddress}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 block text-[9px]">Tarif/Daya:</span>
              <span className="text-slate-200 font-bold">{selectedMatch.tariff} / {selectedMatch.power}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[9px]">Koordinat Master:</span>
              <span className="text-slate-200">{selectedMatch.masterCoords[0]}, {selectedMatch.masterCoords[1]}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900/95 border-t border-slate-800 p-3 text-center text-xs text-slate-400 flex items-center justify-center space-x-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Pilih salah satu kandidat di daftar sebelah kiri untuk memusatkan peta dan memeriksa detail jarak.</span>
        </div>
      )}
    </div>
  );
}
