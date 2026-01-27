'use client';

/**
 * Step: Indirizzo Reseller (Solo SuperAdmin)
 *
 * Form per inserire l'indirizzo (sede legale o residenza):
 * - Via, Citta, Provincia, CAP, Nazione
 */

import { MapPin, Building, Hash, Globe } from 'lucide-react';
import { useWizard } from '../WizardContext';
import { Indirizzo } from '../types';

export function StepResellerIndirizzo() {
  const { resellerFormData, updateResellerFormData, errors, clearError } = useWizard();

  const updateIndirizzo = (data: Partial<Indirizzo>) => {
    updateResellerFormData({
      indirizzo: { ...resellerFormData.indirizzo, ...data },
    });
  };

  const hasError = (field: string) => errors[`reseller.indirizzo.${field}`];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Indirizzo</h2>
        <p className="text-gray-400">
          {resellerFormData.tipoCliente === 'azienda'
            ? 'Inserisci la sede legale del reseller'
            : 'Inserisci la residenza del reseller'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Indirizzo */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <MapPin className="w-4 h-4 inline mr-2" />
            Indirizzo *
          </label>
          <input
            type="text"
            value={resellerFormData.indirizzo.indirizzo}
            onChange={(e) => {
              updateIndirizzo({ indirizzo: e.target.value });
              if (hasError('indirizzo')) clearError('reseller.indirizzo.indirizzo');
            }}
            placeholder="Via Roma, 123"
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-all
              ${hasError('indirizzo') ? 'border-red-500' : 'border-gray-700'}
            `}
          />
          {hasError('indirizzo') && (
            <p className="mt-1 text-sm text-red-400">{hasError('indirizzo')}</p>
          )}
        </div>

        {/* Citta e Provincia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Building className="w-4 h-4 inline mr-2" />
              Citta *
            </label>
            <input
              type="text"
              value={resellerFormData.indirizzo.citta}
              onChange={(e) => {
                updateIndirizzo({ citta: e.target.value });
                if (hasError('citta')) clearError('reseller.indirizzo.citta');
              }}
              placeholder="Roma"
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all
                ${hasError('citta') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('citta') && <p className="mt-1 text-sm text-red-400">{hasError('citta')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Provincia *</label>
            <input
              type="text"
              value={resellerFormData.indirizzo.provincia}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().slice(0, 2);
                updateIndirizzo({ provincia: value });
                if (hasError('provincia')) clearError('reseller.indirizzo.provincia');
              }}
              placeholder="RM"
              maxLength={2}
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100 uppercase
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all
                ${hasError('provincia') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('provincia') && (
              <p className="mt-1 text-sm text-red-400">{hasError('provincia')}</p>
            )}
          </div>
        </div>

        {/* CAP e Nazione */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Hash className="w-4 h-4 inline mr-2" />
              CAP *
            </label>
            <input
              type="text"
              value={resellerFormData.indirizzo.cap}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                updateIndirizzo({ cap: value });
                if (hasError('cap')) clearError('reseller.indirizzo.cap');
              }}
              placeholder="00100"
              maxLength={5}
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all font-mono
                ${hasError('cap') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('cap') && <p className="mt-1 text-sm text-red-400">{hasError('cap')}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Globe className="w-4 h-4 inline mr-2" />
              Nazione
            </label>
            <input
              type="text"
              value={resellerFormData.indirizzo.nazione}
              onChange={(e) => updateIndirizzo({ nazione: e.target.value })}
              placeholder="Italia"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
