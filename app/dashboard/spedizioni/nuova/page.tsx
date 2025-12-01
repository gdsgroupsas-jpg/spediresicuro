/**
 * Nuova Spedizione - God-Tier Logistics Dashboard
 * 
 * Design ispirato a Stripe/Flexport con:
 * - Layout a 2 colonne (Split Conversion)
 * - Live Ticket Preview (sticky)
 * - Micro-interazioni e validazione in tempo reale
 * - Progress indicator
 * - Neuromarketing UI principles
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MapPin, 
  Package, 
  User, 
  Truck, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Sparkles,
  Save,
  X,
  Loader2
} from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import AIRoutingAdvisor from '@/components/ai-routing-advisor';
import OCRUpload from '@/components/ocr/ocr-upload';
import { generateShipmentCSV, downloadCSV, generateShipmentPDF, downloadPDF } from '@/lib/generate-shipment-document';
import type { Corriere } from '@/types/corrieri';

interface FormData {
  // Mittente
  mittenteNome: string;
  mittenteIndirizzo: string;
  mittenteCitta: string;
  mittenteProvincia: string;
  mittenteCap: string;
  mittenteTelefono: string;
  mittenteEmail: string;

  // Destinatario
  destinatarioNome: string;
  destinatarioIndirizzo: string;
  destinatarioCitta: string;
  destinatarioProvincia: string;
  destinatarioCap: string;
  destinatarioTelefono: string;
  destinatarioEmail: string;

  // Dati Spedizione (uguali per manuale e AI import)
  peso: string;
  lunghezza: string;
  larghezza: string;
  altezza: string;
  tipoSpedizione: string;
  corriere: string;
  note: string;
  
  // Servizi Aggiuntivi (dopo selezione corriere)
  contrassegno: boolean;
  importoContrassegno: string;
  assicurazione: boolean;
  valoreDichiarato: string;
  ritiro: boolean;
}

// Componente Input con validazione
function SmartInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder,
  icon: Icon,
  isValid,
  errorMessage,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  icon?: any;
  isValid?: boolean;
  errorMessage?: string;
  maxLength?: number;
}) {
  const hasValue = value.length > 0;
  const showValid = hasValue && isValid === true;
  const showError = hasValue && isValid === false;

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`w-full px-4 ${Icon ? 'pl-10' : ''} pr-10 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 ${
            showError
              ? 'border-red-300 ring-2 ring-red-100 focus:ring-red-500 focus:border-red-500'
              : showValid
              ? 'border-green-300 ring-2 ring-green-100 focus:ring-green-500 focus:border-green-500'
              : 'border-gray-200 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500]'
          } focus:outline-none`}
        />
        {showValid && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )}
        {showError && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}
      </div>
      {showError && errorMessage && (
        <p className="text-xs text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}

// Componente Card
function SmartCard({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  icon?: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          {Icon && (
            <div className="p-2 bg-gradient-to-br from-[#FFD700] to-[#FF9500] rounded-lg">
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

// Componente Progress Bar
function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#FFD700] to-[#FF9500] transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

// Componente Route Visualizer
function RouteVisualizer({
  from,
  to,
}: {
  from: { city: string; province: string };
  to: { city: string; province: string };
}) {
  const hasRoute = from.city && to.city;

  if (!hasRoute) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <div className="text-center">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Compila mittente e destinatario</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#FFD700]"></div>
            <span className="text-sm font-medium text-gray-900">
              {from.city}
            </span>
          </div>
          <p className="text-xs text-gray-500 ml-4">{from.province}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <div className="flex-1 border-l-2 border-dashed border-gray-300 h-8"></div>
        <Truck className="w-4 h-4 text-[#FF9500]" />
        <div className="flex-1 border-l-2 border-dashed border-gray-300 h-8"></div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-[#FF9500]"></div>
            <span className="text-sm font-medium text-gray-900">{to.city}</span>
          </div>
          <p className="text-xs text-gray-500 ml-4">{to.province}</p>
        </div>
      </div>
    </div>
  );
}

export default function NuovaSpedizionePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    mittenteNome: '',
    mittenteIndirizzo: '',
    mittenteCitta: '',
    mittenteProvincia: '',
    mittenteCap: '',
    mittenteTelefono: '',
    mittenteEmail: '',
    destinatarioNome: '',
    destinatarioIndirizzo: '',
    destinatarioCitta: '',
    destinatarioProvincia: '',
    destinatarioCap: '',
    destinatarioTelefono: '',
    destinatarioEmail: '',
    peso: '',
    lunghezza: '',
    larghezza: '',
    altezza: '',
    tipoSpedizione: 'standard',
    corriere: 'GLS',
    note: '',
    contrassegno: false,
    importoContrassegno: '',
    assicurazione: false,
    valoreDichiarato: '',
    ritiro: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdTracking, setCreatedTracking] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<'manual' | 'ai'>('manual');
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'csv'>('pdf');

  // Persist source mode and allow query-based default (e.g., ?ai=1 or ?mode=ai)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryMode = params.get('mode');
      const aiFlag = params.get('ai');

      if ((queryMode && queryMode.toLowerCase() === 'ai') || aiFlag === '1' || aiFlag === 'true') {
        setSourceMode('ai');
        localStorage.setItem('sourceMode', 'ai');
        return;
      }

      const saved = localStorage.getItem('sourceMode');
      if (saved === 'ai' || saved === 'manual') {
        setSourceMode(saved as 'manual' | 'ai');
      }
    } catch (e) {
      // ignore storage or URL errors
    }
  }, []);

  const handleSetSourceMode = (mode: 'manual' | 'ai') => {
    setSourceMode(mode);
    try {
      localStorage.setItem('sourceMode', mode);
    } catch (e) {
      // no-op if storage fails
    }
  };

  // Carica mittente predefinito all'avvio
  useEffect(() => {
    async function loadDefaultSender() {
      try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
          const data = await response.json();
          if (data.defaultSender) {
            setFormData((prev) => ({
              ...prev,
              mittenteNome: data.defaultSender.nome || '',
              mittenteIndirizzo: data.defaultSender.indirizzo || '',
              mittenteCitta: data.defaultSender.citta || '',
              mittenteProvincia: data.defaultSender.provincia || '',
              mittenteCap: data.defaultSender.cap || '',
              mittenteTelefono: data.defaultSender.telefono || '',
              mittenteEmail: data.defaultSender.email || '',
            }));
          }
        }
      } catch (error) {
        console.error('Errore caricamento mittente predefinito:', error);
        // Non bloccare, continua con form vuoto
      }
    }

    loadDefaultSender();
  }, []);

  // Validazione campi
  const validation = useMemo(() => {
    return {
      mittenteNome: formData.mittenteNome.length >= 2,
      mittenteIndirizzo: formData.mittenteIndirizzo.length >= 5,
      mittenteCitta: formData.mittenteCitta.length >= 2,
      mittenteTelefono: /^[\d\s\+\-\(\)]{8,}$/.test(formData.mittenteTelefono),
      mittenteEmail: !formData.mittenteEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.mittenteEmail),
      destinatarioNome: formData.destinatarioNome.length >= 2,
      destinatarioIndirizzo: formData.destinatarioIndirizzo.length >= 5,
      destinatarioCitta: formData.destinatarioCitta.length >= 2,
      destinatarioTelefono: /^[\d\s\+\-\(\)]{8,}$/.test(formData.destinatarioTelefono),
      destinatarioEmail: !formData.destinatarioEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.destinatarioEmail),
      peso: parseFloat(formData.peso) > 0,
    };
  }, [formData]);

  // Calcola progresso
  const progress = useMemo(() => {
    const requiredFields = [
      formData.mittenteNome,
      formData.mittenteIndirizzo,
      formData.mittenteCitta,
      formData.mittenteTelefono,
      formData.destinatarioNome,
      formData.destinatarioIndirizzo,
      formData.destinatarioCitta,
      formData.destinatarioTelefono,
      formData.peso,
    ];
    const filled = requiredFields.filter((f) => f.length > 0).length;
    return Math.round((filled / requiredFields.length) * 100);
  }, [formData]);

  // Calcola costo stimato
  const estimatedCost = useMemo(() => {
    const baseCost = 10; // Costo base
    const weightCost = parseFloat(formData.peso) * 2 || 0;
    const distanceMultiplier = formData.mittenteCitta && formData.destinatarioCitta ? 1.2 : 1;
    const typeMultiplier = formData.tipoSpedizione === 'express' ? 1.5 : formData.tipoSpedizione === 'assicurata' ? 1.3 : 1;
    
    return Math.round((baseCost + weightCost) * distanceMultiplier * typeMultiplier);
  }, [formData.peso, formData.mittenteCitta, formData.destinatarioCitta, formData.tipoSpedizione]);


  // Handler dati estratti da OCR
  const handleOCRDataExtracted = (data: any) => {
    // Popola i campi destinatario con i dati estratti
    setFormData((prev) => ({
      ...prev,
      destinatarioNome: data.recipient_name || prev.destinatarioNome,
      destinatarioIndirizzo: data.recipient_address || prev.destinatarioIndirizzo,
      destinatarioCitta: data.recipient_city || prev.destinatarioCitta,
      destinatarioProvincia: data.recipient_province || prev.destinatarioProvincia,
      destinatarioCap: data.recipient_zip || prev.destinatarioCap,
      destinatarioTelefono: data.recipient_phone || prev.destinatarioTelefono,
      destinatarioEmail: data.recipient_email || prev.destinatarioEmail,
      note: data.notes || prev.note,
    }));
    
    // ⚠️ RIMOSSO: Autocompletamento automatico provincia/CAP per evitare bug
    // L'utente dovrà completare manualmente i campi mancanti tramite autocompletamento
  };

  // Handler errori OCR
  const handleOCRError = (error: string) => {
    setSubmitError(`Errore OCR: ${error}`);
  };

  // Funzione per resettare il form a valori iniziali
  const resetForm = () => {
    setFormData({
      mittenteNome: '',
      mittenteIndirizzo: '',
      mittenteCitta: '',
      mittenteProvincia: '',
      mittenteCap: '',
      mittenteTelefono: '',
      mittenteEmail: '',
      destinatarioNome: '',
      destinatarioIndirizzo: '',
      destinatarioCitta: '',
      destinatarioProvincia: '',
      destinatarioCap: '',
      destinatarioTelefono: '',
      destinatarioEmail: '',
      peso: '',
      lunghezza: '',
      larghezza: '',
      altezza: '',
      tipoSpedizione: 'standard',
      corriere: 'GLS',
      note: '',
      contrassegno: false,
      importoContrassegno: '',
      assicurazione: false,
      valoreDichiarato: '',
      ritiro: false,
    });
    setSubmitSuccess(false);
    setSubmitError(null);
    setCreatedTracking(null);
  };

  // Handler submit con prevenzione doppio click
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ⚠️ Prevenzione doppio click: blocca se già in corso submit
    if (isSubmitting) {
      console.warn('⚠️ Submit già in corso, ignorato doppio click');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const response = await fetch('/api/spedizioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore durante il salvataggio');
      }

      const result = await response.json();
      setSubmitSuccess(true);
      setCreatedTracking(result.data?.tracking || null);

      // Genera e scarica documento (CSV o PDF)
      const spedizioneData = result.data;
      if (spedizioneData) {
        // Aggiungi data creazione se manca
        const spedizioneWithDate = {
          ...spedizioneData,
          createdAt: spedizioneData.createdAt || new Date().toISOString(),
        };

        // Piccolo delay per assicurarsi che il download parta dopo il rendering
        setTimeout(() => {
          if (downloadFormat === 'csv') {
            const csvContent = generateShipmentCSV(spedizioneWithDate);
            const filename = `spedizione_${spedizioneData.tracking}_${new Date().toISOString().split('T')[0]}.csv`;
            downloadCSV(csvContent, filename);
          } else {
            const pdfDoc = generateShipmentPDF(spedizioneWithDate);
            const filename = `spedizione_${spedizioneData.tracking}_${new Date().toISOString().split('T')[0]}.pdf`;
            downloadPDF(pdfDoc, filename);
          }
        }, 500);
      }

      // ⚠️ RIMOSSO: Redirect automatico - ora l'utente può scegliere
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Errore durante il salvataggio. Riprova.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatta prezzo
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Nuova Spedizione"
          subtitle="Compila i dati per creare una nuova spedizione"
          showBackButton={true}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN - Input Flow (66%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Completamento</span>
                  <span className="text-sm font-bold text-[#FF9500]">{progress}%</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => handleSetSourceMode('manual')}
                    aria-pressed={sourceMode === 'manual'}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      sourceMode === 'manual'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Manuale
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetSourceMode('ai')}
                    aria-pressed={sourceMode === 'ai'}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      sourceMode === 'ai'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 inline mr-1" />
                    AI Import
                  </button>
                </div>
              </div>
              <ProgressBar percentage={progress} />
            </div>

            {/* OCR Upload Card - Solo quando AI Import è attivo */}
            {sourceMode === 'ai' && (
              <SmartCard title="Importa da Immagine (OCR)" icon={Sparkles}>
                <OCRUpload
                  onDataExtracted={handleOCRDataExtracted}
                  onError={handleOCRError}
                />
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>💡 Suggerimento:</strong> Carica uno screenshot WhatsApp, foto documento o immagine con i dati del destinatario. 
                    Il sistema estrarrà automaticamente nome, indirizzo, CAP, città, telefono e email.
                  </p>
                </div>
              </SmartCard>
            )}

            {/* Mittente Card */}
            <SmartCard title="Mittente" icon={MapPin}>
              <div className="space-y-4">
                <SmartInput
                  label="Nome Completo"
                  value={formData.mittenteNome}
                  onChange={(v) => setFormData((prev) => ({ ...prev, mittenteNome: v }))}
                  required
                  placeholder="Mario Rossi"
                  icon={User}
                  isValid={validation.mittenteNome}
                  errorMessage={formData.mittenteNome && !validation.mittenteNome ? 'Nome troppo corto' : undefined}
                />

                <SmartInput
                  label="Indirizzo"
                  value={formData.mittenteIndirizzo}
                  onChange={(v) => setFormData((prev) => ({ ...prev, mittenteIndirizzo: v }))}
                  required
                  placeholder="Via Roma 123"
                  icon={MapPin}
                  isValid={validation.mittenteIndirizzo}
                  errorMessage={formData.mittenteIndirizzo && !validation.mittenteIndirizzo ? 'Indirizzo troppo corto' : undefined}
                />

                <div className="grid grid-cols-3 gap-4">
                  <SmartInput
                    label="Città"
                    value={formData.mittenteCitta}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteCitta: v }))}
                    required
                    placeholder="Roma"
                    icon={MapPin}
                    isValid={validation.mittenteCitta}
                    errorMessage={formData.mittenteCitta && !validation.mittenteCitta ? 'Città non valida' : undefined}
                  />
                  <SmartInput
                    label="Provincia"
                    value={formData.mittenteProvincia}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteProvincia: v.toUpperCase() }))}
                    required
                    placeholder="RM"
                    maxLength={2}
                    isValid={formData.mittenteProvincia.length === 2}
                    errorMessage={formData.mittenteProvincia && formData.mittenteProvincia.length !== 2 ? 'Inserisci 2 caratteri' : undefined}
                  />
                  <SmartInput
                    label="CAP"
                    value={formData.mittenteCap}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteCap: v.replace(/\D/g, '').slice(0, 5) }))}
                    required
                    placeholder="00100"
                    maxLength={5}
                    isValid={formData.mittenteCap.length === 5}
                    errorMessage={formData.mittenteCap && formData.mittenteCap.length !== 5 ? 'CAP deve essere di 5 cifre' : undefined}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SmartInput
                    label="Telefono"
                    value={formData.mittenteTelefono}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteTelefono: v }))}
                    type="tel"
                    required
                    placeholder="+39 123 456 7890"
                    isValid={validation.mittenteTelefono}
                    errorMessage={formData.mittenteTelefono && !validation.mittenteTelefono ? 'Telefono non valido' : undefined}
                  />

                  <SmartInput
                    label="Email"
                    value={formData.mittenteEmail}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteEmail: v }))}
                    type="email"
                    placeholder="email@esempio.it"
                    isValid={validation.mittenteEmail}
                    errorMessage={formData.mittenteEmail && !validation.mittenteEmail ? 'Email non valida' : undefined}
                  />
                </div>
              </div>
            </SmartCard>

            {/* Destinatario Card */}
            <SmartCard title="Destinatario" icon={Package}>
              <div className="space-y-4">
                <SmartInput
                  label="Nome Completo"
                  value={formData.destinatarioNome}
                  onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioNome: v }))}
                  required
                  placeholder="Luigi Verdi"
                  icon={User}
                  isValid={validation.destinatarioNome}
                  errorMessage={formData.destinatarioNome && !validation.destinatarioNome ? 'Nome troppo corto' : undefined}
                />

                <SmartInput
                  label="Indirizzo"
                  value={formData.destinatarioIndirizzo}
                  onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioIndirizzo: v }))}
                  required
                  placeholder="Via Milano 456"
                  icon={MapPin}
                  isValid={validation.destinatarioIndirizzo}
                  errorMessage={formData.destinatarioIndirizzo && !validation.destinatarioIndirizzo ? 'Indirizzo troppo corto' : undefined}
                />

                <div className="grid grid-cols-3 gap-4">
                  <SmartInput
                    label="Città"
                    value={formData.destinatarioCitta}
                    onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioCitta: v }))}
                    required
                    placeholder="Milano"
                    icon={MapPin}
                    isValid={validation.destinatarioCitta}
                    errorMessage={formData.destinatarioCitta && !validation.destinatarioCitta ? 'Città non valida' : undefined}
                  />
                  <SmartInput
                    label="Provincia"
                    value={formData.destinatarioProvincia}
                    onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioProvincia: v.toUpperCase() }))}
                    required
                    placeholder="MI"
                    maxLength={2}
                    isValid={formData.destinatarioProvincia.length === 2}
                    errorMessage={formData.destinatarioProvincia && formData.destinatarioProvincia.length !== 2 ? 'Inserisci 2 caratteri' : undefined}
                  />
                  <SmartInput
                    label="CAP"
                    value={formData.destinatarioCap}
                    onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioCap: v.replace(/\D/g, '').slice(0, 5) }))}
                    required
                    placeholder="20100"
                    maxLength={5}
                    isValid={formData.destinatarioCap.length === 5}
                    errorMessage={formData.destinatarioCap && formData.destinatarioCap.length !== 5 ? 'CAP deve essere di 5 cifre' : undefined}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SmartInput
                    label="Telefono"
                    value={formData.destinatarioTelefono}
                    onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioTelefono: v }))}
                    type="tel"
                    required
                    placeholder="+39 098 765 4321"
                    isValid={validation.destinatarioTelefono}
                    errorMessage={formData.destinatarioTelefono && !validation.destinatarioTelefono ? 'Telefono non valido' : undefined}
                  />

                  <SmartInput
                    label="Email"
                    value={formData.destinatarioEmail}
                    onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioEmail: v }))}
                    type="email"
                    placeholder="email@esempio.it"
                    isValid={validation.destinatarioEmail}
                    errorMessage={formData.destinatarioEmail && !validation.destinatarioEmail ? 'Email non valida' : undefined}
                  />
                </div>
              </div>
            </SmartCard>

            {/* Dati Spedizione Card - Uguale per Manuale e AI Import */}
            <SmartCard title="Dati Spedizione" icon={Package}>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Peso (kg) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.peso}
                        onChange={(e) => setFormData((prev) => ({ ...prev, peso: e.target.value }))}
                        required
                        placeholder="0.00"
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 ${
                          validation.peso
                            ? 'border-green-300 ring-2 ring-green-100'
                            : formData.peso
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-gray-200 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500]'
                        } focus:outline-none`}
                      />
                      {validation.peso && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Lunghezza (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.lunghezza}
                      onChange={(e) => setFormData((prev) => ({ ...prev, lunghezza: e.target.value }))}
                      placeholder="0.0"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Larghezza (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.larghezza}
                      onChange={(e) => setFormData((prev) => ({ ...prev, larghezza: e.target.value }))}
                      placeholder="0.0"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Altezza (cm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.altezza}
                      onChange={(e) => setFormData((prev) => ({ ...prev, altezza: e.target.value }))}
                      placeholder="0.0"
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Tipo Spedizione <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.tipoSpedizione}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tipoSpedizione: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    >
                      <option value="standard">📦 Standard</option>
                      <option value="express">⚡ Express</option>
                      <option value="assicurata">🛡️ Assicurata</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Corriere <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.corriere}
                      onChange={(e) => setFormData((prev) => ({ ...prev, corriere: e.target.value }))}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    >
                      <option value="GLS">🚚 GLS</option>
                      <option value="SDA">🚚 SDA</option>
                      <option value="Bartolini">🚚 Bartolini</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                    Note (opzionale)
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                    rows={3}
                    placeholder="Note aggiuntive..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none resize-none"
                  />
                </div>
              </div>
            </SmartCard>

            {/* Servizi Aggiuntivi Card - Appare dopo selezione corriere */}
            {formData.corriere && (
              <SmartCard title="Servizi Aggiuntivi" icon={Truck}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="contrassegno"
                        checked={formData.contrassegno}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contrassegno: e.target.checked }))}
                        className="w-5 h-5 text-[#FF9500] border-gray-300 rounded focus:ring-[#FF9500] focus:ring-2"
                      />
                      <label htmlFor="contrassegno" className="text-sm font-medium text-gray-700">
                        💰 Contrassegno
                      </label>
                    </div>

                    {formData.contrassegno && (
                      <div>
                        <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                          Importo Contrassegno (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.importoContrassegno}
                          onChange={(e) => setFormData((prev) => ({ ...prev, importoContrassegno: e.target.value }))}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="assicurazione"
                        checked={formData.assicurazione}
                        onChange={(e) => setFormData((prev) => ({ ...prev, assicurazione: e.target.checked }))}
                        className="w-5 h-5 text-[#FF9500] border-gray-300 rounded focus:ring-[#FF9500] focus:ring-2"
                      />
                      <label htmlFor="assicurazione" className="text-sm font-medium text-gray-700">
                        🛡️ Assicurazione
                      </label>
                    </div>

                    {formData.assicurazione && (
                      <div>
                        <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                          Valore Dichiarato (€)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.valoreDichiarato}
                          onChange={(e) => setFormData((prev) => ({ ...prev, valoreDichiarato: e.target.value }))}
                          placeholder="0.00"
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="ritiro"
                      checked={formData.ritiro}
                      onChange={(e) => setFormData((prev) => ({ ...prev, ritiro: e.target.checked }))}
                      className="w-5 h-5 text-[#FF9500] border-gray-300 rounded focus:ring-[#FF9500] focus:ring-2"
                    />
                    <label htmlFor="ritiro" className="text-sm font-medium text-gray-700">
                      📦 Ritiro presso mittente
                    </label>
                  </div>
                </div>
              </SmartCard>
            )}
          </div>

          {/* RIGHT COLUMN - Live Ticket Preview (33% - STICKY) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-8 space-y-6">
              {/* Live Ticket Card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-[#FFD700] to-[#FF9500] p-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    Ticket di Spedizione
                  </h3>
                </div>

                <div className="p-6 space-y-6">
                  {/* Route Visualizer */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-4">
                      Percorso
                    </h4>
                    <RouteVisualizer
                      from={{
                        city: formData.mittenteCitta || '—',
                        province: formData.mittenteProvincia || '',
                      }}
                      to={{
                        city: formData.destinatarioCitta || '—',
                        province: formData.destinatarioProvincia || '',
                      }}
                    />
                  </div>

                  {/* Scelta Intelligente Corriere - AI Routing Advisor */}
                  {formData.destinatarioCitta && formData.destinatarioProvincia && formData.peso && (
                    <div className="pt-6 border-t border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-[#FF9500]" />
                        <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
                          🧠 Scelta Intelligente Corriere
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">
                        Analisi automatica basata su performance, affidabilità e costi nella zona di destinazione
                      </p>
                      <AIRoutingAdvisor
                        citta={formData.destinatarioCitta}
                        provincia={formData.destinatarioProvincia}
                        corriereScelto={formData.corriere || 'GLS'}
                        prezzoCorriereScelto={estimatedCost}
                        onAcceptSuggestion={(corriere) => {
                          setFormData((prev) => ({ ...prev, corriere }));
                        }}
                      />
                    </div>
                  )}

                  {/* Selezione Manuale Corriere */}
                  <div className="pt-6 border-t border-gray-200">
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-3">
                      Corriere <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['GLS', 'SDA', 'Bartolini'] as Corriere[]).map((corriere) => (
                        <button
                          key={corriere}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, corriere }))}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            formData.corriere === corriere
                              ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
                              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {corriere}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cost Calculator */}
                  <div className="pt-6 border-t border-gray-200">
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">
                        Costo Stimato
                      </p>
                      <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-700">
                        {formatPrice(estimatedCost)}
                      </div>
                      {formData.tipoSpedizione === 'express' && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                          <Sparkles className="w-3 h-3" />
                          Express Rate
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Base</span>
                        <span>{formatPrice(10)}</span>
                      </div>
                      {formData.peso && (
                        <div className="flex justify-between">
                          <span>Peso ({formData.peso} kg)</span>
                          <span>{formatPrice(parseFloat(formData.peso) * 2 || 0)}</span>
                        </div>
                      )}
                      {formData.tipoSpedizione === 'express' && (
                        <div className="flex justify-between">
                          <span>Express</span>
                          <span>+50%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Download Format Selector */}
                  <div className="pt-6 border-t border-gray-200">
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-3">
                      Formato Download
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDownloadFormat('pdf')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          downloadFormat === 'pdf'
                            ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        📄 PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setDownloadFormat('csv')}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                          downloadFormat === 'csv'
                            ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white shadow-sm'
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                      >
                        📊 CSV
                      </button>
                    </div>
                  </div>

                  {/* Action Area */}
                  <div className="pt-6 border-t border-gray-200 space-y-3">
                    <form onSubmit={handleSubmit}>
                      <button
                        type="submit"
                        disabled={isSubmitting || progress < 100}
                        className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Generazione...
                          </>
                        ) : (
                          <>
                            <Truck className="w-5 h-5" />
                            Genera Spedizione
                          </>
                        )}
                      </button>
                    </form>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm font-medium text-gray-700"
                      >
                        <Save className="w-4 h-4" />
                        Salva Bozza
                      </button>
                      <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2 text-sm font-medium text-gray-700"
                      >
                        <X className="w-4 h-4" />
                        Annulla
                      </button>
                    </div>
                  </div>

                  {/* Error/Success Messages */}
                  {submitError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                      {submitError}
                    </div>
                  )}

                  {submitSuccess && (
                    <div className="p-5 bg-green-50 border-2 border-green-300 rounded-xl shadow-lg">
                      <div className="flex items-start gap-3 mb-4">
                        <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-bold text-green-900 text-lg mb-1">
                            ✅ LDV Creata con Successo!
                          </h3>
                          <p className="text-sm text-green-700">
                            La spedizione è stata creata correttamente. Vedi i dettagli nella lista spedizioni.
                          </p>
                          {createdTracking && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-green-200">
                              <div className="text-xs text-gray-600 mb-1">Tracking Number:</div>
                              <div className="text-lg font-mono font-bold text-green-700">{createdTracking}</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => router.push('/dashboard/spedizioni')}
                          className="flex-1 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Vedi Lista Spedizioni
                        </button>
                        <button
                          type="button"
                          onClick={resetForm}
                          className="flex-1 px-4 py-2 bg-white border-2 border-green-600 text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Package className="w-4 h-4" />
                          Crea Nuova Spedizione
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
