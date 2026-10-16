/**
 * Client-side reconciliation engine.
 *
 * Pipeline steps:
 *   1. Parse & extract columns from uploaded data (using existing parser infra)
 *   2. Deduplicate Master by IDPEL (keep first occurrence)
 *   3. Left anti-join: exclude Master records whose IDPEL exists in PDPJ
 *   4. Coordinate matching: for each Koordinat Kosong, find nearest Master records
 *      within tolerance radius using Haversine distance
 */

import type { ColumnRole } from '../upload/types';
import type {
  MasterRecord,
  PdpjRecord,
  KoordinatKosongRecord,
  ReconciliationMatch,
  PipelineStats,
  PipelineState,
} from './types';

// ─── Coordinate helpers ──────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;

/**
 * Haversine distance between two (lat, lon) points, in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLon = (lon2 - lon1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Column extraction helpers ──────────────────────────────────────

/**
 * Parse a combined coordinate string like "-6.208, 106.845" into [lat, lon].
 * Supports both "lat,lon" and "lon,lat" heuristics based on Indonesian ranges.
 */
function parseCombinedCoordinate(value: string): { lat: number; lon: number } | null {
  const cleaned = value.replace(/['"]/g, '').trim();
  const parts = cleaned.split(/[\s,;]+/).filter((p) => p.length > 0);
  if (parts.length < 2) return null;

  const a = parseFloat(parts[0]);
  const b = parseFloat(parts[1]);
  if (isNaN(a) || isNaN(b)) return null;

  // Indonesian latitude range: approx -11 to 6
  // Indonesian longitude range: approx 95 to 141
  if (a >= 90 || a <= -90) return null;
  if (b >= 90 || b <= -90) return null;

  // Heuristic: if first number looks like a longitude (large positive), swap
  if (a > 10 && b < 10) {
    return { lat: b, lon: a };
  }
  return { lat: a, lon: b };
}

/**
 * Extract master records from parsed rows using the column mapping.
 */
export function extractMasterRecords(
  rows: Record<string, string>[],
  mapping: Record<string, ColumnRole>
): MasterRecord[] {
  const idpelCol = Object.entries(mapping).find(([, r]) => r === 'idpel')?.[0];
  const latCol = Object.entries(mapping).find(([, r]) => r === 'latitude')?.[0];
  const lonCol = Object.entries(mapping).find(([, r]) => r === 'longitude')?.[0];
  const combinedCol = Object.entries(mapping).find(([, r]) => r === 'coordinate_combined')?.[0];

  if (!idpelCol) return [];

  const records: MasterRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const idpel = (row[idpelCol] || '').trim();
    if (!idpel) continue;

    let latitude = NaN;
    let longitude = NaN;

    if (combinedCol && row[combinedCol]) {
      const parsed = parseCombinedCoordinate(row[combinedCol]);
      if (parsed) {
        latitude = parsed.lat;
        longitude = parsed.lon;
      }
    } else if (latCol && lonCol) {
      latitude = parseFloat(row[latCol] || '');
      longitude = parseFloat(row[lonCol] || '');
    }

    if (isNaN(latitude) || isNaN(longitude)) continue;

    records.push({
      rowIndex: i,
      idpel,
      latitude,
      longitude,
      raw: row,
    });
  }

  return records;
}

/**
 * Extract PDPJ records (only IDPEL needed).
 */
export function extractPdpjRecords(
  rows: Record<string, string>[],
  mapping: Record<string, ColumnRole>
): PdpjRecord[] {
  const idpelCol = Object.entries(mapping).find(([, r]) => r === 'idpel')?.[0];
  if (!idpelCol) return [];

  const records: PdpjRecord[] = [];
  for (let i = 0; i < rows.length; i++) {
    const idpel = (rows[i][idpelCol] || '').trim();
    if (idpel) {
      records.push({ rowIndex: i, idpel });
    }
  }
  return records;
}

/**
 * Extract Koordinat Kosong records (only coordinates needed).
 */
export function extractKosongRecords(
  rows: Record<string, string>[],
  mapping: Record<string, ColumnRole>
): KoordinatKosongRecord[] {
  const latCol = Object.entries(mapping).find(([, r]) => r === 'latitude')?.[0];
  const lonCol = Object.entries(mapping).find(([, r]) => r === 'longitude')?.[0];
  const combinedCol = Object.entries(mapping).find(([, r]) => r === 'coordinate_combined')?.[0];

  const records: KoordinatKosongRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let latitude = NaN;
    let longitude = NaN;

    if (combinedCol && row[combinedCol]) {
      const parsed = parseCombinedCoordinate(row[combinedCol]);
      if (parsed) {
        latitude = parsed.lat;
        longitude = parsed.lon;
      }
    } else if (latCol && lonCol) {
      latitude = parseFloat(row[latCol] || '');
      longitude = parseFloat(row[lonCol] || '');
    }

    if (isNaN(latitude) || isNaN(longitude)) continue;

    records.push({
      rowIndex: i,
      latitude,
      longitude,
      raw: row,
    });
  }

  return records;
}

