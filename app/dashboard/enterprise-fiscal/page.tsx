'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  AlertTriangle,
  Archive,
  CalendarClock,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Link2,
  Scale,
  ShieldCheck,
  Timer,
  Wallet,
} from 'lucide-react'

import DashboardNav from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { getMyFiscalData } from '@/app/actions/fiscal'
import { getUserInvoices } from '@/app/actions/invoices'

const complianceItems = [
  {
    title: 'Controllo IVA automatizzato',
    description:
      'Validazione aliquote, reverse charge e regimi speciali con alert proattivi.',
    status: 'Attivo',
  },
  {
    title: 'Monitoraggio plafond esportazioni',
    description:
      'Soglie e rischio superamento con report mensili dedicati.',
    status: 'In monitoraggio',
  },
  {
    title: 'Riconciliazione fatture vs incassi',
    description:
      'Allineamento incassi bancari, note di credito e fatture emesse.',
    status: 'In revisione',
  },
]

const auditTrail = [
  {
    id: 'AUD-2381',
    action: 'Aggiornamento aliquota IVA',
    actor: 'CFO Team',
    date: '2024-06-18 11:42',
    risk: 'Basso',
  },
  {
    id: 'AUD-2382',
    action: 'Esportazione registro IVA',
    actor: 'Controller',
    date: '2024-06-18 15:10',
    risk: 'Nullo',
  },
  {
    id: 'AUD-2383',
    action: 'Override scadenza F24',
    actor: 'Finance Ops',
    date: '2024-06-19 09:05',
    risk: 'Medio',
  },
]

const fiscalCalendar = [
  {
    title: 'Scadenza F24 IVA',
    dueDate: '16 Lug',
    owner: 'Tax Manager',
    priority: 'Alta',
  },
  {
    title: 'Chiusura mensile IVA',
    dueDate: '20 Lug',
    owner: 'Accounting',
    priority: 'Media',
  },
  {
    title: 'Report trimestrale margini',
    dueDate: '30 Lug',
    owner: 'CFO',
    priority: 'Bassa',
  },
]

const exportBundles = [
  {
    title: 'Registro IVA vendite (CSV)',
    description: 'Estratto completo con mapping ERP per periodo fiscale.',
    format: 'CSV',
  },
  {
    title: 'Riconciliazione incassi (XLSX)',
    description: 'Riepilogo incassi e pagamenti con indicatori di mismatch.',
    format: 'XLSX',
  },
  {
    title: 'Audit trail completo (PDF)',
    description: 'Report firmato per revisori e compliance interna.',
    format: 'PDF',
  },
]

