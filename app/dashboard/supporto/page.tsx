'use client';

import { useState, useEffect } from 'react';
import {
  Headphones,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  MessageSquare,
  Loader2,
  ChevronRight,
  X,
} from 'lucide-react';

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
  // Join
  users?: { email: string; name: string };
}

const STATUS_CONFIG = {
  open: { label: 'Aperta', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  assigned: { label: 'Assegnata', color: 'bg-yellow-100 text-yellow-800', icon: User },
  resolved: { label: 'Risolta', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Chiusa', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

export default function SupportoPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'resolved'>('open');
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [resolution, setResolution] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEscalations();
  }, [filter]);

  async function fetchEscalations() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/support/escalations?${params}`);
      const data = await res.json();
      if (data.success) {
        setEscalations(data.escalations || []);
      }
    } catch (error) {
      console.error('Errore caricamento escalation:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateEscalation(id: string, updates: Record<string, any>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/support/escalations`, {
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Headphones className="w-6 h-6 text-purple-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escalation Supporto</h1>
          <p className="text-sm text-gray-500">
            Casi che Anne non ha potuto risolvere autonomamente (2-5%)
          </p>
        </div>
      </div>

      {/* Filtri */}
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

      {/* Lista */}
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
              {/* Info */}
              <div>
                <h3 className="font-semibold text-gray-900">{selectedEscalation.reason}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Utente: {selectedEscalation.users?.email || selectedEscalation.user_id}
                </p>
                <p className="text-sm text-gray-500">
                  Data: {new Date(selectedEscalation.created_at).toLocaleString('it-IT')}
                </p>
              </div>

              {/* Riassunto Anne */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-900">Riassunto di Anne</span>
                </div>
                <p className="text-sm text-purple-800">{selectedEscalation.anne_summary}</p>
              </div>

              {/* Conversazione */}
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

              {/* Metadata */}
              {selectedEscalation.metadata &&
                Object.keys(selectedEscalation.metadata).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Dati aggiuntivi</h4>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                      {JSON.stringify(selectedEscalation.metadata, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Azioni */}
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
                          updateEscalation(selectedEscalation.id, {
                            status: 'assigned',
                          })
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

              {/* Risoluzione esistente */}
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
    </div>
  );
}
