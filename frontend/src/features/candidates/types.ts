export type MatchStatus = 'unresolved' | 'valid' | 'invalid';
export type MatchType = 'exact' | 'spatial';

export interface CandidateMatch {
  id: string;
  kosongId: string;
  kosongCoords: [number, number]; // [lat, lng]
  surveyAddress: string;
  masterId: string;
  masterIdpel: string;
  masterCoords: [number, number]; // [lat, lng]
  distanceMeters: number;
  matchType: MatchType;
  rank: number;
  status: MatchStatus;
  processId?: string;
  tariff: string;
  power: string;
  validatedBy?: string;
  validatedAt?: string;
  notes?: string;
}

export interface CandidateFilters {
  status: 'all' | MatchStatus;
  search: string;
  maxDistance: number;
  matchType: 'all' | MatchType;
}
