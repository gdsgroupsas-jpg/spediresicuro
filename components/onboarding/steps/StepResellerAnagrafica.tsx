'use client';

/**
 * Step: Anagrafica Reseller (Solo SuperAdmin)
 *
 * Form per inserire i dati anagrafici del titolare/rappresentante:
 * - Nome, Cognome, Codice Fiscale, Data Nascita, Telefono, etc.
 */

import { User, Phone, Calendar, MapPin } from 'lucide-react';
import { useWizard } from '../WizardContext';
import { DatiAnagrafici } from '../types';

export function StepResellerAnagrafica() {
  const { resellerFormData, updateResellerFormData, errors, clearError } = useWizard();

  const updateAnagrafica = (data: Partial<DatiAnagrafici>) => {
    updateResellerFormData({
      anagrafica: { ...resellerFormData.anagrafica, ...data },
    });
  };

  const hasError = (field: string) => errors[`reseller.anagrafica.${field}`];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Dati Anagrafici</h2>
        <p className="text-gray-400">Inserisci i dati del titolare o rappresentante legale</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Nome e Cognome */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Nome *
            </label>
            <input
              type="text"
              value={resellerFormData.anagrafica.nome}
              onChange={(e) => {
                updateAnagrafica({ nome: e.target.value });
                if (hasError('nome')) clearError('reseller.anagrafica.nome');
              }}
              placeholder="Mario"
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all
                ${hasError('nome') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('nome') && <p className="mt-1 text-sm text-red-400">{hasError('nome')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cognome *</label>
            <input
              type="text"
              value={resellerFormData.anagrafica.cognome}
              onChange={(e) => {
                updateAnagrafica({ cognome: e.target.value });
                if (hasError('cognome')) clearError('reseller.anagrafica.cognome');
              }}
              placeholder="Rossi"
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all
                ${hasError('cognome') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('cognome') && (
              <p className="mt-1 text-sm text-red-400">{hasError('cognome')}</p>
            )}
          </div>
        </div>

        {/* Codice Fiscale */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Codice Fiscale *</label>
          <input
            type="text"
            value={resellerFormData.anagrafica.codiceFiscale}
            onChange={(e) => {
              const value = e.target.value.toUpperCase().slice(0, 16);
              updateAnagrafica({ codiceFiscale: value });
              if (hasError('codiceFiscale')) clearError('reseller.anagrafica.codiceFiscale');
            }}
            placeholder="RSSMRA80A01H501U"
            maxLength={16}
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100 uppercase
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-all font-mono
              ${hasError('codiceFiscale') ? 'border-red-500' : 'border-gray-700'}
            `}
          />
          {hasError('codiceFiscale') && (
            <p className="mt-1 text-sm text-red-400">{hasError('codiceFiscale')}</p>
          )}
        </div>

        {/* Data e Luogo Nascita */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Data di Nascita
            </label>
            <input
              type="date"
              value={resellerFormData.anagrafica.dataNascita}
              onChange={(e) => updateAnagrafica({ dataNascita: e.target.value })}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <MapPin className="w-4 h-4 inline mr-2" />
              Luogo di Nascita
            </label>
            <input
              type="text"
              value={resellerFormData.anagrafica.luogoNascita}
              onChange={(e) => updateAnagrafica({ luogoNascita: e.target.value })}
              placeholder="Roma"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>

        {/* Sesso */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sesso</label>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => updateAnagrafica({ sesso: 'M' })}
              className={`
                flex-1 px-4 py-3 rounded-xl border-2 transition-all
                ${
                  resellerFormData.anagrafica.sesso === 'M'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }
              `}
            >
              Maschio
            </button>
            <button
              type="button"
              onClick={() => updateAnagrafica({ sesso: 'F' })}
              className={`
                flex-1 px-4 py-3 rounded-xl border-2 transition-all
                ${
                  resellerFormData.anagrafica.sesso === 'F'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                }
              `}
            >
              Femmina
            </button>
          </div>
        </div>

        {/* Telefoni */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Phone className="w-4 h-4 inline mr-2" />
              Telefono *
            </label>
            <input
              type="tel"
              value={resellerFormData.anagrafica.telefono}
              onChange={(e) => {
                updateAnagrafica({ telefono: e.target.value });
                if (hasError('telefono')) clearError('reseller.anagrafica.telefono');
              }}
              placeholder="+39 06 1234567"
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all
                ${hasError('telefono') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('telefono') && (
              <p className="mt-1 text-sm text-red-400">{hasError('telefono')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cellulare</label>
            <input
              type="tel"
              value={resellerFormData.anagrafica.cellulare}
              onChange={(e) => updateAnagrafica({ cellulare: e.target.value })}
              placeholder="+39 333 1234567"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
