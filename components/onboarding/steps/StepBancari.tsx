'use client';

import { CreditCard } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepBancari() {
  const { formData, updateFormData, errors, clearError } = useWizard();
  const { bancari } = formData;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateFormData('bancari', { [name]: value });
    clearError(`bancari.${name}`);
  };

  const inputClass = (fieldName: string) => `
    w-full px-4 py-3 bg-gray-800 border-2 rounded-xl text-white font-medium
    placeholder-gray-500 focus:outline-none transition-all
    ${
      errors[`bancari.${fieldName}`]
        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/30'
        : 'border-gray-700 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/30'
    }
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-[#FACC15]/20 rounded-xl flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-[#FACC15]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Dati Bancari</h2>
          <p className="text-sm text-gray-400">Per rimborsi e pagamenti (opzionale)</p>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-300">
          Questi dati sono opzionali. Potrai aggiungerli in seguito dalle impostazioni del profilo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">IBAN</label>
          <input
            type="text"
            name="iban"
            value={bancari.iban}
            onChange={handleChange}
            placeholder="IT60X0542811101000000123456"
            className={`${inputClass('iban')} uppercase`}
          />
          {errors['bancari.iban'] && (
            <p className="mt-1 text-sm text-red-400">{errors['bancari.iban']}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Banca</label>
            <input
              type="text"
              name="banca"
              value={bancari.banca}
              onChange={handleChange}
              placeholder="Nome della banca"
              className={inputClass('banca')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome Intestatario
            </label>
            <input
              type="text"
              name="nomeIntestatario"
              value={bancari.nomeIntestatario}
              onChange={handleChange}
              placeholder="Mario Rossi"
              className={inputClass('nomeIntestatario')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
