'use client';

import { MapPin } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepIndirizzo() {
  const { formData, updateFormData, errors, clearError } = useWizard();
  const { indirizzo } = formData;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateFormData('indirizzo', { [name]: value });
    clearError(`indirizzo.${name}`);
  };

  const inputClass = (fieldName: string) => `
    w-full px-4 py-3 bg-gray-800 border-2 rounded-xl text-white font-medium
    placeholder-gray-500 focus:outline-none transition-all
    ${
      errors[`indirizzo.${fieldName}`]
        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/30'
        : 'border-gray-700 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/30'
    }
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-[#FACC15]/20 rounded-xl flex items-center justify-center">
          <MapPin className="w-6 h-6 text-[#FACC15]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Indirizzo</h2>
          <p className="text-sm text-gray-400">
            {formData.tipoCliente === 'azienda'
              ? "Sede legale dell'azienda"
              : 'Indirizzo di residenza'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Indirizzo <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="indirizzo"
            value={indirizzo.indirizzo}
            onChange={handleChange}
            placeholder="Via Roma, 1"
            className={inputClass('indirizzo')}
          />
          {errors['indirizzo.indirizzo'] && (
            <p className="mt-1 text-sm text-red-400">{errors['indirizzo.indirizzo']}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Città <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="citta"
              value={indirizzo.citta}
              onChange={handleChange}
              placeholder="Roma"
              className={inputClass('citta')}
            />
            {errors['indirizzo.citta'] && (
              <p className="mt-1 text-sm text-red-400">{errors['indirizzo.citta']}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Provincia <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="provincia"
              value={indirizzo.provincia}
              onChange={handleChange}
              placeholder="RM"
              maxLength={2}
              className={`${inputClass('provincia')} uppercase`}
            />
            {errors['indirizzo.provincia'] && (
              <p className="mt-1 text-sm text-red-400">{errors['indirizzo.provincia']}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CAP <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="cap"
              value={indirizzo.cap}
              onChange={handleChange}
              placeholder="00100"
              maxLength={5}
              className={inputClass('cap')}
            />
            {errors['indirizzo.cap'] && (
              <p className="mt-1 text-sm text-red-400">{errors['indirizzo.cap']}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nazione</label>
            <input
              type="text"
              name="nazione"
              value={indirizzo.nazione}
              onChange={handleChange}
              placeholder="Italia"
              className={inputClass('nazione')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
