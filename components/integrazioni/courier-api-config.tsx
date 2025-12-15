'use client'

/**
 * Configurazione API Corrieri
 * 
 * Interfaccia semplice per configurare le credenziali API dei corrieri
 * con copia-incolla delle credenziali fornite dai provider
 */

import { useState, useEffect } from 'react'
import {
  Truck,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  Zap
} from 'lucide-react'
import dynamic from 'next/dynamic'

const PosteWizard = dynamic(() => import('./PosteWizard'))
const SpedisciOnlineWizard = dynamic(() => import('./SpedisciOnlineWizard'))

interface CourierAPI {
  id: string
  name: string
  fields: {
    key: string
    label: string
    type: 'text' | 'password' | 'url'
    placeholder: string
    required: boolean
  }[]
}

// Configurazione API disponibili
const availableAPIs: CourierAPI[] = [
  {
    id: 'spedisci_online',
    name: 'Spedisci.Online',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'FID7mgWlyJybX6wTwXFMc...',
        required: true
      },
      {
        key: 'dominio',
        label: 'Dominio',
        type: 'text',
        placeholder: 'ecommerceitalia.spedisci.online',
        required: true
      },
      {
        key: 'base_url',
        label: 'Endpoint (Base URL)',
        type: 'url',
        placeholder: 'https://ecommerceitalia.spedisci.online/api/v2/',
        required: true
      },
      {
        key: 'contract_mapping',
        label: 'Mapping Contratti (JSON)',
        type: 'text',
        placeholder: '{"interno": "Interno", "postedeliverybusiness": "PosteDeliveryBusiness", "ups": "UPS", "gls": "Gls"}',
        required: false
      }
    ]
  },
  {
    id: 'gls',
    name: 'GLS',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Incolla qui la tua API Key GLS',
        required: true
      },
      {
        key: 'base_url',
        label: 'Base URL',
        type: 'url',
        placeholder: 'https://api.gls.it',
        required: true
      }
    ]
  },
  {
    id: 'brt',
    name: 'BRT',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Incolla qui la tua API Key BRT',
        required: true
      },
      {
        key: 'base_url',
        label: 'Base URL',
        type: 'url',
        placeholder: 'https://api.brt.it',
        required: true
      }
    ]
  },
  {
    id: 'poste',
    name: 'Poste Italiane',
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        placeholder: 'Incolla qui la tua API Key Poste',
        required: true
      },
      {
        key: 'base_url',
        label: 'Base URL',
        type: 'url',
        placeholder: 'https://api.poste.it',
        required: true
      }
    ]
  }
]

