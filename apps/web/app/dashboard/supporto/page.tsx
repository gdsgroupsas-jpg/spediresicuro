'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Headphones,
  Search,
  CheckCircle,
  AlertTriangle,
  User,
  MessageSquare,
  Loader2,
  ChevronRight,
  X,
  Brain,
  BarChart3,
  Shield,
  ShieldCheck,
  Trash2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Bell,
  Mail,
  Send,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface Escalation {
  id: string;
  user_id: string;
  shipment_id: string | null;
  reason: string;
  anne_summary: string;
  conversation_snapshot: any[];
  status: 'open' | 'assigned' | 'resolved' | 'closed';
  assigned_to: string | null;
  resolution: string | null;
  metadata: Record<string, any>;
  created_at: string;
  assigned_at: string | null;
  resolved_at: string | null;
  users?: { email: string; name: string };
}

interface CasePattern {
  id: string;
  category: string;
  carrier: string | null;
  trigger_conditions: Record<string, any>;
  resolution_action: string;
  resolution_params: Record<string, any>;
  successful_message: string | null;
  confidence_score: number;
  success_count: number;
  failure_count: number;
  human_validated: boolean;
  is_active: boolean;
  created_at: string;
}

interface Analytics {
  escalations: {
    total: number;
    byStatus: Record<string, number>;
    avgResolutionHours: number;
    last30Days: number;
  };
  patterns: {
    total: number;
    active: number;
    humanValidated: number;
    avgConfidence: number;
    topPatterns: {
      id: string;
      category: string;
      carrier: string | null;
      confidence: number;
      usageCount: number;
    }[];
  };
  notifications: {
    total: number;
    byType: Record<string, number>;
    byChannel: Record<string, number>;
    last30Days: number;
  };
  patternUsage: {
    total: number;
    successRate: number;
    byOutcome: Record<string, number>;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_CONFIG = {
  open: { label: 'Aperta', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  assigned: { label: 'Assegnata', color: 'bg-yellow-100 text-yellow-800', icon: User },
  resolved: { label: 'Risolta', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Chiusa', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  giacenza: 'Giacenza',
  cancellazione: 'Cancellazione',
  rimborso: 'Rimborso',
  tracking: 'Tracking',
  creazione: 'Creazione',
  generico: 'Generico',
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function SupportoPage() {
  const [activeTab, setActiveTab] = useState('escalations');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Headphones className="w-6 h-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supporto Anne</h1>
          <p className="text-sm text-gray-500">
            Escalation, knowledge base e analytics del sistema di supporto AI
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="escalations">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Escalation
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <Brain className="w-4 h-4 mr-1.5" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="escalations">
          <EscalationsTab />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ESCALATIONS
// ═══════════════════════════════════════════════════════════════════════════

function EscalationsTab() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'resolved'>('open');
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchEscalations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (search) params.set('search', search);
      const res = await fetch(`/api/support/escalations?${params}`);
      const data = await res.json();
      if (data.success) setEscalations(data.escalations || []);
    } catch (error) {
      console.error('Errore caricamento escalation:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchEscalations();
  }, [fetchEscalations]);

  async function updateEscalation(id: string, updates: Record<string, any>) {
    setSaving(true);
    try {
      const res = await fetch('/api/support/escalations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedEscalation(null);
        setResolution('');
        fetchEscalations();
      }
    } catch (error) {
      console.error('Errore aggiornamento:', error);
    } finally {
      setSaving(false);
    }
  }

  const counts = {
    open: escalations.filter((e) => e.status === 'open').length,
    assigned: escalations.filter((e) => e.status === 'assigned').length,
    resolved: escalations.filter((e) => e.status === 'resolved').length,
  };

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'open', 'assigned', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Tutte' : STATUS_CONFIG[f].label}
            {f !== 'all' && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {counts[f]}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchEscalations()}
            placeholder="Cerca..."
            className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : escalations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p className="font-medium">
            Nessuna escalation{' '}
            {filter !== 'all'
              ? STATUS_CONFIG[filter as keyof typeof STATUS_CONFIG]?.label.toLowerCase()
              : ''}
          </p>
          <p className="text-sm mt-1">Anne sta gestendo tutto!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {escalations.map((esc) => {
            const config = STATUS_CONFIG[esc.status];
            const StatusIcon = config.icon;
            return (
              <div
                key={esc.id}
                onClick={() => setSelectedEscalation(esc)}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-sm cursor-pointer transition-all"
              >
                <StatusIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{esc.reason}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {esc.users?.email || esc.user_id} &middot;{' '}
                    {new Date(esc.created_at).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selectedEscalation && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
          <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold text-lg">Dettaglio Escalation</h2>
              <button onClick={() => setSelectedEscalation(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedEscalation.reason}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Utente: {selectedEscalation.users?.email || selectedEscalation.user_id}
                </p>
                <p className="text-sm text-gray-500">
                  Data: {new Date(selectedEscalation.created_at).toLocaleString('it-IT')}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-900">Riassunto di Anne</span>
                </div>
                <p className="text-sm text-purple-800">{selectedEscalation.anne_summary}</p>
              </div>
              {selectedEscalation.conversation_snapshot?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Conversazione</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 rounded-lg p-3">
                    {selectedEscalation.conversation_snapshot.map((msg: any, i: number) => (
                      <div
                        key={i}
                        className={`text-xs p-2 rounded ${
                          msg.role === 'user'
                            ? 'bg-blue-50 text-blue-900'
                            : 'bg-white text-gray-700 border'
                        }`}
                      >
                        <span className="font-medium">
                          {msg.role === 'user' ? 'Utente' : 'Anne'}:
                        </span>{' '}
                        {msg.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedEscalation.metadata &&
                Object.keys(selectedEscalation.metadata).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Dati aggiuntivi</h4>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedEscalation.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              {(selectedEscalation.status === 'open' ||
                selectedEscalation.status === 'assigned') && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Risoluzione
                  </label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Descrivi come hai risolto il problema..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex gap-2 mt-2">
                    {selectedEscalation.status === 'open' && (
                      <button
                        onClick={() =>
                          updateEscalation(selectedEscalation.id, { status: 'assigned' })
                        }
                        disabled={saving}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50"
                      >
                        Prendi in carico
                      </button>
                    )}
                    <button
                      onClick={() =>
                        updateEscalation(selectedEscalation.id, {
                          status: 'resolved',
                          resolution,
                        })
                      }
                      disabled={saving || !resolution.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Risolvi'}
                    </button>
                  </div>
                </div>
              )}
              {selectedEscalation.resolution && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-green-900 mb-1">Risoluzione</h4>
                  <p className="text-sm text-green-800">{selectedEscalation.resolution}</p>
                  {selectedEscalation.resolved_at && (
                    <p className="text-xs text-green-600 mt-1">
                      Risolta il {new Date(selectedEscalation.resolved_at).toLocaleString('it-IT')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════════════

function KnowledgeTab() {
  const [patterns, setPatterns] = useState<CasePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      if (activeOnly) params.set('active', 'true');
      params.set('limit', '100');
      const res = await fetch(`/api/support/patterns?${params}`);
      const data = await res.json();
      if (data.success) {
        setPatterns(data.patterns || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Errore caricamento patterns:', error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, activeOnly]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  async function toggleField(id: string, field: 'is_active' | 'human_validated', current: boolean) {
    setSaving(id);
    try {
      const res = await fetch('/api/support/patterns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: !current }),
      });
      if ((await res.json()).success) {
        setPatterns((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: !current } : p)));
      }
    } catch (error) {
      console.error('Errore toggle:', error);
    } finally {
      setSaving(null);
    }
  }

  async function deletePattern(id: string) {
    if (!confirm("Eliminare questo pattern? L'azione non e reversibile.")) return;
    setSaving(id);
    try {
      const res = await fetch(`/api/support/patterns?id=${id}`, { method: 'DELETE' });
      if ((await res.json()).success) {
        setPatterns((prev) => prev.filter((p) => p.id !== id));
        setTotal((prev) => prev - 1);
      }
    } catch (error) {
      console.error('Errore eliminazione:', error);
    } finally {
      setSaving(null);
    }
  }

  function confidenceBadge(score: number) {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Tutte le categorie</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Solo attivi
        </label>

        <span className="text-sm text-gray-400 ml-auto">{total} pattern totali</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
        </div>
      ) : patterns.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-3 text-purple-300" />
          <p className="font-medium">Nessun pattern trovato</p>
          <p className="text-sm mt-1">Anne impara automaticamente dai casi risolti</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Categoria</th>
                <th className="pb-2 font-medium">Corriere</th>
                <th className="pb-2 font-medium">Azione</th>
                <th className="pb-2 font-medium text-center">Confidence</th>
                <th className="pb-2 font-medium text-center">Uso</th>
                <th className="pb-2 font-medium text-center">Validato</th>
                <th className="pb-2 font-medium text-center">Attivo</th>
                <th className="pb-2 font-medium text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {patterns.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {CATEGORY_LABELS[p.category] || p.category}
                    </span>
                  </td>
                  <td className="py-2.5 text-gray-600">
                    {p.carrier ? (
                      p.carrier.toUpperCase()
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="py-2.5 text-gray-900 font-mono text-xs">{p.resolution_action}</td>
                  <td className="py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${confidenceBadge(p.confidence_score)}`}
                    >
                      {Math.round(p.confidence_score * 100)}%
                    </span>
                  </td>
                  <td className="py-2.5 text-center text-gray-600">
                    <span className="text-green-600">{p.success_count}</span>
                    {' / '}
                    <span className="text-red-600">{p.failure_count}</span>
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => toggleField(p.id, 'human_validated', p.human_validated)}
                      disabled={saving === p.id}
                      className="text-gray-400 hover:text-purple-600 transition-colors"
                      title={p.human_validated ? 'Rimuovi validazione' : 'Valida pattern'}
                    >
                      {p.human_validated ? (
                        <ShieldCheck className="w-4 h-4 text-green-600" />
                      ) : (
                        <Shield className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => toggleField(p.id, 'is_active', p.is_active)}
                      disabled={saving === p.id}
                      className="text-gray-400 hover:text-purple-600 transition-colors"
                      title={p.is_active ? 'Disattiva' : 'Attiva'}
                    >
                      {p.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => deletePattern(p.id)}
                      disabled={saving === p.id}
                      className="text-gray-300 hover:text-red-600 transition-colors"
                      title="Elimina pattern"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB: ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/support/analytics');
        const json = await res.json();
        if (json.success) setData(json);
      } catch (error) {
        console.error('Errore caricamento analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Errore nel caricamento delle analytics</p>
      </div>
    );
  }

  const autonomousRate =
    data.patternUsage.total > 0
      ? 100 -
        Math.round(
          (data.escalations.last30Days / (data.patternUsage.total + data.escalations.last30Days)) *
            100
        )
      : 100;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Escalation aperte"
          value={data.escalations.byStatus.open || 0}
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          color="red"
        />
        <StatCard
          label="Risoluzione autonoma"
          value={`${autonomousRate}%`}
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          color="green"
        />
        <StatCard
          label="Pattern attivi"
          value={data.patterns.active}
          icon={<Brain className="w-5 h-5 text-purple-500" />}
          color="purple"
        />
        <StatCard
          label="Confidence media"
          value={`${Math.round(data.patterns.avgConfidence * 100)}%`}
          icon={<ShieldCheck className="w-5 h-5 text-blue-500" />}
          color="blue"
        />
      </div>

      {/* Escalations & Resolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Escalation</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(data.escalations.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span className="text-gray-600 capitalize">
                  {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.label || status}
                </span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between">
              <span className="text-gray-600">Tempo medio risoluzione</span>
              <span className="font-medium">{data.escalations.avgResolutionHours}h</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Pattern Usage</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(data.patternUsage.byOutcome).map(([outcome, count]) => (
              <div key={outcome} className="flex justify-between">
                <span className="text-gray-600 capitalize">{outcome}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(data.patternUsage.byOutcome).length === 0 && (
              <p className="text-gray-400">Nessun dato ancora</p>
            )}
            <div className="border-t pt-2 flex justify-between">
              <span className="text-gray-600">Success rate</span>
              <span className="font-medium text-green-600">{data.patternUsage.successRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifiche per tipo
          </h3>
          <div className="space-y-2 text-sm">
            {Object.entries(data.notifications.byType).map(([type, count]) => (
              <div key={type} className="flex justify-between">
                <span className="text-gray-600">{type.replace(/_/g, ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(data.notifications.byType).length === 0 && (
              <p className="text-gray-400">Nessuna notifica ancora</p>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Send className="w-4 h-4" />
            Notifiche per canale
          </h3>
          <div className="space-y-2 text-sm">
            {Object.entries(data.notifications.byChannel).map(([channel, count]) => {
              const Icon = channel === 'email' ? Mail : channel === 'telegram' ? Send : Bell;
              return (
                <div key={channel} className="flex items-center justify-between">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    {channel}
                  </span>
                  <span className="font-medium">{count}</span>
                </div>
              );
            })}
            {Object.keys(data.notifications.byChannel).length === 0 && (
              <p className="text-gray-400">Nessuna notifica ancora</p>
            )}
          </div>
        </div>
      </div>

      {/* Top Patterns */}
      {data.patterns.topPatterns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Top Pattern per utilizzo</h3>
          <div className="space-y-2">
            {data.patterns.topPatterns.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="text-gray-400 font-mono w-5">{i + 1}.</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  {CATEGORY_LABELS[p.category] || p.category}
                </span>
                {p.carrier && (
                  <span className="text-gray-500 text-xs">{p.carrier.toUpperCase()}</span>
                )}
                <div className="flex-1" />
                <span className="text-gray-600">{p.usageCount} usi</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.confidence >= 0.8
                      ? 'bg-green-100 text-green-800'
                      : p.confidence >= 0.5
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {Math.round(p.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  const bgColor =
    {
      red: 'bg-red-50 border-red-100',
      green: 'bg-green-50 border-green-100',
      purple: 'bg-purple-50 border-purple-100',
      blue: 'bg-blue-50 border-blue-100',
    }[color] || 'bg-gray-50 border-gray-100';

  return (
    <div className={`rounded-lg border p-4 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
