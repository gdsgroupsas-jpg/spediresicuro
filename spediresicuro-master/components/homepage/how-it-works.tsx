/**
 * How It Works Section
 * 
 * Sezione che spiega il processo in 3-4 step semplici
 */

'use client';

import { Upload, Sparkles, FileText, Truck } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: Upload,
    title: 'Carica Screenshot',
    description: 'Fai uno screenshot della conversazione WhatsApp con i dati di spedizione.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    number: '02',
    icon: Sparkles,
    title: 'AI Analizza',
    description: 'La nostra AI estrae automaticamente tutti i dati: destinatario, indirizzo, CAP, telefono.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Etichetta Pronta',
    description: 'Ricevi l\'etichetta di spedizione pronta per la stampa in formato PDF.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    number: '04',
    icon: Truck,
    title: 'Spedisci',
    description: 'Stampa l\'etichetta, applicala al pacco e consegnala al corriere. Fatto!',
    color: 'from-orange-500 to-red-500',
  },
];

export default function HowItWorks() {
  return (
    <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Come Funziona
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Quattro semplici passaggi per spedire senza stress
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                {/* Connector Line (solo desktop, non per l'ultimo) */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-16 left-full w-full h-0.5 bg-gradient-to-r from-gray-200 to-transparent -z-10" style={{ width: 'calc(100% - 4rem)' }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] rounded-full"></div>
                  </div>
                )}

                <div className="relative bg-white p-8 rounded-2xl border border-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 group">
                  {/* Number Badge */}
                  <div className="absolute -top-4 -left-4 w-16 h-16 bg-gradient-to-r from-[#FFD700] to-[#FF9500] rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-lg">{step.number}</span>
                  </div>

                  {/* Icon */}
                  <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${step.color} mb-6 mt-4 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

