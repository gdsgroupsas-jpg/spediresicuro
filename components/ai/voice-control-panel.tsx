'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Sparkles,
  Square,
  Zap,
} from 'lucide-react';
import { useVoiceControl } from '@/hooks/useVoiceControl';
import { Button } from '@/components/ui/button';

interface VoiceControlPanelProps {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  api?: any; // Optional tRPC client proxy
  userId?: string;
  userRole?: 'admin' | 'user';
}

export function VoiceControlPanel({
  apiKey,
  endpoint,
  model = 'gemini-1.5-pro-latest',
  api,
  userId,
  userRole = 'user',
}: VoiceControlPanelProps) {
  const [lastToolResult, setLastToolResult] = useState<{ tool: string; result: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    isActive,
    isConnecting,
    volume,
    transcript,
    startSession,
    stopSession,
    executeTool,
    tools,
  } = useVoiceControl({
    api,
    apiKey,
    endpoint,
    model,
    userId,
    userRole,
    onError: (err) => setError(err.message),
  });

  const levelBars = useMemo(() => {
    const normalized = Math.min(1, volume * 3);
    return Array.from({ length: 12 }).map((_, idx) => {
      const threshold = (idx + 1) / 12;
      return normalized >= threshold;
    });
  }, [volume]);

  const handleQuickTool = async (toolName: string, args: Record<string, any>) => {
    setError(null);
    try {
      const result = await executeTool(toolName, args);
      setLastToolResult({ tool: toolName, result });
      if (!result?.success) {
        setError(result?.error || 'Errore esecuzione tool');
      }
    } catch (err: any) {
      setError(err?.message || 'Errore esecuzione tool');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-600 font-semibold flex items-center gap-2">
                <Radio className="w-4 h-4 text-blue-500" />
                Gemini Live
              </p>
              <h2 className="text-2xl font-bold text-gray-900 mt-1">Controllo vocale spedizioni</h2>
              <p className="text-gray-600 mt-2">
                Dettatura, tracking e operazioni hands-free per SpediReSicuro. Usa il microfono per
                gestire spedizioni, resi e supporto.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'
                }`}
              />
              <span className="text-sm text-gray-700">{isActive ? 'Live' : 'Pronto'}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              onClick={startSession}
              disabled={isConnecting || isActive}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4"
            >
              {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {isConnecting ? 'Connessione...' : 'Avvia microfono'}
            </Button>
            <Button
              variant="outline"
              onClick={stopSession}
              disabled={!isActive && !isConnecting}
              className="flex items-center gap-2"
            >
              {isActive ? <Square className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              Stop
            </Button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-gray-700 font-semibold">Volume</span>
              <div className="flex items-end gap-1 h-8">
                {levelBars.map((active, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 rounded-t-full transition-all duration-150 ${
                      active ? 'bg-emerald-500' : 'bg-gray-200'
                    }`}
                    style={{ height: `${4 + idx * 4}px` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-700 mb-2">
                <Sparkles className="w-4 h-4" />
                Comandi suggeriti (parla libero, niente keyword rigide)
              </div>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• “Crea una spedizione da Roma a Milano, 2 kg, express”</li>
                <li>• “Traccia il pacco con tracking SS123...”</li>
                <li>• “Dammi le spedizioni in transito oggi”</li>
                <li>• “Apri un ticket per ritardo consegna GLS”</li>
              </ul>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-2">
                <Headphones className="w-4 h-4 text-blue-500" />
                Trascrizione live
              </div>
              <div className="min-h-[96px] max-h-[120px] overflow-y-auto rounded-xl border border-dashed border-gray-200 bg-white p-3 text-sm text-gray-800">
                {transcript ? transcript : 'Inizia a parlare per vedere la trascrizione...'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Azioni rapide</p>
              <h3 className="text-lg font-bold text-gray-900">Esegui tool senza parlare</h3>
            </div>
            <Zap className="w-5 h-5 text-amber-500" />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <QuickActionCard
              label="Lista spedizioni"
              helper="Recupera ultime spedizioni"
              onClick={() => handleQuickTool('listShipments', { limit: 10 })}
            />
            <QuickActionCard
              label="Tracking rapido"
              helper="Cerca per tracking fittizio"
              onClick={() => handleQuickTool('trackShipment', { trackingNumber: 'SS-DEMO-123456' })}
            />
            <QuickActionCard
              label="Preventivo espresso"
              helper="Stima costo 3kg, Milano → Roma"
              onClick={() =>
                handleQuickTool('calculatePrice', {
                  weight: 3,
                  destinationZip: '00100',
                  destinationProvince: 'RM',
                  service: 'express',
                })
              }
            />
            <QuickActionCard
              label="Statistiche oggi"
              helper="Dashboard daily"
              onClick={() => handleQuickTool('getStatistics', { period: 'today' })}
            />
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {lastToolResult && (
            <div className="mt-4 border border-gray-100 rounded-xl bg-gray-50 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">
                Ultima risposta tool — {lastToolResult.tool}
              </div>
              <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                {JSON.stringify(lastToolResult.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <h4 className="text-base font-semibold text-gray-900">Tool disponibili</h4>
          </div>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {tools.map((tool) => (
              <div key={tool.name} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900">{tool.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-blue-600 font-bold">
                    {tool.parameters?.required?.length || 0} req
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{tool.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4" />
            <p className="text-xs uppercase tracking-wide font-semibold">Suggerimento</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed">
            Posiziona questo pannello nella dashboard operativa e lascia che gli operatori gestiscano spedizioni,
            resi e ticket senza usare mouse e tastiera. Abilita cuffie con cancellazione rumore per il miglior
            riconoscimento.
          </p>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  label,
  helper,
  onClick,
}: {
  label: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left border border-gray-100 rounded-2xl p-4 bg-white hover:border-blue-200 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <span className="text-[11px] font-semibold text-blue-600 group-hover:text-blue-700">Esegui</span>
      </div>
      <p className="text-xs text-gray-600 mt-1">{helper}</p>
    </button>
  );
}
