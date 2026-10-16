import { useState } from 'react';
import { 
  Layers, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Save, 
  RotateCcw, 
  Check
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export interface ManualEntryRecord {
  id: string;
  idpel: string;
  customerName: string;
  latitude: number;
  longitude: number;
  tariff: string;
  power: string;
  category: 'pascabayar' | 'prabayar';
  notes: string;
  createdAt: string;
  createdBy: string;
  status: 'tersimpan' | 'terverifikasi';
}

const INITIAL_MANUAL_RECORDS: ManualEntryRecord[] = [
  {
    id: 'man-1',
    idpel: '531000000888',
    customerName: 'Gardu Distribusi GD-JKT-04',
    latitude: -6.20882,
    longitude: 106.84562,
    tariff: 'B1',
    power: '4500 VA',
    category: 'pascabayar',
    notes: 'Koreksi titik gardu hasil verifikasi lapangan analis',
    createdAt: '2026-10-15 08:30:15',
    createdBy: 'analis@pln.co.id',
    status: 'tersimpan',
  },
  {
    id: 'man-2',
    idpel: '531000000777',
    customerName: 'Pelanggan Residensial Blok B',
    latitude: -6.21104,
    longitude: 106.8492,
    tariff: 'R1',
    power: '1300 VA',
    category: 'prabayar',
    notes: 'Survei koordinat meter prabayar baru',
    createdAt: '2026-10-14 16:10:45',
    createdBy: 'analis@pln.co.id',
    status: 'terverifikasi',
  },
];

export function ManualEntryView() {
  const { user, canAccess } = useAuth();
  const [records, setRecords] = useState<ManualEntryRecord[]>(INITIAL_MANUAL_RECORDS);

  // Form states
  const [idpel, setIdpel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [tariff, setTariff] = useState('R1');
  const [power, setPower] = useState('1300 VA');
  const [category, setCategory] = useState<'pascabayar' | 'prabayar'>('pascabayar');
  const [notes, setNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Form Validation checks
  const isIdpelValid = /^\d{11,12}$/.test(idpel.trim());
  const parsedLat = parseFloat(latitude);
  const parsedLon = parseFloat(longitude);
  const isLatValid = !isNaN(parsedLat) && parsedLat >= -11.0 && parsedLat <= 6.0;
  const isLonValid = !isNaN(parsedLon) && parsedLon >= 95.0 && parsedLon <= 141.0;
  const isCoordsValid = isLatValid && isLonValid;
  const isFormValid = isIdpelValid && isCoordsValid && customerName.trim().length > 0;

  const handleReset = () => {
    setIdpel('');
    setCustomerName('');
    setLatitude('');
    setLongitude('');
    setTariff('R1');
    setPower('1300 VA');
    setCategory('pascabayar');
    setNotes('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAccess('validate')) {
      showToast('Akses Dibatasi: Peran Anda tidak memiliki izin untuk menyimpan entri manual.');
      return;
    }

    if (!isFormValid) {
      showToast('Harap periksa kembali format IDPEL (11-12 digit) dan koordinat WGS84 wilayah Indonesia.');
      return;
    }

    const newRecord: ManualEntryRecord = {
      id: `man-${Date.now()}`,
      idpel: idpel.trim(),
      customerName: customerName.trim(),
      latitude: parsedLat,
      longitude: parsedLon,
      tariff,
      power,
      category,
      notes: notes.trim(),
      createdAt: new Date().toLocaleString('id-ID'),
      createdBy: user.email,
      status: 'tersimpan',
    };

    setRecords([newRecord, ...records]);
    showToast(`Data IDPEL ${idpel} berhasil ditambahkan ke Master Pelanggan.`);
    handleReset();
  };

  const applyPresetCoords = (lat: string, lon: string) => {
    setLatitude(lat);
    setLongitude(lon);
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
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Input Manual Data Pelanggan
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800 font-semibold">
                Verifikasi Lapangan
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Formulir entri manual untuk menambahkan titik koordinat pelanggan yang belum terdata dalam master atau hasil verifikasi lapangan.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono">
          Operator: <strong className="text-cyan-600 dark:text-cyan-400">{user.email}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): The Entry Form */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            Entri Titik Pelanggan Baru
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* IDPEL & Customer Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  ID Pelanggan (IDPEL) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="Contoh: 531000000123"
                  value={idpel}
                  onChange={(e) => setIdpel(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none ${
                    idpel && !isIdpelValid ? 'border-rose-500' : 'border-slate-300 dark:border-slate-800 focus:border-cyan-500'
                  }`}
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">
                  Wajib 11 atau 12 digit angka ({idpel.length}/12)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nama / Label Lokasi Pelanggan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Misal: Bapak Ahmad / Gardu GD-01"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Nama atau identitas titik survei</span>
              </div>
            </div>

            {/* Coordinates Lat / Lon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Latitude (Lintang) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="-6.2088"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none ${
                    latitude && !isLatValid ? 'border-rose-500' : 'border-slate-300 dark:border-slate-800 focus:border-cyan-500'
                  }`}
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Wilayah RI: -11.0 s/d 6.0</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Longitude (Bujur) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="106.8456"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none ${
                    longitude && !isLonValid ? 'border-rose-500' : 'border-slate-300 dark:border-slate-800 focus:border-cyan-500'
                  }`}
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Wilayah RI: 95.0 s/d 141.0</span>
              </div>
            </div>

            {/* Quick Coordinate Presets */}
            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 dark:text-slate-400">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">Preset Kota:</span>
              <button
                type="button"
                onClick={() => applyPresetCoords('-6.2088', '106.8456')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Jakarta
              </button>
              <button
                type="button"
                onClick={() => applyPresetCoords('-6.9175', '107.6191')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Bandung
              </button>
              <button
                type="button"
                onClick={() => applyPresetCoords('-7.2575', '112.7521')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Surabaya
              </button>
              <button
                type="button"
                onClick={() => applyPresetCoords('-7.7956', '110.3695')}
                className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Yogyakarta
              </button>
            </div>

            {/* Tariff, Power & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Golongan Tarif</label>
                <select
                  value={tariff}
                  onChange={(e) => setTariff(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="R1">R1 (Rumah Tangga Kecil)</option>
                  <option value="R2">R2 (Rumah Tangga Menengah)</option>
                  <option value="R3">R3 (Rumah Tangga Besar)</option>
                  <option value="B1">B1 (Bisnis Kecil)</option>
                  <option value="B2">B2 (Bisnis Menengah)</option>
                  <option value="I1">I1 (Industri)</option>
                  <option value="P1">P1 (Pemerintah/Sosial)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Daya Listrik</label>
                <select
                  value={power}
                  onChange={(e) => setPower(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="450 VA">450 VA</option>
                  <option value="900 VA">900 VA</option>
                  <option value="1300 VA">1300 VA</option>
                  <option value="2200 VA">2200 VA</option>
                  <option value="3500 VA">3500 VA</option>
                  <option value="4500 VA">4500 VA</option>
                  <option value="5500 VA">5500 VA</option>
                  <option value="6600 VA">6600 VA</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Kategori Layanan</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="pascabayar">Pascabayar</option>
                  <option value="prabayar">Prabayar (Token)</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Catatan Verifikasi Lapangan
              </label>
              <textarea
                rows={2}
                placeholder="Misal: Nomor meter fisik terkonfirmasi di tiang nomor 14B..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Validation Checklist Strip */}
            <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex items-center space-x-2">
                {isIdpelValid ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className={isIdpelValid ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>
                  Format ID Pelanggan (11-12 digit angka)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isCoordsValid ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span className={isCoordsValid ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}>
                  Koordinat WGS84 Valid Wilayah Indonesia
                </span>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="submit"
                disabled={!isFormValid}
                className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                  isFormValid
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-cyan-500/20'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Simpan ke Data Master</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column (5 Cols): Live Coordinate Visualizer & History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Coordinate Preview Box */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Pratinjau Posisi Geospasial
              </span>
              <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950 px-2 py-0.5 rounded border border-cyan-300 dark:border-cyan-800 font-semibold">
                WGS84 EPSG:4326
              </span>
            </div>

            {/* Mini Map Canvas Simulation */}
            <div className="w-full h-44 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 relative overflow-hidden flex items-center justify-center bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="absolute w-24 h-24 rounded-full border border-cyan-500/30 bg-cyan-500/10 animate-pulse" />
              <div className="flex flex-col items-center z-10">
                <div className="w-8 h-8 rounded-full bg-cyan-600 border-2 border-white flex items-center justify-center shadow-lg shadow-cyan-500/50">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div className="mt-1 bg-white dark:bg-slate-900/90 border border-slate-300 dark:border-cyan-500/40 text-slate-800 dark:text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded shadow">
                  {latitude || '0'}, {longitude || '0'}
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
              <div className="flex justify-between">
                <span>Enkripsi IDPEL:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">AES-256-GCM + Blind Index</span>
              </div>
              <div className="flex justify-between">
                <span>Eksklusi PDPJ:</span>
                <span className="text-slate-700 dark:text-slate-300">Lolos (Anti-Join OK)</span>
              </div>
            </div>
          </div>

          {/* List of Recent Manual Entries */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Riwayat Entri Manual Terbaru</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{records.length} Data</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {records.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-colors text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">{rec.idpel}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 font-semibold">
                      {rec.status}
                    </span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 text-[11px] truncate">{rec.customerName}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-1">
                    <span>{rec.latitude}, {rec.longitude}</span>
                    <span>{rec.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
