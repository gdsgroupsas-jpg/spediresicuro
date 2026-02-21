'use client';

import { FileText } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepDocumento() {
  const { formData, updateFormData, errors, clearError } = useWizard();
  const { documento } = formData;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateFormData('documento', { [name]: value });
    clearError(`documento.${name}`);
  };

  const inputClass = (fieldName: string) => `
    w-full px-4 py-3 bg-gray-800 border-2 rounded-xl text-white font-medium
    placeholder-gray-500 focus:outline-none transition-all
    ${
      errors[`documento.${fieldName}`]
        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/30'
        : 'border-gray-700 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/30'
    }
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-[#FACC15]/20 rounded-xl flex items-center justify-center">
          <FileText className="w-6 h-6 text-[#FACC15]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Documento di Identità</h2>
          <p className="text-sm text-gray-400">Per verifiche di sicurezza (opzionale)</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-300">
          Questi dati sono opzionali. Potrai aggiungerli in seguito dalle impostazioni del profilo.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Documento</label>
          <select
            name="tipoDocumento"
            value={documento.tipoDocumento}
            onChange={handleChange}
            className={inputClass('tipoDocumento')}
          >
            <option value="">Seleziona</option>
            <option value="carta_identita">Carta d&apos;Identità</option>
            <option value="patente">Patente</option>
            <option value="passaporto">Passaporto</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Numero Documento</label>
          <input
            type="text"
            name="numeroDocumento"
            value={documento.numeroDocumento}
            onChange={handleChange}
            placeholder="AX1234567"
            className={inputClass('numeroDocumento')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Rilasciato Da</label>
          <input
            type="text"
            name="rilasciatoDa"
            value={documento.rilasciatoDa}
            onChange={handleChange}
            placeholder="Comune di Roma"
            className={inputClass('rilasciatoDa')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Data Rilascio</label>
          <input
            type="date"
            name="dataRilascio"
            value={documento.dataRilascio}
            onChange={handleChange}
            className={inputClass('dataRilascio')}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">Data Scadenza</label>
          <input
            type="date"
            name="dataScadenza"
            value={documento.dataScadenza}
            onChange={handleChange}
            className={inputClass('dataScadenza')}
          />
        </div>
      </div>
    </div>
  );
}
