'use client';

/**
 * Step: Credito Iniziale Reseller (Solo SuperAdmin)
 *
 * Configura il credito wallet iniziale del reseller
 */

import { Wallet } from 'lucide-react';
import { useWizard } from '../WizardContext';
import { formatCurrency } from '@/lib/utils';

const QUICK_CREDITS = [0, 50, 100, 250, 500, 1000];

export function StepResellerCredito() {
  const { resellerFormData, updateResellerFormData, errors, clearError } = useWizard();

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Credito Iniziale</h2>
        <p className="text-gray-400">Configura il saldo wallet iniziale per il nuovo reseller</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Input Credito */}
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 rounded-2xl p-6 border border-green-700/50">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-green-400" />
            <h3 className="font-semibold text-gray-100">Importo da Accreditare</h3>
          </div>

          <div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                EUR
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="10000"
                value={resellerFormData.initialCredit}
                onChange={(e) => {
                  updateResellerFormData({ initialCredit: parseFloat(e.target.value) || 0 });
                  if (errors['reseller.initialCredit']) clearError('reseller.initialCredit');
                }}
                className={`
                  w-full pl-14 pr-4 py-4 bg-gray-800 border rounded-xl text-gray-100 text-2xl font-bold
                  focus:outline-none focus:ring-2 focus:ring-green-500 transition-all
                  ${errors['reseller.initialCredit'] ? 'border-red-500' : 'border-gray-700'}
                `}
              />
            </div>
            {errors['reseller.initialCredit'] && (
              <p className="mt-1 text-sm text-red-400">{errors['reseller.initialCredit']}</p>
            )}
          </div>

          {/* Quick Amounts */}
          <div className="mt-4">
            <label className="text-sm font-medium text-gray-400 mb-2 block">Importi Rapidi</label>
            <div className="flex flex-wrap gap-2">
              {QUICK_CREDITS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => updateResellerFormData({ initialCredit: amount })}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${
                      resellerFormData.initialCredit === amount
                        ? 'bg-green-600 text-white shadow-lg scale-105'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="mt-6 bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Credito Totale:</span>
              <span className="text-3xl font-bold text-green-400">
                {formatCurrency(resellerFormData.initialCredit || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4">
          <p className="text-sm text-purple-300">
            Il credito verra accreditato immediatamente sul wallet del reseller dopo la creazione
            dell&apos;account.
          </p>
        </div>
      </div>
    </div>
  );
}
