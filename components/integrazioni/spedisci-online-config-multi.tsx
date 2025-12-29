'use client'

/**
 * Configurazione Spedisci.Online Multi-Dominio
 * 
 * Interfaccia per gestire più configurazioni Spedisci.Online:
 * - Lista di tutte le configurazioni
 * - Aggiungere nuove configurazioni
 * - Attivare/disattivare configurazioni
 * - Solo superadmin può gestire
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
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
  Power,
  PowerOff,
  Edit2,
  X
} from 'lucide-react'

interface Contract {
  codice: string
  corriere: string
}

interface Config {
  id?: string
  name: string
  dominio: string
  base_url: string
  api_key: string
  contracts: Contract[]
  is_active: boolean
  is_default: boolean
}

export default function SpedisciOnlineConfigMulti() {
  const { data: session } = useSession()
  const [configs, setConfigs] = useState<Config[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<Config | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState<Config>({
    name: '',
    dominio: '',
    base_url: '',
    api_key: '',
    contracts: [],
    is_active: true,
    is_default: false,
  })
  const [newContract, setNewContract] = useState({ codice: '', corriere: '' })
  const [showApiKey, setShowApiKey] = useState(false)

  // Carica configurazioni
  useEffect(() => {
    loadConfigurations()
  }, [])

  const loadConfigurations = async () => {
    setIsLoading(true)
    try {
      const { listConfigurations } = await import('@/actions/configurations')
      const result = await listConfigurations()
      
      if (result.success && result.configs) {
        const spedisciConfigs = result.configs
          .filter((c: any) => c.provider_id === 'spedisci_online')
          .map((c: any) => {
            let contracts: Contract[] = []
            if (c.contract_mapping) {
              const mapping = typeof c.contract_mapping === 'string'
                ? JSON.parse(c.contract_mapping)
                : c.contract_mapping
              
              Object.entries(mapping).forEach(([codice, corriere]) => {
                contracts.push({
                  codice: codice as string,
                  corriere: corriere as string
                })
              })
            }
            
            return {
              id: c.id,
              name: c.name || 'Configurazione Spedisci.Online',
              dominio: c.description?.replace('Dominio: ', '') || '',
              base_url: c.base_url || '',
              api_key: c.api_key || '',
              contracts,
              is_active: c.is_active ?? true,
              is_default: c.is_default ?? false,
            }
          })
        
        setConfigs(spedisciConfigs)
      }
    } catch (error) {
      console.error('Errore caricamento configurazioni:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleActive = async (configId: string, currentStatus: boolean) => {
    try {
      const { updateConfigurationStatus } = await import('@/actions/configurations')
      const result = await updateConfigurationStatus(configId, !currentStatus)
      
      if (result.success) {
        await loadConfigurations()
      }
    } catch (error) {
      console.error('Errore toggle attiva/disattiva:', error)
    }
  }

  const handleEdit = (config: Config) => {
    setEditingConfig(config)
    setFormData(config)
    setShowForm(true)
  }

  const handleNew = () => {
    setEditingConfig(null)
    setFormData({
      name: '',
      dominio: '',
      base_url: '',
      api_key: '',
      contracts: [],
      is_active: true,
      is_default: false,
    })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingConfig(null)
    setFormData({
      name: '',
      dominio: '',
      base_url: '',
      api_key: '',
      contracts: [],
      is_active: true,
      is_default: false,
    })
    setNewContract({ codice: '', corriere: '' })
  }

  const addContract = () => {
    if (newContract.codice.trim() && newContract.corriere.trim()) {
      setFormData({
        ...formData,
        contracts: [...formData.contracts, { ...newContract }]
      })
      setNewContract({ codice: '', corriere: '' })
    }
  }

  const removeContract = (index: number) => {
    setFormData({
      ...formData,
      contracts: formData.contracts.filter((_, i) => i !== index)
    })
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Valida
      if (!formData.api_key.trim()) {
        alert('API Key è obbligatoria')
        setIsSaving(false)
        return
      }

      if (!formData.base_url.trim()) {
        alert('Endpoint (Base URL) è obbligatorio')
        setIsSaving(false)
        return
      }

      // Prepara contract_mapping
      const contractMapping: Record<string, string> = {}
      formData.contracts.forEach(contract => {
        if (contract.codice.trim() && contract.corriere.trim()) {
          contractMapping[contract.codice] = contract.corriere
        }
      })

      const configInput = {
        id: editingConfig?.id,
        name: formData.name.trim() || `Spedisci.Online - ${formData.dominio || 'Configurazione'}`,
        provider_id: 'spedisci_online',
        api_key: formData.api_key.trim(),
        base_url: formData.base_url.trim(),
        contract_mapping: contractMapping,
        is_active: formData.is_active,
        is_default: editingConfig ? editingConfig.is_default : false,
        description: formData.dominio.trim() ? `Dominio: ${formData.dominio.trim()}` : undefined,
      }

      // ⚠️ FIX: Reseller usano savePersonalConfiguration, Admin usano saveConfiguration
      const userRole = (session?.user as any)?.role
      const isUserAdmin = userRole === 'admin' || (session?.user as any)?.account_type === 'superadmin'
      
      let result
      if (isUserAdmin) {
        const { saveConfiguration } = await import('@/actions/configurations')
        result = await saveConfiguration(configInput)
      } else {
        // Reseller o utenti normali usano savePersonalConfiguration
        // Rimuovi is_default perché non è permesso per config personali
        const { is_default, ...personalConfigInput } = configInput
        const { savePersonalConfiguration } = await import('@/actions/configurations')
        result = await savePersonalConfiguration(personalConfigInput)
      }

      if (result.success) {
        await loadConfigurations()
        handleCancel()
      } else {
        alert(result.error || 'Errore durante il salvataggio')
      }
    } catch (error: any) {
      alert(error.message || 'Errore durante il salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (configId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa configurazione?')) return

    try {
      const { deleteConfiguration } = await import('@/actions/configurations')
      const result = await deleteConfiguration(configId)
      
      if (result.success) {
        await loadConfigurations()
      }
    } catch (error) {
      console.error('Errore eliminazione:', error)
    }
  }

  // ⚠️ RBAC: Admin vedono tutte le config, Reseller vedono solo la propria
  const accountType = (session?.user as any)?.account_type
  const isAdmin = (session?.user as any)?.role === 'admin' || accountType === 'superadmin'
  const isReseller = (session?.user as any)?.is_reseller === true
  const resellerRole = (session?.user as any)?.reseller_role
  const isResellerAdmin = isReseller && resellerRole === 'admin'
  const canAccessConfigurations = isAdmin || isReseller

  if (!canAccessConfigurations) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Accesso Negato
          </h3>
          <p className="text-gray-600">
            Devi essere un reseller o amministratore per gestire le configurazioni Spedisci.Online.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Truck className="w-6 h-6 text-blue-600" />
              Configurazioni Spedisci.Online {isAdmin && '(Multi-Dominio)'}
            </h2>
            <p className="text-gray-600">
              {isAdmin 
                ? 'Gestisci tutte le configurazioni Spedisci.Online. Puoi avere più domini con le stesse regole.'
                : 'Gestisci la tua configurazione personale Spedisci.Online'}
            </p>
            {!isAdmin && (
              <p className="text-sm text-blue-600 mt-2">
                💡 Stai visualizzando solo la tua configurazione personale
              </p>
            )}
          </div>
          {!showForm && (
            <button
              onClick={handleNew}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nuova Configurazione
            </button>
          )}
        </div>

        {/* Lista Configurazioni */}
        {!showForm && (
          <>
            {isLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                <p className="text-gray-600 mt-2">Caricamento configurazioni...</p>
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Nessuna configurazione presente</p>
                <button
                  onClick={handleNew}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Aggiungi Prima Configurazione
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {configs.map((config) => (
                  <div
                    key={config.id}
                    className={`border-2 rounded-lg p-6 transition-all ${
                      config.is_active
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {config.name}
                          </h3>
                          {config.is_default && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              Default
                            </span>
                          )}
                          {config.is_active ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center gap-1">
                              <Power className="w-3 h-3" />
                              Attiva
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded flex items-center gap-1">
                              <PowerOff className="w-3 h-3" />
                              Inattiva
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p><strong>Dominio:</strong> {config.dominio || 'Non specificato'}</p>
                          <p><strong>Endpoint:</strong> {config.base_url}</p>
                          <p><strong>Contratti:</strong> {config.contracts.length}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* ⚠️ RBAC: Mostra toggle attivo/inattivo solo se super_admin o reseller_admin (propria config) */}
                        {(isAdmin || isResellerAdmin) && (
                          <button
                            onClick={() => handleToggleActive(config.id!, config.is_active)}
                            className={`p-2 rounded-lg transition-colors ${
                              config.is_active
                                ? 'text-green-600 hover:bg-green-100'
                                : 'text-gray-400 hover:bg-gray-100'
                            }`}
                            title={config.is_active ? 'Disattiva' : 'Attiva'}
                          >
                            {config.is_active ? (
                              <Power className="w-5 h-5" />
                            ) : (
                              <PowerOff className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        {/* ⚠️ RBAC: Mostra modifica solo se super_admin o reseller_admin (propria config) */}
                        {(isAdmin || isResellerAdmin) && (
                          <button
                            onClick={() => handleEdit(config)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Modifica"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        )}
                        {/* ⚠️ RBAC: Mostra elimina solo se super_admin o reseller_admin (propria config) */}
                        {(isAdmin || isResellerAdmin) && (
                          <button
                            onClick={() => handleDelete(config.id!)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            title="Elimina"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Form Aggiunta/Modifica */}
        {showForm && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingConfig ? 'Modifica Configurazione' : 'Nuova Configurazione'}
              </h3>
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Configurazione
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Es: Configurazione Principale"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md text-base font-medium text-gray-900 bg-white hover:border-gray-400 transition-all"
                  style={{ fontSize: '15px' }}
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    placeholder="Incolla qui la tua API Key"
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono text-gray-900 bg-white"
                    style={{ fontSize: '15px', letterSpacing: '0.5px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-5 h-5 text-gray-500" />
                    ) : (
                      <Eye className="w-5 h-5 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* Dominio e Endpoint */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dominio
                  </label>
                  <input
                    type="text"
                    value={formData.dominio}
                    onChange={(e) => setFormData({ ...formData, dominio: e.target.value })}
                    placeholder="ecommerceitalia.spedisci.online"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md text-base font-medium text-gray-900 bg-white hover:border-gray-400 transition-all"
                    style={{ fontSize: '15px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint (Base URL) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="url"
                    value={formData.base_url}
                    onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
                    placeholder="https://ecommerceitalia.spedisci.online/api/v2/"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono text-gray-900 bg-white"
                    style={{ fontSize: '15px' }}
                  />
                </div>
              </div>

              {/* Contratti */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contratti
                </label>
                
                {formData.contracts.length > 0 && (
                  <div className="mb-4 overflow-x-auto border border-gray-300 rounded-lg">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Codice</th>
                          <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700">Corriere</th>
                          <th className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">Azioni</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.contracts.map((contract, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-gray-900">{contract.codice}</td>
                            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-900">{contract.corriere}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <button
                                onClick={() => removeContract(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
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

                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <input
                        type="text"
                        value={newContract.codice}
                        onChange={(e) => setNewContract({ ...newContract, codice: e.target.value })}
                        placeholder="Codice contratto (es: gls-NN6-STANDARD-(TR-VE))"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base font-mono text-gray-900 bg-white"
                        style={{ fontSize: '15px' }}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={newContract.corriere}
                        onChange={(e) => setNewContract({ ...newContract, corriere: e.target.value })}
                        placeholder="Corriere (es: Gls)"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white"
                        style={{ fontSize: '15px' }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addContract}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Aggiungi Contratto
                  </button>
                </div>
              </div>

              {/* Toggle Attivo/Inattivo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                  Configurazione attiva
                </label>
              </div>

              {/* Pulsanti */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Salva
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

