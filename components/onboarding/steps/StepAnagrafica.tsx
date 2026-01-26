'use client';

import { User } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepAnagrafica() {
  const { formData, updateFormData, errors, clearError } = useWizard();
  const { anagrafica } = formData;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    updateFormData('anagrafica', { [name]: value });
    clearError(`anagrafica.${name}`);
  };

  const inputClass = (fieldName: string) => `
    w-full px-4 py-3 bg-gray-800 border-2 rounded-xl text-white font-medium
    placeholder-gray-500 focus:outline-none transition-all
    ${
      errors[`anagrafica.${fieldName}`]
        ? 'border-red-500 focus:border-red-400 focus:ring-2 focus:ring-red-500/30'
        : 'border-gray-700 focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/30'
    }
  `;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-[#FACC15]/20 rounded-xl flex items-center justify-center">
          <User className="w-6 h-6 text-[#FACC15]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-100">Dati Anagrafici</h2>
          <p className="text-sm text-gray-400">
            {formData.tipoCliente === 'azienda'
              ? 'Del rappresentante legale'
              : 'Informazioni personali'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="nome"
            value={anagrafica.nome}
            onChange={handleChange}
            placeholder="Mario"
            className={inputClass('nome')}
          />
          {errors['anagrafica.nome'] && (
            <p className="mt-1 text-sm text-red-400">{errors['anagrafica.nome']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Cognome <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="cognome"
            value={anagrafica.cognome}
            onChange={handleChange}
            placeholder="Rossi"
            className={inputClass('cognome')}
          />
          {errors['anagrafica.cognome'] && (
            <p className="mt-1 text-sm text-red-400">{errors['anagrafica.cognome']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Codice Fiscale <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="codiceFiscale"
            value={anagrafica.codiceFiscale}
            onChange={handleChange}
            placeholder="RSSMRA80A01H501U"
            maxLength={16}
            className={`${inputClass('codiceFiscale')} uppercase`}
          />
          {errors['anagrafica.codiceFiscale'] && (
            <p className="mt-1 text-sm text-red-400">{errors['anagrafica.codiceFiscale']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Telefono <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            name="telefono"
            value={anagrafica.telefono}
            onChange={handleChange}
            placeholder="+39 333 1234567"
            className={inputClass('telefono')}
          />
          {errors['anagrafica.telefono'] && (
            <p className="mt-1 text-sm text-red-400">{errors['anagrafica.telefono']}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Data di Nascita</label>
          <input
            type="date"
            name="dataNascita"
            value={anagrafica.dataNascita}
            onChange={handleChange}
            className={inputClass('dataNascita')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Luogo di Nascita</label>
          <input
            type="text"
            name="luogoNascita"
            value={anagrafica.luogoNascita}
            onChange={handleChange}
            placeholder="Roma"
            className={inputClass('luogoNascita')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sesso</label>
          <select
            name="sesso"
            value={anagrafica.sesso}
            onChange={handleChange}
            className={inputClass('sesso')}
          >
            <option value="">Seleziona</option>
            <option value="M">Maschio</option>
            <option value="F">Femmina</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Cellulare</label>
          <input
            type="tel"
            name="cellulare"
            value={anagrafica.cellulare}
            onChange={handleChange}
            placeholder="+39 333 1234567"
            className={inputClass('cellulare')}
          />
        </div>
      </div>
    </div>
  );
}
