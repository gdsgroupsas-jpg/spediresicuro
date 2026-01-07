'use client'

/**
 * Financial Dashboard - SuperAdmin
 * 
 * Dashboard completa per P&L, margini e riconciliazione.
 * Sprint 2: Aggiunto Period Selector, Export CSV, Charts
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Shield, 
  RefreshCw, 
  DollarSign,
  ArrowLeft,
  Download,
  Loader2
} from 'lucide-react'
import { toast, Toaster } from 'sonner'

import { Button } from '@/components/ui/button'
import { StatsCards } from './_components/stats-cards'
import { AlertsTable } from './_components/alerts-table'
import { ReconciliationTable } from './_components/reconciliation-table'
import { MonthlyPnL } from './_components/monthly-pnl'
import { PeriodSelector, type PeriodType, getStartDateForPeriod } from './_components/period-selector'
import { MarginByCourierChart } from './_components/margin-by-courier-chart'
import { TopResellersTable } from './_components/top-resellers-table'

import {
  getPlatformStatsAction,
  getMonthlyPnLAction,
  getMarginAlertsAction,
  getReconciliationPendingAction,
  updateReconciliationStatusAction,
  getMarginByCourierAction,
  getTopResellersAction,
  exportFinancialCSVAction,
  type PlatformMonthlyPnL,
  type MarginAlert,
  type ReconciliationPending,
  type CourierMarginData,
  type TopResellerData,
} from '@/actions/platform-costs'

export default function FinancialDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  // Period filter
  const [period, setPeriod] = useState<PeriodType>('30d')
  
  // Data states
  const [stats, setStats] = useState<{
    totalShipments: number;
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    avgMarginPercent: number;
    pendingReconciliation: number;
    negativeMarginCount: number;
    last30DaysShipments: number;
  } | null>(null)
  const [monthlyPnL, setMonthlyPnL] = useState<PlatformMonthlyPnL[]>([])
  const [alerts, setAlerts] = useState<MarginAlert[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationPending[]>([])
  const [courierMargins, setCourierMargins] = useState<CourierMarginData[]>([])
  const [topResellers, setTopResellers] = useState<TopResellerData[]>([])
  
  const [activeTab, setActiveTab] = useState<'overview' | 'alerts' | 'reconciliation' | 'analytics'>('overview')

  // Verifica permessi superadmin
  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }

    async function checkSuperAdmin() {
      try {
        const response = await fetch('/api/user/info')
        if (response.ok) {
          const data = await response.json()
          const userData = data.user || data
          const accountType = userData.account_type || userData.accountType

          if (accountType === 'superadmin') {
            setIsAuthorized(true)
          } else {
            router.push('/dashboard?error=unauthorized')
            return
          }
        } else {
          router.push('/dashboard?error=unauthorized')
          return
        }
      } catch (error) {
        console.error('Errore verifica superadmin:', error)
        router.push('/dashboard?error=unauthorized')
        return
      } finally {
        setIsLoading(false)
      }
    }

    checkSuperAdmin()
  }, [session, status, router])

  // Carica dati
  const loadData = useCallback(async () => {
    setIsRefreshing(true)
    
    const startDate = getStartDateForPeriod(period)
    const startDateStr = startDate?.toISOString()
    
    try {
      const [
        statsRes, 
        monthlyRes, 
        alertsRes, 
        reconciliationRes,
        courierRes,
        resellersRes
      ] = await Promise.all([
        getPlatformStatsAction(),
        getMonthlyPnLAction(12),
        getMarginAlertsAction(),
        getReconciliationPendingAction(),
        getMarginByCourierAction(startDateStr),
        getTopResellersAction(20, startDateStr),
      ])

      if (statsRes.success) setStats(statsRes.data!)
      if (monthlyRes.success) setMonthlyPnL(monthlyRes.data!)
      if (alertsRes.success) setAlerts(alertsRes.data!)
      if (reconciliationRes.success) setReconciliation(reconciliationRes.data!)
      if (courierRes.success) setCourierMargins(courierRes.data!)
      if (resellersRes.success) setTopResellers(resellersRes.data!)
    } catch (error) {
      console.error('Errore caricamento dati:', error)
      toast.error('Errore nel caricamento dei dati')
    } finally {
      setIsRefreshing(false)
    }
  }, [period])

  useEffect(() => {
    if (isAuthorized) {
      loadData()
    }
  }, [isAuthorized, loadData])

  // Handler per aggiornamento status riconciliazione
  const handleUpdateStatus = async (
    id: string, 
    newStatus: 'matched' | 'discrepancy' | 'resolved',
    notes?: string
  ) => {
    const result = await updateReconciliationStatusAction(id, newStatus, notes)
    if (result.success) {
      toast.success('Stato aggiornato')
      await loadData()
    } else {
      toast.error(result.error || 'Errore aggiornamento stato')
    }
  }

  // Export CSV handler
  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      const startDate = getStartDateForPeriod(period)
      const result = await exportFinancialCSVAction(startDate?.toISOString())
      
      if (result.success && result.csv) {
        // Download CSV
        const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `financial-export-${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        toast.success('Export completato')
      } else {
        toast.error(result.error || 'Errore export')
      }
    } catch (error) {
      console.error('Errore export:', error)
      toast.error('Errore durante l\'export')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifica permessi...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
          <p className="text-gray-600">Solo i superadmin possono accedere a questa sezione.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/dashboard/super-admin')}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Indietro
              </Button>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Financial Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                  P&L, Margini e Riconciliazione
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Period Selector */}
              <PeriodSelector value={period} onChange={setPeriod} />
              
              {/* Export CSV */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Export CSV
              </Button>
              
              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={loadData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Aggiorna
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'alerts', label: `Alert (${alerts.length})` },
              { id: 'reconciliation', label: `Riconciliazione (${reconciliation.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards - Always visible */}
        <div className="mb-8">
          <StatsCards stats={stats} isLoading={isRefreshing && !stats} />
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MonthlyPnL data={monthlyPnL} isLoading={isRefreshing && monthlyPnL.length === 0} />
            
            {/* Quick Alerts Preview */}
            <div className="space-y-6">
              <AlertsTable 
                alerts={alerts.slice(0, 5)} 
                isLoading={isRefreshing && alerts.length === 0}
                onResolve={handleUpdateStatus}
              />
              
              {alerts.length > 5 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setActiveTab('alerts')}
                >
                  Vedi tutti gli alert ({alerts.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MarginByCourierChart 
              data={courierMargins} 
              isLoading={isRefreshing && courierMargins.length === 0} 
            />
            <TopResellersTable 
              data={topResellers} 
              isLoading={isRefreshing && topResellers.length === 0} 
            />
          </div>
        )}

        {activeTab === 'alerts' && (
          <AlertsTable 
            alerts={alerts} 
            isLoading={isRefreshing && alerts.length === 0}
            onResolve={handleUpdateStatus}
          />
        )}

        {activeTab === 'reconciliation' && (
          <ReconciliationTable 
            items={reconciliation} 
            isLoading={isRefreshing && reconciliation.length === 0}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </main>

      <Toaster position="top-right" richColors />
    </div>
  )
}
