/**
 * Features Section
 * 
 * Sezione che mostra i principali benefici e funzionalità
 */

'use client';

import { Zap, Shield, Clock, TrendingUp, Globe, Sparkles } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: '10 Secondi',
    description: 'Da screenshot WhatsApp a etichetta pronta. Zero form, zero stress.',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    icon: Shield,
    title: '100% Sicuro',
    description: 'Dati protetti GDPR, SSL certificato. La tua privacy è la nostra priorità.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Clock,
    title: '24/7 Disponibile',
    description: 'Spedisci quando vuoi, anche di notte. Il sistema non dorme mai.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: TrendingUp,
    title: 'Risparmia Tempo',
    description: 'Riduci del 90% il tempo per creare una spedizione. Più tempo per il tuo business.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Globe,
    title: 'Tutta Italia',
    description: 'Spedizioni in ogni comune italiano. Validazione automatica indirizzi.',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    icon: Sparkles,
    title: 'AI Avanzata',
    description: 'Intelligenza artificiale che impara e migliora continuamente.',
    color: 'from-rose-500 to-orange-500',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/5 via-transparent to-[#00B8D4]/5 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#FFD700]/10 to-[#FF9500]/10 border border-[#FF9500]/20 mb-4">
            <span className="text-sm font-semibold text-[#FF9500]">✨ Funzionalità Premium</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Perché Scegliere SpedireSicuro?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            La soluzione più veloce e intelligente per le tue spedizioni
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group p-8 rounded-2xl border border-gray-100 hover:border-transparent hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-white to-gray-50 hover:-translate-y-2"
              >
                {/* Icon */}
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${feature.color} mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-[#FF9500] transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