// ─── Pipeline Steps ──────────────────────────────────────────────────

/**
 * Step 1: Deduplicate master records by IDPEL.
 * Keeps first occurrence of each IDPEL.
 */
export function deduplicateMaster(records: MasterRecord[]): {
  deduped: MasterRecord[];
  duplicatesRemoved: number;
} {
  const seen = new Set<string>();
  const deduped: MasterRecord[] = [];
  let duplicatesRemoved = 0;

  for (const record of records) {
    if (seen.has(record.idpel)) {
      duplicatesRemoved++;
      continue;
    }
    seen.add(record.idpel);
    deduped.push(record);
  }

  return { deduped, duplicatesRemoved };
}

/**
 * Step 2: Exclude PDPJ-validated IDPELs from master.
 * Left anti-join: Master - PDPJ.
 */
export function excludePdpj(
  masterRecords: MasterRecord[],
  pdpjRecords: PdpjRecord[]
): {
  remaining: MasterRecord[];
  excludedCount: number;
} {
  const pdpjSet = new Set(pdpjRecords.map((p) => p.idpel));
  const remaining: MasterRecord[] = [];
  let excludedCount = 0;

  for (const record of masterRecords) {
    if (pdpjSet.has(record.idpel)) {
      excludedCount++;
    } else {
      remaining.push(record);
    }
  }

  return { remaining, excludedCount };
}

/**
 * Step 3: Match Koordinat Kosong against remaining Master records.
 *
 * For each kosong record, finds all master records within tolerance radius
 * using brute-force Haversine (sufficient for typical PLN datasets up to ~500K).
 * Results are sorted by distance ascending for each kosong.
 *
 * Returns top `maxCandidates` matches per kosong point.
 */
export function matchKoordinatKosong(
  masterRecords: MasterRecord[],
  kosongRecords: KoordinatKosongRecord[],
  toleranceMeters: number = 5,
  maxCandidates: number = 5
): {
  matches: ReconciliationMatch[];
  unmatchedKosong: KoordinatKosongRecord[];
} {
  const matches: ReconciliationMatch[] = [];
  const unmatchedKosong: KoordinatKosongRecord[] = [];
  let matchIdCounter = 0;

  // Precompute a rough bounding-box filter for perf:
  // 1 degree lat ≈ 111km → toleranceMeters / 111000 degrees
  const degTolerance = toleranceMeters / 111_000;

  for (const kosong of kosongRecords) {
    const candidates: { master: MasterRecord; distance: number }[] = [];

    for (const master of masterRecords) {
      // Quick bounding-box reject
      if (
        Math.abs(master.latitude - kosong.latitude) > degTolerance * 1.5 ||
        Math.abs(master.longitude - kosong.longitude) > degTolerance * 2
      ) {
        continue;
      }

      const dist = haversineDistance(
        kosong.latitude,
        kosong.longitude,
        master.latitude,
        master.longitude
      );

      if (dist <= toleranceMeters) {
        candidates.push({ master, distance: dist });
      }
    }

    if (candidates.length === 0) {
      unmatchedKosong.push(kosong);
      continue;
    }

    // Sort by distance ascending, take top N
    candidates.sort((a, b) => a.distance - b.distance);
    const top = candidates.slice(0, maxCandidates);

    for (let rank = 0; rank < top.length; rank++) {
      matchIdCounter++;
      matches.push({
        id: `recon-${matchIdCounter.toString().padStart(4, '0')}`,
        kosong,
        master: top[rank].master,
        distanceMeters: Math.round(top[rank].distance * 100) / 100,
        rank: rank + 1,
      });
    }
  }

  return { matches, unmatchedKosong };
}

