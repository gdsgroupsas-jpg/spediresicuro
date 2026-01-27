'use client';

/**
 * Step: Dati Azienda Reseller (Solo SuperAdmin)
 *
 * Form per inserire i dati aziendali (solo se tipoCliente === 'azienda'):
 * - Ragione Sociale, P.IVA, SDI, PEC, Indirizzo Fatturazione
 */

import { Building2, FileText, Mail, MapPin } from 'lucide-react';
import { useWizard } from '../WizardContext';
import { DatiAzienda } from '../types';

export function StepResellerAzienda() {
  const { resellerFormData, updateResellerFormData, errors, clearError } = useWizard();

  const updateAzienda = (data: Partial<DatiAzienda>) => {
    updateResellerFormData({
      azienda: { ...resellerFormData.azienda, ...data },
    });
  };

  const hasError = (field: string) => errors[`reseller.azienda.${field}`];

  // Copia indirizzo sede come indirizzo fatturazione
  const copyFromSede = () => {
    updateAzienda({
      indirizzoFatturazione: resellerFormData.indirizzo.indirizzo,
      cittaFatturazione: resellerFormData.indirizzo.citta,
      provinciaFatturazione: resellerFormData.indirizzo.provincia,
      capFatturazione: resellerFormData.indirizzo.cap,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Dati Azienda</h2>
        <p className="text-gray-400">Inserisci le informazioni fiscali dell&apos;azienda</p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Ragione Sociale */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Building2 className="w-4 h-4 inline mr-2" />
            Ragione Sociale *
          </label>
          <input
            type="text"
            value={resellerFormData.azienda.ragioneSociale}
            onChange={(e) => {
              updateAzienda({ ragioneSociale: e.target.value });
              if (hasError('ragioneSociale')) clearError('reseller.azienda.ragioneSociale');
            }}
            placeholder="Azienda Esempio S.r.l."
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-all
              ${hasError('ragioneSociale') ? 'border-red-500' : 'border-gray-700'}
            `}
          />
          {hasError('ragioneSociale') && (
            <p className="mt-1 text-sm text-red-400">{hasError('ragioneSociale')}</p>
          )}
        </div>

        {/* Partita IVA e Codice SDI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <FileText className="w-4 h-4 inline mr-2" />
              Partita IVA *
            </label>
            <input
              type="text"
              value={resellerFormData.azienda.partitaIva}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 11);
                updateAzienda({ partitaIva: value });
                if (hasError('partitaIva')) clearError('reseller.azienda.partitaIva');
              }}
              placeholder="12345678901"
              maxLength={11}
              className={`
                w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-all font-mono
                ${hasError('partitaIva') ? 'border-red-500' : 'border-gray-700'}
              `}
            />
            {hasError('partitaIva') && (
              <p className="mt-1 text-sm text-red-400">{hasError('partitaIva')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Codice SDI</label>
            <input
              type="text"
              value={resellerFormData.azienda.codiceSDI}
              onChange={(e) => {
                const value = e.target.value.toUpperCase().slice(0, 7);
                updateAzienda({ codiceSDI: value });
              }}
              placeholder="0000000"
              maxLength={7}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono uppercase"
            />
          </div>
        </div>

        {/* PEC */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            PEC (Posta Elettronica Certificata)
          </label>
          <input
            type="email"
            value={resellerFormData.azienda.pec}
            onChange={(e) => updateAzienda({ pec: e.target.value })}
            placeholder="azienda@pec.it"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>

        {/* Indirizzo Fatturazione */}
        <div className="border-t border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-300">
              <MapPin className="w-4 h-4 inline mr-2" />
              Indirizzo di Fatturazione
            </label>
            <button
              type="button"
              onClick={copyFromSede}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Copia dalla sede legale
            </button>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={resellerFormData.azienda.indirizzoFatturazione}
              onChange={(e) => updateAzienda({ indirizzoFatturazione: e.target.value })}
              placeholder="Via della Fatturazione, 456"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />

            <div className="grid grid-cols-3 gap-4">
              <input
                type="text"
                value={resellerFormData.azienda.cittaFatturazione}
                onChange={(e) => updateAzienda({ cittaFatturazione: e.target.value })}
                placeholder="Citta"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <input
                type="text"
                value={resellerFormData.azienda.provinciaFatturazione}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase().slice(0, 2);
                  updateAzienda({ provinciaFatturazione: value });
                }}
                placeholder="Prov"
                maxLength={2}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100 uppercase
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <input
                type="text"
                value={resellerFormData.azienda.capFatturazione}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 5);
                  updateAzienda({ capFatturazione: value });
                }}
                placeholder="CAP"
                maxLength={5}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
