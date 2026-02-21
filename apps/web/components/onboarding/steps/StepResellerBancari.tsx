'use client';

/**
 * Step: Dati Bancari Reseller (Solo SuperAdmin)
 *
 * Form per inserire i dati bancari (opzionale):
 * - IBAN, Banca, Nome Intestatario
 */

import { Wallet, Building, User } from 'lucide-react';
import { useWizard } from '../WizardContext';
import { DatiBancari } from '../types';

export function StepResellerBancari() {
  const { resellerFormData, updateResellerFormData } = useWizard();

  const updateBancari = (data: Partial<DatiBancari>) => {
    updateResellerFormData({
      bancari: { ...resellerFormData.bancari, ...data },
    });
  };

  // Formatta IBAN con spazi ogni 4 caratteri
  const formatIBAN = (value: string) => {
    const clean = value.replace(/\s/g, '').toUpperCase();
    return clean.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Dati Bancari</h2>
        <p className="text-gray-400">
          Inserisci i dati bancari per rimborsi e pagamenti (opzionale)
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* IBAN */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Wallet className="w-4 h-4 inline mr-2" />
            IBAN
          </label>
          <input
            type="text"
            value={formatIBAN(resellerFormData.bancari.iban)}
            onChange={(e) => {
              const value = e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 27);
              updateBancari({ iban: value });
            }}
            placeholder="IT60 X054 2811 1010 0000 0123 456"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-all font-mono uppercase tracking-wider"
          />
          <p className="mt-1 text-xs text-gray-500">
            L&apos;IBAN italiano ha 27 caratteri (es: IT60X0542811101000000123456)
          </p>
        </div>

        {/* Banca */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Building className="w-4 h-4 inline mr-2" />
            Nome Banca
          </label>
          <input
            type="text"
            value={resellerFormData.bancari.banca}
            onChange={(e) => updateBancari({ banca: e.target.value })}
            placeholder="Banca Esempio S.p.A."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Intestatario */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="w-4 h-4 inline mr-2" />
            Nome Intestatario
          </label>
          <input
            type="text"
            value={resellerFormData.bancari.nomeIntestatario}
            onChange={(e) => updateBancari({ nomeIntestatario: e.target.value })}
            placeholder="Mario Rossi o Azienda Esempio S.r.l."
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Info Box */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <p className="text-sm text-purple-300">
            <strong>Nota:</strong> I dati bancari sono opzionali ma consigliati per gestire
            eventuali rimborsi o accrediti. Potrai sempre aggiungerli in seguito.
          </p>
        </div>
      </div>
    </div>
  );
}
