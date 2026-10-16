import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthProvider } from '../auth/AuthContext';
import { AuditLogViewer } from './AuditLogViewer';
import { App } from '../../App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

describe('AuditLogViewer and RBAC', () => {
  it('blocks analyst role from viewing audit logs with 403 message', () => {
    render(
      <AuthProvider>
        <AuditLogViewer />
      </AuthProvider>
    );

    // Default role is 'analis'
    expect(screen.getByText('Akses Ditolak (403 Forbidden)')).toBeInTheDocument();
  });

  it('allows switching to Auditor and viewing sanitized audit logs', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );

    // Switch role to auditor
    const userButton = screen.getByText('Budi (Analis)');
    fireEvent.click(userButton);

    const auditorOption = screen.getByText('auditor');
    fireEvent.click(auditorOption);

    // Click Log Audit tab
    const auditTab = screen.getByText('Log Audit');
    fireEvent.click(auditTab);

    // Now audit logs should be visible
    expect(screen.getByText('Log Audit Sistem')).toBeInTheDocument();
    expect(screen.getByText('candidate.validate')).toBeInTheDocument();
  });
});
