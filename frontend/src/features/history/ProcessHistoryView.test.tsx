import '@testing-library/jest-dom';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessHistoryView } from './ProcessHistoryView';
import { AuthProvider } from '../auth/AuthContext';

const completedJob = {
  id: 'prc-a',
  processCode: 'PRC-A',
  startedAt: '2026-10-15 10:00:00',
  durationSeconds: 2.0,
  toleranceMeters: 5,
  totalKosong: 10,
  matchedKosong: 8,
  exactMatches: 3,
  spatialMatches: 5,
  unmatchedKosong: 2,
  validatedKosong: 5,
  status: 'completed' as const,
  initiatedBy: 'analis@pln.co.id',
  masterFileName: 'm.csv',
  pdpjFileName: 'p.csv',
  kosongFileName: 'k.csv',
};

function renderHistory(jobs: typeof completedJob[]) {
  localStorage.clear();
  localStorage.setItem('pln_process_history_v1', JSON.stringify(jobs));
  return render(
    <AuthProvider>
      <ProcessHistoryView />
    </AuthProvider>
  );
}

describe('ProcessHistoryView statistics', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('shows total completed processes', () => {
    renderHistory([completedJob]);
    expect(screen.getByText('1 Kali')).toBeInTheDocument();
  });

  it('shows validated kosong count as titik berhasil cocok', () => {
    renderHistory([{ ...completedJob, validatedKosong: 5 }]);
    expect(screen.getByText('5 Titik')).toBeInTheDocument();
  });

  it('does not count unresolved/invalid as titik valid (validatedKosong only)', () => {
    renderHistory([{ ...completedJob, validatedKosong: 0 }]);
    expect(screen.getByText('0 Titik')).toBeInTheDocument();
  });

  it('averages match rate across processes', () => {
    renderHistory([
      { ...completedJob, totalKosong: 10, validatedKosong: 5 },
      { ...completedJob, id: 'prc-b', processCode: 'PRC-B', totalKosong: 10, validatedKosong: 10 },
    ]);
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('averages duration across completed processes only', () => {
    renderHistory([
      { ...completedJob, durationSeconds: 2.0 },
      { ...completedJob, id: 'prc-b', processCode: 'PRC-B', durationSeconds: 4.0 },
    ]);
    expect(screen.getByText('3.0 Detik')).toBeInTheDocument();
  });

  it('shows zero when no completed process', () => {
    renderHistory([]);
    expect(screen.getByText('0 Kali')).toBeInTheDocument();
    expect(screen.getByText('0 Titik')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.getByText('0.0 Detik')).toBeInTheDocument();
  });

  it('five valid candidates linked to one process yield five titik valid', () => {
    const job = { ...completedJob, validatedKosong: 5, totalKosong: 5 };
    renderHistory([job]);
    expect(screen.getByText('5 Titik')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });
});
