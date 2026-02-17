'use client';

/**
 * Report Fiscale per Reseller
 *
 * Dashboard per generare report fiscali mensili con dati pronti
 * per fatturazione ai sub-user (clienti del reseller).
 *
 * Features:
 * - Riepilogo KPI mensili (lordo, netto, IVA, margine)
 * - Tabella riepilogo per cliente con drill-down
 * - Export CSV per commercialista
 * - Export Excel multi-sheet
 */

import { Download, FileSpreadsheet, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';

import DashboardNav from '@/components/dashboard-nav';
import { QueryProvider } from '@/components/providers/query-provider';
import { Button } from '@/components/ui/button';

import { FiscalStatsCards } from './_components/fiscal-stats-cards';
import { MonthYearSelector } from './_components/month-year-selector';
import { ClientSummaryTable } from './_components/client-summary-table';
import { ExportFiscalDialog } from './_components/export-fiscal-dialog';
import { ResellerProviderChart } from './_components/reseller-provider-chart';

import {
  getResellerFiscalReport,
  getResellerMarginByProvider,
} from '@/actions/reseller-fiscal-report';
import type {
  MonthlyFiscalSummary,
  FiscalReportFilters,
  ResellerProviderMarginData,
} from '@/types/reseller-fiscal';

function ReportFiscaleContent() {
  const router = useRouter();

  // Periodo: default mese precedente
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // Mese precedente (1-12)
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  // State
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [data, setData] = useState<MonthlyFiscalSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [providerMargins, setProviderMargins] = useState<ResellerProviderMarginData[]>([]);

  // Load data
  const loadData = useCallback(
    async (showRefreshToast = false) => {
      try {
        if (showRefreshToast) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const filters: FiscalReportFilters = { month, year };
        const [result, providerRes] = await Promise.all([
          getResellerFiscalReport(filters),
          getResellerMarginByProvider(filters),
        ]);

        if (!result.success) {
          toast.error(result.error || 'Errore caricamento dati');
          return;
        }

        setData(result.data || null);
        if (providerRes.success) setProviderMargins(providerRes.data || []);

        if (showRefreshToast) {
          toast.success('Dati aggiornati');
        }
      } catch (error) {
        console.error('Errore caricamento report fiscale:', error);
        toast.error('Errore nel caricamento del report');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [month, year]
  );

  // Initial load e reload on period change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle period change
  const handlePeriodChange = (newMonth: number, newYear: number) => {
    setMonth(newMonth);
    setYear(newYear);
  };

  // Handle refresh
  const handleRefresh = () => {
    loadData(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Gestione Business', href: '/dashboard/reseller/clienti' },
          { label: 'Report Fiscale' },
        ]}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report Fiscale</h1>
            <p className="mt-1 text-sm text-gray-500">
              Riepilogo mensile per fatturazione ai tuoi clienti
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period selector */}
            <MonthYearSelector
              month={month}
              year={year}
              onChange={handlePeriodChange}
              disabled={isLoading || isRefreshing}
            />

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>

            {/* Export */}
            <Button
              onClick={() => setShowExportDialog(true)}
              disabled={isLoading || !data || data.clients.length === 0}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Download className="mr-2 h-4 w-4" />
              Esporta
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6">
          <FiscalStatsCards data={data} isLoading={isLoading} />
        </div>

        {/* Info cedente */}
        {data && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  Cedente: {data.reseller.company_name || data.reseller.name}
                </p>
                <p className="text-sm text-blue-700">
                  {data.reseller.vat_number && `P.IVA: ${data.reseller.vat_number} - `}
                  {data.reseller.email}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Riepilogo per Cliente</h2>
          {data && (
            <span className="text-sm text-gray-500">
              {data.clients.length} clienti con {data.total_shipments} spedizioni
            </span>
          )}
        </div>

        {/* Client table */}
        <ClientSummaryTable clients={data?.clients || []} isLoading={isLoading} />

        {/* Provider margin chart */}
        <div className="mt-6">
          <ResellerProviderChart
            data={providerMargins}
            isLoading={isLoading && providerMargins.length === 0}
          />
        </div>

        {/* Export Dialog */}
        <ExportFiscalDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          data={data}
        />
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

export default function ReportFiscalePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Auth + role check
  useEffect(() => {
    async function checkAccess() {
      if (status === 'loading') return;
      if (status === 'unauthenticated' || !session?.user?.email) {
        router.push('/auth/signin');
        return;
      }
      try {
        const res = await fetch('/api/user/info');
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          const accountType = u.account_type || u.accountType;
          setIsAuthorized(
            accountType === 'superadmin' || accountType === 'admin' || u.is_reseller === true
          );
        } else {
          setIsAuthorized(false);
        }
      } catch {
        setIsAuthorized(false);
      }
    }
    checkAccess();
  }, [session, status, router]);

  if (status === 'loading' || isAuthorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Accesso non autorizzato</h2>
          <p className="text-gray-500 mt-2">Solo i reseller possono accedere al report fiscale.</p>
        </div>
      </div>
    );
  }

  return (
    <QueryProvider>
      <ReportFiscaleContent />
    </QueryProvider>
  );
}
