import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CandidateListView } from './CandidateListView';
import { AuthProvider } from '../auth/AuthContext';
import { INITIAL_CANDIDATE_MATCHES } from './mockData';
import { processApi } from '../api/apiClient';

vi.mock('../api/apiClient', () => ({
  candidateApi: {
    validateCandidate: vi.fn(),
  },
  processApi: {
    createNewProcess: vi.fn(),
    finalizeProcess: vi.fn(),
  },
}));

vi.mock('./SpatialMap', () => ({
  SpatialMap: ({ allMatches }: { allMatches: any[] }) => (
    <div data-testid="spatial-map">{allMatches.length}</div>
  ),
}));

vi.mock('./LeafletSpatialMap', () => ({
  LeafletSpatialMap: ({ matches }: { matches: any[] }) => (
    <div data-testid="leaflet-map">{matches.length}</div>
  ),
}));

const validMatches = INITIAL_CANDIDATE_MATCHES.filter((m) => m.status === 'valid');

function renderWithAuth() {
  return render(
    <AuthProvider>
      <CandidateListView />
    </AuthProvider>
  );
}

describe('CandidateListView reset session', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(INITIAL_CANDIDATE_MATCHES));
    localStorage.setItem('pln_process_history_v1', JSON.stringify([
      { id: 'prc-01', processCode: 'PRC-20261015-001', startedAt: '2026-10-15 10:00:00',
        durationSeconds: 0.85, toleranceMeters: 5, totalKosong: 5, matchedKosong: 5,
        exactMatches: 5, spatialMatches: 0, unmatchedKosong: 0, validatedKosong: 5,
        status: 'completed', initiatedBy: 'analis@pln.co.id', masterFileName: 'm.csv',
        pdpjFileName: 'p.csv', kosongFileName: 'k.csv' },
    ]));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('shows initial candidate stats from storage', () => {
    renderWithAuth();
    // Use getAllByText to avoid matching mock map displays
    const allNumbers = screen.getAllByText(String(INITIAL_CANDIDATE_MATCHES.length));
    expect(allNumbers.length).toBeGreaterThan(0); // At least one stats card shows total
    const validNumbers = screen.getAllByText(String(validMatches.length));
    expect(validNumbers.length).toBeGreaterThan(0); // At least one stats card shows valid count
  });

  it('resets active candidate list to empty after confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth();
    fireEvent.click(screen.getByText('Reset Daftar Kandidat'));
    expect(screen.getByText(/Tidak ada kandidat cocok/)).toBeInTheDocument();
    expect(localStorage.getItem('pln_candidate_matches_v1')).toBeNull();
  });

  it('keeps candidate list when user cancels reset confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderWithAuth();
    fireEvent.click(screen.getByText('Reset Daftar Kandidat'));
    // After cancel, candidates still present — check "Semua (10)" tab still visible
    expect(screen.getByText('Semua (10)')).toBeInTheDocument();
    expect(localStorage.getItem('pln_candidate_matches_v1')).not.toBeNull();
  });

  it('reset does not remove process history', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth();
    fireEvent.click(screen.getByText('Reset Daftar Kandidat'));
    expect(localStorage.getItem('pln_process_history_v1')).not.toBeNull();
  });

  it('does not resurrect old candidates after reset', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth();
    fireEvent.click(screen.getByText('Reset Daftar Kandidat'));
    expect(screen.getByText(/Tidak ada kandidat cocok/)).toBeInTheDocument();
  });
});

