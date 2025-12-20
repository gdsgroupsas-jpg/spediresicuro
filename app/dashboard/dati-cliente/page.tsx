'use client'

/**
 * Pagina Dati Cliente - Completamento Obbligatorio
 * 
 * Questa pagina viene mostrata obbligatoriamente ai nuovi utenti
 * dopo la registrazione per completare tutti i dati anagrafici,
 * fiscali e bancari necessari.
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardNav from '@/components/dashboard-nav'
import { 
  User, 
  Building2, 
  CreditCard, 
  FileText, 
  Upload, 
  Save,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'

interface FormData {
  // Dati anagrafici
  nome: string
  cognome: string
  codiceFiscale: string
  dataNascita: string
  luogoNascita: string
  sesso: 'M' | 'F' | ''
  telefono: string
  cellulare: string
  
  // Indirizzo
  indirizzo: string
  citta: string
  provincia: string
  cap: string
  nazione: string
  
  // Tipo cliente
  tipoCliente: 'persona' | 'azienda'
  
  // Dati azienda
  ragioneSociale: string
  partitaIva: string
  codiceSDI: string
  pec: string
  
  // Fatturazione
  indirizzoFatturazione: string
  cittaFatturazione: string
  provinciaFatturazione: string
  capFatturazione: string
  
  // Bancari
  iban: string
  banca: string
  nomeIntestatario: string
  
  // Documento identità
  tipoDocumento: 'carta_identita' | 'patente' | 'passaporto' | ''
  numeroDocumento: string
  rilasciatoDa: string
  dataRilascio: string
  dataScadenza: string
}

export default function DatiClientePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  // ⚠️ NOTA: CSS inline rimosso - fix definitivo in app/globals.css
  // Il CSS globale ora esclude input con bg-gray-800 e forza testo bianco
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    cognome: '',
    codiceFiscale: '',
    dataNascita: '',
    luogoNascita: '',
    sesso: '',
    telefono: '',
    cellulare: '',
    indirizzo: '',
    citta: '',
    provincia: '',
    cap: '',
    nazione: 'Italia',
    tipoCliente: 'persona',
    ragioneSociale: '',
    partitaIva: '',
    codiceSDI: '',
    pec: '',
    indirizzoFatturazione: '',
    cittaFatturazione: '',
    provinciaFatturazione: '',
    capFatturazione: '',
    iban: '',
    banca: '',
    nomeIntestatario: '',
    tipoDocumento: '',
    numeroDocumento: '',
    rilasciatoDa: '',
    dataRilascio: '',
    dataScadenza: '',
  })

  // Carica dati esistenti se presenti e verifica se sono già completati
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      // ⚠️ P0-4 FIX: Controlla database PRIMA di localStorage (rimuove bypass)
      async function checkAndLoad() {
        try {
          const response = await fetch('/api/user/dati-cliente', {
            cache: 'no-store',
          });
          if (response.ok) {
            const data = await response.json();
            // Se i dati sono già completati nel database, NON reindirizzare automaticamente
            // Questo previene loop infiniti se il Server Layout (Source of Truth) ci ha mandato qui
            if (data.datiCliente && data.datiCliente.datiCompletati) {
              console.log('✅ [DATI CLIENTE] Dati completi, ma rimango qui per evitare loop. Utente può rivedere i dati.', {
                email: session?.user?.email
              });
              
              if (typeof window !== 'undefined' && session?.user?.email) {
                localStorage.setItem(`datiCompletati_${session.user.email}`, 'true');
              }
              
              // ⚠️ P0 FIX: Carica comunque i dati nel form invece di redirect
              loadExistingData();
              return;
            }
          }
          // Se i dati non sono completati, carica i dati esistenti nel form
          loadExistingData();
        } catch (err) {
          console.error('❌ [DATI CLIENTE] Errore verifica dati:', err);
          // In caso di errore, carica comunque i dati esistenti (utente può compilare form)
          loadExistingData();
        }
      }
      
      checkAndLoad();
    }
  }, [status, session, router])

  const loadExistingData = async () => {
    try {
      const response = await fetch('/api/user/dati-cliente')
      if (response.ok) {
        const data = await response.json()
        if (data.datiCliente) {
          setFormData({
            nome: data.datiCliente.nome || '',
            cognome: data.datiCliente.cognome || '',
            codiceFiscale: data.datiCliente.codiceFiscale || '',
            dataNascita: data.datiCliente.dataNascita || '',
            luogoNascita: data.datiCliente.luogoNascita || '',
            sesso: data.datiCliente.sesso || '',
            telefono: data.datiCliente.telefono || '',
            cellulare: data.datiCliente.cellulare || '',
            indirizzo: data.datiCliente.indirizzo || '',
            citta: data.datiCliente.citta || '',
            provincia: data.datiCliente.provincia || '',
            cap: data.datiCliente.cap || '',
            nazione: data.datiCliente.nazione || 'Italia',
            tipoCliente: data.datiCliente.tipoCliente || 'persona',
            ragioneSociale: data.datiCliente.ragioneSociale || '',
            partitaIva: data.datiCliente.partitaIva || '',
            codiceSDI: data.datiCliente.codiceSDI || '',
            pec: data.datiCliente.pec || '',
            indirizzoFatturazione: data.datiCliente.indirizzoFatturazione || '',
            cittaFatturazione: data.datiCliente.cittaFatturazione || '',
            provinciaFatturazione: data.datiCliente.provinciaFatturazione || '',
            capFatturazione: data.datiCliente.capFatturazione || '',
            iban: data.datiCliente.iban || '',
            banca: data.datiCliente.banca || '',
            nomeIntestatario: data.datiCliente.nomeIntestatario || '',
            tipoDocumento: data.datiCliente.documentoIdentita?.tipo || '',
            numeroDocumento: data.datiCliente.documentoIdentita?.numero || '',
            rilasciatoDa: data.datiCliente.documentoIdentita?.rilasciatoDa || '',
            dataRilascio: data.datiCliente.documentoIdentita?.dataRilascio || '',
            dataScadenza: data.datiCliente.documentoIdentita?.dataScadenza || '',
          })
        }
      }
    } catch (err) {
      console.error('Errore caricamento dati:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const validateForm = (): boolean => {
    // Email dell'utente corrente
    const userEmail = session?.user?.email?.toLowerCase() || ''
    
    // Per l'utenza test@spediresicuro.it, i campi sono opzionali
    const isTestUser = userEmail === 'test@spediresicuro.it'

    // Validazione campi obbligatori base (solo se NON è l'utente test)
    if (!isTestUser) {
      if (!formData.nome.trim()) {
        setError('Il nome è obbligatorio')
        return false
      }
      if (!formData.cognome.trim()) {
        setError('Il cognome è obbligatorio')
        return false
      }
      if (!formData.codiceFiscale.trim()) {
        setError('Il codice fiscale è obbligatorio')
        return false
      }
      if (formData.codiceFiscale.length !== 16) {
        setError('Il codice fiscale deve essere di 16 caratteri')
        return false
      }
      if (!formData.telefono.trim()) {
        setError('Il telefono è obbligatorio')
        return false
      }
      if (!formData.indirizzo.trim()) {
        setError('L\'indirizzo è obbligatorio')
        return false
      }
      if (!formData.citta.trim()) {
        setError('La città è obbligatoria')
        return false
      }
      if (!formData.provincia.trim()) {
        setError('La provincia è obbligatoria')
        return false
      }
      if (!formData.cap.trim()) {
        setError('Il CAP è obbligatorio')
        return false
      }

      // Validazione dati azienda se tipoCliente === 'azienda'
      if (formData.tipoCliente === 'azienda') {
        if (!formData.ragioneSociale.trim()) {
          setError('La ragione sociale è obbligatoria per le aziende')
          return false
        }
        if (!formData.partitaIva.trim()) {
          setError('La partita IVA è obbligatoria per le aziende')
          return false
        }
        if (formData.partitaIva.length !== 11) {
          setError('La partita IVA deve essere di 11 caratteri')
          return false
        }
      }
    } else {
      // Per utente test: validazione codice fiscale solo se fornito
      if (formData.codiceFiscale.trim() && formData.codiceFiscale.length !== 16) {
        setError('Il codice fiscale deve essere di 16 caratteri')
        return false
      }
      
      // Per utente test: validazione partita IVA solo se tipoCliente === 'azienda' e partitaIva è fornita
      if (formData.tipoCliente === 'azienda' && formData.partitaIva.trim() && formData.partitaIva.length !== 11) {
        setError('La partita IVA deve essere di 11 caratteri')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!validateForm()) {
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch('/api/user/dati-cliente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          email: session?.user?.email,
          documentoIdentita: formData.tipoDocumento ? {
            tipo: formData.tipoDocumento,
            numero: formData.numeroDocumento,
            rilasciatoDa: formData.rilasciatoDa,
            dataRilascio: formData.dataRilascio,
            dataScadenza: formData.dataScadenza || undefined,
          } : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Errore durante il salvataggio')
        setIsSaving(false)
        return
      }

      // Salvataggio riuscito!
      setSuccess(true)
      setIsSaving(false) // Importante: resetta lo stato di salvataggio
      
      console.log('✅ [DATI CLIENTE] Dati salvati con successo:', data)
      console.log('✅ [DATI CLIENTE] Verifica dati salvati:', {
        datiCompletati: data.datiCliente?.datiCompletati,
        hasDatiCliente: !!data.datiCliente,
      })
      
      // Salva IMMEDIATAMENTE in localStorage per evitare controlli futuri nella dashboard
      if (typeof window !== 'undefined' && session?.user?.email) {
        localStorage.setItem(`datiCompletati_${session.user.email}`, 'true')
        console.log('💾 [DATI CLIENTE] Flag salvato in localStorage:', session.user.email)
      }
      
      // Reindirizza alla dashboard con parametro URL per indicare che i dati sono stati appena salvati
      // Questo evita che il controllo nella dashboard reindirizzi di nuovo qui
      setTimeout(() => {
        console.log('🔄 [DATI CLIENTE] Reindirizzamento a /dashboard?saved=true con refresh completo...')
        window.location.href = '/dashboard?saved=true'
      }, 1500)
    } catch (err: any) {
      setError('Errore durante il salvataggio: ' + err.message)
      setIsSaving(false)
    }
  }

  if (status === 'loading') {
    return <div className="p-8">Caricamento...</div>
  }

  if (status === 'unauthenticated') {
    // ⚠️ P0 FIX: Evita redirect loop (Server Auth ha già validato accesso)
    // Se NextAuth client non ha ancora sessione, mostra messaggio invece di redirect
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">Sincronizzazione sessione in corso...</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-4 text-blue-600 hover:underline"
        >
          Ricarica pagina
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav 
        title="Completa i Tuoi Dati Cliente"
        subtitle="Compila tutti i campi obbligatori per completare la registrazione"
      />

      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        {error && (
          <div className="mb-6 p-4 glass border border-red-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 glass border-2 border-green-500/50 rounded-lg flex items-start gap-3 bg-green-500/10 animate-pulse">
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-base font-bold text-green-300">✅ Dati salvati con successo!</p>
              <p className="text-sm text-green-400 mt-1">Reindirizzamento alla dashboard in corso...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Tipo Cliente */}
          <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
            <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FACC15]" />
              Tipo Cliente
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 border-2 border-[#FACC15]/30 rounded-lg cursor-pointer hover:bg-[#FACC15]/10 transition-colors glass-subtle">
                <input
                  type="radio"
                  name="tipoCliente"
                  value="persona"
                  checked={formData.tipoCliente === 'persona'}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#FACC15]"
                />
                <User className="w-5 h-5 text-gray-300" />
                <span className="font-medium text-gray-100">Persona Fisica</span>
              </label>
              <label className="flex items-center gap-3 p-4 border-2 border-[#FACC15]/30 rounded-lg cursor-pointer hover:bg-[#FACC15]/10 transition-colors glass-subtle">
                <input
                  type="radio"
                  name="tipoCliente"
                  value="azienda"
                  checked={formData.tipoCliente === 'azienda'}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#FACC15]"
                />
                <Building2 className="w-5 h-5 text-gray-300" />
                <span className="font-medium text-gray-100">Azienda</span>
              </label>
            </div>
          </div>

          {/* Dati Anagrafici */}
          <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
            <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FACC15]" />
              Dati Anagrafici {formData.tipoCliente === 'persona' ? 'Persona Fisica' : 'Rappresentante Legale'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Cognome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="cognome"
                  value={formData.cognome}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Codice Fiscale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="codiceFiscale"
                  value={formData.codiceFiscale}
                  onChange={handleChange}
                  required
                  maxLength={16}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all uppercase"
                  placeholder="ABCDEF12G34H567I"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Data di Nascita
                </label>
                <input
                  type="date"
                  name="dataNascita"
                  value={formData.dataNascita}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Luogo di Nascita
                </label>
                <input
                  type="text"
                  name="luogoNascita"
                  value={formData.luogoNascita}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Sesso
                </label>
                <select
                  name="sesso"
                  value={formData.sesso}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                >
                  <option value="">Seleziona</option>
                  <option value="M">Maschio</option>
                  <option value="F">Femmina</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Telefono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Cellulare
                </label>
                <input
                  type="tel"
                  name="cellulare"
                  value={formData.cellulare}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
            </div>
          </div>

          {/* Dati Azienda - Solo se tipoCliente === 'azienda' */}
          {formData.tipoCliente === 'azienda' && (
            <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
              <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FACC15]" />
                Dati Azienda
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Ragione Sociale <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ragioneSociale"
                    value={formData.ragioneSociale}
                    onChange={handleChange}
                    required={formData.tipoCliente === 'azienda'}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Partita IVA <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="partitaIva"
                    value={formData.partitaIva}
                    onChange={handleChange}
                    required={formData.tipoCliente === 'azienda'}
                    maxLength={11}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Codice SDI (Fatturazione Elettronica)
                  </label>
                  <input
                    type="text"
                    name="codiceSDI"
                    value={formData.codiceSDI}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                    placeholder="XXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    PEC (Posta Elettronica Certificata)
                  </label>
                  <input
                    type="email"
                    name="pec"
                    value={formData.pec}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                    placeholder="azienda@pec.it"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Indirizzo */}
          <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
            <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-[#FACC15]" />
              Indirizzo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Indirizzo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="indirizzo"
                  value={formData.indirizzo}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Città <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="citta"
                  value={formData.citta}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Provincia <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="provincia"
                  value={formData.provincia}
                  onChange={handleChange}
                  required
                  maxLength={2}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all uppercase"
                  placeholder="RM"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  CAP <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="cap"
                  value={formData.cap}
                  onChange={handleChange}
                  required
                  maxLength={5}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nazione
                </label>
                <input
                  type="text"
                  name="nazione"
                  value={formData.nazione}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
            </div>
          </div>

          {/* Dati Fatturazione - Solo se azienda */}
          {formData.tipoCliente === 'azienda' && (
            <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
              <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#FACC15]" />
                Dati Fatturazione
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Indirizzo Fatturazione
                  </label>
                  <input
                    type="text"
                    name="indirizzoFatturazione"
                    value={formData.indirizzoFatturazione}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Città Fatturazione
                  </label>
                  <input
                    type="text"
                    name="cittaFatturazione"
                    value={formData.cittaFatturazione}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Provincia Fatturazione
                  </label>
                  <input
                    type="text"
                    name="provinciaFatturazione"
                    value={formData.provinciaFatturazione}
                    onChange={handleChange}
                    maxLength={2}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    CAP Fatturazione
                  </label>
                  <input
                    type="text"
                    name="capFatturazione"
                    value={formData.capFatturazione}
                    onChange={handleChange}
                    maxLength={5}
                    className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dati Bancari */}
          <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
            <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#FACC15]" />
              Dati Bancari (Opzionali)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  IBAN
                </label>
                <input
                  type="text"
                  name="iban"
                  value={formData.iban}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all uppercase"
                  placeholder="IT60X0542811101000000123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Banca
                </label>
                <input
                  type="text"
                  name="banca"
                  value={formData.banca}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nome Intestatario
                </label>
                <input
                  type="text"
                  name="nomeIntestatario"
                  value={formData.nomeIntestatario}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
            </div>
          </div>

          {/* Documento Identità */}
          <div className="glass-strong rounded-xl shadow-sm p-6 border border-[#FACC15]/20">
            <h2 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FACC15]" />
              Documento di Identità (Opzionale)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Tipo Documento
                </label>
                <select
                  name="tipoDocumento"
                  value={formData.tipoDocumento}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                >
                  <option value="">Seleziona</option>
                  <option value="carta_identita">Carta d&apos;Identità</option>
                  <option value="patente">Patente</option>
                  <option value="passaporto">Passaporto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Numero Documento
                </label>
                <input
                  type="text"
                  name="numeroDocumento"
                  value={formData.numeroDocumento}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Rilasciato Da
                </label>
                <input
                  type="text"
                  name="rilasciatoDa"
                  value={formData.rilasciatoDa}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Data Rilascio
                </label>
                <input
                  type="date"
                  name="dataRilascio"
                  value={formData.dataRilascio}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Data Scadenza
                </label>
                <input
                  type="date"
                  name="dataScadenza"
                  value={formData.dataScadenza}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Carica Documento (Opzionale)
                </label>
                <div className="flex items-center gap-4 p-4 border-2 border-dashed border-[#FACC15]/30 rounded-lg glass-subtle">
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">Funzionalità di upload documenti in arrivo</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pulsante Salva */}
          <div className="flex justify-end gap-4">
            <button
              type="submit"
              disabled={isSaving || success}
              className="px-8 py-3 bg-gradient-to-r from-[#FACC15] to-[#FBBF24] text-[#09090b] font-bold rounded-lg shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 btn-tactile"
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#09090b] border-t-transparent rounded-full animate-spin" />
                  Salvataggio...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Salvato con successo!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salva e Completa Registrazione
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

