/**
 * Stats Section - Sezione Statistiche
 *
 * Mostra numeri e risultati per costruire fiducia
 */

'use client';

import { TrendingUp, Users, Package, Clock } from 'lucide-react';

const stats = [
  {
    icon: Users,
    value: '1.247+',
    label: 'Aziende Attive',
    description: 'Già spediscono con noi',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Package,
    value: '45.892',
    label: 'Spedizioni',
    description: 'Gestite questo mese',
    color: 'from-[#FFD700] to-[#FF9500]',
  },
  {
    icon: Clock,
    value: '10 sec',
    label: 'Tempo Medio',
    description: 'Per creare una spedizione',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: TrendingUp,
    value: '90%',
    label: 'Risparmio Tempo',
    description: 'Rispetto al metodo tradizionale',
    color: 'from-purple-500 to-pink-500',
  },
];

export default function StatsSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Numeri che Parlano</h2>
          <p className="text-lg text-gray-600">La fiducia di centinaia di aziende italiane</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div
                  className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${stat.color} mb-4 shadow-lg`}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-semibold text-gray-700 mb-1">{stat.label}</div>
                <div className="text-xs text-gray-500">{stat.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
