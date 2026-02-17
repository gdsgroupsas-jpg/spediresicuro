'use client';

/**
 * Dashboard Admin: Automazioni Piattaforma
 *
 * Pagina per governare le automazioni della piattaforma.
 * Ogni automazione nasce DISATTIVATA — l'admin la accende/configura/esegue.
 * Storico esecuzioni completo per ogni automazione.
 */

import { useState, useEffect, useCallback } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import {
  getAutomations,
  toggleAutomationEnabled,
  updateAutomationConfig,
  runAutomationManually,
  getAutomationRuns,
} from '@/actions/automations';
import type { AutomationWithLastRun, AutomationRun } from '@/types/automations';
import { toast } from 'sonner';
import {
  Zap,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Settings,
  History,
} from 'lucide-react';

export default function AutomazioniPiattaformaPage() {
  const [automations, setAutomations] = useState<AutomationWithLastRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, AutomationRun[]>>({});
  const [runsLoading, setRunsLoading] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, unknown>>({});

  const loadAutomations = useCallback(async () => {
    const result = await getAutomations();
    if (result.success && result.automations) {
      setAutomations(result.automations);
    } else {
      toast.error(result.error || 'Errore caricamento automazioni');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  // Toggle on/off
  const handleToggle = async (id: string, enabled: boolean) => {
    const result = await toggleAutomationEnabled(id, enabled);
    if (result.success) {
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, enabled } : a)));
      toast.success(enabled ? 'Automazione attivata' : 'Automazione disattivata');
    } else {
      toast.error(result.error || 'Errore toggle');
    }
  };

  // Esegui manualmente
  const handleRun = async (id: string) => {
    setRunning(id);
    toast.info('Esecuzione in corso...');
    const result = await runAutomationManually(id);
    setRunning(null);

    if (result.success) {
      toast.success(
        `Completato: ${result.run?.items_processed || 0} processati, ${result.run?.items_failed || 0} errori`
      );
      loadAutomations();
      // Ricarica runs se espanso
      if (expandedId === id) {
        loadRuns(id);
      }
    } else {
      toast.error(result.error || 'Errore esecuzione');
    }
  };

  // Carica storico run
  const loadRuns = async (id: string) => {
    setRunsLoading(id);
    const result = await getAutomationRuns(id);
    if (result.success && result.runs) {
      setRuns((prev) => ({ ...prev, [id]: result.runs! }));
    }
    setRunsLoading(null);
  };

  // Espandi/collassa card
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!runs[id]) {
        loadRuns(id);
      }
    }
  };

  // Salva config
  const handleSaveConfig = async (id: string) => {
    const result = await updateAutomationConfig(id, configDraft);
    if (result.success) {
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, config: configDraft } : a)));
      setEditingConfig(null);
      toast.success('Configurazione salvata');
    } else {
      toast.error(result.error || 'Errore salvataggio');
    }
  };

  // Status badge
  const StatusBadge = ({ status }: { status: string | null }) => {
    if (!status) return <span className="text-gray-500 text-xs">Mai eseguito</span>;

    const colors: Record<string, string> = {
      success: 'bg-green-500/20 text-green-400',
      failure: 'bg-red-500/20 text-red-400',
      partial: 'bg-yellow-500/20 text-yellow-400',
      running: 'bg-blue-500/20 text-blue-400',
    };

    const icons: Record<string, React.ReactNode> = {
      success: <CheckCircle2 className="w-3 h-3" />,
      failure: <XCircle className="w-3 h-3" />,
      partial: <AlertTriangle className="w-3 h-3" />,
      running: <Loader2 className="w-3 h-3 animate-spin" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-500/20 text-gray-400'}`}
      >
        {icons[status]}
        {status}
      </span>
    );
  };

  // Trigger badge
  const TriggerBadge = ({ trigger }: { trigger: string }) => {
    const colors: Record<string, string> = {
      cron: 'bg-blue-500/10 text-blue-400',
      manual: 'bg-purple-500/10 text-purple-400',
      api: 'bg-gray-500/10 text-gray-400',
    };

    return (
      <span
        className={`px-2 py-0.5 rounded text-xs ${colors[trigger] || 'bg-gray-500/10 text-gray-400'}`}
      >
        {trigger}
      </span>
    );
  };

  // Formatta data
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Formatta durata
  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Render config editor
  const renderConfigEditor = (automation: AutomationWithLastRun) => {
    const schema = automation.config_schema as {
      properties?: Record<
        string,
        {
          type: string;
          title: string;
          description?: string;
          default?: unknown;
          minimum?: number;
          maximum?: number;
        }
      >;
    };

    if (!schema?.properties) return null;

    return (
      <div className="space-y-3 mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurazione
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingConfig(null)}
              className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1"
            >
              Annulla
            </button>
            <button
              onClick={() => handleSaveConfig(automation.id)}
              className="text-xs bg-[#FACC15] text-black font-medium px-3 py-1 rounded hover:bg-[#F59E0B]"
            >
              Salva
            </button>
          </div>
        </div>

        {Object.entries(schema.properties).map(([key, prop]) => (
          <div
            key={key}
            className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
          >
            <div>
              <p className="text-sm text-gray-200">{prop.title || key}</p>
              {prop.description && <p className="text-xs text-gray-500">{prop.description}</p>}
            </div>
            {prop.type === 'boolean' ? (
              <button
                onClick={() => setConfigDraft((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  configDraft[key] ? 'bg-[#FACC15]' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    configDraft[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            ) : prop.type === 'number' ? (
              <input
                type="number"
                value={(configDraft[key] as number) || 0}
                min={prop.minimum}
                max={prop.maximum}
                onChange={(e) =>
                  setConfigDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
                className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              />
            ) : (
              <input
                type="text"
                value={String(configDraft[key] || '')}
                onChange={(e) => setConfigDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                className="w-40 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <DashboardNav />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FACC15] to-[#F59E0B] flex items-center justify-center">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Automazioni Piattaforma</h1>
              <p className="text-gray-400 text-sm">
                Processi automatici governabili — ogni automazione nasce disattivata
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#FACC15] animate-spin" />
          </div>
        )}

        {/* Lista automazioni */}
        {!loading && automations.length === 0 && (
          <div className="text-center py-20 text-gray-500">Nessuna automazione configurata</div>
        )}

        {!loading && (
          <div className="space-y-4">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden"
              >
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-semibold text-gray-100">{automation.name}</h3>
                        <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded">
                          {automation.category}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{automation.description}</p>

                      {/* Info row */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {automation.schedule}
                        </span>
                        <span>Ultimo run: {formatDate(automation.last_run_at)}</span>
                        <StatusBadge status={automation.last_run_status} />
                      </div>
                    </div>

                    {/* Azioni */}
                    <div className="flex items-center gap-3 ml-4">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(automation.id, !automation.enabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          automation.enabled ? 'bg-[#FACC15]' : 'bg-gray-600'
                        }`}
                        title={automation.enabled ? 'Disattiva' : 'Attiva'}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            automation.enabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>

                      {/* Esegui ora */}
                      <button
                        onClick={() => handleRun(automation.id)}
                        disabled={running === automation.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg transition-colors disabled:opacity-50"
                        title="Esegui ora"
                      >
                        {running === automation.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        Esegui
                      </button>

                      {/* Config */}
                      <button
                        onClick={() => {
                          if (editingConfig === automation.id) {
                            setEditingConfig(null);
                          } else {
                            setEditingConfig(automation.id);
                            setConfigDraft({ ...automation.config });
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
                        title="Configura"
                      >
                        <Settings className="w-4 h-4" />
                      </button>

                      {/* Espandi storico */}
                      <button
                        onClick={() => toggleExpand(automation.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
                        title="Storico esecuzioni"
                      >
                        {expandedId === automation.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Config editor */}
                  {editingConfig === automation.id && renderConfigEditor(automation)}
                </div>

                {/* Storico runs (espandibile) */}
                {expandedId === automation.id && (
                  <div className="border-t border-gray-700 p-5 bg-gray-800/50">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <History className="w-4 h-4" />
                      Storico Esecuzioni
                    </h4>

                    {runsLoading === automation.id && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      </div>
                    )}

                    {runs[automation.id] && runs[automation.id].length === 0 && (
                      <p className="text-sm text-gray-500 py-4 text-center">
                        Nessuna esecuzione registrata
                      </p>
                    )}

                    {runs[automation.id] && runs[automation.id].length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 text-xs border-b border-gray-700">
                              <th className="text-left py-2 pr-4">Data</th>
                              <th className="text-left py-2 pr-4">Trigger</th>
                              <th className="text-left py-2 pr-4">Stato</th>
                              <th className="text-right py-2 pr-4">Durata</th>
                              <th className="text-right py-2 pr-4">Processati</th>
                              <th className="text-right py-2">Errori</th>
                            </tr>
                          </thead>
                          <tbody>
                            {runs[automation.id].map((run) => (
                              <tr key={run.id} className="border-b border-gray-800 last:border-0">
                                <td className="py-2 pr-4 text-gray-300">
                                  {formatDate(run.started_at)}
                                </td>
                                <td className="py-2 pr-4">
                                  <TriggerBadge trigger={run.triggered_by} />
                                </td>
                                <td className="py-2 pr-4">
                                  <StatusBadge status={run.status} />
                                </td>
                                <td className="py-2 pr-4 text-right text-gray-400">
                                  {formatDuration(run.duration_ms)}
                                </td>
                                <td className="py-2 pr-4 text-right text-gray-300">
                                  {run.items_processed}
                                </td>
                                <td className="py-2 text-right text-red-400">
                                  {run.items_failed > 0 ? run.items_failed : '—'}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
