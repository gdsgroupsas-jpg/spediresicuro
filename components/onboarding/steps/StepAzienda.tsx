'use client';

import { Building2 } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepAzienda() {
  const { formData, updateFormData, errors, clearError } = useWizard();
  const { azienda } = formData;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    updateFormData('azienda', { [name]: value });
    clearError(`azienda.${name}`);
  };

  const inputClass = (fieldName: string) => `
    w-full px-4 py-3 bg-gray-800 border-2 rounded-xl text-white font-medium
    placeholder-gray-500 focus:outline-none transition-all
    ${
      errors[`azienda.${fieldName}`]
        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/30'
        : 'border-gray-700 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/30'
    }
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-[#FACC15]/20 rounded-xl flex items-center justify-center">
          <Building2 className="w-6 h-6 text-[#FACC15]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Dati Azienda</h2>
          <p className="text-sm text-gray-400">Informazioni fiscali dell&apos;azienda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ragione Sociale <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="ragioneSociale"
            value={azienda.ragioneSociale}
            onChange={handleChange}
            placeholder="Azienda S.r.l."
            className={inputClass('ragioneSociale')}
          />
          {errors['azienda.ragioneSociale'] && (
            <p className="mt-1 text-sm text-red-400">{errors['azienda.ragioneSociale']}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Partita IVA <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="partitaIva"
              value={azienda.partitaIva}
              onChange={handleChange}
              placeholder="12345678901"
              maxLength={11}
              className={inputClass('partitaIva')}
            />
            {errors['azienda.partitaIva'] && (
              <p className="mt-1 text-sm text-red-400">{errors['azienda.partitaIva']}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Codice SDI</label>
            <input
              type="text"
              name="codiceSDI"
              value={azienda.codiceSDI}
              onChange={handleChange}
              placeholder="XXXXXXX"
              maxLength={7}
              className={`${inputClass('codiceSDI')} uppercase`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">PEC</label>
          <input
            type="email"
            name="pec"
            value={azienda.pec}
            onChange={handleChange}
            placeholder="azienda@pec.it"
            className={inputClass('pec')}
          />
        </div>

        <div className="pt-4 border-t border-gray-700">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">
            Indirizzo di Fatturazione
            <span className="text-sm font-normal text-gray-400 ml-2">
              (se diverso dalla sede legale)
            </span>
          </h3>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Indirizzo</label>
              <input
                type="text"
                name="indirizzoFatturazione"
                value={azienda.indirizzoFatturazione}
                onChange={handleChange}
                placeholder="Via Milano, 10"
                className={inputClass('indirizzoFatturazione')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Città</label>
                <input
                  type="text"
                  name="cittaFatturazione"
                  value={azienda.cittaFatturazione}
                  onChange={handleChange}
                  placeholder="Milano"
                  className={inputClass('cittaFatturazione')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Provincia</label>
                <input
                  type="text"
                  name="provinciaFatturazione"
                  value={azienda.provinciaFatturazione}
                  onChange={handleChange}
                  placeholder="MI"
                  maxLength={2}
                  className={`${inputClass('provinciaFatturazione')} uppercase`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">CAP</label>
                <input
                  type="text"
                  name="capFatturazione"
                  value={azienda.capFatturazione}
                  onChange={handleChange}
                  placeholder="20100"
                  maxLength={5}
                  className={inputClass('capFatturazione')}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
