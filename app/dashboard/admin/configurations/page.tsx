/**
 * Admin Dashboard - Gestione Configurazioni Corrieri
 * 
 * Interfaccia CRUD completa per gestire configurazioni API corrieri.
 * Solo gli admin possono accedere a questa pagina.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardNav from '@/components/dashboard-nav';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Key,
  Globe,
  Package,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  saveConfiguration,
  deleteConfiguration,
  listConfigurations,
  getConfiguration,
  type CourierConfig,
  type CourierConfigInput,
} from '@/actions/configurations';

// Provider disponibili
const AVAILABLE_PROVIDERS = [
  { id: 'spedisci_online', name: 'Spedisci.Online', baseUrl: 'https://ecommerceitalia.spedisci.online/api/v2' },
  { id: 'gls', name: 'GLS', baseUrl: 'https://api.gls.it' },
  { id: 'brt', name: 'BRT', baseUrl: 'https://api.brt.it' },
  { id: 'poste', name: 'Poste Italiane', baseUrl: 'https://api.poste.it' },
];

export default function ConfigurationsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [configs, setConfigs] = useState<CourierConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Stati per modale creazione/modifica
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<CourierConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});

  // Form data
  const [formData, setFormData] = useState<CourierConfigInput>({
    name: '',
    provider_id: 'spedisci_online',
    api_key: '',
    api_secret: '',
    base_url: '',
    contract_mapping: {},
    is_active: true,
    is_default: false,
    description: '',
    notes: '',
  });

  // Contract mapping form (chiave-valore dinamici)
  const [contractEntries, setContractEntries] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  // Verifica autorizzazione e carica dati
  useEffect(() => {
    async function checkAuthAndLoad() {
      if (status === 'loading') return;

      if (status === 'unauthenticated' || !session) {
        router.push('/login');
        return;
      }

      // Verifica ruolo admin
      try {
        const response = await fetch('/api/admin/overview');
        if (response.ok) {
          setIsAuthorized(true);
          await loadConfigurations();
        } else {
          setIsAuthorized(false);
          setError('Accesso negato. Solo gli admin possono accedere.');
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

  // Carica configurazioni
  async function loadConfigurations() {
    try {
      const result = await listConfigurations();
      if (result.success && result.configs) {
        setConfigs(result.configs);
      } else {
        setError(result.error || 'Errore durante il caricamento');
      }
    } catch (error: any) {
      console.error('Errore caricamento configurazioni:', error);
      setError(error.message || 'Errore durante il caricamento');
    }
  }

  // Apri modale creazione
  function handleCreate() {
    setSelectedConfig(null);
    setFormData({
      name: '',
      provider_id: 'spedisci_online',
      api_key: '',
      api_secret: '',
      base_url: AVAILABLE_PROVIDERS[0].baseUrl,
      contract_mapping: {},
      is_active: true,
      is_default: false,
      description: '',
      notes: '',
    });
    setContractEntries([{ key: '', value: '' }]);
    setShowConfigModal(true);
  }

  // Apri modale modifica
  function handleEdit(config: CourierConfig) {
    setSelectedConfig(config);
    setFormData({
      id: config.id,
      name: config.name,
      provider_id: config.provider_id,
      api_key: config.api_key,
      api_secret: config.api_secret || '',
      base_url: config.base_url,
      contract_mapping: config.contract_mapping || {},
      is_active: config.is_active,
      is_default: config.is_default,
      description: config.description || '',
      notes: config.notes || '',
    });
    
    // Converti contract_mapping in array per il form
    const entries = Object.entries(config.contract_mapping || {}).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    setContractEntries(entries.length > 0 ? entries : [{ key: '', value: '' }]);
    setShowConfigModal(true);
  }

  // Apri modale eliminazione
  function handleDeleteClick(config: CourierConfig) {
    setSelectedConfig(config);
    setShowDeleteModal(true);
  }

  // Salva configurazione
  async function handleSave() {
    if (!formData.name || !formData.provider_id || !formData.api_key || !formData.base_url) {
      alert('Compila tutti i campi obbligatori');
      return;
    }

    setIsSaving(true);
    try {
      // Converti contract entries in object
      const contractMapping: Record<string, string> = {};
      contractEntries.forEach((entry) => {
        if (entry.key && entry.value) {
          contractMapping[entry.key] = entry.value;
        }
      });

      const result = await saveConfiguration({
        ...formData,
        contract_mapping: contractMapping,
      });

      if (result.success) {
        setShowConfigModal(false);
        await loadConfigurations();
        alert(selectedConfig ? 'Configurazione aggiornata con successo' : 'Configurazione creata con successo');
      } else {
        alert(`Errore: ${result.error || 'Errore sconosciuto'}`);
      }
    } catch (error: any) {
      console.error('Errore salvataggio:', error);
      alert(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setIsSaving(false);
    }
  }

  // Elimina configurazione
  async function handleDelete() {
    if (!selectedConfig || isDeleting) return;

    setIsDeleting(true);
    try {
      const result = await deleteConfiguration(selectedConfig.id);

      if (result.success) {
        setShowDeleteModal(false);
        setSelectedConfig(null);
        await loadConfigurations();
        alert('Configurazione eliminata con successo');
      } else {
        alert(`Errore: ${result.error || 'Errore sconosciuto'}`);
      }
    } catch (error: any) {
      console.error('Errore eliminazione:', error);
      alert(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setIsDeleting(false);
    }
  }

  // Aggiungi entry contract mapping
  function addContractEntry() {
    setContractEntries([...contractEntries, { key: '', value: '' }]);
  }

  // Rimuovi entry contract mapping
  function removeContractEntry(index: number) {
    setContractEntries(contractEntries.filter((_, i) => i !== index));
  }

  // Aggiorna contract entry
  function updateContractEntry(index: number, field: 'key' | 'value', value: string) {
    const updated = [...contractEntries];
    updated[index] = { ...updated[index], [field]: value };
    setContractEntries(updated);
  }

  // Aggiorna base_url quando cambia provider
  function handleProviderChange(providerId: string) {
    const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
    if (provider) {
      setFormData({ ...formData, provider_id: providerId, base_url: provider.baseUrl });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <>
        <DashboardNav
          title="Configurazioni Corrieri"
          subtitle="Gestione configurazioni API corrieri"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Admin', href: '/dashboard/admin' },
            { label: 'Configurazioni', href: '/dashboard/admin/configurations' },
          ]}
        />
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Accesso Negato</h2>
            <p className="text-gray-600">{error || 'Solo gli admin possono accedere a questa pagina'}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardNav
        title="Configurazioni Corrieri"
        subtitle="Gestione dinamica API corrieri - Multi-Tenant"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin', href: '/dashboard/admin' },
          { label: 'Configurazioni', href: '/dashboard/admin/configurations' },
        ]}
        actions={
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuova Configurazione
          </button>
        }
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header informativo */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <Settings className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Sistema Multi-Tenant API Corrieri
                </h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  Gestisci configurazioni API corrieri in modo dinamico. Ogni configurazione può essere 
                  assegnata a utenti specifici o impostata come default per un provider. 
                  Questo sistema sostituisce le variabili d'ambiente statiche.
                </p>
              </div>
            </div>
          </div>

          {/* Lista configurazioni */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {configs.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna configurazione</h3>
              <p className="text-gray-600 mb-6">Crea la prima configurazione per iniziare</p>
              <button
                onClick={handleCreate}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Crea Configurazione
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                        {config.is_default && (
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                            Default
                          </span>
                        )}
                        {config.is_active ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Attiva
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Inattiva
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <strong>Provider:</strong> {AVAILABLE_PROVIDERS.find((p) => p.id === config.provider_id)?.name || config.provider_id}
                        </p>
                        <p>
                          <strong>Base URL:</strong> {config.base_url}
                        </p>
                        <p>
                          <strong>API Key:</strong>{' '}
                          <span className="font-mono text-xs">
                            {showApiKey[config.id] ? config.api_key : '•'.repeat(20)}
                          </span>
                          <button
                            onClick={() => setShowApiKey({ ...showApiKey, [config.id]: !showApiKey[config.id] })}
                            className="ml-2 text-blue-600 hover:text-blue-700"
                          >
                            {showApiKey[config.id] ? <EyeOff className="w-4 h-4 inline" /> : <Eye className="w-4 h-4 inline" />}
                          </button>
                        </p>
                        {config.description && (
                          <p>
                            <strong>Descrizione:</strong> {config.description}
                          </p>
                        )}
                        {Object.keys(config.contract_mapping || {}).length > 0 && (
                          <div>
                            <strong>Contratti:</strong>
                            <ul className="list-disc list-inside ml-4 mt-1">
                              {Object.entries(config.contract_mapping || {}).map(([key, value]) => (
                                <li key={key} className="text-xs">
                                  {key}: <span className="font-mono">{value}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(config)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Modifica"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(config)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modale Creazione/Modifica */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedConfig ? 'Modifica Configurazione' : 'Nuova Configurazione'}
              </h2>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Configurazione *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Es: Account Standard, Account VIP"
                />
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Provider *
                </label>
                <select
                  value={formData.provider_id}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {AVAILABLE_PROVIDERS.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key *
                </label>
                <input
                  type="text"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Inserisci la chiave API"
                />
              </div>

              {/* API Secret (opzionale) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Secret (opzionale)
                </label>
                <input
                  type="text"
                  value={formData.api_secret}
                  onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  placeholder="Inserisci il secret API (se richiesto)"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base URL *
                </label>
                <input
                  type="text"
                  value={formData.base_url}
                  onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://api.example.com"
                />
              </div>

              {/* Contract Mapping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mapping Contratti (Servizio → Codice Contratto)
                </label>
                <div className="space-y-2">
                  {contractEntries.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={entry.key}
                        onChange={(e) => updateContractEntry(index, 'key', e.target.value)}
                        placeholder="Servizio (es: poste)"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="text"
                        value={entry.value}
                        onChange={(e) => updateContractEntry(index, 'value', e.target.value)}
                        placeholder="Codice Contratto"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                      />
                      {contractEntries.length > 1 && (
                        <button
                          onClick={() => removeContractEntry(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addContractEntry}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Aggiungi Contratto
                  </button>
                </div>
              </div>

              {/* Checkbox */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Configurazione attiva</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Configurazione default (usata come fallback)
                  </span>
                </label>
              </div>

              {/* Descrizione */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrizione (opzionale)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Descrizione della configurazione"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salva
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Eliminazione */}
      {showDeleteModal && selectedConfig && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Elimina Configurazione</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-700 mb-4">
                Sei sicuro di voler eliminare la configurazione <strong>{selectedConfig.name}</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-amber-800">
                  ⚠️ Questa azione è irreversibile. Verifica che la configurazione non sia assegnata ad alcun utente.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminazione...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Elimina
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

