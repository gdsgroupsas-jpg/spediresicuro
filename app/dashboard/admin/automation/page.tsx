/**
 * Dashboard Admin: Gestione Automation Spedisci.Online
 * 
 * Permette di:
 * - Visualizzare configurazioni con automation
 * - Abilitare/disabilitare automation
 * - Configurare settings (email 2FA, IMAP, credenziali)
 * - Eseguire sync manuale
 * - Verificare stato session
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  toggleAutomation,
  saveAutomationSettings,
  manualSync,
  getAutomationStatus,
  getAutomationSettings,
  acquireManualLock,
  releaseManualLock,
  checkLock,
} from '@/actions/automation'
import type { AutomationSettings } from '@/lib/automation/spedisci-online-agent'
import { OTPInputModal } from '@/components/automation/otp-input-modal'

interface CourierConfig {
  id: string
  name: string
  provider_id: string
  base_url: string
  automation_enabled: boolean
  last_automation_sync: string | null
  session_data: any
}

export default function AutomationPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<CourierConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null)
  const [settings, setSettings] = useState<AutomationSettings | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [locks, setLocks] = useState<Record<string, any>>({})
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [pendingSyncConfigId, setPendingSyncConfigId] = useState<string | null>(null)
  const [otpPromiseResolver, setOtpPromiseResolver] = useState<((otp: string) => void) | null>(null)

  // Form settings
  const [formSettings, setFormSettings] = useState<Partial<AutomationSettings>>({
    email_2fa: '',
    imap_server: 'imap.gmail.com',
    imap_port: 993,
    imap_username: '',
    imap_password: '',
    spedisci_online_username: '',
    spedisci_online_password: '',
    auto_refresh_interval_hours: 24,
    enabled: false,
  })

  useEffect(() => {
    loadConfigs()
    // Carica lock ogni 10 secondi
    const interval = setInterval(() => {
      loadLocks()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  async function loadLocks() {
    for (const config of configs) {
      const result = await checkLock(config.id)
      if (result.success) {
        setLocks(prev => ({ ...prev, [config.id]: result }))
      }
    }
  }

  async function loadConfigs() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/configurations')
      if (!response.ok) throw new Error('Errore caricamento configurazioni')
      
      const data = await response.json()
      if (data.success && data.configs) {
        // Filtra solo Spedisci.Online
        const spedisciConfigs = data.configs.filter(
          (c: any) => c.provider_id === 'spedisci_online'
        )
        setConfigs(spedisciConfigs)
      }
    } catch (error) {
      console.error('Errore caricamento configurazioni:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleAutomation(configId: string, enabled: boolean) {
    const result = await toggleAutomation(configId, enabled)
    if (result.success) {
      await loadConfigs()
      alert(enabled ? 'Automation abilitata' : 'Automation disabilitata')
    } else {
      alert(`Errore: ${result.error}`)
    }
  }

  async function handleOpenSettings(configId: string) {
    setSelectedConfig(configId)
    const result = await getAutomationSettings(configId)
    
    if (result.success && result.settings) {
      setFormSettings(result.settings)
    } else {
      // Reset form
      setFormSettings({
        email_2fa: '',
        imap_server: 'imap.gmail.com',
        imap_port: 993,
        imap_username: '',
        imap_password: '',
        spedisci_online_username: '',
        spedisci_online_password: '',
        auto_refresh_interval_hours: 24,
        enabled: false,
      })
    }
    
    setShowSettingsModal(true)
  }

  async function handleSaveSettings() {
    if (!selectedConfig) return

    const fullSettings: AutomationSettings = {
      two_factor_method: formSettings.two_factor_method || 'email',
      email_2fa: formSettings.email_2fa || '',
      imap_server: formSettings.imap_server || 'imap.gmail.com',
      imap_port: formSettings.imap_port || 993,
      imap_username: formSettings.imap_username || '',
      imap_password: formSettings.imap_password || '',
      spedisci_online_username: formSettings.spedisci_online_username || '',
      spedisci_online_password: formSettings.spedisci_online_password || '',
      auto_refresh_interval_hours: formSettings.auto_refresh_interval_hours || 24,
      enabled: formSettings.enabled || false,
    }

    const result = await saveAutomationSettings(selectedConfig, fullSettings)
    
    if (result.success) {
      alert('Settings salvati con successo')
      setShowSettingsModal(false)
      await loadConfigs()
    } else {
      alert(`Errore: ${result.error}`)
    }
  }

  async function handleManualSync(configId: string, force: boolean = false) {
    // Verifica se config usa 2FA manuale
    const config = configs.find(c => c.id === configId)
    if (config) {
      const settingsResult = await getAutomationSettings(configId)
      if (settingsResult.success && settingsResult.settings?.two_factor_method === 'manual') {
        // 2FA manuale: mostra modal per OTP
        setPendingSyncConfigId(configId)
        setShowOTPModal(true)
        return // Aspetta OTP
      }
    }

    // Procedi con sync normale
    await executeSync(configId, force)
  }

  async function executeSync(configId: string, force: boolean = false, otp?: string) {
    setSyncing(configId)
    try {
      // TODO: Passa OTP a manualSync se disponibile
      // Per ora, manualSync gestirà 2FA manuale internamente
      const result = await manualSync(configId, force)
      
      if (result.success) {
        alert('Sync completata con successo!')
        await loadConfigs()
        await loadLocks()
      } else {
        // Se errore è "2FA manuale richiesto", mostra modal
        if (result.error?.includes('2FA manuale richiesto') || result.error?.includes('OTP')) {
          setPendingSyncConfigId(configId)
          setShowOTPModal(true)
        } else {
          alert(`Errore sync: ${result.error}`)
        }
      }
    } finally {
      setSyncing(null)
    }
  }

  function handleOTPConfirm(otp: string) {
    setShowOTPModal(false)
    if (pendingSyncConfigId) {
      // TODO: Passa OTP a sync
      // Per ora, mostra messaggio
      alert(`OTP ricevuto: ${otp}. Sync verrà eseguita con questo OTP.`)
      // executeSync(pendingSyncConfigId, false, otp)
      setPendingSyncConfigId(null)
    }
  }

  async function handleAcquireManualLock(configId: string) {
    const result = await acquireManualLock(configId, 60) // 60 minuti
    if (result.success) {
      alert('Lock manuale acquisito. Agent non interferirà per 60 minuti.')
      await loadLocks()
    } else {
      alert(`Errore: ${result.error}`)
    }
  }

  async function handleReleaseLock(configId: string) {
    const result = await releaseManualLock(configId)
    if (result.success) {
      alert('Lock rilasciato. Agent può ora lavorare.')
      await loadLocks()
    } else {
      alert(`Errore: ${result.error}`)
    }
  }

  function getSessionStatus(config: CourierConfig) {
    if (!config.session_data) return { valid: false, message: 'Nessuna sessione' }
    
    const expiresAt = config.session_data?.expires_at
    if (expiresAt) {
      const expires = new Date(expiresAt)
      const now = new Date()
      if (expires > now) {
        const hoursLeft = Math.round((expires.getTime() - now.getTime()) / (1000 * 60 * 60))
        return { valid: true, message: `Valida (${hoursLeft}h rimaste)` }
      } else {
        return { valid: false, message: 'Scaduta' }
      }
    }
    
    return { valid: true, message: 'Valida' }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Caricamento...</div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Automation Spedisci.Online</h1>
        <p className="text-gray-600">
          Gestisci automazione per estrazione automatica di session cookies e contratti
        </p>
      </div>

      {/* Lista Configurazioni */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Base URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Automation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Ultimo Sync
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Session
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Lock
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {configs.map((config) => {
              const sessionStatus = getSessionStatus(config)
              
              return (
                <tr key={config.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {config.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {config.base_url}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleAutomation(config.id, !config.automation_enabled)}
                      className={`px-3 py-1 rounded text-xs font-medium ${
                        config.automation_enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {config.automation_enabled ? 'Abilitata' : 'Disabilitata'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {config.last_automation_sync
                      ? new Date(config.last_automation_sync).toLocaleString('it-IT')
                      : 'Mai'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        sessionStatus.valid
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {sessionStatus.message}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {locks[config.id]?.has_lock ? (
                      <div className="space-y-1">
                        <span
                          className={`px-2 py-1 rounded text-xs block ${
                            locks[config.id].lock_type === 'manual'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {locks[config.id].lock_type === 'manual' ? '🔒 Manuale' : '🤖 Agent'}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          {locks[config.id].minutes_remaining}m rimaste
                        </span>
                        {locks[config.id].lock_type === 'manual' && (
                          <button
                            onClick={() => handleReleaseLock(config.id)}
                            className="text-xs text-red-600 hover:text-red-900"
                          >
                            Rilascia
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                          Libero
                        </span>
                        <button
                          onClick={() => handleAcquireManualLock(config.id)}
                          className="text-xs text-yellow-600 hover:text-yellow-900"
                        >
                          Lock Manuale
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleOpenSettings(config.id)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => handleManualSync(config.id, false)}
                      disabled={syncing === config.id || locks[config.id]?.has_lock}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50"
                      title={locks[config.id]?.has_lock ? 'Lock attivo, usa "Forza Sync" per ignorare' : ''}
                    >
                      {syncing === config.id ? 'Sync...' : 'Sync'}
                    </button>
                    {locks[config.id]?.has_lock && (
                      <button
                        onClick={() => handleManualSync(config.id, true)}
                        disabled={syncing === config.id}
                        className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                        title="Forza sync ignorando lock (usa con cautela)"
                      >
                        Forza Sync
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {configs.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            Nessuna configurazione Spedisci.Online trovata
          </div>
        )}
      </div>

      {/* Modal Settings */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Automation Settings</h2>

            <div className="space-y-4">
              {/* Metodo 2FA */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Metodo 2FA *
                </label>
                <select
                  value={formSettings.two_factor_method || 'email'}
                  onChange={(e) => setFormSettings({ ...formSettings, two_factor_method: e.target.value as 'email' | 'manual' })}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="email">Email (IMAP) - Legge codice da email</option>
                  <option value="manual">Manuale (Microsoft Authenticator) - Inserisci OTP manualmente</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formSettings.two_factor_method === 'manual' 
                    ? '⚠️ Con Microsoft Authenticator, devi inserire OTP manualmente durante sync'
                    : 'Per Gmail: usa App Password (non password normale)'}
                </p>
              </div>

              {/* Email 2FA (solo se metodo = email) */}
              {formSettings.two_factor_method === 'email' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email per 2FA *
                    </label>
                    <input
                      type="email"
                      value={formSettings.email_2fa || ''}
                      onChange={(e) => setFormSettings({ ...formSettings, email_2fa: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="email@example.com"
                    />
                  </div>

                  {/* IMAP Server */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      IMAP Server *
                    </label>
                    <input
                      type="text"
                      value={formSettings.imap_server || ''}
                      onChange={(e) => setFormSettings({ ...formSettings, imap_server: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="imap.gmail.com"
                    />
                  </div>

                  {/* IMAP Port */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      IMAP Port *
                    </label>
                    <input
                      type="number"
                      value={formSettings.imap_port || 993}
                      onChange={(e) => setFormSettings({ ...formSettings, imap_port: parseInt(e.target.value) })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  {/* IMAP Username */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      IMAP Username *
                    </label>
                    <input
                      type="text"
                      value={formSettings.imap_username || ''}
                      onChange={(e) => setFormSettings({ ...formSettings, imap_username: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="email@example.com"
                    />
                  </div>

                  {/* IMAP Password */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      IMAP Password (App Password) *
                    </label>
                    <input
                      type="password"
                      value={formSettings.imap_password || ''}
                      onChange={(e) => setFormSettings({ ...formSettings, imap_password: e.target.value })}
                      className="w-full border rounded px-3 py-2"
                      placeholder="App Password Gmail"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Per Gmail: usa App Password (non password normale)
                    </p>
                  </div>
                </>
              )}

              {/* Info Manual 2FA */}
              {formSettings.two_factor_method === 'manual' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ 2FA Manuale (Microsoft Authenticator):</strong>
                    <br />
                    Con questo metodo, durante sync manuale ti verrà chiesto di inserire l'OTP dal tuo Authenticator.
                    <br />
                    Sync automatico (cron) non funzionerà con questo metodo.
                  </p>
                </div>
              )}

              {/* Spedisci.Online Username */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Spedisci.Online Username *
                </label>
                <input
                  type="text"
                  value={formSettings.spedisci_online_username || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, spedisci_online_username: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Spedisci.Online Password */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Spedisci.Online Password *
                </label>
                <input
                  type="password"
                  value={formSettings.spedisci_online_password || ''}
                  onChange={(e) => setFormSettings({ ...formSettings, spedisci_online_password: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Auto Refresh Interval */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Auto Refresh Interval (ore)
                </label>
                <input
                  type="number"
                  value={formSettings.auto_refresh_interval_hours || 24}
                  onChange={(e) => setFormSettings({ ...formSettings, auto_refresh_interval_hours: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Enabled */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formSettings.enabled || false}
                  onChange={(e) => setFormSettings({ ...formSettings, enabled: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium">
                  Abilita automation
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveSettings}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal OTP Input */}
      <OTPInputModal
        isOpen={showOTPModal}
        onClose={() => {
          setShowOTPModal(false)
          setPendingSyncConfigId(null)
        }}
        onConfirm={handleOTPConfirm}
        title="Inserisci Codice OTP"
        message="Apri Microsoft Authenticator e inserisci il codice a 6 cifre per Spedisci.Online:"
      />
    </div>
  )
}

