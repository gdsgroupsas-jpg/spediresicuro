'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, Filter, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface DiagnosticEvent {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  context: any;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export default function DoctorDashboardPage() {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: 'all',
    severity: 'all',
    dateRange: '24h',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    fetchEvents();
    // Poll ogni 30 secondi
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, [filters, pagination.page]);

  async function fetchEvents() {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        ...filters,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const res = await fetch(`/api/admin/doctor/events?${params}`);
      const data = await res.json();

      if (res.ok) {
        setEvents(data.events || []);
        setPagination(data.pagination || pagination);
      } else {
        console.error('Errore caricamento eventi:', data.error);
      }
    } catch (error) {
      console.error('Errore fetch eventi:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'medium':
        return <Info className="w-5 h-5 text-yellow-600" />;
      case 'low':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-blue-100 text-blue-700',
      info: 'bg-gray-100 text-gray-700',
    };

    const labels = {
      critical: 'Critico',
      high: 'Alto',
      medium: 'Medio',
      low: 'Basso',
      info: 'Info',
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[severity as keyof typeof styles] || styles.info}`}
      >
        {labels[severity as keyof typeof labels] || severity}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            Doctor Service Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Monitoraggio eventi diagnostici e auto-remediation</p>
        </div>
        <button
          onClick={fetchEvents}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Aggiorna
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Evento</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutti</option>
              <option value="error">Errori</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
              <option value="performance">Performance</option>
              <option value="user_action">Azioni Utente</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Severità</label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tutte</option>
              <option value="critical">Critico</option>
              <option value="high">Alto</option>
              <option value="medium">Medio</option>
              <option value="low">Basso</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="24h">Ultime 24 ore</option>
              <option value="7d">Ultimi 7 giorni</option>
              <option value="30d">Ultimi 30 giorni</option>
              <option value="all">Tutti</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabella Eventi */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-500">Caricamento eventi...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Nessun evento trovato</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Timestamp</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Tipo</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Severità</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Messaggio</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">
                      {format(new Date(event.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: it })}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{event.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(event.severity)}
                        {getSeverityBadge(event.severity)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {typeof event.context === 'object'
                        ? event.context.message ||
                          event.context.error ||
                          JSON.stringify(event.context).substring(0, 100)
                        : String(event.context).substring(0, 100)}
                    </td>
                    <td className="px-6 py-4">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-800 text-xs">
                          Dettagli
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-w-md">
                          {JSON.stringify(event.context, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginazione */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} eventi)
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                disabled={pagination.page === 1}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Precedente
              </button>
              <button
                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Successivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
