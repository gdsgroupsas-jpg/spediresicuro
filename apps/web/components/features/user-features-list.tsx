/**
 * Componente: Lista Features Attive Utente
 *
 * Mostra tutte le killer features attive per l'utente corrente
 */

'use client';

import { useFeatures } from '@/lib/hooks/use-features';
import { Sparkles, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function UserFeaturesList() {
  const { features, isLoading, error } = useFeatures();

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Le Tue Features</h3>
        </div>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-500 mt-2">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Le Tue Features</h3>
        </div>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Le Tue Features</h3>
        </div>
        <p className="text-gray-500 text-center py-8">Nessuna feature attiva al momento</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Sparkles className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Le Tue Features</h3>
        <span className="ml-auto px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
          {features.length} attive
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map((feature) => {
          const isExpired = feature.expires_at && new Date(feature.expires_at) < new Date();

          return (
            <div
              key={feature.feature_code}
              className={`border rounded-lg p-4 ${
                isExpired
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
              } transition-all`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    {feature.feature_name}
                    {isExpired ? (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">{feature.category}</p>
                </div>
                {feature.is_free ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    Gratuita
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    Premium
                  </span>
                )}
              </div>

              {feature.expires_at && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className={isExpired ? 'text-red-600' : 'text-gray-500'}>
                    {isExpired ? 'Scaduta il' : 'Scade il'}{' '}
                    {new Date(feature.expires_at).toLocaleDateString('it-IT')}
                  </span>
                </div>
              )}

              {feature.activation_type && feature.activation_type !== 'free' && (
                <div className="mt-2 text-xs text-gray-500">
                  Attivata via: {feature.activation_type}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
