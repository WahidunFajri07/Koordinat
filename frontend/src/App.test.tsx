import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

const queryClient = new QueryClient();

describe('App', () => {
  it('renders the header and navigation tabs in Indonesian', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByText('Rekonsiliasi Data Pelanggan')).toBeInTheDocument();
    expect(screen.getByText('Unggah Data')).toBeInTheDocument();
    expect(screen.getByText('Daftar Kandidat & Peta')).toBeInTheDocument();
    expect(screen.getByText('Log Audit')).toBeInTheDocument();
  });
});
