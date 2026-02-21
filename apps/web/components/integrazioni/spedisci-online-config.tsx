'use client';

/**
 * Configurazione Spedisci.Online - Interfaccia Migliorata
 *
 * Interfaccia tabellare chiara per configurare:
 * - Credenziali API (una sola, valida per tutti i contratti)
 * - Mapping contratti (tabella con codici contratto completi)
 */

import { useState, useEffect } from 'react';
import {
  Truck,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Table,
} from 'lucide-react';

interface Contract {
  codice: string; // Es: "gls-NN6-STANDARD-(TR-VE)"
  corriere: string; // Es: "Gls"
}

export default function SpedisciOnlineConfig() {
  const [apiKey, setApiKey] = useState('');
  const [dominio, setDominio] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [newContract, setNewContract] = useState({ codice: '', corriere: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Carica configurazione esistente
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const { listConfigurations } = await import('@/actions/configurations');
      const result = await listConfigurations();
      if (result.success && result.configs) {
        const config = result.configs.find(
          (c: any) => c.provider_id === 'spedisci_online' && c.is_active
        );

        if (config) {
          setApiKey(config.api_key || '');
          setDominio(config.description?.replace('Dominio: ', '') || '');
          setBaseUrl(config.base_url || '');

          // Carica contratti dal contract_mapping
          if (config.contract_mapping) {
            const mapping =
              typeof config.contract_mapping === 'string'
                ? JSON.parse(config.contract_mapping)
                : config.contract_mapping;

            const contractList: Contract[] = [];
            Object.entries(mapping).forEach(([codice, corriere]) => {
              contractList.push({
                codice: codice as string,
                corriere: corriere as string,
              });
            });
            setContracts(contractList);
          }
        }
      }
    } catch (error) {
      console.error('Errore caricamento configurazione:', error);
    }
  };

  const addContract = () => {
    if (newContract.codice.trim() && newContract.corriere.trim()) {
      setContracts([...contracts, { ...newContract }]);
      setNewContract({ codice: '', corriere: '' });
    }
  };

  const removeContract = (index: number) => {
    setContracts(contracts.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setResult(null);

    try {
      // Valida campi obbligatori
      if (!apiKey.trim()) {
        setResult({
          success: false,
          error: "L'API Key è obbligatoria",
        });
        setIsSaving(false);
        return;
      }

      if (!baseUrl.trim()) {
        setResult({
          success: false,
          error: "L'Endpoint (Base URL) è obbligatorio",
        });
        setIsSaving(false);
        return;
      }

      // Prepara contract_mapping
      const contractMapping: Record<string, string> = {};
      contracts.forEach((contract) => {
        if (contract.codice.trim() && contract.corriere.trim()) {
          // Usa solo la prima parte del codice come chiave (prima del primo trattino)
          const key = contract.codice.split('-')[0].toLowerCase();
          contractMapping[contract.codice] = contract.corriere;
        }
      });

      // Prepara dati configurazione
      const configInput = {
        name: 'Spedisci.Online - Configurazione',
        provider_id: 'spedisci_online',
        api_key: apiKey.trim(),
        base_url: baseUrl.trim(),
        contract_mapping: contractMapping,
        is_active: true,
        is_default: true,
        description: dominio.trim() ? `Dominio: ${dominio.trim()}` : undefined,
      };

      // Salva configurazione
      const { saveConfiguration } = await import('@/actions/configurations');
      const result = await saveConfiguration(configInput);

      if (result.success) {
        setResult({
          success: true,
          message: 'Configurazione salvata con successo!',
        });
        setTimeout(() => setResult(null), 3000);
      } else {
        setResult({
          success: false,
          error: result.error || 'Errore durante il salvataggio',
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || 'Errore durante il salvataggio',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600" />
          Configurazione Spedisci.Online
        </h2>
        <p className="text-gray-600">
          Configura le credenziali API e i contratti. Le stesse API Key sono valide per tutti i
          contratti.
        </p>
      </div>

      {result && (
        <div
          className={`mb-6 p-4 rounded-xl border ${
            result.success
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold">{result.success ? 'Successo!' : 'Errore'}</p>
              <p className="text-sm mt-1">{result.message || result.error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Sezione Credenziali API */}
        <div className="border-b border-gray-200 pb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-600" />
            Credenziali API
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Incolla qui la tua API Key"
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md text-base font-mono text-gray-900 font-medium bg-white hover:border-gray-400 transition-all"
                  style={{ fontSize: '15px', letterSpacing: '0.5px', color: '#111827' }}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title={showApiKey ? 'Nascondi' : 'Mostra'}
                >
                  {showApiKey ? (
                    <EyeOff className="w-5 h-5 text-gray-500" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dominio</label>
              <input
                type="text"
                value={dominio}
                onChange={(e) => setDominio(e.target.value)}
                placeholder="tuodominio.spedisci.online"
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md text-base font-medium text-gray-900 bg-white hover:border-gray-400 transition-all"
                style={{ fontSize: '15px', color: '#111827' }}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endpoint (Base URL) <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://tuodominio.spedisci.online/api/v2/"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md text-base font-mono font-medium text-gray-900 bg-white hover:border-gray-400 transition-all"
              style={{ fontSize: '15px', color: '#111827' }}
            />
          </div>
        </div>

        {/* Sezione Contratti */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Table className="w-5 h-5 text-blue-600" />
            Contratti (Codice Contratto → Corriere)
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            Aggiungi tutti i contratti disponibili. Copia i codici dalla tabella del pannello
            Spedisci.Online.
          </p>

          {/* Tabella Contratti Esistenti */}
          {contracts.length > 0 && (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th
                      className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700"
                      style={{ fontSize: '14px' }}
                    >
                      Codice Contratto
                    </th>
                    <th
                      className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700"
                      style={{ fontSize: '14px' }}
                    >
                      Corriere
                    </th>
                    <th
                      className="border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700"
                      style={{ fontSize: '14px' }}
                    >
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((contract, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td
                        className="border border-gray-300 px-4 py-3 font-mono text-sm"
                        style={{ fontSize: '14px', letterSpacing: '0.3px' }}
                      >
                        {contract.codice}
                      </td>
                      <td
                        className="border border-gray-300 px-4 py-3 text-sm"
                        style={{ fontSize: '14px' }}
                      >
                        {contract.corriere}
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeContract(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Rimuovi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Aggiunta Nuovo Contratto */}
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice Contratto
                </label>
                <input
                  type="text"
                  value={newContract.codice}
                  onChange={(e) => setNewContract({ ...newContract, codice: e.target.value })}
                  placeholder="Es: corriere-CODICE-SERVIZIO"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono text-gray-900 bg-white"
                  style={{ fontSize: '15px', letterSpacing: '0.3px', color: '#111827' }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addContract();
                    }
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Corriere</label>
                <input
                  type="text"
                  value={newContract.corriere}
                  onChange={(e) => setNewContract({ ...newContract, corriere: e.target.value })}
                  placeholder="Es: Gls"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                  style={{ fontSize: '15px', color: '#111827' }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addContract();
                    }
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={addContract}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Contratto
            </button>
          </div>
        </div>

        {/* Pulsante Salva */}
        <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salva Configurazione
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
