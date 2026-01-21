/**
 * Anne Promo Section
 *
 * Sezione pubblicitaria che presenta Anne e tutte le sue capacità
 */

'use client';

import {
  Sparkles,
  TrendingUp,
  Package,
  AlertCircle,
  Calculator,
  Search,
  BarChart3,
  Lightbulb,
  Zap,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const capabilities = [
  {
    icon: Calculator,
    title: 'Calcolo Prezzi Intelligente',
    description:
      'Calcola automaticamente il prezzo ottimale per ogni spedizione, confrontando tutti i corrieri disponibili.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Package,
    title: 'Gestione Spedizioni',
    description:
      'Crea, traccia e gestisci tutte le tue spedizioni in modo semplice e veloce. Compila form automaticamente.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Search,
    title: 'Tracking Avanzato',
    description:
      'Traccia qualsiasi spedizione in tempo reale. Ricevi aggiornamenti automatici sullo stato.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: BarChart3,
    title: 'Analisi Business',
    description:
      'Analizza margini, fatturato e performance. Confronta periodi e ottieni insights strategici.',
    color: 'from-orange-500 to-red-500',
    adminOnly: true,
  },
  {
    icon: AlertCircle,
    title: 'Monitoraggio Sistema',
    description: 'Controlla errori e criticità del sistema in tempo reale. Ricevi alert proattivi.',
    color: 'from-amber-500 to-yellow-500',
    adminOnly: true,
  },
  {
    icon: Lightbulb,
    title: 'Suggerimenti Intelligenti',
    description:
      "Ricevi consigli operativi per ottimizzare margini e migliorare l'efficienza del tuo business.",
    color: 'from-indigo-500 to-blue-500',
  },
];

export default function AnnePromoSection() {
  return (
    <section className="py-24 bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-cyan-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-purple-300/30 mb-6">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">🤖 Nuova Funzionalità</span>
          </div>

          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-2xl">
                <span className="text-white font-bold text-3xl">A</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse"></div>
            </div>
            <div className="text-left">
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                Anne
                <Sparkles className="text-purple-500" size={32} />
              </h2>
              <p className="text-lg text-gray-600 font-medium">
                Il tuo Executive Business Partner AI
              </p>
            </div>
          </div>

          <p className="text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            Anne è il tuo assistente AI intelligente che ti aiuta a gestire spedizioni, calcolare
            prezzi ottimali, analizzare il business e ottimizzare i margini.{' '}
            <strong>Parla con Anne come con un collega esperto.</strong>
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {capabilities.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <div
                key={index}
                className="group p-6 rounded-xl border-2 border-gray-200 hover:border-purple-300 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`flex-shrink-0 p-3 rounded-lg bg-gradient-to-r ${capability.color} shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-6 h-6 text-white" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                        {capability.title}
                      </h3>
                      {capability.adminOnly && (
                        <span className="text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                          👑 Admin
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {capability.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="group px-8 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-3"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Prova Anne Gratis</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/dashboard"
            className="px-8 py-4 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-bold text-lg hover:border-purple-400 hover:text-purple-600 transition-all duration-300 flex items-center gap-3"
          >
            <Zap className="w-5 h-5" />
            <span>Vai al Dashboard</span>
          </Link>
        </div>

        {/* Features List */}
        <div className="mt-16 pt-12 border-t border-gray-200">
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Per Utenti
              </h4>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Calcola prezzi ottimali per ogni spedizione</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Traccia spedizioni in tempo reale</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Compila form spedizione automaticamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Riepilogo spedizioni mensili</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-amber-600" />
                Per Admin
              </h4>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Analisi business e margini</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Monitoraggio errori sistema</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Report fatturato e statistiche</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Suggerimenti ottimizzazione</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Testimonial Box */}
        <div className="mt-12 max-w-3xl mx-auto bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-purple-200 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-gray-700 text-lg leading-relaxed italic mb-4">
                &quot;Ciao! Sono Anne, il tuo Executive Business Partner. Posso aiutarti a calcolare
                prezzi ottimali, gestire spedizioni, analizzare il business e molto altro.{' '}
                <strong>Parlami come con un collega esperto!</strong>&quot;
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>Disponibile 24/7 • Risposte in pochi secondi • Sempre aggiornata</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
