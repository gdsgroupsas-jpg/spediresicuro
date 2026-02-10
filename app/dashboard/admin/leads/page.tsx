'use client';

/**
 * Pagina Lead Management — CRM Livello 1 (Admin)
 *
 * Pipeline lead per acquisizione reseller con scoring, filtri,
 * creazione, timeline eventi e conversione a reseller.
 * Accessibile solo a admin/superadmin.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getLeads,
  createLead,
  updateLead,
  deleteLead,
  addLeadNote,
  convertLeadToReseller,
  getLeadEvents,
} from '@/app/actions/leads';
import { getLeadAnalytics } from '@/app/actions/crm-analytics';
import { getCrmHealthAlerts } from '@/app/actions/crm-health';
import type { HealthAlertsSummary } from '@/app/actions/crm-health';
import type { CrmAnalyticsData } from '@/lib/crm/analytics';
import dynamic from 'next/dynamic';
const CrmAnalyticsPanel = dynamic(() => import('@/components/crm-analytics-panel'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-100 rounded-xl h-64" />,
});
import CrmHealthAlerts from '@/components/crm-health-alerts';
import type {
  Lead,
  LeadStatus,
  LeadSource,
  LeadSector,
  GeographicZone,
  LeadEvent,
  CreateLeadDTO,
} from '@/types/leads';
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_SECTOR_LABELS,
  GEOGRAPHIC_ZONE_LABELS,
  LEAD_VALID_TRANSITIONS,
} from '@/types/leads';
import { getScoreLabel, getScoreColor } from '@/lib/crm/lead-scoring';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  Trash2,
  X,
  UserPlus,
  ArrowRight,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';

// Colori CSS per status badge
const STATUS_CSS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-indigo-100 text-indigo-700',
  qualified: 'bg-orange-100 text-orange-700',
  negotiation: 'bg-purple-100 text-purple-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-500',
};

// Colori CSS per score badge
const SCORE_CSS: Record<string, string> = {
  red: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  gray: 'bg-gray-100 text-gray-500 border-gray-200',
};

// Colori per StatCard (espliciti per Tailwind JIT)
const STAT_COLORS: Record<string, { label: string; value: string }> = {
  gray: { label: 'text-gray-500', value: 'text-gray-600' },
  blue: { label: 'text-blue-500', value: 'text-blue-600' },
  orange: { label: 'text-orange-500', value: 'text-orange-600' },
  green: { label: 'text-green-500', value: 'text-green-600' },
  purple: { label: 'text-purple-500', value: 'text-purple-600' },
  indigo: { label: 'text-indigo-500', value: 'text-indigo-600' },
};

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  negotiation: number;
  won: number;
  lost: number;
  avgScore: number;
}

function StatCard({
  label,
  value,
  color = 'gray',
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  const colors = STAT_COLORS[color] || STAT_COLORS.gray;
  return (
    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center min-w-[90px]">
      <span className={`text-xs uppercase font-bold ${colors.label}`}>{label}</span>
      <span className={`text-xl font-bold ${colors.value}`}>{value}</span>
    </div>
  );
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [sectorFilter, setSectorFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState<Lead | null>(null);
  const [showTimeline, setShowTimeline] = useState<Lead | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<LeadEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'analisi' | 'salute'>('pipeline');
  const [analytics, setAnalytics] = useState<CrmAnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [healthData, setHealthData] = useState<HealthAlertsSummary | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Caricamento lazy analytics: solo al click su tab "Analisi"
  useEffect(() => {
    if (activeTab === 'analisi' && !analytics) {
      setAnalyticsLoading(true);
      getLeadAnalytics().then((result) => {
        if (result.success && result.data) setAnalytics(result.data);
        setAnalyticsLoading(false);
      });
    }
  }, [activeTab, analytics]);

  // Caricamento lazy health alerts: solo al click su tab "Salute"
  useEffect(() => {
    if (activeTab === 'salute' && !healthData) {
      setHealthLoading(true);
      getCrmHealthAlerts().then((result) => {
        if (result.success && result.data) setHealthData(result.data);
        setHealthLoading(false);
      });
    }
  }, [activeTab, healthData]);

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getLeads({
        search: search || undefined,
        status: statusFilter || undefined,
        sector: sectorFilter || undefined,
        source: sourceFilter || undefined,
        zone: zoneFilter || undefined,
        sortBy: 'created_at',
        sortDir: 'desc',
      });

      if (result.success && result.data) {
        setLeads(result.data.leads);
        setStats(result.data.stats);
      } else {
        setError(result.error || 'Errore caricamento');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, sectorFilter, sourceFilter, zoneFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Carica timeline quando si apre il drawer
  useEffect(() => {
    if (showTimeline) {
      getLeadEvents(showTimeline.id).then((res) => {
        if (res.success && res.data) {
          setTimelineEvents(res.data);
        }
      });
    }
  }, [showTimeline]);

  const handleStatusChange = async (lead: Lead, newStatus: LeadStatus) => {
    const validTargets = LEAD_VALID_TRANSITIONS[lead.status] || [];
    if (!validTargets.includes(newStatus)) {
      alert(`Transizione ${lead.status} → ${newStatus} non valida`);
      return;
    }

    try {
      const result = await updateLead(lead.id, {
        status: newStatus,
        lost_reason:
          newStatus === 'lost' ? prompt('Motivo perdita (opzionale):') || undefined : undefined,
      });
      if (!result.success) {
        alert(result.error);
      }
      loadLeads();
    } catch {
      loadLeads();
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirm) return;
    try {
      const result = await deleteLead(deleteConfirm);
      if (!result.success) {
        setError(result.error || 'Errore eliminazione');
      }
      loadLeads();
    } catch {
      setError('Errore eliminazione');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleAddNote = async (lead: Lead) => {
    const note = prompt('Aggiungi nota:');
    if (!note) return;

    const result = await addLeadNote(lead.id, note);
    if (!result.success) {
      alert(result.error);
    }
    loadLeads();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Lead Management
          </h1>
          <p className="text-gray-500 text-sm">
            Pipeline acquisizione reseller con scoring e conversione.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatCard label="Totali" value={stats?.total || 0} color="gray" />
          <StatCard label="Nuovi" value={stats?.new || 0} color="blue" />
          <StatCard label="Qualificati" value={stats?.qualified || 0} color="orange" />
          <StatCard label="In Trattativa" value={stats?.negotiation || 0} color="purple" />
          <StatCard label="Convertiti" value={stats?.won || 0} color="green" />
          <StatCard label="Score Medio" value={stats?.avgScore || 0} color="indigo" />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'pipeline'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pipeline
        </button>
        <button
          onClick={() => setActiveTab('analisi')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'analisi'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Analisi
        </button>
        <button
          onClick={() => setActiveTab('salute')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'salute'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Salute
          {healthData && healthData.totalCritical > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {healthData.totalCritical}
            </span>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Tab: Pipeline */}
      {activeTab === 'pipeline' && (
        <>
          {/* Action Bar */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca azienda, nome, email..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeadStatus | '')}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Tutti gli stati</option>
                {(Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Tutti i settori</option>
                {(Object.entries(LEAD_SECTOR_LABELS) as [LeadSector, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Tutte le fonti</option>
                {(Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Tutte le zone</option>
                {(Object.entries(GEOGRAPHIC_ZONE_LABELS) as [GeographicZone, string][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  )
                )}
              </select>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Nuovo Lead
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-gray-400">Caricamento leads...</div>
            ) : leads.length === 0 ? (
              <div className="p-12 text-center text-gray-400">Nessun lead trovato.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Azienda / Contatto</th>
                      <th className="px-4 py-3 font-medium">Contatti</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium">Stato</th>
                      <th className="px-4 py-3 font-medium">Settore</th>
                      <th className="px-4 py-3 font-medium">Fonte</th>
                      <th className="px-4 py-3 font-medium">Volume</th>
                      <th className="px-4 py-3 font-medium">Ultimo Contatto</th>
                      <th className="px-4 py-3 font-medium text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => {
                      const score = lead.lead_score || 0;
                      const scoreColor = getScoreColor(score);
                      const scoreLabel = getScoreLabel(score);
                      const canConvert = ['qualified', 'negotiation'].includes(lead.status);

                      return (
                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setShowTimeline(lead)}
                              className="text-left hover:underline"
                            >
                              <div className="font-semibold text-gray-900">{lead.company_name}</div>
                              <div className="text-gray-500 text-xs">
                                {lead.contact_name || 'Nessun contatto'}
                              </div>
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-0.5">
                              {lead.email && (
                                <a
                                  href={`mailto:${lead.email}`}
                                  className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 text-xs"
                                >
                                  <Mail className="w-3 h-3" /> {lead.email}
                                </a>
                              )}
                              {lead.phone && (
                                <a
                                  href={`tel:${lead.phone}`}
                                  className="flex items-center gap-1 text-gray-600 hover:text-indigo-600 text-xs"
                                >
                                  <Phone className="w-3 h-3" /> {lead.phone}
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${SCORE_CSS[scoreColor] || SCORE_CSS.gray}`}
                            >
                              {score} — {scoreLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={lead.status}
                              onChange={(e) =>
                                handleStatusChange(lead, e.target.value as LeadStatus)
                              }
                              className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer outline-none ring-1 ring-inset ring-black/5 ${STATUS_CSS[lead.status]}`}
                            >
                              <option value={lead.status}>{LEAD_STATUS_LABELS[lead.status]}</option>
                              {(LEAD_VALID_TRANSITIONS[lead.status] || []).map((s) => (
                                <option key={s} value={s}>
                                  {LEAD_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {lead.sector
                              ? LEAD_SECTOR_LABELS[lead.sector as LeadSector] || lead.sector
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {lead.lead_source
                              ? LEAD_SOURCE_LABELS[lead.lead_source as LeadSource] ||
                                lead.lead_source
                              : lead.source || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {lead.estimated_monthly_volume
                              ? `${lead.estimated_monthly_volume}/mese`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {lead.last_contact_at
                              ? format(new Date(lead.last_contact_at), 'dd MMM yyyy', {
                                  locale: itLocale,
                                })
                              : 'Mai'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleAddNote(lead)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title="Aggiungi nota"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setShowTimeline(lead)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                title="Timeline"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                              {canConvert && (
                                <button
                                  onClick={() => setShowConvertModal(lead)}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                                  title="Converti a Reseller"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteConfirm(lead.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab: Analisi */}
      {activeTab === 'analisi' &&
        (analyticsLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
            <p>Caricamento analisi CRM...</p>
          </div>
        ) : analytics ? (
          <CrmAnalyticsPanel data={analytics} variant="admin" />
        ) : (
          <div className="p-12 text-center text-gray-400">Errore caricamento analytics</div>
        ))}

      {/* Tab: Salute */}
      {activeTab === 'salute' &&
        (healthLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3" />
            <p>Caricamento alert salute CRM...</p>
          </div>
        ) : healthData ? (
          <CrmHealthAlerts data={healthData} />
        ) : (
          <div className="p-12 text-center text-gray-400">Errore caricamento alert</div>
        ))}

      {/* Modal Creazione Lead */}
      {showCreateModal && (
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadLeads();
          }}
        />
      )}

      {/* Modal Conversione */}
      {showConvertModal && (
        <ConvertLeadModal
          lead={showConvertModal}
          onClose={() => setShowConvertModal(null)}
          onConverted={() => {
            setShowConvertModal(null);
            loadLeads();
          }}
        />
      )}

      {/* Drawer Timeline */}
      {showTimeline && (
        <TimelineDrawer
          lead={showTimeline}
          events={timelineEvents}
          onClose={() => {
            setShowTimeline(null);
            setTimelineEvents([]);
          }}
        />
      )}

      {/* Confirm dialog eliminazione lead */}
      <ConfirmActionDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirmed}
        title="Eliminare questo lead?"
        description="Questa azione è irreversibile. Il lead e tutti i suoi eventi verranno eliminati definitivamente."
        confirmText="Elimina"
        variant="destructive"
      />
    </div>
  );
}

// ============================================
// MODAL: Creazione Lead
// ============================================

function CreateLeadModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateLeadDTO>({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    lead_source: 'direct',
    sector: undefined,
    estimated_monthly_volume: undefined,
    geographic_zone: undefined,
    notes: '',
    estimated_value: undefined,
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async () => {
    if (!form.company_name.trim()) {
      setFormError('Nome azienda obbligatorio');
      return;
    }
    setLoading(true);
    setFormError('');
    const result = await createLead(form);
    setLoading(false);
    if (result.success) {
      onCreated();
    } else {
      setFormError(result.error || 'Errore creazione');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">Nuovo Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {formError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Azienda *</label>
              <input
                type="text"
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Nome azienda"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contatto</label>
              <input
                type="text"
                value={form.contact_name || ''}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Nome e cognome"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                type="tel"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="+39..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
              <select
                value={form.sector || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sector: (e.target.value || undefined) as LeadSector | undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Seleziona...</option>
                {(Object.entries(LEAD_SECTOR_LABELS) as [LeadSector, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fonte</label>
              <select
                value={form.lead_source || 'direct'}
                onChange={(e) => setForm({ ...form, lead_source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {(Object.entries(LEAD_SOURCE_LABELS) as [LeadSource, string][]).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Volume stimato (sped/mese)
              </label>
              <input
                type="number"
                value={form.estimated_monthly_volume || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimated_monthly_volume: e.target.value ? parseInt(e.target.value) : undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="es. 100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Zona</label>
              <select
                value={form.geographic_zone || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    geographic_zone: (e.target.value || undefined) as GeographicZone | undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="">Seleziona...</option>
                {(Object.entries(GEOGRAPHIC_ZONE_LABELS) as [GeographicZone, string][]).map(
                  ([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              rows={3}
              placeholder="Note iniziali..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creazione...' : 'Crea Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL: Conversione Lead → Reseller
// ============================================

function ConvertLeadModal({
  lead,
  onClose,
  onConverted,
}: {
  lead: Lead;
  onClose: () => void;
  onConverted: () => void;
}) {
  const [form, setForm] = useState({
    resellerName: lead.contact_name || lead.company_name,
    resellerEmail: lead.email || '',
    resellerPassword: '',
    initialCredit: 0,
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successData, setSuccessData] = useState<{
    userId: string;
    workspaceId: string;
  } | null>(null);

  const handleConvert = async () => {
    if (!form.resellerEmail.trim()) {
      setFormError('Email obbligatoria');
      return;
    }
    if (!form.resellerPassword || form.resellerPassword.length < 8) {
      setFormError('Password minimo 8 caratteri');
      return;
    }
    setLoading(true);
    setFormError('');

    const result = await convertLeadToReseller({
      leadId: lead.id,
      resellerName: form.resellerName,
      resellerEmail: form.resellerEmail,
      resellerPassword: form.resellerPassword,
      initialCredit: form.initialCredit > 0 ? form.initialCredit : undefined,
    });

    setLoading(false);

    if (result.success && result.data) {
      setSuccessData(result.data);
    } else {
      setFormError(result.error || 'Errore conversione');
    }
  };

  if (successData) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Reseller Creato!</h2>
          <p className="text-gray-600 mb-4">{lead.company_name} e stato convertito in reseller.</p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-1 mb-4">
            <p>
              <span className="font-medium">Email:</span> {form.resellerEmail}
            </p>
            <p>
              <span className="font-medium">Password:</span> {form.resellerPassword}
            </p>
            <p>
              <span className="font-medium">Credito:</span>{' '}
              {form.initialCredit > 0 ? `${form.initialCredit} EUR` : 'Nessuno'}
            </p>
          </div>
          <button
            onClick={onConverted}
            className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 w-full"
          >
            Chiudi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            Converti a Reseller
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-indigo-50 rounded-lg p-3 text-sm text-indigo-700">
            Lead: <strong>{lead.company_name}</strong> ({LEAD_STATUS_LABELS[lead.status]})
          </div>

          {formError && (
            <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome reseller</label>
            <input
              type="text"
              value={form.resellerName}
              onChange={(e) => setForm({ ...form, resellerName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email account *</label>
            <input
              type="email"
              value={form.resellerEmail}
              onChange={(e) => setForm({ ...form, resellerEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password temporanea * (min 8 caratteri)
            </label>
            <input
              type="text"
              value={form.resellerPassword}
              onChange={(e) => setForm({ ...form, resellerPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Almeno 8 caratteri"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Credito iniziale (EUR)
            </label>
            <input
              type="number"
              value={form.initialCredit || ''}
              onChange={(e) => setForm({ ...form, initialCredit: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="0"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleConvert}
            disabled={loading}
            className="px-5 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              'Conversione...'
            ) : (
              <>
                <ArrowRight className="w-4 h-4" /> Converti
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DRAWER: Timeline eventi
// ============================================

const EVENT_LABELS: Record<string, string> = {
  created: 'Lead creato',
  contacted: 'Contattato',
  note_added: 'Nota aggiunta',
  email_sent: 'Email inviata',
  email_opened: 'Email aperta',
  qualified: 'Qualificato',
  negotiation_started: 'Negoziazione avviata',
  converted: 'Convertito a reseller',
  lost: 'Lead perso',
  reactivated: 'Riattivato',
  score_changed: 'Score aggiornato',
  assigned: 'Assegnato',
};

const EVENT_ICONS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-600',
  contacted: 'bg-indigo-100 text-indigo-600',
  converted: 'bg-green-100 text-green-600',
  lost: 'bg-gray-100 text-gray-500',
  qualified: 'bg-orange-100 text-orange-600',
  negotiation_started: 'bg-purple-100 text-purple-600',
  note_added: 'bg-yellow-100 text-yellow-600',
  score_changed: 'bg-pink-100 text-pink-600',
  assigned: 'bg-teal-100 text-teal-600',
};

function TimelineDrawer({
  lead,
  events,
  onClose,
}: {
  lead: Lead;
  events: LeadEvent[];
  onClose: () => void;
}) {
  const score = lead.lead_score || 0;
  const scoreColor = getScoreColor(score);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-gray-900">{lead.company_name}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CSS[lead.status]}`}
            >
              {LEAD_STATUS_LABELS[lead.status]}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${SCORE_CSS[scoreColor] || SCORE_CSS.gray}`}
            >
              Score: {score}
            </span>
          </div>
          {lead.contact_name && <p className="text-gray-500 text-sm mt-2">{lead.contact_name}</p>}
          {lead.sector && (
            <p className="text-gray-400 text-xs mt-1">
              {LEAD_SECTOR_LABELS[lead.sector as LeadSector] || lead.sector}
              {lead.geographic_zone &&
                ` — ${GEOGRAPHIC_ZONE_LABELS[lead.geographic_zone as GeographicZone] || lead.geographic_zone}`}
            </p>
          )}
          {lead.notes && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {lead.notes}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Timeline</h3>
          {events.length === 0 ? (
            <p className="text-gray-400 text-sm">Nessun evento registrato.</p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="flex gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${EVENT_ICONS[event.event_type] || 'bg-gray-100 text-gray-500'}`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {EVENT_LABELS[event.event_type] || event.event_type}
                    </p>
                    {event.event_data && Object.keys(event.event_data).length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatEventData(event.event_data)}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(event.created_at), "dd MMM yyyy 'alle' HH:mm", {
                        locale: itLocale,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatEventData(data: Record<string, unknown>): string {
  const parts: string[] = [];
  if (data.from_status && data.to_status) {
    const from = LEAD_STATUS_LABELS[data.from_status as LeadStatus] || String(data.from_status);
    const to = LEAD_STATUS_LABELS[data.to_status as LeadStatus] || String(data.to_status);
    parts.push(`${from} → ${to}`);
  }
  if (data.lost_reason) parts.push(`Motivo: ${data.lost_reason}`);
  if (data.old_score !== undefined && data.new_score !== undefined) {
    parts.push(`${data.old_score} → ${data.new_score}`);
  }
  if (data.note_preview) parts.push(`"${data.note_preview}"`);
  if (data.reseller_email) parts.push(`Email: ${data.reseller_email}`);
  return parts.join(' | ');
}
