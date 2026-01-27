'use client';

/**
 * Step: Tipo Cliente Reseller (Solo SuperAdmin)
 *
 * Permette di scegliere se il reseller è:
 * - Persona Fisica (libero professionista)
 * - Azienda (società, ditta individuale)
 */

import { User, Building2 } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepResellerTipoCliente() {
  const { resellerFormData, updateResellerFormData } = useWizard();

  const setTipoCliente = (tipo: 'persona' | 'azienda') => {
    updateResellerFormData({ tipoCliente: tipo });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Che tipo di account reseller?</h2>
        <p className="text-gray-400">
          Seleziona se il reseller opera come persona fisica o azienda
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <button
          type="button"
          onClick={() => setTipoCliente('persona')}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-300
            flex flex-col items-center gap-4 group
            ${
              resellerFormData.tipoCliente === 'persona'
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }
          `}
        >
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${
                resellerFormData.tipoCliente === 'persona'
                  ? 'bg-purple-500 text-white'
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
                ${resellerFormData.tipoCliente === 'persona' ? 'text-purple-400' : 'text-gray-200'}
              `}
            >
              Persona Fisica
            </h3>
            <p className="text-sm text-gray-400">Libero professionista</p>
          </div>
          {resellerFormData.tipoCliente === 'persona' && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
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
              resellerFormData.tipoCliente === 'azienda'
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }
          `}
        >
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${
                resellerFormData.tipoCliente === 'azienda'
                  ? 'bg-purple-500 text-white'
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
                ${resellerFormData.tipoCliente === 'azienda' ? 'text-purple-400' : 'text-gray-200'}
              `}
            >
              Azienda
            </h3>
            <p className="text-sm text-gray-400">Societa o ditta individuale</p>
          </div>
          {resellerFormData.tipoCliente === 'azienda' && (
            <div className="absolute top-4 right-4 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
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
