'use client';

/**
 * Step: Account Reseller (Solo SuperAdmin)
 *
 * Form per inserire i dati base dell'account:
 * - Email, Password
 */

import { useState } from 'react';
import { Mail, Key, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useWizard } from '../WizardContext';

export function StepResellerAccount() {
  const { resellerFormData, updateResellerFormData, errors, clearError } = useWizard();
  const [showPassword, setShowPassword] = useState(false);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    const password = Array.from(
      { length: 12 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    updateResellerFormData({ password });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Account Reseller</h2>
        <p className="text-gray-400">Inserisci le credenziali di accesso per il nuovo reseller</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Mail className="w-4 h-4 inline mr-2" />
            Email *
          </label>
          <input
            type="email"
            value={resellerFormData.email}
            onChange={(e) => {
              updateResellerFormData({ email: e.target.value });
              if (errors['reseller.email']) clearError('reseller.email');
            }}
            placeholder="reseller@esempio.it"
            className={`
              w-full px-4 py-3 bg-gray-800 border rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-all
              ${errors['reseller.email'] ? 'border-red-500' : 'border-gray-700'}
            `}
          />
          {errors['reseller.email'] && (
            <p className="mt-1 text-sm text-red-400">{errors['reseller.email']}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Il reseller userà questa email per accedere al sistema
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Key className="w-4 h-4 inline mr-2" />
            Password *
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={resellerFormData.password}
                onChange={(e) => {
                  updateResellerFormData({ password: e.target.value });
                  if (errors['reseller.password']) clearError('reseller.password');
                }}
                placeholder="Minimo 8 caratteri"
                className={`
                  w-full px-4 py-3 pr-10 bg-gray-800 border rounded-xl text-gray-100
                  placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500
                  transition-all
                  ${errors['reseller.password'] ? 'border-red-500' : 'border-gray-700'}
                `}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={generatePassword}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Genera
            </button>
          </div>
          {errors['reseller.password'] && (
            <p className="mt-1 text-sm text-red-400">{errors['reseller.password']}</p>
          )}
          {resellerFormData.password && resellerFormData.password.length >= 8 && (
            <div className="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-400 font-mono">{resellerFormData.password}</p>
              <p className="text-xs text-green-500 mt-1">Salva questa password!</p>
            </div>
          )}
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Note Interne (opzionale)
          </label>
          <textarea
            value={resellerFormData.notes}
            onChange={(e) => updateResellerFormData({ notes: e.target.value })}
            placeholder="Es: Cliente referenziato da..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-gray-100
              placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>
    </div>
  );
}
