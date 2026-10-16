import { ColumnRole, FileType, MappingValidationResult } from '../types';

/**
 * Format bytes to readable string (e.g. 1.2 MB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Calculate SHA-256 hash using the native browser Web Crypto API.
 */
export async function computeFileHashSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Robust CSV parser that handles delimiters, quotes, escapes, and line breaks.
 */
export function parseCsvSnippet(
  text: string,
  maxRows = 10
): { headers: string[]; previewRows: Record<string, string>[]; totalRowsEstimated: number } {
  // Normalize line breaks
  const rawLines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0);
  if (rawLines.length === 0) {
    return { headers: [], previewRows: [], totalRowsEstimated: 0 };
  }

  // Detect delimiter from first row (comma, semicolon, or tab)
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
          i++; // skip escaped quote
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

  const rawHeaders = splitLine(rawLines[0]).map((h) => h.replace(/^["']|["']$/g, '').trim());
  const headers = rawHeaders.filter((h) => h.length > 0);

  const previewRows: Record<string, string>[] = [];
  const limit = Math.min(rawLines.length, maxRows + 1);

  for (let i = 1; i < limit; i++) {
    const cols = splitLine(rawLines[i]).map((c) => c.replace(/^["']|["']$/g, '').trim());
    if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = cols[index] !== undefined ? cols[index] : '';
    });
    previewRows.push(rowObj);
  }

  return {
    headers,
    previewRows,
    totalRowsEstimated: Math.max(0, rawLines.length - 1),
  };
}

/**
 * Heuristic and value-based column role auto-detection.
 */
export function autoDetectColumnRole(
  header: string,
  sampleValues: string[],
  fileType: FileType
): ColumnRole {
  const norm = header.toLowerCase().replace(/[\s\-_]/g, '');

  // 1. Longitude (Koordinat X / Bujur) check
  if (
    norm === 'koordinatx' ||
    norm.includes('koordinat_x') ||
    norm.includes('coordx') ||
    norm === 'x' ||
    norm.startsWith('lon') ||
    norm.startsWith('lng') ||
    norm.includes('longitude') ||
    norm.includes('bujur')
  ) {
    return 'longitude';
  }

  // 2. Latitude (Koordinat Y / Lintang) check
  if (
    norm === 'koordinaty' ||
    norm.includes('koordinat_y') ||
    norm.includes('coordy') ||
    norm === 'y' ||
    norm.startsWith('lat') ||
    norm.includes('latitude') ||
    norm.includes('lintang')
  ) {
    return 'latitude';
  }

  // 3. Tanggal Baca (tglbaca) check
  if (
    norm.includes('tglbaca') ||
    norm.includes('tgl_baca') ||
    norm.includes('tanggalbaca') ||
    norm.includes('tglmeter')
  ) {
    return 'tglbaca';
  }

  // 4. Jenis Pelanggan (jenis_pel) check
  if (
    norm.includes('jenispel') ||
    norm.includes('jenis_pel') ||
    norm.includes('jenispelanggan') ||
    norm.includes('tipepelanggan')
  ) {
    return 'jenis_pel';
  }

  // 5. Combined coordinate check (e.g. "-6.123, 106.789")
  const combinedRegex = /^-?\d+\.?\d*[\s,]+-?\d+\.?\d*$/;
  const combinedMatchCount = sampleValues.filter((v) => combinedRegex.test(v.trim())).length;
  if (
    norm.includes('koordinat') ||
    norm.includes('titik') ||
    norm.includes('coord') ||
    (sampleValues.length > 0 && combinedMatchCount >= Math.ceil(sampleValues.length * 0.5))
  ) {
    if (!norm.includes('lat') && !norm.includes('lon') && !norm.includes('lintang') && !norm.includes('bujur')) {
      return 'coordinate_combined';
    }
  }

  // 6. ID Pelanggan (IDPEL) check
  if (fileType !== 'kosong') {
    if (!norm.includes('nama')) {
      const idpelKeywords = [
        'idpel',
        'idpelanggan',
        'id_pel',
        'nopelanggan',
        'idcust',
        'nomorpelanggan',
        'nometer',
        'nopel',
      ];
      if (idpelKeywords.some((kw) => norm.includes(kw)) || norm === 'id' || norm === 'no') {
        return 'idpel';
      }

      // Value pattern: 10-14 digit numbers typical of PLN IDPEL
      const idpelRegex = /^(\d{10,14}|\d\.\d+e\+\d+)$/i;
      const idpelMatchCount = sampleValues.filter((v) => idpelRegex.test(v.trim())).length;
      if (sampleValues.length > 0 && idpelMatchCount >= Math.ceil(sampleValues.length * 0.5)) {
        return 'idpel';
      }
    }
  }

  return 'ignore';
}

/**
 * Detect mapping for all columns in a file.
 */
export function autoDetectAllColumns(
  headers: string[],
  previewRows: Record<string, string>[],
  fileType: FileType
): Record<string, ColumnRole> {
  const mapping: Record<string, ColumnRole> = {};

  for (const h of headers) {
    const samples = previewRows.map((r) => r[h] || '').filter((v) => v.length > 0);
    mapping[h] = autoDetectColumnRole(h, samples, fileType);
  }

  return mapping;
}

/**
 * Validate that confirmed column mappings satisfy the business logic requirements.
 */
export function validateColumnMapping(
  fileType: FileType,
  mapping: Record<string, ColumnRole>
): MappingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const roles = Object.values(mapping);
  const hasIdpel = roles.includes('idpel');
  const hasLat = roles.includes('latitude');
  const hasLon = roles.includes('longitude');
  const hasCombined = roles.includes('coordinate_combined');

  if (fileType === 'master') {
    if (!hasIdpel) {
      errors.push('File Data Master wajib memiliki tepat satu kolom ID Pelanggan (IDPEL).');
    }
    if (!hasCombined && (!hasLat || !hasLon)) {
      errors.push(
        'File Data Master wajib memiliki koordinat (pilih kolom Latitude & Longitude terpisah, atau satu kolom Koordinat Gabungan).'
      );
    }
  } else if (fileType === 'pdpj') {
    if (!hasIdpel) {
      errors.push('File PDPJ wajib memiliki satu kolom ID Pelanggan (IDPEL) yang akan dieksklusi.');
    }
  } else if (fileType === 'kosong') {
    if (!hasCombined && (!hasLat || !hasLon)) {
      errors.push(
        'File Koordinat Kosong wajib memiliki koordinat (Latitude & Longitude terpisah atau Koordinat Gabungan).'
      );
    }
    if (hasIdpel) {
      warnings.push('File Koordinat Kosong biasanya tidak memiliki IDPEL. Kolom IDPEL akan diabaikan saat pencocokan spasial.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
