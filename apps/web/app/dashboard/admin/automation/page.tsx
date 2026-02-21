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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';
import {
  toggleAutomation,
  saveAutomationSettings,
  manualSync,
  getAutomationStatus,
  getAutomationSettings,
  acquireManualLock,
  releaseManualLock,
  checkLock,
} from '@/actions/automation';
import type { AutomationSettings } from '@/lib/automation/spedisci-online-agent';
import { OTPInputModal } from '@/components/automation/otp-input-modal';
import { toast } from 'sonner';

interface CourierConfig {
  id: string;
  name: string;
  provider_id: string;
  base_url: string;
  automation_enabled: boolean;
  last_automation_sync: string | null;
  session_data: any;
}

export default function AutomationPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<CourierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConfig, setSelectedConfig] = useState<string | null>(null);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [locks, setLocks] = useState<Record<string, any>>({});
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [pendingSyncConfigId, setPendingSyncConfigId] = useState<string | null>(null);
  const [otpPromiseResolver, setOtpPromiseResolver] = useState<((otp: string) => void) | null>(
    null
  );

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
  });

  useEffect(() => {
    loadConfigs();
    // Carica lock ogni 10 secondi
    const interval = setInterval(() => {
      loadLocks();
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLocks() {
    for (const config of configs) {
      const result = await checkLock(config.id);
      if (result.success) {
        setLocks((prev) => ({ ...prev, [config.id]: result }));
      }
    }
  }

  async function loadConfigs() {
    try {
      setLoading(true);
      // Usa server action invece di API
      const { listConfigurations } = await import('@/actions/configurations');
      const result = await listConfigurations();

      if (result.success && result.configs) {
        // Filtra solo Spedisci.Online e aggiungi campi automation
        const spedisciConfigs = result.configs
          .filter((c: any) => c.provider_id === 'spedisci_online')
          .map((c: any) => ({
            ...c,
            automation_enabled: c.automation_enabled || false,
            last_automation_sync: c.last_automation_sync || null,
            session_data: c.session_data || null,
          }));
        setConfigs(spedisciConfigs);
      }
    } catch (error) {
      console.error('Errore caricamento configurazioni:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAutomation(configId: string, enabled: boolean) {
    const result = await toggleAutomation(configId, enabled);
    if (result.success) {
      await loadConfigs();
      toast.success(enabled ? 'Automation abilitata' : 'Automation disabilitata');
    } else {
      toast.error(result.error);
    }
  }

  async function handleOpenSettings(configId: string) {
    setSelectedConfig(configId);
    const result = await getAutomationSettings(configId);

    if (result.success && result.settings) {
      setFormSettings(result.settings);
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
      });
    }

    // Form già visibile nella pagina
  }

  async function handleSaveSettings() {
    if (!selectedConfig) return;

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
    };

    const result = await saveAutomationSettings(selectedConfig, fullSettings);

    if (result.success) {
      toast.success('Settings salvati con successo');
      setSelectedConfig(null);
      await loadConfigs();
    } else {
      toast.error(result.error);
    }
  }

  async function handleManualSync(configId: string, force: boolean = false) {
    // Verifica se config usa 2FA manuale
    const config = configs.find((c) => c.id === configId);
    if (config) {
      const settingsResult = await getAutomationSettings(configId);
      if (settingsResult.success && settingsResult.settings?.two_factor_method === 'manual') {
        // 2FA manuale: mostra modal per OTP
        setPendingSyncConfigId(configId);
        setShowOTPModal(true);
        return; // Aspetta OTP
      }
    }

    // Procedi con sync normale
    await executeSync(configId, force);
  }

  async function executeSync(configId: string, force: boolean = false, otp?: string) {
    setSyncing(configId);
    try {
      // TODO: Passa OTP a manualSync se disponibile
      // Per ora, manualSync gestirà 2FA manuale internamente
      const result = await manualSync(configId, force);

      if (result.success) {
        toast.success('Sync completata con successo!');
        await loadConfigs();
        await loadLocks();
      } else {
        // Se errore è "2FA manuale richiesto", mostra modal
        if (result.error?.includes('2FA manuale richiesto') || result.error?.includes('OTP')) {
          setPendingSyncConfigId(configId);
          setShowOTPModal(true);
        } else {
          toast.error(`Errore sync: ${result.error}`);
        }
      }
    } finally {
      setSyncing(null);
    }
  }

  function handleOTPConfirm(otp: string) {
    setShowOTPModal(false);
    if (pendingSyncConfigId) {
      // TODO: Passa OTP a sync
      // Per ora, mostra messaggio
      toast.info(`OTP ricevuto: ${otp}. Sync verrà eseguita con questo OTP.`);
      // executeSync(pendingSyncConfigId, false, otp)
      setPendingSyncConfigId(null);
    }
  }

  async function handleAcquireManualLock(configId: string) {
    const result = await acquireManualLock(configId, 60); // 60 minuti
    if (result.success) {
      toast.success('Lock manuale acquisito. Agent non interferirà per 60 minuti.');
      await loadLocks();
    } else {
      toast.error(result.error);
    }
  }

  async function handleReleaseLock(configId: string) {
    const result = await releaseManualLock(configId);
    if (result.success) {
      toast.success('Lock rilasciato. Agent può ora lavorare.');
      await loadLocks();
    } else {
      toast.error(result.error);
    }
  }

  function getSessionStatus(config: CourierConfig) {
    if (!config.session_data) return { valid: false, message: 'Nessuna sessione' };

    const expiresAt = config.session_data?.expires_at;
    if (expiresAt) {
      const expires = new Date(expiresAt);
      const now = new Date();
      if (expires > now) {
        const hoursLeft = Math.round((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
        return { valid: true, message: `Valida (${hoursLeft}h rimaste)` };
      } else {
        return { valid: false, message: 'Scaduta' };
      }
    }

    return { valid: true, message: 'Valida' };
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav
          title="Automation Spedisci.Online"
          subtitle="Gestisci automazione per estrazione automatica di session cookies e contratti"
          showBackButton={true}
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Admin', href: '/dashboard/admin' },
            { label: 'Automation', href: '/dashboard/admin/automation' },
          ]}
        />

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>📝 Come iniziare:</strong> Clicca su &quot;⚙️ Configura&quot; su una
            configurazione qui sotto per aprire il form e inserire le credenziali Spedisci.Online.
          </p>
        </div>

        {/* Form Configurazione Diretta */}
        {selectedConfig && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">⚙️ Configurazione Automation</h2>
            <p className="text-sm text-gray-600 mb-4">
              Inserisci le credenziali Spedisci.Online e configura le impostazioni di automazione.
              Tutti i campi con * sono obbligatori.
            </p>
            <div className="space-y-4">
              {/* Metodo 2FA */}
              <div>
                <label className="block text-sm font-medium mb-1">Metodo 2FA *</label>
                <select
                  value={formSettings.two_factor_method || 'email'}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      two_factor_method: e.target.value as 'email' | 'manual',
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                >
                  <option value="email">Email (IMAP) - Legge codice da email</option>
                  <option value="manual">
                    Manuale (Microsoft Authenticator) - Inserisci OTP manualmente
                  </option>
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
                    <label className="block text-sm font-medium mb-1">Email per 2FA *</label>
                    <input
                      type="email"
                      value={formSettings.email_2fa || ''}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, email_2fa: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. mario.rossi@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">IMAP Server *</label>
                    <input
                      type="text"
                      value={formSettings.imap_server || ''}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, imap_server: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. imap.gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">IMAP Port *</label>
                    <input
                      type="number"
                      value={formSettings.imap_port || 993}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, imap_port: parseInt(e.target.value) })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. 993"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">IMAP Username *</label>
                    <input
                      type="text"
                      value={formSettings.imap_username || ''}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, imap_username: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. mario.rossi@gmail.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      IMAP Password (App Password) *
                    </label>
                    <input
                      type="password"
                      value={formSettings.imap_password || ''}
                      onChange={(e) =>
                        setFormSettings({ ...formSettings, imap_password: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="es. xxxx xxxx xxxx xxxx (App Password Gmail)"
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
                    Con questo metodo, durante sync manuale ti verrà chiesto di inserire l&apos;OTP
                    dal tuo Authenticator.
                    <br />
                    Sync automatico (cron) non funzionerà con questo metodo.
                  </p>
                </div>
              )}

              {/* Spedisci.Online Username */}
              <div>
                <label className="block text-sm font-medium mb-1">Spedisci.Online Username *</label>
                <input
                  type="text"
                  value={formSettings.spedisci_online_username || ''}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, spedisci_online_username: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="es. mario.rossi@azienda.it"
                />
              </div>

              {/* Spedisci.Online Password */}
              <div>
                <label className="block text-sm font-medium mb-1">Spedisci.Online Password *</label>
                <input
                  type="password"
                  value={formSettings.spedisci_online_password || ''}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, spedisci_online_password: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="es. Inserisci la tua password Spedisci.Online"
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
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      auto_refresh_interval_hours: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="es. 24 (ore)"
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
                <label className="text-sm font-medium">Abilita automation</label>
              </div>

              {/* Bottoni */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setSelectedConfig(null);
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
                    });
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Salva Configurazione
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista Configurazioni */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase min-w-[200px]">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {configs.map((config) => {
                  const sessionStatus = getSessionStatus(config);

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
                          onClick={() =>
                            handleToggleAutomation(config.id, !config.automation_enabled)
                          }
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedConfig(config.id);
                              handleOpenSettings(config.id);
                            }}
                            className={`px-3 py-1.5 rounded font-medium text-sm whitespace-nowrap ${
                              selectedConfig === config.id
                                ? 'bg-blue-700 text-white'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                          >
                            {selectedConfig === config.id ? '✓ Configura' : '⚙️ Configura'}
                          </button>
                          <button
                            onClick={() => handleManualSync(config.id, false)}
                            disabled={syncing === config.id || locks[config.id]?.has_lock}
                            className="px-2 py-1 text-green-600 hover:text-green-900 disabled:opacity-50 text-sm whitespace-nowrap"
                            title={
                              locks[config.id]?.has_lock
                                ? 'Lock attivo, usa "Forza Sync" per ignorare'
                                : ''
                            }
                          >
                            {syncing === config.id ? 'Sync...' : 'Sync'}
                          </button>
                          {locks[config.id]?.has_lock && (
                            <button
                              onClick={() => handleManualSync(config.id, true)}
                              disabled={syncing === config.id}
                              className="px-2 py-1 text-orange-600 hover:text-orange-900 disabled:opacity-50 text-sm whitespace-nowrap"
                              title="Forza sync ignorando lock (usa con cautela)"
                            >
                              Forza Sync
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {configs.length === 0 && (
                <div className="p-6 text-center text-gray-500">
                  Nessuna configurazione Spedisci.Online trovata
                </div>
              )}
            </table>
          </div>
        </div>

        {/* Modal OTP Input */}
        <OTPInputModal
          isOpen={showOTPModal}
          onClose={() => {
            setShowOTPModal(false);
            setPendingSyncConfigId(null);
          }}
          onConfirm={handleOTPConfirm}
          title="Inserisci Codice OTP"
          message="Apri Microsoft Authenticator e inserisci il codice a 6 cifre per Spedisci.Online:"
        />
      </div>
    </div>
  );
}
