/**
 * Pagina: Controllo Vocale
 *
 * Interfaccia dedicata per il controllo vocale (Gemini Live) di spedizioni, resi e ticket.
 */

'use client';

import { useMemo } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import { VoiceControlPanel } from '@/components/ai/voice-control-panel';

export default function VoiceDashboardPage() {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const endpoint = process.env.NEXT_PUBLIC_GEMINI_LIVE_ENDPOINT;

  const info = useMemo(
    () => [
      { title: 'Hands-free', desc: 'Gestisci spedizioni e tracking solo con la voce.' },
      { title: 'Tool calling', desc: 'Gemini invoca tRPC o API per creare, tracciare, quotare.' },
      { title: 'Audio duplex', desc: 'Streaming bidirezionale: ascolta le risposte in tempo reale.' },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <DashboardNav />
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <header className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Gemini Live · Voice Ops</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Cockpit vocale spedizioni</h1>
            <p className="text-gray-600 mt-2 max-w-2xl">
              Avvia una sessione live: il microfono invia audio a Gemini, che restituisce risposte vocali e
              chiama i tool per creare spedizioni, tracciare pacchi, aprire ticket e ottenere statistiche.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-700">
            <span className="px-3 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-100">
              Endpoint: {endpoint || 'imposta NEXT_PUBLIC_GEMINI_LIVE_ENDPOINT'}
            </span>
            <span className="px-3 py-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
              API Key: {apiKey ? 'caricata' : 'mancante (NEXT_PUBLIC_GEMINI_API_KEY)'}
            </span>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {info.map((item) => (
            <div
              key={item.title}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 hover:shadow-md transition-all"
            >
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>

        <VoiceControlPanel apiKey={apiKey} endpoint={endpoint} />
      </main>
    </div>
  );
}
