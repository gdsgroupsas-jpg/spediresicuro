'use client';

/**
 * Step: Selezione Tipo Utente (Solo SuperAdmin)
 *
 * Permette al superadmin di scegliere se creare:
 * - Un nuovo Reseller
 * - Un nuovo Cliente (sotto un reseller esistente)
 */

import { Store, Users } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepSelezioneTipoUtente() {
  const { userCreationType, setUserCreationType } = useWizard();

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Che tipo di utente vuoi creare?</h2>
        <p className="text-gray-400">
          Seleziona il tipo di account da registrare sulla piattaforma
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Reseller Option */}
        <button
          type="button"
          onClick={() => setUserCreationType('reseller')}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-300
            flex flex-col items-center gap-4 group
            ${
              userCreationType === 'reseller'
                ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }
          `}
        >
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${
                userCreationType === 'reseller'
                  ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'
              }
            `}
          >
            <Store className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3
              className={`
                text-xl font-bold mb-1
                ${userCreationType === 'reseller' ? 'text-purple-400' : 'text-gray-200'}
              `}
            >
              Reseller
            </h3>
            <p className="text-sm text-gray-400">Nuovo rivenditore con propri clienti</p>
            <p className="text-xs text-gray-500 mt-2">
              Potra gestire clienti, listini e spedizioni
            </p>
          </div>
          {userCreationType === 'reseller' && (
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

        {/* Cliente Option */}
        <button
          type="button"
          onClick={() => setUserCreationType('cliente')}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-300
            flex flex-col items-center gap-4 group
            ${
              userCreationType === 'cliente'
                ? 'border-[#FACC15] bg-[#FACC15]/10 shadow-lg shadow-[#FACC15]/20'
                : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
            }
          `}
        >
          <div
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all
              ${
                userCreationType === 'cliente'
                  ? 'bg-[#FACC15] text-black'
                  : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'
              }
            `}
          >
            <Users className="w-10 h-10" />
          </div>
          <div className="text-center">
            <h3
              className={`
                text-xl font-bold mb-1
                ${userCreationType === 'cliente' ? 'text-[#FACC15]' : 'text-gray-200'}
              `}
            >
              Cliente
            </h3>
            <p className="text-sm text-gray-400">Nuovo cliente di un reseller</p>
            <p className="text-xs text-gray-500 mt-2">
              Dovrai selezionare il reseller di appartenenza
            </p>
          </div>
          {userCreationType === 'cliente' && (
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
