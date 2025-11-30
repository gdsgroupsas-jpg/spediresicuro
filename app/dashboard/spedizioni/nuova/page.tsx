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
import AsyncLocationCombobox from '@/components/ui/async-location-combobox';
import DashboardNav from '@/components/dashboard-nav';
import AIRoutingAdvisor from '@/components/ai-routing-advisor';
import OCRUpload from '@/components/ocr/ocr-upload';
import FieldTooltip from '@/components/ui/field-tooltip';
import { generateShipmentCSV, downloadCSV, generateShipmentPDF, downloadPDF } from '@/lib/generate-shipment-document';
import type { OnLocationSelect } from '@/types/geo';
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

  // Dettagli spedizione
  peso: string;
  lunghezza: string;
  larghezza: string;
  altezza: string;
  tipoSpedizione: string;
  corriere: string;
  contrassegno: string;
  assicurazione: string;
  note: string;
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
          className={`w-full px-4 ${Icon ? 'pl-10' : ''} pr-10 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white ${
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
    contrassegno: '',
    assicurazione: '',
    note: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdTracking, setCreatedTracking] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<'manual' | 'ai'>('manual');
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'csv'>('pdf');
  
  // Stato per validazione indirizzo destinatario
  const [addressValidation, setAddressValidation] = useState<{
    isValid: boolean | null;
    message: string | null;
    suggestion: string | null;
    isChecking: boolean;
  }>({
    isValid: null,
    message: null,
    suggestion: null,
    isChecking: false,
  });

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

  // Handler selezione location mittente
  const handleMittenteLocation: OnLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      mittenteCitta: location.city,
      mittenteProvincia: location.province,
      mittenteCap: location.cap || '',
    }));
  };

  // Handler selezione location destinatario
  const handleDestinatarioLocation: OnLocationSelect = (location) => {
    setFormData((prev) => ({
      ...prev,
      destinatarioCitta: location.city,
      destinatarioProvincia: location.province,
      destinatarioCap: location.cap || '',
    }));
  };

  // Funzione per validare indirizzo con Google Maps
  const validateAddress = async (address: string, city: string, province: string, zip: string) => {
    if (!address || !city) {
      return;
    }

    setAddressValidation({ isValid: null, message: null, suggestion: null, isChecking: true });

    try {
      const response = await fetch('/api/address/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, city, province, zip }),
      });

      const result = await response.json();

      if (result.success) {
        setAddressValidation({
          isValid: result.isValid,
          message: result.message || null,
          suggestion: result.suggestion || null,
          isChecking: false,
        });
      } else {
        setAddressValidation({
          isValid: null,
          message: null,
          suggestion: null,
          isChecking: false,
        });
      }
    } catch (error) {
      console.error('Errore validazione indirizzo:', error);
      setAddressValidation({
        isValid: null,
        message: null,
        suggestion: null,
        isChecking: false,
      });
    }
  };

  // Handler dati estratti da OCR - Popola TUTTI i campi automaticamente
  // In modalità AI, i campi città/CAP/provincia sono input di testo (non autocomplete)
  const handleOCRDataExtracted = async (data: any) => {
    // Popola destinatario - ordine: nome, indirizzo, città, CAP, provincia
    const updatedData: Partial<FormData> = {
      destinatarioNome: data.recipient_name || data.destinatarioNome || '',
      destinatarioIndirizzo: data.recipient_address || data.destinatarioIndirizzo || '',
      // In modalità AI: campi di testo normali, non autocomplete
      destinatarioCitta: data.recipient_city || data.destinatarioCitta || '',
      destinatarioCap: data.recipient_zip || data.destinatarioCap || '',
      destinatarioProvincia: data.recipient_province || data.destinatarioProvincia || '',
      destinatarioTelefono: data.recipient_phone || data.destinatarioTelefono || '',
      destinatarioEmail: data.recipient_email || data.destinatarioEmail || '',
      note: data.notes || data.note || '',
    };

    // Popola anche mittente se presente nei dati OCR - ordine: nome, indirizzo, città, CAP, provincia
    if (data.sender_name || data.mittenteNome) {
      updatedData.mittenteNome = data.sender_name || data.mittenteNome || '';
      updatedData.mittenteIndirizzo = data.sender_address || data.mittenteIndirizzo || '';
      // In modalità AI: campi di testo normali, non autocomplete
      updatedData.mittenteCitta = data.sender_city || data.mittenteCitta || '';
      updatedData.mittenteCap = data.sender_zip || data.mittenteCap || '';
      updatedData.mittenteProvincia = data.sender_province || data.mittenteProvincia || '';
      updatedData.mittenteTelefono = data.sender_phone || data.mittenteTelefono || '';
      updatedData.mittenteEmail = data.sender_email || data.mittenteEmail || '';
    }

    // Popola anche peso e dimensioni se presenti
    if (data.weight || data.peso) {
      updatedData.peso = String(data.weight || data.peso).replace(',', '.'); // Converti virgola in punto per formato spedisci.online
    }
    if (data.length || data.lunghezza) {
      updatedData.lunghezza = String(data.length || data.lunghezza);
    }
    if (data.width || data.larghezza) {
      updatedData.larghezza = String(data.width || data.larghezza);
    }
    if (data.height || data.altezza) {
      updatedData.altezza = String(data.height || data.altezza);
    }

    // Popola campi aggiuntivi per formato spedisci.online
    if (data.contenuto) {
      updatedData.note = (updatedData.note ? updatedData.note + ' - ' : '') + data.contenuto;
    }
    if (data.order_id) {
      // Salva order_id nelle note o in un campo separato se necessario
      updatedData.note = (updatedData.note ? updatedData.note + ' | Order ID: ' : 'Order ID: ') + data.order_id;
    }
    if (data.contrassegno) {
      updatedData.contrassegno = String(data.contrassegno).replace(',', '.'); // Converti virgola in punto
    }

    // Aggiorna il form con tutti i dati
    setFormData((prev) => ({
      ...prev,
      ...updatedData,
    }));

    // Valida l'indirizzo destinatario dopo l'estrazione
    if (updatedData.destinatarioIndirizzo && updatedData.destinatarioCitta) {
      // Piccolo delay per assicurarsi che il form sia aggiornato
      setTimeout(() => {
        validateAddress(
          updatedData.destinatarioIndirizzo || '',
          updatedData.destinatarioCitta || '',
          updatedData.destinatarioProvincia || '',
          updatedData.destinatarioCap || ''
        );
      }, 500);
    }
  };

  // Handler errori OCR
  const handleOCRError = (error: string) => {
    setSubmitError(`Errore OCR: ${error}`);
  };

  // Handler submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      // Mostra info creazione LDV (se presente)
      if (result.ldv) {
        if (result.ldv.success) {
          const methodLabel = result.ldv.method === 'direct' ? 'adapter diretto' 
            : result.ldv.method === 'broker' ? 'broker spedisci.online' 
            : 'CSV fallback';
          console.log(`✅ LDV creata tramite ${methodLabel}:`, result.ldv.tracking_number);
          // Potresti mostrare un toast qui
        } else {
          console.warn('⚠️ Creazione LDV fallita:', result.ldv.error);
          // Potresti mostrare un avviso non bloccante
        }
      }

      // Genera e scarica documento (CSV o PDF)
      const spedizioneData = result.data;
      if (spedizioneData) {
        // Prepara dati completi per CSV/PDF con formato spedisci.online
        const spedizioneWithDate = {
          ...spedizioneData,
          createdAt: spedizioneData.createdAt || new Date().toISOString(),
          // Campi aggiuntivi per formato spedisci.online
          contrassegno: formData.contrassegno || spedizioneData.contrassegno || '',
          assicurazione: formData.assicurazione || spedizioneData.assicurazione || '',
          contenuto: spedizioneData.contenuto || '',
          order_id: spedizioneData.order_id || spedizioneData.tracking || '',
          totale_ordine: spedizioneData.prezzoFinale || spedizioneData.totale_ordine || '',
          rif_mittente: spedizioneData.rif_mittente || spedizioneData.mittente?.nome || '',
          rif_destinatario: spedizioneData.rif_destinatario || spedizioneData.destinatario?.nome || '',
          colli: spedizioneData.colli || 1,
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

      // Reindirizza alla lista dopo 3 secondi
      setTimeout(() => {
        router.push('/dashboard/spedizioni');
      }, 3000);
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
                {/* Ordine: Nome, Indirizzo, Città, CAP, Provincia */}
                <FieldTooltip content="Inserisci il nome completo o la ragione sociale del mittente. Questo campo è obbligatorio.">
                  <SmartInput
                    label="Nome / Cognome / Ragione Sociale"
                    value={formData.mittenteNome}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteNome: v }))}
                    required
                    placeholder="Mario Rossi o Azienda S.r.l."
                    icon={User}
                    isValid={validation.mittenteNome}
                    errorMessage={formData.mittenteNome && !validation.mittenteNome ? 'Nome troppo corto' : undefined}
                  />
                </FieldTooltip>

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

                {/* Se modalità AI: campi di testo normali, altrimenti autocomplete */}
                {sourceMode === 'ai' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <SmartInput
                      label="Città"
                      value={formData.mittenteCitta}
                      onChange={(v) => setFormData((prev) => ({ ...prev, mittenteCitta: v }))}
                      required
                      placeholder="Milano"
                      isValid={validation.mittenteCitta}
                      errorMessage={formData.mittenteCitta && !validation.mittenteCitta ? 'Città troppo corta' : undefined}
                    />
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
                        CAP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.mittenteCap}
                        onChange={(e) => setFormData((prev) => ({ ...prev, mittenteCap: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                        required
                        placeholder="20100"
                        maxLength={5}
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white ${
                          formData.mittenteCap.length === 5
                            ? 'border-green-300 ring-2 ring-green-100'
                            : formData.mittenteCap && formData.mittenteCap.length !== 5
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-gray-200 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500]'
                        } focus:outline-none`}
                      />
                      {formData.mittenteCap && formData.mittenteCap.length !== 5 && (
                        <p className="text-xs text-red-600">CAP deve essere di 5 cifre</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
                        Provincia <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.mittenteProvincia}
                        onChange={(e) => setFormData((prev) => ({ ...prev, mittenteProvincia: e.target.value.toUpperCase().slice(0, 2) }))}
                        required
                        placeholder="MI"
                        maxLength={2}
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white ${
                          formData.mittenteProvincia.length === 2
                            ? 'border-green-300 ring-2 ring-green-100'
                            : formData.mittenteProvincia && formData.mittenteProvincia.length !== 2
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-gray-200 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500]'
                        } focus:outline-none uppercase`}
                      />
                      {formData.mittenteProvincia && formData.mittenteProvincia.length !== 2 && (
                        <p className="text-xs text-red-600">Provincia deve essere di 2 lettere</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <FieldTooltip content="Cerca la città digitando il nome o il CAP. Il sistema troverà automaticamente provincia e CAP corrispondenti. Se la città ha più CAP, potrai selezionare quello corretto.">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                        Città, Provincia, CAP <span className="text-red-500">*</span>
                      </label>
                      <AsyncLocationCombobox
                        onSelect={handleMittenteLocation}
                        placeholder="Cerca città..."
                        className="w-full"
                        defaultValue={
                          formData.mittenteCitta && formData.mittenteProvincia
                            ? {
                                city: formData.mittenteCitta,
                                province: formData.mittenteProvincia,
                                cap: formData.mittenteCap || null,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </FieldTooltip>
                )}

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
                {/* Ordine: Nome, Indirizzo, Città, CAP, Provincia */}
                <SmartInput
                  label="Nome / Cognome / Ragione Sociale"
                  value={formData.destinatarioNome}
                  onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioNome: v }))}
                  required
                  placeholder="Luigi Verdi o Azienda S.r.l."
                  icon={User}
                  isValid={validation.destinatarioNome}
                  errorMessage={formData.destinatarioNome && !validation.destinatarioNome ? 'Nome troppo corto' : undefined}
                />

                <div>
                  <SmartInput
                    label="Indirizzo"
                    value={formData.destinatarioIndirizzo}
                    onChange={(v) => {
                      setFormData((prev) => ({ ...prev, destinatarioIndirizzo: v }));
                      // Valida indirizzo quando cambia (con debounce implicito)
                      if (v.length >= 5 && formData.destinatarioCitta) {
                        setTimeout(() => {
                          validateAddress(v, formData.destinatarioCitta, formData.destinatarioProvincia, formData.destinatarioCap);
                        }, 1000);
                      } else {
                        setAddressValidation({ isValid: null, message: null, suggestion: null, isChecking: false });
                      }
                    }}
                    required
                    placeholder="Via Milano 456"
                    icon={MapPin}
                    isValid={validation.destinatarioIndirizzo}
                    errorMessage={formData.destinatarioIndirizzo && !validation.destinatarioIndirizzo ? 'Indirizzo troppo corto' : undefined}
                  />
                  
                  {/* Avviso validazione indirizzo */}
                  {addressValidation.isChecking && (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <p className="text-sm text-blue-900">Verifica indirizzo su Google Maps...</p>
                    </div>
                  )}
                  
                  {!addressValidation.isChecking && addressValidation.isValid === false && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-900">
                            {addressValidation.message || 'Indirizzo non trovato su Google Maps'}
                          </p>
                          {addressValidation.suggestion && (
                            <p className="text-sm text-yellow-800 mt-1">
                              <strong>Forse la via giusta è:</strong> {addressValidation.suggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {!addressValidation.isChecking && addressValidation.isValid === true && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <p className="text-sm text-green-900">
                        {addressValidation.message || 'Indirizzo verificato su Google Maps'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Se modalità AI: campi di testo normali, altrimenti autocomplete */}
                {sourceMode === 'ai' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <SmartInput
                      label="Città"
                      value={formData.destinatarioCitta}
                      onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioCitta: v }))}
                      required
                      placeholder="Milano"
                      isValid={validation.destinatarioCitta}
                      errorMessage={formData.destinatarioCitta && !validation.destinatarioCitta ? 'Città troppo corta' : undefined}
                    />
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
                        CAP <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.destinatarioCap}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinatarioCap: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                        required
                        placeholder="20100"
                        maxLength={5}
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white ${
                          formData.destinatarioCap.length === 5
                            ? 'border-green-300 ring-2 ring-green-100'
                            : formData.destinatarioCap && formData.destinatarioCap.length !== 5
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-gray-200 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500]'
                        } focus:outline-none`}
                      />
                      {formData.destinatarioCap && formData.destinatarioCap.length !== 5 && (
                        <p className="text-xs text-red-600">CAP deve essere di 5 cifre</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider">
                        Provincia <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.destinatarioProvincia}
                        onChange={(e) => setFormData((prev) => ({ ...prev, destinatarioProvincia: e.target.value.toUpperCase().slice(0, 2) }))}
                        required
                        placeholder="MI"
                        maxLength={2}
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white ${
                          formData.destinatarioProvincia.length === 2
                            ? 'border-green-300 ring-2 ring-green-100'
                            : formData.destinatarioProvincia && formData.destinatarioProvincia.length !== 2
                            ? 'border-red-300 ring-2 ring-red-100'
                            : 'border-gray-200 focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500]'
                        } focus:outline-none uppercase`}
                      />
                      {formData.destinatarioProvincia && formData.destinatarioProvincia.length !== 2 && (
                        <p className="text-xs text-red-600">Provincia deve essere di 2 lettere</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <FieldTooltip content="Cerca la città digitando il nome o il CAP. Il sistema troverà automaticamente provincia e CAP corrispondenti. Se la città ha più CAP, potrai selezionare quello corretto.">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                        Città, Provincia, CAP <span className="text-red-500">*</span>
                      </label>
                      <AsyncLocationCombobox
                        onSelect={handleDestinatarioLocation}
                        placeholder="Cerca città..."
                        className="w-full"
                        defaultValue={
                          formData.destinatarioCitta && formData.destinatarioProvincia
                            ? {
                                city: formData.destinatarioCitta,
                                province: formData.destinatarioProvincia,
                                cap: formData.destinatarioCap || null,
                              }
                            : undefined
                        }
                      />
                    </div>
                  </FieldTooltip>
                )}

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

            {/* Pacco Card */}
            <SmartCard title="Dettagli Pacco" icon={Package}>
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
                        className={`w-full px-4 py-3 border rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white ${
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    >
                      <option value="standard">📦 Standard</option>
                      <option value="express">⚡ Express</option>
                      <option value="assicurata">🛡️ Assicurata</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Corriere
                    </label>
                    <select
                      value={formData.corriere}
                      onChange={(e) => setFormData((prev) => ({ ...prev, corriere: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                    >
                      <option value="GLS">GLS</option>
                      <option value="BRT">BRT</option>
                      <option value="DHL">DHL</option>
                      <option value="UPS">UPS</option>
                      <option value="SDA">SDA</option>
                      <option value="POSTE">Poste Italiane</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldTooltip content="Inserisci l'importo che il corriere dovrà riscuotere dal destinatario al momento della consegna. Il contrassegno è opzionale e comporta costi aggiuntivi.">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                        Contrassegno (€) <span className="text-gray-400 text-xs normal-case">opzionale</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.contrassegno}
                        onChange={(e) => setFormData((prev) => ({ ...prev, contrassegno: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-500">Importo da riscuotere alla consegna</p>
                    </div>
                  </FieldTooltip>

                  <FieldTooltip content="Inserisci il valore assicurato del pacco. Questo determina il risarcimento in caso di smarrimento o danneggiamento. L'assicurazione è opzionale ma consigliata per oggetti di valore.">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                        Assicurazione (€) <span className="text-gray-400 text-xs normal-case">opzionale</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.assicurazione}
                        onChange={(e) => setFormData((prev) => ({ ...prev, assicurazione: e.target.value }))}
                        placeholder="0.00"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-500">Valore assicurato del pacco</p>
                    </div>
                  </FieldTooltip>
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
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] focus:outline-none resize-none"
                  />
                </div>
              </div>
            </SmartCard>
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

                  {/* AI Routing Advisor */}
                  {formData.destinatarioCitta && formData.destinatarioProvincia && estimatedCost > 0 && (
                    <div className="pt-6 border-t border-gray-200">
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

                  {/* Corriere Selection */}
                  <div className="pt-6 border-t border-gray-200">
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-3">
                      Corriere
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
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">Spedizione creata con successo!</span>
                      </div>
                      {createdTracking && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-green-200">
                          <div className="text-xs text-gray-600 mb-1">Tracking Number:</div>
                          <div className="text-lg font-mono font-bold text-green-700">{createdTracking}</div>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-green-600">
                        Reindirizzamento alla lista spedizioni...
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
