'use client'

import { useState } from 'react'
import {
    Truck,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Loader2,
    ShieldCheck,
    Zap,
    X,
    Eye,
    EyeOff,
    Info
} from 'lucide-react'
import { savePersonalConfiguration } from '@/actions/configurations'

interface SpedisciOnlineWizardProps {
    onClose: () => void
    onSuccess: () => void
}

type WizardStep = 'welcome' | 'credentials' | 'testing' | 'success'

export default function SpedisciOnlineWizard({ onClose, onSuccess }: SpedisciOnlineWizardProps) {
    const [step, setStep] = useState<WizardStep>('welcome')
    const [formData, setFormData] = useState({
        apiKey: '',
        dominio: '', // Es: ecommerceitalia.spedisci.online
        baseUrl: '', // Generato automaticamente da dominio
        contractMapping: '' // Formato: "codicecontratto-Corriere" (una riga per contratto)
    })
    const [showApiKey, setShowApiKey] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [testDetails, setTestDetails] = useState<string | null>(null)

    const handleNext = async () => {
        setError(null)
        setTestDetails(null)

        if (step === 'welcome') {
            setStep('credentials')
            return
        }

        if (step === 'credentials') {
            if (!formData.apiKey.trim()) {
                setError('API Key è obbligatoria')
                return
            }
            if (!formData.dominio.trim()) {
                setError('Dominio è obbligatorio')
                return
            }
            // Genera Base URL automaticamente se non presente
            if (!formData.baseUrl.trim()) {
                const dominio = formData.dominio.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')
                setFormData(prev => ({
                    ...prev,
                    baseUrl: `https://${dominio}/api/v2`
                }))
            }
            setStep('testing')
            testAndSave()
            return
        }
    }

    const testAndSave = async () => {
        setIsTesting(true)
        setError(null)
        setTestDetails(null)

        try {
            // Test connessione usando endpoint server-side
            // Questo evita problemi CORS e mantiene l'API Key sicura (non esposta nel browser)
            setTestDetails('Verifica credenziali API...')
            
            const baseUrl = formData.baseUrl.trim().replace(/\/$/, '') // Rimuovi slash finale

            setTestDetails('Chiamata API in corso...')
            
            // Chiamata tramite endpoint server-side per evitare problemi CORS
            // e mantenere l'API Key sicura (non esposta nel browser)
            const response = await fetch('/api/test-spedisci-online', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    apiKey: formData.apiKey.trim(),
                    baseUrl: baseUrl,
                }),
            })

            const testResult = await response.json()

            if (!testResult.success) {
                throw new Error(testResult.error || 'Errore durante il test di connessione')
            }

            // Se la risposta è OK, la connessione funziona
            setTestDetails('Connessione verificata con successo!')
            await new Promise(resolve => setTimeout(resolve, 500))

            // Parse contract_mapping se presente
            // Supporta formato tabella: "Codice Contratto - Corriere" (come nello screenshot)
            let contractMappingObj: Record<string, string> = {}
            if (formData.contractMapping.trim()) {
                try {
                    // Prova prima come JSON
                    contractMappingObj = JSON.parse(formData.contractMapping)
                } catch {
                    // Se non è JSON, parsa formato tabella (come nello screenshot)
                    // Formato supportato:
                    // - "interno-Interno" -> Interno
                    // - "postedeliverybusiness-Solution-and-Shipment" -> PosteDeliveryBusiness
                    // - "ups-UPS5-INTERNAZIONALE-(F)-[CM14]" -> UPS
                    const lines = formData.contractMapping.split('\n').filter(l => l.trim())
                    lines.forEach(line => {
                        const trimmed = line.trim()
                        if (!trimmed) return
                        
                        // Supporta separatori: "-", ":", "\t" o spazi multipli
                        // Prende tutto prima dell'ultimo separatore come codice contratto
                        // e l'ultima parte come corriere
                        const parts = trimmed.split(/[-:\t]+/).map(p => p.trim()).filter(p => p)
                        if (parts.length >= 2) {
                            // Il codice contratto è tutto tranne l'ultimo elemento
                            const contractCode = parts.slice(0, -1).join('-')
                            const courier = parts[parts.length - 1]
                            contractMappingObj[contractCode] = courier
                        }
                    })
                }
            }

            // Save configuration
            // Nota: Ogni utente può salvare la propria configurazione personale
            const session = await fetch('/api/auth/session').then(r => r.json()).catch(() => null)
            const userName = session?.user?.name || session?.user?.email || 'Utente'
            
            const configInput = {
                name: `Spedisci.Online - ${userName}`,
                provider_id: 'spedisci_online',
                api_key: formData.apiKey.trim(),
                base_url: baseUrl,
                contract_mapping: contractMappingObj,
                is_active: true,
                description: `Configurazione personale creata tramite Wizard - Dominio: ${formData.dominio.trim()}`,
            }

            setTestDetails('Salvataggio configurazione...')
            const saveResult = await savePersonalConfiguration(configInput)

            if (saveResult.success) {
                setStep('success')
            } else {
                setError(saveResult.error || 'Errore durante il salvataggio')
                setStep('credentials')
            }
        } catch (err: any) {
            console.error('Errore test connessione:', err)
            setError(err.message || 'Errore di connessione. Verifica API Key e Base URL.')
            setStep('credentials')
        } finally {
            setIsTesting(false)
            setTestDetails(null)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Truck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Configura Spedisci.Online</h2>
                            <p className="text-white/90 font-medium">Wizard di configurazione automatica</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 min-h-[400px] flex flex-col">

                    {step === 'welcome' && (
                        <div className="space-y-6 flex-1 flex flex-col justify-center">
                            <div className="text-center space-y-4">
                                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Zap className="w-8 h-8 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Pronto per iniziare?</h3>
                                <p className="text-gray-600 max-w-md mx-auto">
                                    Questo wizard ti aiuterà a collegare il tuo account Spedisci.Online in pochi secondi.
                                    Tieni a portata di mano la tua <strong>API Key</strong>.
                                </p>
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        <strong>📋 Non hai ancora l&apos;API Key?</strong><br />
                                        Accedi al tuo account Spedisci.Online e vai nella sezione API per generare la tua chiave.
                                        Consulta la <a href="https://apidocs.spedisci.online/" target="_blank" rel="noopener noreferrer" className="underline font-semibold">documentazione API</a> per i dettagli.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <ShieldCheck className="w-6 h-6 text-green-600 mb-2" />
                                    <h4 className="font-semibold text-gray-900">Sicuro</h4>
                                    <p className="text-sm text-gray-500">Credenziali crittografate</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <Zap className="w-6 h-6 text-yellow-500 mb-2" />
                                    <h4 className="font-semibold text-gray-900">Veloce</h4>
                                    <p className="text-sm text-gray-500">Setup istantaneo</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'credentials' && (
                        <div className="space-y-6 flex-1">
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold text-gray-900">Inserisci Credenziali</h3>
                                <p className="text-gray-500 text-sm">
                                    Inserisci l&apos;API Key fornita dal tuo account Spedisci.Online.
                                    <br />
                                    <a href="https://apidocs.spedisci.online/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                                        📖 Consulta la documentazione API
                                    </a>
                                </p>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800 animate-in slide-in-from-top-2">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Dominio <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.dominio}
                                        onChange={e => {
                                            const dominio = e.target.value.trim()
                                            // Genera automaticamente Base URL
                                            const baseUrl = dominio 
                                                ? `https://${dominio.replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/v2`
                                                : ''
                                            setFormData(prev => ({ ...prev, dominio, baseUrl }))
                                        }}
                                        placeholder="ecommerceitalia.spedisci.online"
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                        autoFocus
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Il tuo dominio Spedisci.Online (es: <code className="bg-gray-100 px-1 rounded">ecommerceitalia.spedisci.online</code>). L&apos;Endpoint verrà generato automaticamente.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Endpoint (generato automaticamente)
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.baseUrl}
                                        onChange={e => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                                        placeholder="https://tuodominio.spedisci.online/api/v2"
                                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm text-gray-600"
                                        readOnly
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Generato automaticamente dal dominio. Puoi modificarlo manualmente se necessario.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        API Key <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showApiKey ? "text" : "password"}
                                            placeholder="Incolla qui la tua API Key..."
                                            value={formData.apiKey}
                                            onChange={e => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowApiKey(!showApiKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        La tua API Key è disponibile nel pannello di controllo Spedisci.Online.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Contratti (Opzionale)
                                    </label>
                                    <textarea
                                        value={formData.contractMapping}
                                        onChange={e => setFormData(prev => ({ ...prev, contractMapping: e.target.value }))}
                                        placeholder={`interno-Interno
postedeliverybusiness-Solution-and-Shipment-PosteDeliveryBusiness
ups-UPS5-INTERNAZIONALE-(F)-[CM14]-UPS`}
                                        rows={6}
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                    />
                                    <div className="mt-2 space-y-2">
                                        <p className="text-xs text-gray-500">
                                            <strong>📋 Copia dalla tabella &quot;Contratti&quot; del tuo pannello Spedisci.Online:</strong>
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Formato: <strong>Codice Contratto - Corriere</strong> (una riga per contratto)<br />
                                            Esempi:<br />
                                            <code className="bg-gray-100 px-1 rounded block mt-1">interno-Interno</code>
                                            <code className="bg-gray-100 px-1 rounded block">postedeliverybusiness-Solution-and-Shipment-PosteDeliveryBusiness</code>
                                            <code className="bg-gray-100 px-1 rounded block">ups-UPS5-INTERNAZIONALE-(F)-[CM14]-UPS</code>
                                        </p>
                                        <p className="text-xs text-blue-600 mt-2">
                                            💡 <strong>Suggerimento:</strong> Copia direttamente dalla colonna &quot;Codice Contratto&quot; e &quot;Corriere&quot; della tabella nel tuo pannello, separati da un trattino.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-blue-800">
                                            <strong>Nota:</strong> Il mapping contratti è opzionale. Puoi configurarlo successivamente se necessario.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'testing' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                                <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Truck className="w-8 h-8 text-blue-600 animate-pulse" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Verifica in corso...</h3>
                                <p className="text-gray-500">{testDetails || 'Stiamo testando la connessione ai server Spedisci.Online.'}</p>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-300">
                            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-12 h-12 text-green-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-gray-900">Tutto Pronto!</h3>
                                <p className="text-gray-600 max-w-sm mx-auto">
                                    La connessione è stata stabilita con successo. Ora puoi creare spedizioni con Spedisci.Online tramite API.
                                </p>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                    {step !== 'success' && step !== 'testing' && (
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Annulla
                        </button>
                    )}

                    <div className="ml-auto">
                        {step === 'welcome' && (
                            <button
                                onClick={handleNext}
                                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 group"
                            >
                                Inizia Configurazione
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}

                        {step === 'credentials' && (
                            <button
                                onClick={handleNext}
                                disabled={!formData.apiKey.trim() || !formData.dominio.trim()}
                                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Verifica & Salva
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        )}

                        {step === 'success' && (
                            <button
                                onClick={() => { onSuccess(); onClose(); }}
                                className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-green-500/30 flex items-center gap-2"
                            >
                                Completa
                                <CheckCircle2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