export default function CourierAPIConfig() {
  const [selectedAPI, setSelectedAPI] = useState<string>('spedisci_online')
  const [showPosteWizard, setShowPosteWizard] = useState(false)
  const [showSpedisciOnlineWizard, setShowSpedisciOnlineWizard] = useState(false)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    error?: string
  } | null>(null)
  const [existingConfigs, setExistingConfigs] = useState<any[]>([])

  // Carica configurazioni esistenti
  useEffect(() => {
    loadConfigurations()
  }, [])

  // Carica dati quando cambia API selezionata
  useEffect(() => {
    loadConfigForAPI(selectedAPI)
  }, [selectedAPI])

  const loadConfigurations = async () => {
    try {
      const { listConfigurations } = await import('@/actions/configurations')
      const result = await listConfigurations()
      if (result.success) {
        setExistingConfigs(result.configs || [])
      }
    } catch (error) {
      console.error('Errore caricamento configurazioni:', error)
    }
  }

  const loadConfigForAPI = (apiId: string) => {
    const config = existingConfigs.find(c => c.provider_id === apiId && c.is_active)
    if (config) {
      const data: Record<string, string> = {}
      const api = availableAPIs.find(a => a.id === apiId)
      if (api) {
        api.fields.forEach(field => {
          if (field.key === 'contract_mapping') {
            data[field.key] = typeof config.contract_mapping === 'string'
              ? config.contract_mapping
              : JSON.stringify(config.contract_mapping || {}, null, 2)
          } else {
            data[field.key] = config[field.key] || ''
          }
        })
      }
      setFormData(data)
    } else {
      // Reset form
      const api = availableAPIs.find(a => a.id === apiId)
      const data: Record<string, string> = {}
      if (api) {
        api.fields.forEach(field => {
          data[field.key] = ''
        })
      }
      setFormData(data)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setResult(null)

    try {
      const api = availableAPIs.find(a => a.id === selectedAPI)
      if (!api) return

      // Valida campi obbligatori
      for (const field of api.fields) {
        if (field.required && !formData[field.key]?.trim()) {
          setResult({
            success: false,
            error: `Il campo "${field.label}" è obbligatorio`
          })
          setIsSaving(false)
          return
        }
      }

      // Prepara dati
      const configData: any = {
        name: `${api.name} - Configurazione`,
        provider_id: selectedAPI,
        api_key: formData.api_key || '',
        base_url: formData.base_url || formData.endpoint || '',
        is_active: true,
      }

      // Se c'è un dominio, lo aggiungiamo come metadata
      if (formData.dominio) {
        configData.description = `Dominio: ${formData.dominio}`
      }

      // Gestisci contract_mapping se presente
      if (formData.contract_mapping) {
        try {
          // Prova prima come JSON
          configData.contract_mapping = JSON.parse(formData.contract_mapping)
        } catch {
          // Se non è JSON valido, converti da formato semplice
          // Formato: "codicecontratto-Corriere" (es: "interno-Interno")
          const lines = formData.contract_mapping.split('\n').filter(l => l.trim())
          const mapping: Record<string, string> = {}

          lines.forEach(line => {
            const trimmed = line.trim()
            if (!trimmed) return

            // Formato: "codicecontratto-Corriere" (es: "interno-Interno")
            // Oppure formato tabella: "codicecontratto    Corriere"
            const parts = trimmed.split(/[-:\t]/).map(p => p.trim()).filter(p => p)

            if (parts.length >= 2) {
              // Prendi il primo elemento come chiave (codice contratto)
              // e l'ultimo come valore (corriere)
              const contractCode = parts[0]
              const courier = parts[parts.length - 1]

              // Se il codice contiene trattini, prendi solo la prima parte
              // Es: "postedeliverybusiness-Solution-and-Shipment" -> "postedeliverybusiness"
              const key = contractCode.split('-')[0]

              mapping[key] = courier
            }
          })

          if (Object.keys(mapping).length > 0) {
            configData.contract_mapping = mapping
          } else {
            // Fallback: salva come stringa
            configData.contract_mapping = formData.contract_mapping
          }
        }
      }

      // Salva configurazione usando server action
      const { saveConfiguration } = await import('@/actions/configurations')

      // Prepara CourierConfigInput
      const configInput = {
        name: configData.name,
        provider_id: configData.provider_id,
        api_key: configData.api_key,
        base_url: configData.base_url,
        contract_mapping: configData.contract_mapping || {},
        is_active: configData.is_active ?? true,
        is_default: false,
        description: configData.description,
        notes: configData.notes,
      }

      const result = await saveConfiguration(configInput)

      if (result.success) {
        setResult({
          success: true,
          message: 'Configurazione salvata con successo!'
        })
        await loadConfigurations()
        setTimeout(() => setResult(null), 3000)
      } else {
        setResult({
          success: false,
          error: result.error || 'Errore durante il salvataggio'
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || 'Errore durante il salvataggio'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const togglePasswordVisibility = (fieldKey: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldKey]: !prev[fieldKey]
    }))
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // Potresti aggiungere un toast qui
  }

  const currentAPI = availableAPIs.find(a => a.id === selectedAPI)
  const hasExistingConfig = existingConfigs.some(c => c.provider_id === selectedAPI && c.is_active)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600" />
          Configurazione API Corrieri
        </h2>
        <p className="text-gray-600">
          Configura le credenziali API dei corrieri. Copia e incolla le credenziali fornite dal tuo provider.
        </p>
      </div>

      {showPosteWizard && (
        <PosteWizard
          onClose={() => setShowPosteWizard(false)}
          onSuccess={() => {
            setShowPosteWizard(false)
            loadConfigurations() // Reload to show new config
          }}
        />
      )}

      {showSpedisciOnlineWizard && (
        <SpedisciOnlineWizard
          onClose={() => setShowSpedisciOnlineWizard(false)}
          onSuccess={() => {
            setShowSpedisciOnlineWizard(false)
            loadConfigurations() // Reload to show new config
          }}
        />
      )}

      {/* Selezione Corriere */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Seleziona Corriere
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {availableAPIs.map((api) => (
            <button
              key={api.id}
              type="button"
              onClick={() => setSelectedAPI(api.id)}
              className={`px-4 py-3 rounded-lg border-2 transition-all ${selectedAPI === api.id
                ? 'border-blue-600 bg-blue-50 text-blue-900 font-semibold'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
            >
              {api.name}
              {existingConfigs.some(c => c.provider_id === api.id && c.is_active) && (
                <CheckCircle2 className="w-4 h-4 text-green-600 inline-block ml-2" />
              )}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className={`mb-6 p-4 rounded-xl border ${result.success
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
          }`}>
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

      {/* Form Credenziali */}
      {currentAPI && (
        <div className="space-y-6">

          {/* Banner Wizard per Poste Italiane */}
          {selectedAPI === 'poste' && (
            <div className={`mb-6 rounded-xl p-6 shadow-lg border ${hasExistingConfig
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900'
                : 'bg-gradient-to-r from-yellow-400 to-yellow-500 border-yellow-300 text-blue-900'
              }`}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Zap className={`w-6 h-6 ${hasExistingConfig ? 'text-blue-600' : ''}`} />
                    {hasExistingConfig ? 'Aggiorna Configurazione Poste' : 'Configurazione Guidata'}
                  </h3>
                  <p className="font-medium opacity-90">
                    {hasExistingConfig
                      ? 'Usa il Wizard per aggiornare Client ID e Secret ID in modo sicuro.'
                      : 'Configura il tuo account Poste Italiane in pochi secondi con il nostro nuovo Wizard automatizzato.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowPosteWizard(true)}
                  className={`px-6 py-2.5 font-bold rounded-lg transition-colors shadow-md ${hasExistingConfig
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                >
                  {hasExistingConfig ? 'Apri Wizard' : 'Avvia Wizard'}
                </button>
              </div>
            </div>
          )}

          {/* Banner Wizard per Spedisci.Online */}
          {selectedAPI === 'spedisci_online' && (
            <div className={`mb-6 rounded-xl p-6 shadow-lg border ${hasExistingConfig
                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400 text-white'
              }`}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Zap className={`w-6 h-6 ${hasExistingConfig ? 'text-blue-600' : 'text-white'}`} />
                    {hasExistingConfig ? 'Aggiorna Configurazione Spedisci.Online' : 'Configurazione Guidata'}
                  </h3>
                  <p className={`font-medium ${hasExistingConfig ? 'opacity-90' : 'opacity-95'}`}>
                    {hasExistingConfig
                      ? 'Usa il Wizard per aggiornare API Key e Base URL in modo sicuro.'
                      : 'Configura il tuo account Spedisci.Online in pochi secondi con il nostro nuovo Wizard automatizzato.'}
                  </p>
                </div>
                <button
                  onClick={() => setShowSpedisciOnlineWizard(true)}
                  className={`px-6 py-2.5 font-bold rounded-lg transition-colors shadow-md ${hasExistingConfig
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-white text-blue-900 hover:bg-blue-50'
                    }`}
                >
                  {hasExistingConfig ? 'Apri Wizard' : 'Avvia Wizard'}
                </button>
              </div>
            </div>
          )}

          {hasExistingConfig && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <CheckCircle2 className="w-4 h-4 inline-block mr-2" />
              Configurazione esistente trovata. Modifica i campi per aggiornarla.
            </div>
          )}

          {currentAPI.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.key === 'contract_mapping' ? (
                <div className="relative">
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={8}
                    className="w-full px-4 py-3 pr-20 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md font-mono font-medium text-sm text-gray-900 bg-white hover:border-gray-400 transition-all resize-y"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    {formData[field.key] && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData[field.key])}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Copia"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500">
                      <strong>Formato JSON:</strong> {"{"}&quot;interno&quot;: &quot;Interno&quot;, &quot;postedeliverybusiness&quot;: &quot;PosteDeliveryBusiness&quot;, &quot;gls&quot;: &quot;Gls&quot;{"}"}
                    </p>
                    <p className="text-xs text-gray-400">
                      <strong>Oppure formato semplice</strong> (una riga per contratto, copia-incolla dalla tabella):<br />
                      <code className="bg-gray-100 px-1 rounded">interno-Interno</code><br />
                      <code className="bg-gray-100 px-1 rounded">postedeliverybusiness-PosteDeliveryBusiness</code><br />
                      <code className="bg-gray-100 px-1 rounded">gls-Gls</code>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                    value={formData[field.key] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    required={field.required}
                    className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(field.key)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title={showPasswords[field.key] ? 'Nascondi' : 'Mostra'}
                      >
                        {showPasswords[field.key] ? (
                          <EyeOff className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Eye className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    )}
                    {formData[field.key] && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formData[field.key])}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                        title="Copia"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {field.key === 'dominio' && (
                <p className="text-xs text-gray-500 mt-1">
                  Esempio: ecommerceitalia.spedisci.online
                </p>
              )}
              {field.key === 'base_url' && (
                <p className="text-xs text-gray-500 mt-1">
                  Esempio: https://ecommerceitalia.spedisci.online/api/v2/
                </p>
              )}
            </div>
          ))}

          <div className="flex items-center gap-4 pt-4">
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
      )}
    </div>
  )
}

