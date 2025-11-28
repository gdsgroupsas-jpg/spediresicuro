'use client';

import { XCircle, CheckCircle } from 'lucide-react';

const pains = [
  'Gestione spedizioni manuale e dispersiva',
  'Errori nei dati destinatari',
  'Calcolo prezzi complicato',
  'Nessuna tracciabilità in tempo reale',
];

const gains = [
  'Automazione completa processo spedizioni',
  'OCR per estrazione automatica dati',
  'Calcolo prezzi automatico con margine',
  'Dashboard con tracking real-time',
];

export default function PainVsGainSection() {
  return (
    <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            Prima vs Dopo SpedireSicuro
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Scopri come trasformiamo la gestione delle tue spedizioni
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Pain Points */}
          <div className="bg-red-50 rounded-lg p-6 border border-red-200">
            <div className="flex items-center gap-3 mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
              <h3 className="text-xl font-semibold text-red-900">
                Senza SpedireSicuro
              </h3>
            </div>
            <ul className="space-y-3">
              {pains.map((pain, index) => (
                <li key={index} className="flex items-start gap-2">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-red-800">{pain}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gains */}
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <h3 className="text-xl font-semibold text-green-900">
                Con SpedireSicuro
              </h3>
            </div>
            <ul className="space-y-3">
              {gains.map((gain, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-green-800">{gain}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Inizia Gratis Ora
          </a>
        </div>
      </div>
    </section>
  );
}
