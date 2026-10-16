/**
 * Types for the client-side reconciliation pipeline.
 * Alur: Master (dedup) → Exclude PDPJ → Match Koordinat Kosong
 */

/** A single row of master data after parsing + column mapping */
export interface MasterRecord {
  /** Original row index for tracing */
  rowIndex: number;
  /** ID Pelanggan (IDPEL) */
  idpel: string;
  /** Latitude (Koordinat Y / Lintang) */
  latitude: number;
  /** Longitude (Koordinat X / Bujur) */
  longitude: number;
  /** All raw columns preserved for display */
  raw: Record<string, string>;
}

/** A single PDPJ record (only needs IDPEL) */
export interface PdpjRecord {
  rowIndex: number;
  idpel: string;
}

/** A single Koordinat Kosong record */
export interface KoordinatKosongRecord {
  rowIndex: number;
  latitude: number;
  longitude: number;
  /** All raw columns preserved for display */
  raw: Record<string, string>;
}

/** A matched candidate between Koordinat Kosong and Master */
export interface ReconciliationMatch {
  id: string;
  /** The kosong record */
  kosong: KoordinatKosongRecord;
  /** The matched master record */
  master: MasterRecord;
  /** Haversine distance in meters */
  distanceMeters: number;
  /** Rank among candidates for this kosong (1 = closest) */
  rank: number;
}

/** Stats collected at each pipeline stage */
export interface PipelineStats {
  /** Step 1: Master input */
  masterRawCount: number;
  /** Step 1b: After dedup by IDPEL */
  masterDedupCount: number;
  masterDuplicatesRemoved: number;

  /** Step 2: PDPJ exclusion */
  pdpjCount: number;
  masterAfterExcludeCount: number;
  pdpjExcludedCount: number;

  /** Step 3: Koordinat Kosong */
  kosongCount: number;

  /** Step 4: Matching results */
  matchedKosongCount: number;
  unmatchedKosongCount: number;
  totalMatchCandidates: number;

  /** Timing */
  processingTimeMs: number;
}

/** Overall pipeline state */
export type PipelineStage =
  | 'idle'
  | 'parsing'
  | 'dedup'
  | 'excluding'
  | 'matching'
  | 'complete'
  | 'error';

export interface PipelineState {
  stage: PipelineStage;
  stats: PipelineStats;
  /** Master records after dedup */
  masterDeduped: MasterRecord[];
  /** Master records after PDPJ exclusion */
  masterExcluded: MasterRecord[];
  /** Koordinat Kosong records */
  kosongRecords: KoordinatKosongRecord[];
  /** Matched results */
  matches: ReconciliationMatch[];
  /** Unmatched Koordinat Kosong (no nearby master found) */
  unmatchedKosong: KoordinatKosongRecord[];
  /** Error message if stage === 'error' */
  errorMessage?: string;
  /** Tolerance radius in meters */
  toleranceMeters: number;
}
