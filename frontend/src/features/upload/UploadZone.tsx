import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Sparkles, AlertCircle } from 'lucide-react';
import { FileType } from './types';

interface UploadZoneProps {
  fileType: FileType;
  onFileSelected: (file: File) => void;
  onLoadSample?: () => void;
  isReading?: boolean;
}

export function UploadZone({
  fileType,
  onFileSelected,
  onLoadSample,
  isReading = false,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTitle = () => {
    switch (fileType) {
      case 'master':
        return 'Unggah Data Master Pelanggan';
      case 'pdpj':
        return 'Unggah Data PDPJ (Terverifikasi)';
      case 'kosong':
        return 'Unggah Data Koordinat Kosong';
    }
  };

  const getDescription = () => {
    switch (fileType) {
      case 'master':
        return 'Gabungan pascabayar dan prabayar dengan kolom IDPEL serta koordinat.';
      case 'pdpj':
        return 'Daftar IDPEL yang sudah valid dan akan dieksklusi dari master.';
      case 'kosong':
        return 'File survei lapangan berisi titik koordinat tanpa IDPEL untuk dicocokkan.';
    }
  };

  const handleFiles = (files: FileList | null) => {
    setErrorMessage(null);
    if (!files || files.length === 0) return;

    const file = files[0];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('Format file tidak didukung. Mohon gunakan file .csv, .xlsx, atau .xls');
      return;
    }

    const maxSizeBytes = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSizeBytes) {
      setErrorMessage('Ukuran file melebihi batas maksimal 100 MB');
      return;
    }

    onFileSelected(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 group ${
          isDragOver
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 scale-[1.01] shadow-xl shadow-cyan-500/20'
            : 'border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 hover:border-cyan-500 hover:bg-slate-50 dark:hover:bg-slate-800/40 shadow-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isReading}
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg ${
              isDragOver
                ? 'bg-cyan-500 text-white shadow-cyan-500/40'
                : 'bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-700 shadow-slate-200 dark:shadow-slate-900/50'
            }`}
          >
            {isReading ? (
              <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
              {getTitle()}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {getDescription()}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Tarik & letakkan file di sini atau klik untuk jelajahi file</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
            <span>Mendukung CSV, XLSX, XLS</span>
            <span>•</span>
            <span>Maksimal 100 MB</span>
          </div>
        </div>

        {/* Quick sample loader button */}
        {onLoadSample && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onLoadSample();
            }}
            className="mt-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/80 border border-cyan-300 dark:border-cyan-800/80 text-cyan-800 dark:text-cyan-300 text-xs font-medium transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Gunakan Contoh Data Sintetis</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-xl flex items-center space-x-3 text-rose-800 dark:text-rose-200 text-xs animate-shake">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
