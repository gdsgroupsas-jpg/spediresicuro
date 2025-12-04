/**
 * Admin Dashboard - Gestione Features Piattaforma
 * 
 * Permette al superadmin di attivare/disattivare tutte le features/moduli
 * della piattaforma da un pannello centralizzato.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardNav from '@/components/dashboard-nav';
import {
  Settings,
  Power,
  PowerOff,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Save,
  RefreshCw,
} from 'lucide-react';

interface PlatformFeature {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  is_visible: boolean;
  display_order: number;
  icon: string | null;
  route_path: string | null;
  config: any;
}

export default function PlatformFeaturesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [features, setFeatures] = useState<PlatformFeature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Verifica autorizzazione e carica dati
  useEffect(() => {
    async function checkAuthAndLoad() {
      if (status === 'loading') return;

      if (status === 'unauthenticated' || !session) {
        router.push('/login');
        return;
      }

      // Verifica ruolo superadmin
      try {
        const response = await fetch('/api/admin/overview');
        if (response.ok) {
          const data = await response.json();
          // Verifica se è superadmin (account_type = 'superadmin')
          const userResponse = await fetch('/api/user/info');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.account_type === 'superadmin') {
              setIsAuthorized(true);
              await loadFeatures();
            } else {
              setIsAuthorized(false);
              setError('Accesso negato. Solo il superadmin può gestire le features della piattaforma.');
            }
          } else {
            setIsAuthorized(false);
            setError('Errore durante la verifica dei permessi');
          }
        } else {
          setIsAuthorized(false);
          setError('Accesso negato. Solo il superadmin può accedere.');
        }
      } catch (error) {
        console.error('Errore verifica autorizzazione:', error);
        setIsAuthorized(false);
        setError('Errore durante la verifica dei permessi');
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthAndLoad();
  }, [status, session, router]);

  // Carica features
  async function loadFeatures() {
    try {
      const response = await fetch('/api/admin/platform-features');
      if (!response.ok) {
        throw new Error('Errore durante il caricamento delle features');
      }
      const data = await response.json();
      if (data.success) {
        setFeatures(data.features || []);
      } else {
        setError(data.error || 'Errore durante il caricamento');
      }
    } catch (error: any) {
      console.error('Errore caricamento features:', error);
      setError(error.message || 'Errore durante il caricamento');
    }
  }

  // Toggle enabled
  async function toggleEnabled(featureCode: string, currentValue: boolean) {
    await updateFeature(featureCode, { is_enabled: !currentValue });
  }

  // Toggle visible
  async function toggleVisible(featureCode: string, currentValue: boolean) {
    await updateFeature(featureCode, { is_visible: !currentValue });
  }

  // Aggiorna feature
  async function updateFeature(featureCode: string, updates: Partial<PlatformFeature>) {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await fetch('/api/admin/platform-features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature_code: featureCode,
          ...updates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio');
      }

      const data = await response.json();
      if (data.success) {
        setSaveMessage('Modifiche salvate con successo!');
        setTimeout(() => setSaveMessage(null), 3000);
        await loadFeatures();
      } else {
        throw new Error(data.error || 'Errore durante il salvataggio');
      }
    } catch (error: any) {
      console.error('Errore aggiornamento feature:', error);
      setSaveMessage(`Errore: ${error.message}`);
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  }

  // Raggruppa features per categoria
  const featuresByCategory = features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, PlatformFeature[]>);

  // Ordina categorie
  const categories = Object.keys(featuresByCategory).sort();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento features...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized || error) {
    return (
      <>
        <DashboardNav
          title="Gestione Features Piattaforma"
          subtitle="Attiva/disattiva features della piattaforma"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Admin', href: '/dashboard/admin' },
            { label: 'Features', href: '/dashboard/admin/features' },
          ]}
        />
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600">{error || 'Solo il superadmin può accedere a questa pagina'}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardNav
        title="Gestione Features Piattaforma"
        subtitle="Attiva/disattiva tutte le features e moduli della piattaforma"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Features', href: '/dashboard/admin/features' },
        ]}
        actions={
          <button
            onClick={loadFeatures}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Ricarica
          </button>
        }
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Messaggio salvataggio */}
          {saveMessage && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                saveMessage.includes('Errore')
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-green-50 border border-green-200 text-green-800'
              }`}
            >
              {saveMessage.includes('Errore') ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <p className="text-sm font-medium">{saveMessage}</p>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <Settings className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Gestione Features Piattaforma
                </h3>
                <p className="text-sm text-blue-800 leading-relaxed mb-2">
                  Da qui puoi attivare o disattivare tutte le features e moduli della piattaforma.
                </p>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>
                    <strong>Attiva/Disattiva:</strong> Se disattivata, la feature non funziona (anche se visibile)
                  </li>
                  <li>
                    <strong>Visibile/Nascosta:</strong> Se nascosta, la feature non appare nel menu (anche se attiva)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Features per Categoria */}
          {categories.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna feature trovata</h3>
              <p className="text-gray-600">Esegui la migration SQL per creare le features</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                    <h2 className="text-xl font-bold text-white capitalize">
                      {category === 'user' ? 'Features Utente' : category}
                    </h2>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 gap-4">
                      {featuresByCategory[category]
                        .sort((a, b) => a.display_order - b.display_order)
                        .map((feature) => (
                          <div
                            key={feature.id}
                            className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-lg font-semibold text-gray-900">{feature.name}</h3>
                                  {feature.route_path && (
                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                      {feature.route_path}
                                    </span>
                                  )}
                                </div>
                                {feature.description && (
                                  <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {feature.code}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Toggle Attiva/Disattiva */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {feature.is_enabled ? (
                                    <Power className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <PowerOff className="w-5 h-5 text-gray-400" />
                                  )}
                                  <span className="text-sm font-medium text-gray-700">
                                    {feature.is_enabled ? 'Attiva' : 'Disattivata'}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {feature.is_enabled
                                    ? 'La feature è funzionante'
                                    : 'La feature è disattivata e non funziona'}
                                </span>
                              </div>
                              <button
                                onClick={() => toggleEnabled(feature.code, feature.is_enabled)}
                                disabled={isSaving}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 ${
                                  feature.is_enabled
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                }`}
                              >
                                {feature.is_enabled ? (
                                  <>
                                    <PowerOff className="w-4 h-4" />
                                    Disattiva
                                  </>
                                ) : (
                                  <>
                                    <Power className="w-4 h-4" />
                                    Attiva
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Toggle Visibile/Nascosta */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {feature.is_visible ? (
                                    <Eye className="w-5 h-5 text-blue-600" />
                                  ) : (
                                    <EyeOff className="w-5 h-5 text-gray-400" />
                                  )}
                                  <span className="text-sm font-medium text-gray-700">
                                    {feature.is_visible ? 'Visibile' : 'Nascosta'}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {feature.is_visible
                                    ? 'La feature appare nel menu'
                                    : 'La feature è nascosta nel menu'}
                                </span>
                              </div>
                              <button
                                onClick={() => toggleVisible(feature.code, feature.is_visible)}
                                disabled={isSaving}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 ${
                                  feature.is_visible
                                    ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                {feature.is_visible ? (
                                  <>
                                    <EyeOff className="w-4 h-4" />
                                    Nascondi
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-4 h-4" />
                                    Mostra
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