describe('CandidateListView stats integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    const fiveValid = INITIAL_CANDIDATE_MATCHES.slice(0, 5).map((m, i) => ({
      ...m,
      id: `mat-v${i}`,
      status: 'valid' as const,
      validatedBy: 'analis@pln.co.id',
    }));
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(fiveValid));
    localStorage.setItem('pln_process_history_v1', JSON.stringify([
      { id: 'prc-a', processCode: 'PRC-A', startedAt: '2026-10-15 10:00:00',
        durationSeconds: 1.0, toleranceMeters: 5, totalKosong: 5, matchedKosong: 5,
        exactMatches: 5, spatialMatches: 0, unmatchedKosong: 0, validatedKosong: 5,
        status: 'completed', initiatedBy: 'analis@pln.co.id', masterFileName: 'm.csv',
        pdpjFileName: 'p.csv', kosongFileName: 'k.csv' },
    ]));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('counts five valid candidates as five titik valid', () => {
    renderWithAuth();
    expect(screen.getAllByText('5').length).toBeGreaterThan(0);
  });

  it('does not count unresolved and invalid as titik valid', () => {
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify([
      ...INITIAL_CANDIDATE_MATCHES.filter((m) => m.status === 'unresolved'),
      ...INITIAL_CANDIDATE_MATCHES.filter((m) => m.status === 'invalid'),
    ]));
    renderWithAuth();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('does not resurrect mock sample data after reset', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderWithAuth();
    fireEvent.click(screen.getByText('Reset Daftar Kandidat'));
    expect(screen.getByText(/Tidak ada kandidat cocok/)).toBeInTheDocument();
  });

  it('starts a new process linking candidates to a process id', async () => {
    localStorage.clear();
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(INITIAL_CANDIDATE_MATCHES));
    vi.mocked(processApi.createNewProcess).mockResolvedValue({ id: 'prc-new-1' });

    renderWithAuth();
    fireEvent.click(screen.getByText('Mulai Proses Baru'));

    await new Promise((r) => setTimeout(r, 0));

    expect(processApi.createNewProcess).toHaveBeenCalled();
    const raw = localStorage.getItem('pln_process_history_v1');
    expect(raw).not.toBeNull();
  });

  it('finalizes review and persists process history', async () => {
    localStorage.clear();
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(INITIAL_CANDIDATE_MATCHES));
    vi.mocked(processApi.createNewProcess).mockResolvedValue({ id: 'prc-new-1' });
    vi.mocked(processApi.finalizeProcess).mockResolvedValue({});

    renderWithAuth();
    fireEvent.click(screen.getByText('Mulai Proses Baru'));

    // Wait for process creation to link current candidates before finalizing.
    await waitFor(() => {
      const raw = localStorage.getItem('pln_candidate_matches_v1');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)[0].processId).toBe('prc-new-1');
    });

    fireEvent.click(screen.getByText('Selesaikan Review'));
    fireEvent.click(screen.getByText('Ya, Selesaikan Review'));

    await waitFor(() => {
      expect(processApi.finalizeProcess).toHaveBeenCalled();
    });

    // Wait for finalize to update local storage
    await waitFor(() => {
      const raw = localStorage.getItem('pln_process_history_v1');
      expect(raw).not.toBeNull();
      const jobs = JSON.parse(raw!);
      const completedJob = jobs.find((j: any) => j.status === 'completed');
      expect(completedJob).toBeTruthy();
    });
  });

  it('finalize dialog lists candidate decision counts', async () => {
    localStorage.clear();
    localStorage.setItem('pln_candidate_matches_v1', JSON.stringify(INITIAL_CANDIDATE_MATCHES));
    vi.mocked(processApi.createNewProcess).mockResolvedValue({ id: 'prc-new-1' });
    vi.mocked(processApi.finalizeProcess).mockResolvedValue({});

    renderWithAuth();
    fireEvent.click(screen.getByText('Mulai Proses Baru'));

    await new Promise((r) => setTimeout(r, 0));

    fireEvent.click(screen.getByText('Selesaikan Review'));
    await new Promise((r) => setTimeout(r, 0));

    const stats = INITIAL_CANDIDATE_MATCHES.reduce(
      (acc, m) => {
        if (m.status === 'valid') acc.valid++;
        if (m.status === 'invalid') acc.invalid++;
        if (m.status === 'unresolved') acc.unresolved++;
        return acc;
      },
      { valid: 0, invalid: 0, unresolved: 0 }
    );
    expect(screen.getByText('Selesaikan Review?')).toBeInTheDocument();
    expect(screen.getAllByText(String(stats.valid)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(stats.unresolved)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(stats.invalid)).length).toBeGreaterThan(0);
  });
});