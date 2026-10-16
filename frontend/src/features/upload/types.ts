export type FileType = 'master' | 'pdpj' | 'kosong';

export type ColumnRole = 
  | 'idpel' 
  | 'latitude' 
  | 'longitude' 
  | 'tglbaca' 
  | 'jenis_pel' 
  | 'coordinate_combined' 
  | 'ignore';

export interface ColumnDefinition {
  name: string;
  role: ColumnRole;
  sampleValues: string[];
  isAutoDetected: boolean;
}

export interface FileUploadState {
  file: File | null;
  uploadId: string;
  fileType: FileType;
  originalFilename: string;
  fileSizeBytes: number;
  fileHashSha256: string;
  headers: string[];
  previewRows: Record<string, string>[];
  fullRows?: Record<string, string>[];
  rawText?: string;
  sheetNames: string[];
  selectedSheet?: string;
  columnMapping: Record<string, ColumnRole>;
  isDuplicate: boolean;
  duplicateOfId?: string | null;
  status: 'idle' | 'reading' | 'ready' | 'processing' | 'completed' | 'error';
  totalRowsEstimated: number;
  errorMessage?: string;
}

export interface MappingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
