/**
 * API client for candidate and process endpoints (frontend).
 */

const API_BASE = '/api/v1';

export interface ValidateRequest {
  status: 'valid' | 'invalid';
  validated_at: string;
}

export interface ProcessStats {
  process_id: string;
  total: number;
  valid: number;
  invalid: number;
  unresolved: number;
}

export interface ProcessHistoryItem {
  id: string;
  status: string;
  initiated_by: string;
  created_at: string;
  completed_at: string | null;
  master_filename: string;
  pdpj_filename: string | null;
  kosong_filename: string;
  validated_kosong: number;
  total_candidates: number;
}

export const candidateApi = {
  async validateCandidate(
    candidateId: string,
    status: 'valid' | 'invalid',
    token: string
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/candidates/${candidateId}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status,
        validated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) throw new Error(`Validation failed: ${res.statusText}`);
    return res.json();
  },

  async getCandidatesByProcess(
    processId: string,
    token: string,
    status?: string
  ): Promise<any[]> {
    let url = `${API_BASE}/candidates/process/${processId}`;
    if (status) url += `?status=${status}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Fetch candidates failed: ${res.statusText}`);
    return res.json();
  },

  async getProcessStats(
    processId: string,
    token: string
  ): Promise<ProcessStats> {
    const res = await fetch(`${API_BASE}/candidates/process/${processId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Fetch stats failed: ${res.statusText}`);
    return res.json();
  },
};

export const processApi = {
  async createNewProcess(
    masterFilename: string,
    kosongFilename: string,
    pdpjFilename: string | null,
    token: string
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/process/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        master_filename: masterFilename,
        kosong_filename: kosongFilename,
        pdpj_filename: pdpjFilename,
      }),
    });
    if (!res.ok) throw new Error(`Create process failed: ${res.statusText}`);
    return res.json();
  },

  async finalizeProcess(
    processId: string,
    notes: string | null,
    token: string
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/process/${processId}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) throw new Error(`Finalize failed: ${res.statusText}`);
    return res.json();
  },

  async getProcessHistory(token: string): Promise<ProcessHistoryItem[]> {
    const res = await fetch(`${API_BASE}/process/history/all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Fetch history failed: ${res.statusText}`);
    return res.json();
  },

  async getProcessById(processId: string, token: string): Promise<any> {
    const res = await fetch(`${API_BASE}/process/${processId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Fetch process failed: ${res.statusText}`);
    return res.json();
  },
};
