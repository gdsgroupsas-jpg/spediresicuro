/**
 * Value Dashboard Component - P4 Task 1
 *
 * Mostra all'utente il valore generato da Anne:
 * - Minuti risparmiati
 * - Errori evitati
 * - Confidence media
 *
 * Mostra solo se utente ha usato Anne almeno 3 volte.
 */

'use client';

import { useEffect, useState } from 'react';
import { Clock, Shield, TrendingUp, Sparkles } from 'lucide-react';

interface ValueStats {
  totalRequests: number;
  minutesSaved: number;
  errorsAvoided: number;
  averageConfidence: number;
  hasEnoughData: boolean;
}

interface ValueDashboardProps {
  /** ID utente */
  userId: string;
  /** Mostra anche se dati insufficienti (per debug) */
  forceShow?: boolean;
}

export function ValueDashboard({ userId, forceShow = false }: ValueDashboardProps) {
  const [stats, setStats] = useState<ValueStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      try {
        setIsLoading(true);
        setError(null);

        // Cache locale (TTL 5 minuti)
        const cacheKey = `value-stats-${userId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 5 * 60 * 1000) {
            // 5 minuti
            if (mounted) {
              setStats(data);
              setIsLoading(false);
              return;
            }
          }
        }

        // Fetch da API
        const response = await fetch('/api/ai/value-stats');
        if (!response.ok) {
          throw new Error('Errore caricamento statistiche');
        }

        const result = await response.json();
        if (result.success && result.stats) {
          // Salva in cache
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              data: result.stats,
              timestamp: Date.now(),
            })
          );

          if (mounted) {
            setStats(result.stats);
          }
        } else {
          throw new Error('Dati non disponibili');
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStats();

    return () => {
      mounted = false;
    };
  }, [userId]);

  // Non mostrare se dati insufficienti (a meno che forceShow)
  if (!isLoading && stats && !stats.hasEnoughData && !forceShow) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-3 animate-pulse">
        <div className="h-4 bg-blue-200 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-blue-200 rounded w-1/3"></div>
      </div>
    );
  }

  if (error || !stats) {
    return null; // Silenzioso, non mostrare errori
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-3 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="text-sm font-semibold text-indigo-900">Il tuo valore con Anne</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Minuti risparmiati */}
        <div className="flex flex-col items-center text-center">
          <Clock className="w-5 h-5 text-blue-600 mb-1" />
          <div className="text-lg font-bold text-blue-900">{stats.minutesSaved}</div>
          <div className="text-xs text-blue-700">min risparmiati</div>
        </div>

        {/* Errori evitati */}
        <div className="flex flex-col items-center text-center">
          <Shield className="w-5 h-5 text-green-600 mb-1" />
          <div className="text-lg font-bold text-green-900">{stats.errorsAvoided}</div>
          <div className="text-xs text-green-700">errori evitati</div>
        </div>

        {/* Confidence media */}
        <div className="flex flex-col items-center text-center">
          <TrendingUp className="w-5 h-5 text-purple-600 mb-1" />
          <div className="text-lg font-bold text-purple-900">
            {stats.averageConfidence.toFixed(0)}%
          </div>
          <div className="text-xs text-purple-700">confidence</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-700 text-center">
        Basato su {stats.totalRequests} richieste questa settimana
      </div>
    </div>
  );
}