// ─── Full Pipeline Runner ───────────────────────────────────────────

/**
 * Run the complete reconciliation pipeline end-to-end.
 *
 * Input: raw parsed rows + column mappings for each file type.
 * Output: complete PipelineState with stats and matched results.
 */
export function runReconciliationPipeline(
  masterRows: Record<string, string>[],
  masterMapping: Record<string, ColumnRole>,
  pdpjRows: Record<string, string>[],
  pdpjMapping: Record<string, ColumnRole>,
  kosongRows: Record<string, string>[],
  kosongMapping: Record<string, ColumnRole>,
  toleranceMeters: number = 5
): PipelineState {
  const startTime = performance.now();

  try {
    // Extract typed records from raw rows
    const masterRaw = extractMasterRecords(masterRows, masterMapping);
    const pdpjRaw = extractPdpjRecords(pdpjRows, pdpjMapping);
    const kosongRaw = extractKosongRecords(kosongRows, kosongMapping);

    // Step 1: Dedup master
    const { deduped, duplicatesRemoved } = deduplicateMaster(masterRaw);

    // Step 2: Exclude PDPJ
    const { remaining, excludedCount } = excludePdpj(deduped, pdpjRaw);

    // Step 3: Match coordinates
    const { matches, unmatchedKosong } = matchKoordinatKosong(
      remaining,
      kosongRaw,
      toleranceMeters
    );

    const endTime = performance.now();

    const stats: PipelineStats = {
      masterRawCount: masterRaw.length,
      masterDedupCount: deduped.length,
      masterDuplicatesRemoved: duplicatesRemoved,
      pdpjCount: pdpjRaw.length,
      masterAfterExcludeCount: remaining.length,
      pdpjExcludedCount: excludedCount,
      kosongCount: kosongRaw.length,
      matchedKosongCount: kosongRaw.length - unmatchedKosong.length,
      unmatchedKosongCount: unmatchedKosong.length,
      totalMatchCandidates: matches.length,
      processingTimeMs: Math.round(endTime - startTime),
    };

    return {
      stage: 'complete',
      stats,
      masterDeduped: deduped,
      masterExcluded: remaining,
      kosongRecords: kosongRaw,
      matches,
      unmatchedKosong,
      toleranceMeters,
    };
  } catch (err) {
    const endTime = performance.now();
    return {
      stage: 'error',
      stats: {
        masterRawCount: 0,
        masterDedupCount: 0,
        masterDuplicatesRemoved: 0,
        pdpjCount: 0,
        masterAfterExcludeCount: 0,
        pdpjExcludedCount: 0,
        kosongCount: 0,
        matchedKosongCount: 0,
        unmatchedKosongCount: 0,
        totalMatchCandidates: 0,
        processingTimeMs: Math.round(endTime - startTime),
      },
      masterDeduped: [],
      masterExcluded: [],
      kosongRecords: [],
      matches: [],
      unmatchedKosong: [],
      toleranceMeters,
      errorMessage: err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pipeline.',
    };
  }
}
