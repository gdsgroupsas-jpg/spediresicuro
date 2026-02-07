'use client';

/**
 * Pagina Prospect per Reseller — CRM Livello 2
 *
 * Pipeline prospect con scoring, filtri, creazione e timeline eventi.
 * Accessibile solo a reseller (is_reseller) e admin.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getProspects,
  createProspect,
  updateProspect,
  deleteProspect,
  addProspectNote,
} from '@/actions/reseller-prospects';
import type {
  ResellerProspect,
  ProspectStatus,
  ProspectSector,
  ProspectStats,
  CreateProspectDTO,
} from '@/types/reseller-prospects';
import { STATUS_LABELS, STATUS_COLORS, SECTOR_LABELS } from '@/types/reseller-prospects';
import { getScoreLabel, getScoreColor } from '@/lib/crm/lead-scoring';
import {
  UserPlus,
  Search,
  Plus,
  Phone,
  Mail,
  Trash2,
  X,
  TrendingUp,
  Users,
  Target,
  Award,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { it as itLocale } from 'date-fns/locale';

// Colori Tailwind per status
const STATUS_CSS: Record<ProspectStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  quote_sent: 'bg-purple-100 text-purple-700',
  negotiating: 'bg-orange-100 text-orange-700',
  won: 'bg-green-100 text-green-700',
  lost: 'bg-gray-100 text-gray-500',
};

// Colori per score badge
const SCORE_CSS: Record<string, string> = {
  red: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  gray: 'bg-gray-100 text-gray-500 border-gray-200',
};

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<ResellerProspect[]>([]);
  const [stats, setStats] = useState<ProspectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | ''>('');
  const [sectorFilter, setSectorFilter] = useState<ProspectSector | ''>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProspects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProspects({
        search: search || undefined,
        status: statusFilter || undefined,
        sector: sectorFilter || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      if (result.success && result.data) {
        setProspects(result.data.prospects);
        setStats(result.data.stats);
      } else {
        setError(result.error || 'Errore caricamento');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, sectorFilter]);

  useEffect(() => {
    loadProspects();
  }, [loadProspects]);

  // --- Handlers ---

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    // Optimistic UI
    setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)));
    try {
      const result = await updateProspect(id, { status: newStatus });
      if (!result.success) {
        alert(result.error || 'Errore aggiornamento stato');
        loadProspects(); // Revert
      } else {
        loadProspects(); // Aggiorna stats
      }
    } catch {
      loadProspects();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo prospect?')) return;
    try {
      const result = await deleteProspect(id);
      if (result.success) {
        setProspects((prev) => prev.filter((p) => p.id !== id));
        loadProspects();
      } else {
        alert(result.error);
      }
    } catch {
      alert('Errore eliminazione');
    }
  };

  const handleCreate = async (data: CreateProspectDTO) => {
    try {
      const result = await createProspect(data);
      if (result.success) {
        setShowCreateModal(false);
        loadProspects();
      } else {
        alert(result.error);
      }
    } catch {
      alert('Errore creazione');
    }
  };

  // --- Formattatori ---

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy', { locale: itLocale });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-indigo-600" />I Miei Prospect
          </h1>
          <p className="text-gray-500 text-sm">
            Gestisci i potenziali clienti e traccia la pipeline vendite.
          </p>
        </div>

        {stats && (
          <div className="flex gap-3 flex-wrap">
            <StatCard label="Totali" value={stats.total} icon={Users} color="gray" />
            <StatCard label="Nuovi" value={stats.by_status.new} icon={Target} color="blue" />
            <StatCard
              label="In Trattativa"
              value={stats.by_status.negotiating + stats.by_status.quote_sent}
              icon={TrendingUp}
              color="orange"
            />
            <StatCard
              label="Vinti (mese)"
              value={stats.won_this_month}
              icon={Award}
              color="green"
            />
            <StatCard
              label="Pipeline"
              value={formatCurrency(stats.pipeline_value)}
              icon={TrendingUp}
              color="indigo"
              isText
            />
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca azienda, nome o email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filtro status */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProspectStatus | '')}
              className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
            >
              <option value="">Tutti gli stati</option>
              {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro settore */}
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value as ProspectSector | '')}
            className="py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none"
          >
            <option value="">Tutti i settori</option>
            {(Object.keys(SECTOR_LABELS) as ProspectSector[]).map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        <button
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 whitespace-nowrap"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4" /> Nuovo Prospect
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Caricamento prospect...</div>
        ) : prospects.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium text-gray-500">Nessun prospect trovato</p>
            <p className="text-sm mt-1">Crea il tuo primo prospect per iniziare la pipeline.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/50 border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-medium">Azienda / Contatto</th>
                  <th className="px-6 py-4 font-medium">Contatti</th>
                  <th className="px-6 py-4 font-medium">Stato</th>
                  <th className="px-6 py-4 font-medium">Score</th>
                  <th className="px-6 py-4 font-medium">Settore</th>
                  <th className="px-6 py-4 font-medium">Valore/mese</th>
                  <th className="px-6 py-4 font-medium">Ultimo Contatto</th>
                  <th className="px-6 py-4 font-medium text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prospects.map((prospect) => {
                  const scoreColor = getScoreColor(prospect.lead_score);
                  return (
                    <tr key={prospect.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{prospect.company_name}</div>
                        <div className="text-gray-500 text-xs">
                          {prospect.contact_name || 'Nessun contatto'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {prospect.email && (
                            <a
                              href={`mailto:${prospect.email}`}
                              className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600 text-xs"
                            >
                              <Mail className="w-3 h-3" /> {prospect.email}
                            </a>
                          )}
                          {prospect.phone && (
                            <a
                              href={`tel:${prospect.phone}`}
                              className="flex items-center gap-1.5 text-gray-600 hover:text-indigo-600 text-xs"
                            >
                              <Phone className="w-3 h-3" /> {prospect.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={prospect.status}
                          onChange={(e) =>
                            handleStatusChange(prospect.id, e.target.value as ProspectStatus)
                          }
                          className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer outline-none ring-1 ring-inset ring-black/5 ${STATUS_CSS[prospect.status]}`}
                        >
                          {(Object.keys(STATUS_LABELS) as ProspectStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${SCORE_CSS[scoreColor] || SCORE_CSS.gray}`}
                        >
                          {prospect.lead_score}
                          <span className="font-normal text-[10px]">
                            {getScoreLabel(prospect.lead_score)}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {prospect.sector ? SECTOR_LABELS[prospect.sector] || prospect.sector : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-700 text-xs">
                        {formatCurrency(prospect.estimated_monthly_value)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {formatDate(prospect.last_contact_at || prospect.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDelete(prospect.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Modal Creazione */}
      {showCreateModal && (
        <CreateProspectModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </div>
  );
}

// ============================================
// COMPONENTI
// ============================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isText,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center min-w-[100px]">
      <span className={`text-xs text-${color}-500 uppercase font-bold`}>{label}</span>
      <span className={`${isText ? 'text-sm' : 'text-xl'} font-bold text-${color}-600`}>
        {value}
      </span>
    </div>
  );
}

function CreateProspectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: CreateProspectDTO) => void;
}) {
  const [form, setForm] = useState<Partial<CreateProspectDTO>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name?.trim()) {
      alert('Il nome azienda e obbligatorio');
      return;
    }
    setSubmitting(true);
    await onCreate({
      workspace_id: '', // Settato server-side da getWorkspaceAuth
      company_name: form.company_name.trim(),
      contact_name: form.contact_name?.trim() || undefined,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      sector: form.sector || undefined,
      estimated_monthly_volume: form.estimated_monthly_volume || undefined,
      estimated_monthly_value: form.estimated_monthly_value || undefined,
      notes: form.notes?.trim() || undefined,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Nuovo Prospect</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Azienda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Azienda *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Es. FastShip SRL"
              value={form.company_name || ''}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
            />
          </div>

          {/* Contatto */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Contatto</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="Mario Rossi"
                value={form.contact_name || ''}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={form.sector || ''}
                onChange={(e) =>
                  setForm({ ...form, sector: (e.target.value as ProspectSector) || undefined })
                }
              >
                <option value="">Seleziona...</option>
                {(Object.keys(SECTOR_LABELS) as ProspectSector[]).map((s) => (
                  <option key={s} value={s}>
                    {SECTOR_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contatti */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="info@azienda.it"
                value={form.email || ''}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="+39 333 1234567"
                value={form.phone || ''}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Business */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Spedizioni/mese stimate
              </label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="100"
                value={form.estimated_monthly_volume || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimated_monthly_volume: parseInt(e.target.value) || undefined,
                  })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valore/mese stimato (EUR)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="5000"
                value={form.estimated_monthly_value || ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimated_monthly_value: parseFloat(e.target.value) || undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              placeholder="Informazioni aggiuntive sul prospect..."
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-200"
            >
              {submitting ? 'Creazione...' : 'Crea Prospect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
