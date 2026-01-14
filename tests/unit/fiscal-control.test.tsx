import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FinanceControlRoom from '@/app/dashboard/finanza/page';
import * as fiscalActions from '@/app/actions/fiscal';

// Mock delle server actions
vi.mock('@/app/actions/fiscal', () => ({
  getMyFiscalData: vi.fn(),
}));

vi.mock('@/app/actions/invoices', () => ({
  getUserInvoices: vi.fn(),
}));

describe('FinanceControlRoom', () => {
  const mockFiscalData = {
    userId: 'test-user-id',
    role: 'user',
    period: {
      start: '2026-01-01T00:00:00.000Z',
      end: '2026-01-14T00:00:00.000Z',
    },
    wallet: {
      balance: 1500.50,
    },
    shipmentsSummary: {
      count: 25,
      total_margin: 2840.50,
      total_revenue: 12450.00,
    },
    pending_cod_count: 5,
    pending_cod_value: 450.00,
    deadlines: [
      {
        date: '2026-02-16',
        description: 'F24 IVA mensile / Ritenute',
        type: 'F24',
      },
      {
        date: '2026-03-16',
        description: 'F24 IVA mensile / Ritenute',
        type: 'F24',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Finance Control Room header', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    expect(screen.getByText('Finance Control Room')).toBeInTheDocument();
    expect(screen.getByText(/AI-Powered CFO View/)).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    // Should show initial AI message
    expect(screen.getByText(/Sto analizzando i flussi di cassa/)).toBeInTheDocument();
  });

  it('fetches and displays fiscal data', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(fiscalActions.getMyFiscalData).toHaveBeenCalledTimes(1);
    });
  });

  it('displays margin KPI correctly', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(screen.getByText(/MARGINE NETTO/)).toBeInTheDocument();
      // Check if margin value is displayed (formatted as Italian locale)
      expect(screen.getByText(/2\.840,50/)).toBeInTheDocument();
    });
  });

  it('displays projection KPI', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(screen.getByText(/PROIEZIONE CHIUSURA/)).toBeInTheDocument();
    });
  });

  it('displays next deadline', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(screen.getByText(/NEXT DEADLINE/)).toBeInTheDocument();
    });
  });

  it('shows fiscal health check section', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(screen.getByText('Fiscal Health Check')).toBeInTheDocument();
      expect(screen.getByText('Dichiarazione IVA')).toBeInTheDocument();
      expect(screen.getByText('Plafond Export')).toBeInTheDocument();
      expect(screen.getByText('Rischio Controlli')).toBeInTheDocument();
      expect(screen.getByText('Regime Forfettario')).toBeInTheDocument();
    });
  });

  it('displays ANNE insight section', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    expect(screen.getByText(/ANNE INSIGHT/)).toBeInTheDocument();
  });

  it('shows action buttons', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(screen.getByText('Chiedi Dettagli')).toBeInTheDocument();
      expect(screen.getByText('Dettagli')).toBeInTheDocument();
      expect(screen.getByText('Paga Ora')).toBeInTheDocument();
      expect(screen.getByText('Vedi Report Completo')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fiscalActions.getMyFiscalData).mockRejectedValue(
      new Error('API Error')
    );

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch fiscal data',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('updates AI message after loading completes', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    // Initial message
    expect(screen.getByText(/Sto analizzando i flussi di cassa/)).toBeInTheDocument();

    // Wait for the AI message to update (2 second timeout in component)
    await waitFor(
      () => {
        expect(screen.getByText(/Analisi completata/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('displays system operational status', () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    expect(screen.getByText('SYSTEM OPERATIONAL')).toBeInTheDocument();
  });

  it('renders revenue vs costs analysis section', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      expect(screen.getByText('Analisi Ricavi vs Costi')).toBeInTheDocument();
    });
  });

  it('calculates projection correctly from revenue', async () => {
    vi.mocked(fiscalActions.getMyFiscalData).mockResolvedValue(mockFiscalData);

    render(<FinanceControlRoom />);

    await waitFor(() => {
      // Projection should be revenue * 1.1
      const expectedProjection = mockFiscalData.shipmentsSummary.total_revenue * 1.1;
      const formattedProjection = expectedProjection.toLocaleString('it-IT');
      expect(screen.getByText(new RegExp(formattedProjection))).toBeInTheDocument();
    });
  });
});
