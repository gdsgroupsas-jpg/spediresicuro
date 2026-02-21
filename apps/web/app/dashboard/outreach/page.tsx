'use client';

/**
 * Reseller Outreach Dashboard — Sprint S4c
 *
 * Panoramica outreach per reseller: metriche workspace, enrollment, sequenze.
 * Accessibile ai reseller (workspace-scoped).
 * Pattern UI identico a prospects page.
 */

import { useState, useEffect } from 'react';
import {
  getOutreachOverviewReseller,
  getEnrollmentsReseller,
  getSequencesReseller,
} from '@/app/actions/outreach';
import type { OutreachOverview, EnrollmentWithMeta } from '@/app/actions/outreach';
import type { OutreachSequence, EnrollmentStatus } from '@/types/outreach';
import {
  Mail,
  Send,
  CheckCircle2,
  Eye,
  MessageSquare,
  AlertTriangle,
  Zap,
  Pause,
} from 'lucide-react';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

// ============================================
// COSTANTI
// ============================================

const STATUS_CSS: Record<EnrollmentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
  bounced: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<EnrollmentStatus, string> = {
  active: 'Attivo',
  paused: 'In Pausa',
  completed: 'Completato',
  cancelled: 'Cancellato',
  bounced: 'Bounced',
};

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

export default function ResellerOutreachPage() {
  const [activeTab, setActiveTab] = useState<'panoramica' | 'enrollment' | 'sequenze'>(
    'panoramica'
  );
  const [overview, setOverview] = useState<OutreachOverview | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentWithMeta[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | ''>('');

  // Carica overview
  useEffect(() => {
    setLoading(true);
    getOutreachOverviewReseller().then((result) => {
      if (result.success && result.data) {
        setOverview(result.data);
      } else {
        setError(result.error || 'Errore caricamento');
      }
      setLoading(false);
    });
  }, []);

  // Carica enrollment lazy
  useEffect(() => {
    if (activeTab === 'enrollment') {
      getEnrollmentsReseller(
        statusFilter ? { status: statusFilter as EnrollmentStatus } : undefined
      ).then((result) => {
        if (result.success && result.data) setEnrollments(result.data);
      });
    }
  }, [activeTab, statusFilter]);

  // Carica sequenze lazy
  useEffect(() => {
    if (activeTab === 'sequenze') {
      getSequencesReseller().then((result) => {
        if (result.success && result.data) setSequences(result.data);
      });
    }
  }, [activeTab]);

  const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;

  if (loading) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Mail className="w-7 h-7 text-indigo-600" />
          Il Mio Outreach
        </h1>
        <p className="text-gray-500 text-sm">Stato invii, sequenze e metriche del tuo workspace.</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['panoramica', 'enrollment', 'sequenze'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tab: Panoramica */}
      {activeTab === 'panoramica' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              icon={Send}
              label="Invii Totali"
              value={overview.metrics.totalSent}
              color="indigo"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Consegnati"
              value={formatPercent(overview.metrics.deliveryRate)}
              color="green"
              isText
            />
            <KpiCard
              icon={Eye}
              label="Aperti"
              value={formatPercent(overview.metrics.openRate)}
              color="blue"
              isText
            />
            <KpiCard
              icon={MessageSquare}
              label="Risposti"
              value={formatPercent(overview.metrics.replyRate)}
              color="purple"
              isText
            />
            <KpiCard
              icon={Zap}
              label="Enrollment Attivi"
              value={overview.activeEnrollments}
              color="orange"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Falliti"
              value={overview.metrics.totalFailed}
              color="red"
            />
          </div>

          {/* Channel Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Metriche per Canale</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Canale</th>
                    <th className="px-5 py-3 font-medium text-right">Inviati</th>
                    <th className="px-5 py-3 font-medium text-right">Consegnati</th>
                    <th className="px-5 py-3 font-medium text-right">Aperti</th>
                    <th className="px-5 py-3 font-medium text-right">Risposti</th>
                    <th className="px-5 py-3 font-medium text-right">Falliti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(['email', 'whatsapp', 'telegram'] as const).map((ch) => {
                    const data = overview.metrics.byChannel[ch];
                    return (
                      <tr key={ch} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900 capitalize">{ch}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{data.sent}</td>
                        <td className="px-5 py-3 text-right text-green-600">{data.delivered}</td>
                        <td className="px-5 py-3 text-right text-blue-600">{data.opened}</td>
                        <td className="px-5 py-3 text-right text-purple-600">{data.replied}</td>
                        <td className="px-5 py-3 text-right text-red-600">{data.failed}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Enrollment */}
      {activeTab === 'enrollment' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EnrollmentStatus | '')}
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              aria-label="Filtra per stato enrollment"
            >
              <option value="">Tutti gli stati</option>
              {(Object.entries(STATUS_LABELS) as [EnrollmentStatus, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {enrollments.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Nessun enrollment trovato.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-medium">Sequenza</th>
                      <th className="px-5 py-3 font-medium">Tipo</th>
                      <th className="px-5 py-3 font-medium">Stato</th>
                      <th className="px-5 py-3 font-medium">Step</th>
                      <th className="px-5 py-3 font-medium">Prossima Esecuzione</th>
                      <th className="px-5 py-3 font-medium">Aggiornato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {enrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-900">
                          {enrollment.sequence_name || enrollment.sequence_id.slice(0, 8)}
                        </td>
                        <td className="px-5 py-3 text-gray-600 capitalize text-xs">
                          {enrollment.entity_type}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CSS[enrollment.status]}`}
                          >
                            {STATUS_LABELS[enrollment.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{enrollment.current_step}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">
                          {enrollment.next_execution_at
                            ? format(new Date(enrollment.next_execution_at), 'dd MMM yyyy HH:mm', {
                                locale: itLocale,
                              })
                            : '-'}
                        </td>
                        <td className="px-5 py-3 text-gray-400 text-xs">
                          {format(new Date(enrollment.updated_at), 'dd MMM yyyy', {
                            locale: itLocale,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Sequenze */}
      {activeTab === 'sequenze' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {sequences.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              Nessuna sequenza configurata per il tuo workspace.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">Trigger</th>
                    <th className="px-5 py-3 font-medium">Stato</th>
                    <th className="px-5 py-3 font-medium">Creata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sequences.map((seq) => (
                    <tr key={seq.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{seq.name}</div>
                        {seq.description && (
                          <div className="text-xs text-gray-500 mt-0.5">{seq.description}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600 text-xs capitalize">
                        {seq.trigger_on.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            seq.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {seq.is_active ? (
                            <>
                              <Zap className="w-3 h-3" /> Attiva
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3" /> Disattiva
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {format(new Date(seq.created_at), 'dd MMM yyyy', { locale: itLocale })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// SOTTO-COMPONENTI
// ============================================

const KPI_COLORS: Record<string, { label: string; value: string }> = {
  indigo: { label: 'text-indigo-500', value: 'text-indigo-600' },
  green: { label: 'text-green-500', value: 'text-green-600' },
  blue: { label: 'text-blue-500', value: 'text-blue-600' },
  purple: { label: 'text-purple-500', value: 'text-purple-600' },
  orange: { label: 'text-orange-500', value: 'text-orange-600' },
  red: { label: 'text-red-500', value: 'text-red-600' },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  isText,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  isText?: boolean;
}) {
  const colors = KPI_COLORS[color] || KPI_COLORS.indigo;
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
      <Icon className={`w-5 h-5 ${colors.label} mb-1`} />
      <span className={`text-xs uppercase font-bold ${colors.label}`}>{label}</span>
      <span className={`${isText ? 'text-lg' : 'text-2xl'} font-bold ${colors.value} mt-0.5`}>
        {value}
      </span>
    </div>
  );
}
