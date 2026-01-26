'use client';

import { User, Building2, Mail } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepTipoCliente() {
  const { formData, setTipoCliente, mode, clientEmail, setClientEmail, errors, clearError } =
    useWizard();

  const isResellerMode = mode === 'reseller';

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">
          {isResellerMode ? 'Nuovo Cliente' : 'Che tipo di account stai registrando?'}
        </h2>
        <p className="text-gray-400">
          {isResellerMode
            ? "Inserisci l'email e seleziona il tipo di cliente"
            : "Seleziona se sei una persona fisica o rappresenti un'azienda"}
        </p>
      </div>

      {/* Email field for reseller mode */}
      {isResellerMode && (
        <div className="max-w-md mx-auto mb-8">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email del Cliente *
          </label>
          <input
            type="email"
            value={clientEmail}
            onChange={(e) => {
              setClientEmail(e.target.value);
              if (errors['clientEmail']) clearError('clientEmail');
            }}
            placeholder="cliente@email.com"
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FACC15]
              transition-all
              ${errors['clientEmail'] ? 'border-red-500' : 'border-gray-700'}
            `}
          />
          {errors['clientEmail'] && (
            <p className="mt-1 text-sm text-red-400">{errors['clientEmail']}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Il cliente riceverà le credenziali per accedere al sistema
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => setTipoCliente('persona')}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-300
            flex flex-col items-center gap-4 group
            ${
              formData.tipoCliente === 'persona'
                ? 'border-[#FACC15] bg-[#FACC15]/10 shadow-lg shadow-[#FACC15]/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }
          `}
        >
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${
                formData.tipoCliente === 'persona'
                  ? 'bg-[#FACC15] text-black'
                  : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'
              }
            `}
          >
            <User className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3
              className={`
                text-xl font-bold mb-1
                ${formData.tipoCliente === 'persona' ? 'text-[#FACC15]' : 'text-gray-200'}
              `}
            >
              Persona Fisica
            </h3>
            <p className="text-sm text-gray-400">Per privati e liberi professionisti</p>
          </div>
          {formData.tipoCliente === 'persona' && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-[#FACC15] rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTipoCliente('azienda')}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-300
            flex flex-col items-center gap-4 group
            ${
              formData.tipoCliente === 'azienda'
                ? 'border-[#FACC15] bg-[#FACC15]/10 shadow-lg shadow-[#FACC15]/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }
          `}
        >
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${
                formData.tipoCliente === 'azienda'
                  ? 'bg-[#FACC15] text-black'
                  : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'
              }
            `}
          >
            <Building2 className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3
              className={`
                text-xl font-bold mb-1
                ${formData.tipoCliente === 'azienda' ? 'text-[#FACC15]' : 'text-gray-200'}
              `}
            >
              Azienda
            </h3>
            <p className="text-sm text-gray-400">Per società e ditte individuali</p>
          </div>
          {formData.tipoCliente === 'azienda' && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-[#FACC15] rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