export default function EnterpriseFiscalPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState({
    vatDue: 82450,
    vatDelta: '+6% vs mese scorso',
    riskLevel: 'Basso',
    riskDetail: '0 anomalie critiche',
    docsToReview: 12,
    docsPriority: '3 ad alta priorità',
    closeTime: '4,2 gg',
    closeTarget: 'target 5 gg',
    totalRevenue: 0,
    totalMargin: 0,
    invoiceBacklog: 0,
  })

  const fiscalKpis = useMemo(
    () => [
      {
        label: 'IVA dovuta (Mese)',
        value: `€ ${metrics.vatDue.toLocaleString('it-IT')}`,
        delta: metrics.vatDelta,
        icon: <Wallet className="h-5 w-5 text-emerald-400" />,
      },
      {
        label: 'Rischio fiscale',
        value: metrics.riskLevel,
        delta: metrics.riskDetail,
        icon: <ShieldCheck className="h-5 w-5 text-blue-400" />,
      },
      {
        label: 'Documenti da revisionare',
        value: metrics.docsToReview.toString(),
        delta: metrics.docsPriority,
        icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
      },
      {
        label: 'Tempo medio chiusura',
        value: metrics.closeTime,
        delta: metrics.closeTarget,
        icon: <Timer className="h-5 w-5 text-purple-400" />,
      },
    ],
    [metrics]
  )

  useEffect(() => {
    if (status === 'loading') return

    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }

    async function checkAccess() {
      try {
        const response = await fetch('/api/user/info')
        if (!response.ok) {
          setIsAuthorized(false)
          setError('Impossibile verificare i permessi. Riprova più tardi.')
          return
        }

        const data = await response.json()
        const userData = data.user || data
        const accountType = userData.account_type || userData.accountType
        const resellerAdmin = userData.is_reseller && userData.reseller_role === 'admin'

        if (accountType === 'superadmin' || accountType === 'admin' || resellerAdmin) {
          setIsAuthorized(true)
        } else {
          setIsAuthorized(false)
        }
      } catch (err: any) {
        console.error('Errore verifica accesso enterprise fiscal:', err)
        setError('Errore durante la verifica accessi.')
        setIsAuthorized(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkAccess()
  }, [session, status, router])

  useEffect(() => {
    async function loadFiscalMetrics() {
      try {
        const fiscalData = await getMyFiscalData()
        if (fiscalData?.shipmentsSummary) {
          setMetrics((prev) => ({
            ...prev,
            totalRevenue: fiscalData.shipmentsSummary.total_revenue || prev.totalRevenue,
            totalMargin: fiscalData.shipmentsSummary.total_margin || prev.totalMargin,
          }))
        }

        const invoiceResponse = await getUserInvoices()
        if (Array.isArray(invoiceResponse)) {
          const backlog = invoiceResponse.filter((invoice) =>
            ['draft', 'pending', 'overdue'].includes(invoice.status)
          ).length

          setMetrics((prev) => ({
            ...prev,
            invoiceBacklog: backlog,
          }))
        }
      } catch (err) {
        console.error('Errore caricamento metriche fiscali:', err)
      }
    }

    if (isAuthorized) {
      loadFiscalMetrics()
    }
  }, [isAuthorized])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-400 mx-auto" />
          <p className="mt-4 text-slate-300">Verifica permessi enterprise...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="max-w-md text-center space-y-3">
          <ShieldCheck className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-semibold">Accesso riservato</h1>
          <p className="text-slate-400">
            Questa area fiscale enterprise è disponibile solo per Superadmin,
            Admin e Reseller Admin.
          </p>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <Button onClick={() => router.push('/dashboard')} variant="secondary">
            Torna alla dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="Enterprise Fiscal Control"
          subtitle="Governance fiscale, compliance e reporting avanzato"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Enterprise Fiscal' },
          ]}
        />

        <section className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 lg:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Executive fiscal overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Governance fiscale enterprise con monitoraggio continuo
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Centralizza compliance, audit e reporting per tutte le unità
              operative.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Scale className="h-4 w-4 text-emerald-400" />
              Volume fiscale monitorato
            </div>
            <div className="mt-3 text-2xl font-semibold">
              € {metrics.totalRevenue.toLocaleString('it-IT')}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Margine operativo: € {metrics.totalMargin.toLocaleString('it-IT')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Link2 className="h-4 w-4 text-indigo-300" />
              Fatture in lavorazione
            </div>
            <div className="mt-3 text-2xl font-semibold">{metrics.invoiceBacklog}</div>
            <p className="mt-1 text-xs text-slate-400">
              Allineamento con incassi e note di credito
            </p>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {fiscalKpis.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-400">{kpi.label}</div>
                <div className="rounded-lg bg-slate-800 p-2">{kpi.icon}</div>
              </div>
              <div className="mt-4 text-2xl font-semibold">{kpi.value}</div>
              <div className="mt-2 text-xs text-slate-400">{kpi.delta}</div>
            </div>
          ))}
        </section>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Compliance &amp; Governance</h2>
                <p className="text-sm text-slate-400">
                  Stato dei controlli e delle policy fiscali enterprise.
                </p>
              </div>
              <ClipboardCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="mt-6 space-y-4">
              {complianceItems.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-300">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Fiscal Calendar</h2>
                <p className="text-sm text-slate-400">
                  Scadenziario centralizzato con ownership.
                </p>
              </div>
              <CalendarClock className="h-6 w-6 text-blue-400" />
            </div>
            <div className="mt-6 space-y-4">
              {fiscalCalendar.map((event) => (
                <div
                  key={event.title}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="text-sm font-semibold">{event.title}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    Scadenza {event.dueDate} · Owner: {event.owner}
                  </div>
                  <span className="mt-3 inline-flex text-xs font-semibold text-amber-300">
                    Priorità {event.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Audit Trail</h2>
                <p className="text-sm text-slate-400">
                  Tracciabilità completa su attività fiscali.
                </p>
              </div>
              <Archive className="h-6 w-6 text-purple-400" />
            </div>
            <div className="mt-6 space-y-3">
              {auditTrail.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="text-sm font-semibold">{entry.action}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {entry.id} · {entry.actor}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{entry.date}</div>
                  <span className="mt-3 inline-flex text-xs font-semibold text-emerald-300">
                    Rischio {entry.risk}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Export &amp; Integration</h2>
                <p className="text-sm text-slate-400">
                  Pacchetti di export pronti per ERP e revisori.
                </p>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-indigo-300" />
            </div>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {exportBundles.map((bundle) => (
                <div
                  key={bundle.title}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold">{bundle.title}</div>
                    <p className="mt-1 text-xs text-slate-400">
                      {bundle.description}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4 w-full justify-center"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Scarica {bundle.format}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
