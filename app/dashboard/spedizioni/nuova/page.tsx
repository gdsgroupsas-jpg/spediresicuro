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

import AIRoutingAdvisor from '@/components/ai-routing-advisor';
import DashboardNav from '@/components/dashboard-nav';
import OCRUpload from '@/components/ocr/ocr-upload';
import ContractComparison from '@/components/shipments/contract-comparison';
import { IntelligentQuoteComparator } from '@/components/shipments/intelligent-quote-comparator';
import AddressFields from '@/components/ui/address-fields';
import { downloadPDF, generateShipmentPDF } from '@/lib/generate-shipment-document';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  Package,
  Save,
  Sparkles,
  Truck,
  User,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback } from 'react';

// Enterprise Feedback UX Components (Phase 3)
import { SuccessModal, ErrorDialog } from '@/components/feedback';
import { useEnterpriseFeedbackUX } from '@/hooks/useEnterpriseFeedbackUX';
import { formatError } from '@/lib/errors';

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
  note: string;
  // Contrassegno (COD) - ora è un campo numerico
  contrassegnoAmount: string;
  // Servizi Accessori
  serviziAccessori: string[];
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
          className={`w-full px-4 ${
            Icon ? 'pl-10' : ''
          } pr-10 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
            showError
              ? 'border-red-500 ring-2 ring-red-200 focus:ring-red-500 focus:border-red-600 bg-red-50'
              : showValid
                ? 'border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50'
                : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
          } focus:outline-none placeholder:text-gray-500`}
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
      {showError && errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
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
    <div
      className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}
    >
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
            <span className="text-sm font-medium text-gray-900">{from.city}</span>
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

  // Enterprise Feedback UX feature flag
  const { isEnabled: useEnterpriseFeedback } = useEnterpriseFeedbackUX();

  // State per Enterprise Feedback modals
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [formattedError, setFormattedError] = useState<ReturnType<typeof formatError> | null>(null);
  const [createdShipmentData, setCreatedShipmentData] = useState<{
    tracking: string;
    courier: string;
    cost: string;
  } | null>(null);

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
    corriere: '', // ⚠️ VUOTO - L'utente DEVE selezionare dal preventivatore
    note: '',
    contrassegnoAmount: '',
    serviziAccessori: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdTracking, setCreatedTracking] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<'manual' | 'ai'>('manual');

  // ✨ NUOVO: Contratto selezionato (per reseller)
  const [selectedContractId, setSelectedContractId] = useState<string | undefined>(undefined);
  const [selectedContractType, setSelectedContractType] = useState<
    'reseller' | 'master' | 'default' | undefined
  >(undefined);
  // ✨ ENTERPRISE: ConfigId della configurazione API selezionata (per multi-config)
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined);

  // ✨ ENTERPRISE: Quote selezionato con prezzo esatto (per routing)
  const [selectedQuoteExactPrice, setSelectedQuoteExactPrice] = useState<{
    courierName: string;
    price: number;
    contractCode?: string;
  } | null>(null);
  // ✨ NUOVO: VAT context dal quote selezionato (ADR-001)
  const [selectedVATContext, setSelectedVATContext] = useState<{
    vat_mode?: 'included' | 'excluded' | null;
    vat_rate?: number;
  } | null>(null);

  // Corrieri disponibili caricati dinamicamente dal DB
  const [availableCouriers, setAvailableCouriers] = useState<
    Array<{ displayName: string; courierName: string; contractCode?: string }>
  >([]);
  const [couriersLoading, setCouriersLoading] = useState(true);

  // ✨ ENTERPRISE: Quote ricevute per ogni corriere
  const [courierQuotes, setCourierQuotes] = useState<Map<string, any>>(new Map());

  // ✨ RIMOSSA: validQuotesFromComparator non più usato (sezione routing rimossa)

  // ✨ FIX: Counter per forzare re-mount del preventivatore dopo reset form
  const [formResetCounter, setFormResetCounter] = useState(0);

  // ✨ Layout sempre ottimizzato per tabella (40/60)

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

  // Carica corrieri disponibili dal DB (basato su contract_mapping dell'utente)
  useEffect(() => {
    async function loadAvailableCouriers() {
      try {
        setCouriersLoading(true);
        console.log('🔄 [FORM] Caricamento corrieri disponibili...');
        const response = await fetch('/api/couriers/available');
        console.log('📥 [FORM] Risposta API corrieri:', {
          status: response.status,
          ok: response.ok,
        });
        if (response.ok) {
          const data = await response.json();
          console.log('📋 [FORM] Corrieri ricevuti:', {
            total: data.total,
            couriers: data.couriers?.length || 0,
            details: data.couriers?.map((c: any) => ({
              displayName: c.displayName,
              courierName: c.courierName,
              contractCode: c.contractCode,
            })),
          });
          if (data.couriers && data.couriers.length > 0) {
            setAvailableCouriers(data.couriers);
            console.log(`✅ [FORM] ${data.couriers.length} corrieri caricati e impostati`);
            // ⚠️ NON auto-selezionare! L'utente DEVE cliccare sul preventivatore
            // Se il corriere già selezionato non è più disponibile, resetta a vuoto
            const displayNames = data.couriers.map((c: { displayName: string }) => c.displayName);
            setFormData((prev) => ({
              ...prev,
              corriere: displayNames.includes(prev.corriere) ? prev.corriere : '', // ⚠️ VUOTO invece di auto-select primo
            }));
          } else {
            // Fallback: nessun corriere configurato, mostra default
            console.warn("⚠️ [FORM] Nessun corriere configurato per l'utente, usando default");
            setAvailableCouriers([{ displayName: 'GLS', courierName: 'Gls' }]);
          }
        } else {
          const errorText = await response.text();
          console.error('❌ [FORM] Errore caricamento corrieri:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          // Fallback in caso di errore
          setAvailableCouriers([{ displayName: 'GLS', courierName: 'Gls' }]);
        }
      } catch (error) {
        console.error('❌ [FORM] Errore caricamento corrieri disponibili:', error);
        // Fallback in caso di errore
        setAvailableCouriers([{ displayName: 'GLS', courierName: 'Gls' }]);
      } finally {
        setCouriersLoading(false);
      }
    }
    loadAvailableCouriers();
  }, []);

  // ✨ ENTERPRISE: Reset prezzo esatto quando cambiano i dati critici (peso, destinazione)
  useEffect(() => {
    // Reset quando peso o destinazione cambiano o vengono rimossi
    if (!formData.peso || parseFloat(formData.peso) <= 0 || !formData.destinatarioCap) {
      setSelectedQuoteExactPrice(null);
    }
  }, [formData.peso, formData.destinatarioCap]);

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
    // Contrassegno attivo se valore > 0
    const contrassegnoAttivo =
      formData.contrassegnoAmount && parseFloat(formData.contrassegnoAmount) > 0;
    return {
      mittenteNome: formData.mittenteNome.length >= 2,
      mittenteIndirizzo: formData.mittenteIndirizzo.length >= 5,
      mittenteCitta: formData.mittenteCitta.length >= 2,
      mittenteProvincia: formData.mittenteProvincia.length >= 2, // ⚠️ VALIDAZIONE PROVINCIA MITTENTE (OBBLIGATORIA)
      mittenteCap: formData.mittenteCap.length >= 5, // ⚠️ VALIDAZIONE CAP MITTENTE (OBBLIGATORIO)
      mittenteTelefono: /^[\d\s\+\-\(\)]{8,}$/.test(formData.mittenteTelefono),
      mittenteEmail:
        !formData.mittenteEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.mittenteEmail),
      destinatarioNome: formData.destinatarioNome.length >= 2,
      destinatarioIndirizzo: formData.destinatarioIndirizzo.length >= 5,
      destinatarioCitta: formData.destinatarioCitta.length >= 2,
      destinatarioProvincia: formData.destinatarioProvincia.length >= 2, // ⚠️ VALIDAZIONE PROVINCIA DESTINATARIO (OBBLIGATORIA)
      destinatarioCap: formData.destinatarioCap.length >= 5, // ⚠️ VALIDAZIONE CAP DESTINATARIO (OBBLIGATORIO)
      destinatarioTelefono: contrassegnoAttivo
        ? /^[\d\s\+\-\(\)]{8,}$/.test(formData.destinatarioTelefono) // REQUIRED se contrassegno attivo
        : !formData.destinatarioTelefono ||
          /^[\d\s\+\-\(\)]{8,}$/.test(formData.destinatarioTelefono), // Opzionale altrimenti
      destinatarioEmail:
        !formData.destinatarioEmail ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.destinatarioEmail),
      peso: parseFloat(formData.peso) > 0,
      contrassegnoAmount:
        !formData.contrassegnoAmount || parseFloat(formData.contrassegnoAmount) > 0,
    };
  }, [formData]);

  // Calcola progresso
  const progress = useMemo(() => {
    const requiredFields = [
      formData.mittenteNome,
      formData.mittenteIndirizzo,
      formData.mittenteCitta,
      formData.mittenteProvincia, // ⚠️ PROVINCIA MITTENTE OBBLIGATORIA
      formData.mittenteCap, // ⚠️ CAP MITTENTE OBBLIGATORIO
      formData.mittenteTelefono,
      formData.destinatarioNome,
      formData.destinatarioIndirizzo,
      formData.destinatarioCitta,
      formData.destinatarioProvincia, // ⚠️ PROVINCIA DESTINATARIO OBBLIGATORIA
      formData.destinatarioCap, // ⚠️ CAP DESTINATARIO OBBLIGATORIO
      formData.destinatarioTelefono,
      formData.peso,
      formData.corriere, // ⚠️ CORRIERE OBBLIGATORIO - Deve essere selezionato dal preventivatore
    ];
    const filled = requiredFields.filter((f) => f && f.length > 0).length;
    return Math.round((filled / requiredFields.length) * 100);
  }, [formData]);

  // Calcola costo stimato
  const estimatedCost = useMemo(() => {
    const baseCost = 10; // Costo base
    const weightCost = parseFloat(formData.peso) * 2 || 0;
    const distanceMultiplier = formData.mittenteCitta && formData.destinatarioCitta ? 1.2 : 1;
    const typeMultiplier =
      formData.tipoSpedizione === 'express'
        ? 1.5
        : formData.tipoSpedizione === 'assicurata'
          ? 1.3
          : 1;

    return Math.round((baseCost + weightCost) * distanceMultiplier * typeMultiplier);
  }, [formData.peso, formData.mittenteCitta, formData.destinatarioCitta, formData.tipoSpedizione]);

  // Handler per campi mittente
  const handleMittenteCittaChange = (city: string) => {
    console.log('🔍 [HANDLER] handleMittenteCittaChange:', city);
    setFormData((prev) => ({ ...prev, mittenteCitta: city }));
  };
  const handleMittenteProvinciaChange = (province: string) => {
    console.log('🔍 [HANDLER] handleMittenteProvinciaChange:', province);
    setFormData((prev) => ({ ...prev, mittenteProvincia: province }));
  };
  const handleMittenteCapChange = (cap: string) => {
    console.log('🔍 [HANDLER] handleMittenteCapChange:', cap);
    setFormData((prev) => ({ ...prev, mittenteCap: cap }));
  };

  // Handler per campi destinatario
  const handleDestinatarioCittaChange = (city: string) => {
    console.log('🔍 [HANDLER] handleDestinatarioCittaChange:', city);
    setFormData((prev) => ({ ...prev, destinatarioCitta: city }));
  };
  const handleDestinatarioProvinciaChange = (province: string) => {
    console.log('🔍 [HANDLER] handleDestinatarioProvinciaChange:', province);
    setFormData((prev) => ({ ...prev, destinatarioProvincia: province }));
  };
  const handleDestinatarioCapChange = (cap: string) => {
    console.log('🔍 [HANDLER] handleDestinatarioCapChange:', cap);
    setFormData((prev) => ({ ...prev, destinatarioCap: cap }));
  };

  // Helper per formattazione telefono italiana
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    // Rimuovi spazi, lineette, parentesi
    let clean = phone.replace(/[\s\-\(\)]/g, '');

    // Se inizia con +39, ok
    if (clean.startsWith('+39')) {
      return clean;
    }
    // Se inizia con 3, aggiungi +39
    if (clean.startsWith('3')) {
      return `+39${clean}`;
    }
    // Se inizia con 0039, sostituisci con +39
    if (clean.startsWith('0039')) {
      return `+39${clean.substring(4)}`;
    }

    return clean;
  };

  // Handler dati estratti da AGENT AI
  const handleOCRDataExtracted = (data: any) => {
    // 1. Popola Dati Destinatario
    setFormData((prev) => {
      const newData = {
        ...prev,
        destinatarioNome: data.recipient_name || prev.destinatarioNome,
        destinatarioIndirizzo: data.recipient_address || prev.destinatarioIndirizzo,
        destinatarioCitta: data.recipient_city || prev.destinatarioCitta,
        destinatarioProvincia: data.recipient_province || prev.destinatarioProvincia,
        destinatarioCap: data.recipient_zip || prev.destinatarioCap,
        destinatarioTelefono: data.recipient_phone
          ? formatPhoneNumber(data.recipient_phone)
          : prev.destinatarioTelefono,
        destinatarioEmail: data.recipient_email || prev.destinatarioEmail,
        note: data.notes ? (prev.note ? `${prev.note}\n${data.notes}` : data.notes) : prev.note,
      };

      // 2. Gestione Contrassegno (COD)
      if (data.cash_on_delivery_amount) {
        newData.contrassegnoAmount = String(data.cash_on_delivery_amount);
      }

      return newData;
    });

    console.log('Agent Data applied:', data);
  };

  // Handler errori OCR
  const handleOCRError = (error: string) => {
    setSubmitError(`Errore OCR: ${error}`);
  };

  // Handler submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ⚠️ DOUBLE-SUBMIT PROTECTION: Blocca se già in corso
    if (isSubmitting) {
      console.warn('⚠️ [FORM] Submit già in corso, ignoro click duplicato');
      return;
    }

    // ⚠️ VALIDAZIONE PRE-SUBMIT: Blocca se dati obbligatori mancano
    const validationErrors: string[] = [];

    // ⚠️ CRITICO: Verifica che sia stato selezionato un corriere dal preventivatore
    if (!formData.corriere || formData.corriere.length === 0) {
      validationErrors.push(
        'Corriere non selezionato. Clicca su un corriere nella tabella preventivi.'
      );
    }

    if (!formData.mittenteProvincia || formData.mittenteProvincia.length < 2) {
      validationErrors.push("Provincia mittente mancante. Seleziona città dall'autocomplete.");
    }
    if (!formData.mittenteCap || formData.mittenteCap.length < 5) {
      validationErrors.push("CAP mittente mancante. Seleziona città dall'autocomplete.");
    }
    if (!formData.destinatarioProvincia || formData.destinatarioProvincia.length < 2) {
      validationErrors.push("Provincia destinatario mancante. Seleziona città dall'autocomplete.");
    }
    if (!formData.destinatarioCap || formData.destinatarioCap.length < 5) {
      validationErrors.push("CAP destinatario mancante. Seleziona città dall'autocomplete.");
    }

    if (validationErrors.length > 0) {
      setSubmitError(validationErrors.join(' '));
      console.error('❌ [FORM] Validazione fallita:', validationErrors);
      console.error('❌ [FORM] State corrente:', {
        mittente: {
          citta: formData.mittenteCitta,
          provincia: formData.mittenteProvincia,
          cap: formData.mittenteCap,
        },
        destinatario: {
          citta: formData.destinatarioCitta,
          provincia: formData.destinatarioProvincia,
          cap: formData.destinatarioCap,
        },
      });
      return; // ⚠️ BLOCCA SUBMIT
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      // ⚠️ HELPER: Estrae provincia e CAP da stringa formattata "Città (Provincia) - CAP"
      const extractProvinceAndCap = (
        formattedString: string
      ): { province: string; cap: string } => {
        if (!formattedString) return { province: '', cap: '' };

        // Pattern: "Città (Provincia) - CAP" o "Città (Provincia)"
        const match = formattedString.match(/\(([A-Z]{2})\)(?:\s*-\s*(\d{5}))?/);
        if (match) {
          return {
            province: match[1] || '',
            cap: match[2] || '',
          };
        }
        return { province: '', cap: '' };
      };

      // ⚠️ MAPPING ESPLICITO: Assicura che provincia e CAP siano correttamente mappati
      // Se mancano, prova a estrarli dalla stringa formattata (fallback)
      let mittenteProvincia = formData.mittenteProvincia;
      let mittenteCap = formData.mittenteCap;
      let destinatarioProvincia = formData.destinatarioProvincia;
      let destinatarioCap = formData.destinatarioCap;

      // Se provincia mittente manca, prova a estrarla (fallback)
      if (!mittenteProvincia && formData.mittenteCitta) {
        const extracted = extractProvinceAndCap(formData.mittenteCitta);
        if (extracted.province) {
          mittenteProvincia = extracted.province;
          console.warn(
            '⚠️ [FORM] Provincia mittente estratta da stringa formattata:',
            extracted.province
          );
        }
        if (extracted.cap && !mittenteCap) {
          mittenteCap = extracted.cap;
          console.warn('⚠️ [FORM] CAP mittente estratto da stringa formattata:', extracted.cap);
        }
      }

      // Se provincia destinatario manca, prova a estrarla (fallback)
      if (!destinatarioProvincia && formData.destinatarioCitta) {
        const extracted = extractProvinceAndCap(formData.destinatarioCitta);
        if (extracted.province) {
          destinatarioProvincia = extracted.province;
          console.warn(
            '⚠️ [FORM] Provincia destinatario estratta da stringa formattata:',
            extracted.province
          );
        }
        if (extracted.cap && !destinatarioCap) {
          destinatarioCap = extracted.cap;
          console.warn('⚠️ [FORM] CAP destinatario estratto da stringa formattata:', extracted.cap);
        }
      }

      // ⚠️ LOG DEBUG COMPLETO: Verifica state PRIMA del mapping
      console.log('🔍 [FORM] State formData COMPLETO:', {
        mittenteCitta: formData.mittenteCitta,
        mittenteProvincia: formData.mittenteProvincia,
        mittenteCap: formData.mittenteCap,
        destinatarioCitta: formData.destinatarioCitta,
        destinatarioProvincia: formData.destinatarioProvincia,
        destinatarioCap: formData.destinatarioCap,
      });

      // ⚠️ RIMUOVI UNDEFINED: Filtra campi con undefined per evitare che arrivino all'API
      const cleanFormData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined)
      );

      const payload = {
        ...cleanFormData,
        // ⚠️ MAPPING ESPLICITO: Sovrascrive con valori estratti o da state (NO fallback a '' che causa constraint violation)
        mittenteCitta: formData.mittenteCitta || null,
        mittenteProvincia: mittenteProvincia || null,
        mittenteCap: mittenteCap || null,
        destinatarioCitta: formData.destinatarioCitta || null,
        destinatarioProvincia: destinatarioProvincia || null,
        destinatarioCap: destinatarioCap || null,
        // ✨ NUOVO: Contratto selezionato (per reseller)
        ...(selectedContractId &&
          selectedContractType && {
            selectedContractId,
            selectedContractType,
          }),
        // ✨ ENTERPRISE: ConfigId della configurazione API selezionata (per multi-config)
        ...(selectedConfigId && {
          configId: selectedConfigId,
        }),
        // ✨ NUOVO: VAT Semantics (ADR-001) - Propaga VAT context dal quote selezionato
        ...(selectedVATContext && {
          vat_mode: selectedVATContext.vat_mode,
          vat_rate: selectedVATContext.vat_rate,
        }),
        // ✨ FIX: Prezzo finale dal quote selezionato (prezzo listino personalizzato con margine)
        ...(selectedQuoteExactPrice &&
          selectedQuoteExactPrice.price > 0 && {
            final_price: selectedQuoteExactPrice.price,
          }),
      };

      // ⚠️ LOG CRITICO: Verifica payload PRIMA dell'invio (incluso valori undefined)
      console.log('🔍 [FORM] selectedQuoteExactPrice prima invio:', selectedQuoteExactPrice);
      console.log('📋 [FORM] Payload COMPLETO spedizione (prima invio):', payload);
      console.log('💰 [FORM] final_price nel payload:', payload.final_price || 'MANCANTE');

      console.log('📋 [FORM] Payload indirizzo strutturato:', {
        mittente: {
          città: payload.mittenteCitta,
          provincia: payload.mittenteProvincia,
          cap: payload.mittenteCap,
          _tipi: {
            città: typeof payload.mittenteCitta,
            provincia: typeof payload.mittenteProvincia,
            cap: typeof payload.mittenteCap,
          },
        },
        destinatario: {
          città: payload.destinatarioCitta,
          provincia: payload.destinatarioProvincia,
          cap: payload.destinatarioCap,
          _tipi: {
            città: typeof payload.destinatarioCitta,
            provincia: typeof payload.destinatarioProvincia,
            cap: typeof payload.destinatarioCap,
          },
        },
      });

      // ✨ DEBUG: Log payload prima dell'invio
      console.log('📤 [FORM] Invio richiesta creazione spedizione:', {
        payload_keys: Object.keys(payload),
        corriere: (payload as any).corriere || formData.corriere,
        peso: (payload as any).peso || formData.peso,
        mittente: {
          nome: (payload as any).mittenteNome || formData.mittenteNome,
          provincia: (payload as any).mittenteProvincia || mittenteProvincia,
          cap: (payload as any).mittenteCap || mittenteCap,
        },
        destinatario: {
          nome: (payload as any).destinatarioNome || formData.destinatarioNome,
          provincia: (payload as any).destinatarioProvincia || destinatarioProvincia,
          cap: (payload as any).destinatarioCap || destinatarioCap,
        },
      });

      const response = await fetch('/api/spedizioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      console.log('📥 [FORM] Risposta API:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Errore sconosciuto' }));
        console.error('❌ [FORM] Errore API:', errorData);
        throw new Error(errorData.message || errorData.error || 'Errore durante il salvataggio');
      }

      const result = await response.json();
      console.log('📦 [CLIENT] Risultato API spedizioni:', result);
      console.log('📦 [CLIENT] LDV Result (da result.ldv):', result.ldv);
      console.log('📦 [CLIENT] LDV Result (da result.data?.ldv):', result.data?.ldv);
      console.log('📦 [CLIENT] Tracking:', result.data?.tracking);
      console.log('📦 [CLIENT] Corriere:', result.data?.corriere);
      console.log('📦 [CLIENT] Success:', result.success);
      console.log('📦 [CLIENT] Message:', result.message);

      // Legacy state (sempre settato per compatibilità)
      setSubmitSuccess(true);
      setCreatedTracking(result.data?.tracking || null);

      // Enterprise Feedback: Mostra SuccessModal invece dell'inline message
      if (useEnterpriseFeedback) {
        setCreatedShipmentData({
          tracking: result.data?.tracking || '',
          courier: formData.corriere,
          cost: selectedQuoteExactPrice?.price
            ? `€${selectedQuoteExactPrice.price.toFixed(2)}`
            : '',
        });
        setShowSuccessModal(true);
      }

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
          // DEBUG: Stampa l'intero risultato per capire cosa torna dal backend
          console.log('📦 [FRONTEND] Risultato creazione spedizione:', result);

          // VERIFICA SE ESISTE UN'ETICHETTA REALE (DALL'API)
          // L'API restituisce ldv al livello root, non dentro data
          const ldvResult = result.ldv || result.data?.ldv;
          console.log('🔍 [CLIENT] Verifica LDV:', {
            'result.ldv': result.ldv,
            'result.data?.ldv': result.data?.ldv,
            ldvResult: ldvResult,
            'ldvResult?.success': ldvResult?.success,
            'ldvResult?.label_url': ldvResult?.label_url,
            'ldvResult?.error': ldvResult?.error,
            'ldvResult?.method': ldvResult?.method,
          });

          if (ldvResult && ldvResult.success && ldvResult.label_url) {
            console.log('📄 Apertura etichetta originale:', ldvResult.label_url);
            window.open(ldvResult.label_url, '_blank');
          } else if (ldvResult && ldvResult.success && ldvResult.label_pdf) {
            // ⚠️ FIX: Gestisci label_pdf base64 (scarica come PDF)
            console.log('📄 [CLIENT] label_pdf base64 ricevuto, scarico PDF...');
            try {
              // Decodifica base64 e crea blob
              const base64Data = ldvResult.label_pdf;
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: 'application/pdf' });
              const blobUrl = URL.createObjectURL(blob);

              // ⚠️ FIX: Nome file = solo tracking number (senza prefisso LDV_)
              const trackingNumber =
                ldvResult.tracking_number || spedizioneData.tracking || 'spedizione';
              const filename = `${trackingNumber}.pdf`;

              // Scarica il PDF
              const link = document.createElement('a');
              link.href = blobUrl;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);

              // Cleanup
              setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

              console.log('✅ [CLIENT] PDF etichetta scaricato con successo:', filename);
            } catch (pdfError) {
              console.error('❌ [CLIENT] Errore decodifica PDF:', pdfError);
              // Fallback al ticket interno
              const pdfDoc = generateShipmentPDF(spedizioneWithDate);
              const trackingNumber = spedizioneData.tracking || 'spedizione';
              const filename = `${trackingNumber}.pdf`;
              downloadPDF(pdfDoc, filename);
            }
          } else {
            // FALLBACK: Genera Ticket interno se non c'è etichetta reale
            console.log('⚠️ Nessuna etichetta API, genero Ticket interno');

            // LOGGING DETTAGLIATO (da remote)
            console.log('   - ldvResult:', ldvResult);
            console.log('   - ldvResult?.success:', ldvResult?.success);
            console.log('   - ldvResult?.label_url:', ldvResult?.label_url);
            console.log('   - ldvResult?.error:', ldvResult?.error);
            console.log('   - ldvResult?.method:', ldvResult?.method);

            // ⚠️ MOSTRA ERRORE ALL'UTENTE - MESSAGGIO MIGLIORATO
            // Se c'è un errore nell'oggetto LDV, mostralo con dettagli utili
            const errorMsg = result.ldv?.error || result.ldv?.message;
            const method = result.ldv?.method || 'sconosciuto';

            if (errorMsg) {
              // Messaggio più specifico in base al metodo usato
              let title = '⚠️ Errore Creazione LDV';
              let details = errorMsg;

              if (method === 'broker') {
                title = '⚠️ Errore Spedisci.online';
                // Verifica se è un errore di contratto mancante
                if (
                  errorMsg.toLowerCase().includes('contratto') ||
                  errorMsg.toLowerCase().includes('contract')
                ) {
                  const corriereName =
                    formData.corriere || spedizioneData?.corriere || 'questo corriere';
                  details =
                    `Contratto non configurato per ${corriereName}.\n\n` +
                    `Configura il contratto nel wizard Spedisci.online:\n` +
                    `1. Vai su Integrazioni\n` +
                    `2. Apri il wizard Spedisci.online\n` +
                    `3. Aggiungi il contratto per ${corriereName}\n\n` +
                    `Errore tecnico: ${errorMsg}`;
                } else if (
                  errorMsg.toLowerCase().includes('401') ||
                  errorMsg.toLowerCase().includes('unauthorized')
                ) {
                  details =
                    `API Key non valida o scaduta.\n\n` +
                    `Verifica le credenziali nel wizard Spedisci.online.\n\n` +
                    `Errore tecnico: ${errorMsg}`;
                } else if (
                  errorMsg.toLowerCase().includes('404') ||
                  errorMsg.toLowerCase().includes('not found')
                ) {
                  details =
                    `Endpoint non trovato.\n\n` +
                    `Verifica che il Base URL sia corretto nel wizard Spedisci.online.\n\n` +
                    `Errore tecnico: ${errorMsg}`;
                } else {
                  details =
                    `Errore durante la creazione della spedizione tramite Spedisci.online.\n\n` +
                    `Errore: ${errorMsg}\n\n` +
                    `La spedizione è stata salvata localmente. Puoi provare a crearla manualmente dal pannello Spedisci.online.`;
                }
              } else {
                details = `Errore: ${errorMsg}\n\nLa spedizione è stata salvata localmente.`;
              }

              alert(
                `${title}\n\n${details}\n\nÈ stato generato un ticket di riserva (PDF locale).`
              );
            } else if (!result.ldv) {
              // Caso raro: ldv null (errore server interno prima dell'orchestrator)
              console.warn('Oggetto LDV mancante nella risposta');
              alert(
                '⚠️ ERRORE DI SISTEMA:\n\nIl server non ha restituito informazioni sulla spedizione (LDV mancante).\nControlla i log del server per dettagli.'
              );
            }

            const pdfDoc = generateShipmentPDF(spedizioneWithDate);
            // ⚠️ FIX: Nome file = solo tracking number (senza prefisso LDV_)
            const trackingNumber = spedizioneData.tracking || 'spedizione';
            const filename = `${trackingNumber}.pdf`;
            downloadPDF(pdfDoc, filename);
          }
        }, 500);
      }

      // ⚠️ FIX: Reset form e mostra messaggio successo invece di redirect
      setSubmitSuccess(true);
      setCreatedTracking(spedizioneData?.tracking || spedizioneData?.ldv || null);

      // Salva dati mittente predefiniti prima del reset
      const currentMittente = {
        mittenteNome: formData.mittenteNome,
        mittenteIndirizzo: formData.mittenteIndirizzo,
        mittenteCitta: formData.mittenteCitta,
        mittenteProvincia: formData.mittenteProvincia,
        mittenteCap: formData.mittenteCap,
        mittenteTelefono: formData.mittenteTelefono,
        mittenteEmail: formData.mittenteEmail,
      };

      // Reset form dopo 2 secondi per permettere inserimento rapido nuova spedizione
      setTimeout(async () => {
        // Ricarica dati mittente predefiniti dall'API
        let defaultMittente = currentMittente; // Fallback ai dati attuali
        try {
          const response = await fetch('/api/user/settings');
          if (response.ok) {
            const data = await response.json();
            if (data.defaultSender) {
              defaultMittente = {
                mittenteNome: data.defaultSender.nome || '',
                mittenteIndirizzo: data.defaultSender.indirizzo || '',
                mittenteCitta: data.defaultSender.citta || '',
                mittenteProvincia: data.defaultSender.provincia || '',
                mittenteCap: data.defaultSender.cap || '',
                mittenteTelefono: data.defaultSender.telefono || '',
                mittenteEmail: data.defaultSender.email || '',
              };
            }
          }
        } catch (error) {
          console.error('Errore caricamento mittente predefinito:', error);
          // Usa i dati attuali come fallback
        }

        // Reset form mantenendo dati mittente predefiniti
        setFormData({
          ...defaultMittente, // Mantieni dati mittente predefiniti
          // Reset solo destinatario e dettagli spedizione
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
          corriere: '', // ⚠️ VUOTO - L'utente DEVE selezionare dal preventivatore
          note: '',
          contrassegnoAmount: '',
          serviziAccessori: [],
        });

        // Reset stati
        setSubmitSuccess(false);
        setCreatedTracking(null);
        setSubmitError(null);

        // ✨ FIX: Forza re-mount del preventivatore per pulire stato interno
        setFormResetCounter((prev) => prev + 1);
        setCourierQuotes(new Map()); // Reset anche le quote salvate
        setSelectedConfigId(undefined); // ✨ ENTERPRISE: Reset configId per nuova spedizione
        setSelectedQuoteExactPrice(null); // ✨ ENTERPRISE: Reset prezzo esatto

        // ✨ ENTERPRISE: Ricarica corrieri disponibili dopo reset form
        // Questo assicura che se i corrieri sono cambiati (es. dopo configurazione),
        // vengono mostrati correttamente nella nuova spedizione
        try {
          console.log('🔄 [FORM] Ricaricamento corrieri dopo reset form...');
          const couriersResponse = await fetch('/api/couriers/available', {
            cache: 'no-store', // Forza fetch fresco
          });
          if (couriersResponse.ok) {
            const couriersData = await couriersResponse.json();
            if (couriersData.couriers && couriersData.couriers.length > 0) {
              setAvailableCouriers(couriersData.couriers);
              console.log(
                `✅ [FORM] ${couriersData.couriers.length} corrieri ricaricati dopo reset`
              );
            }
          }
        } catch (error) {
          console.error('❌ [FORM] Errore ricaricamento corrieri:', error);
          // Non bloccare, continua con corrieri esistenti
        }

        // Scrolla in alto per mostrare il form vuoto
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Focus sul primo campo destinatario per inserimento rapido
        const destinatarioInput = document.querySelector(
          'input[placeholder*="destinatario"], input[name="destinatarioNome"]'
        ) as HTMLInputElement;
        if (destinatarioInput) {
          setTimeout(() => destinatarioInput.focus(), 100);
        }
      }, 2000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Errore durante il salvataggio. Riprova.';

      // Legacy state (sempre settato per compatibilità)
      setSubmitError(errorMessage);

      // Enterprise Feedback: Mostra ErrorDialog invece dell'inline message
      if (useEnterpriseFeedback) {
        const formatted = formatError({
          message: errorMessage,
          originalError: error,
        });
        setFormattedError(formatted);
        setShowErrorDialog(true);
      }
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

        {/* ✨ Layout ottimizzato: 65/35 (form 65%, preventivatore 35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN - Input Flow */}
          <div className="space-y-6 lg:col-span-2">
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
                <OCRUpload onDataExtracted={handleOCRDataExtracted} onError={handleOCRError} />
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>💡 Suggerimento:</strong> Carica uno screenshot WhatsApp, foto documento
                    o immagine con i dati del destinatario. Il sistema estrarrà automaticamente
                    nome, indirizzo, CAP, città, telefono e email.
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
                  errorMessage={
                    formData.mittenteNome && !validation.mittenteNome
                      ? 'Nome troppo corto'
                      : undefined
                  }
                />

                <SmartInput
                  label="Indirizzo"
                  value={formData.mittenteIndirizzo}
                  onChange={(v) => setFormData((prev) => ({ ...prev, mittenteIndirizzo: v }))}
                  required
                  placeholder="Via Roma 123"
                  icon={MapPin}
                  isValid={validation.mittenteIndirizzo}
                  errorMessage={
                    formData.mittenteIndirizzo && !validation.mittenteIndirizzo
                      ? 'Indirizzo troppo corto'
                      : undefined
                  }
                />

                <AddressFields
                  label=""
                  cityValue={formData.mittenteCitta}
                  provinceValue={formData.mittenteProvincia}
                  postalCodeValue={formData.mittenteCap}
                  onCityChange={handleMittenteCittaChange}
                  onProvinceChange={handleMittenteProvinciaChange}
                  onPostalCodeChange={handleMittenteCapChange}
                  cityValid={validation.mittenteCitta}
                  provinceValid={validation.mittenteProvincia}
                  postalCodeValid={validation.mittenteCap}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <SmartInput
                    label="Telefono"
                    value={formData.mittenteTelefono}
                    onChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        mittenteTelefono: formatPhoneNumber(v),
                      }))
                    }
                    type="tel"
                    required
                    placeholder="+39 312 345 6789"
                    isValid={validation.mittenteTelefono}
                    errorMessage={
                      formData.mittenteTelefono && !validation.mittenteTelefono
                        ? 'Telefono non valido'
                        : undefined
                    }
                  />

                  <SmartInput
                    label="Email"
                    value={formData.mittenteEmail}
                    onChange={(v) => setFormData((prev) => ({ ...prev, mittenteEmail: v }))}
                    type="email"
                    placeholder="email@esempio.it"
                    isValid={validation.mittenteEmail}
                    errorMessage={
                      formData.mittenteEmail && !validation.mittenteEmail
                        ? 'Email non valida'
                        : undefined
                    }
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
                  errorMessage={
                    formData.destinatarioNome && !validation.destinatarioNome
                      ? 'Nome troppo corto'
                      : undefined
                  }
                />

                <SmartInput
                  label="Indirizzo"
                  value={formData.destinatarioIndirizzo}
                  onChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      destinatarioIndirizzo: v,
                    }))
                  }
                  required
                  placeholder="Via Milano 456"
                  icon={MapPin}
                  isValid={validation.destinatarioIndirizzo}
                  errorMessage={
                    formData.destinatarioIndirizzo && !validation.destinatarioIndirizzo
                      ? 'Indirizzo troppo corto'
                      : undefined
                  }
                />

                <AddressFields
                  label=""
                  cityValue={formData.destinatarioCitta}
                  provinceValue={formData.destinatarioProvincia}
                  postalCodeValue={formData.destinatarioCap}
                  onCityChange={handleDestinatarioCittaChange}
                  onProvinceChange={handleDestinatarioProvinciaChange}
                  onPostalCodeChange={handleDestinatarioCapChange}
                  cityValid={validation.destinatarioCitta}
                  provinceValid={validation.destinatarioProvincia}
                  postalCodeValid={validation.destinatarioCap}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <SmartInput
                    label="Telefono"
                    value={formData.destinatarioTelefono}
                    onChange={(v) =>
                      setFormData((prev) => ({
                        ...prev,
                        destinatarioTelefono: formatPhoneNumber(v),
                      }))
                    }
                    type="tel"
                    required
                    placeholder="+39 398 765 4321"
                    isValid={validation.destinatarioTelefono}
                    errorMessage={
                      formData.destinatarioTelefono && !validation.destinatarioTelefono
                        ? 'Telefono non valido'
                        : undefined
                    }
                  />

                  <SmartInput
                    label="Email"
                    value={formData.destinatarioEmail}
                    onChange={(v) => setFormData((prev) => ({ ...prev, destinatarioEmail: v }))}
                    type="email"
                    placeholder="email@esempio.it"
                    isValid={validation.destinatarioEmail}
                    errorMessage={
                      formData.destinatarioEmail && !validation.destinatarioEmail
                        ? 'Email non valida'
                        : undefined
                    }
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
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            peso: e.target.value,
                          }))
                        }
                        required
                        placeholder="0.00"
                        className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
                          validation.peso
                            ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                            : formData.peso
                              ? 'border-red-500 ring-2 ring-red-200 bg-red-50'
                              : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
                        } focus:outline-none placeholder:text-gray-500`}
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
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          lunghezza: e.target.value,
                        }))
                      }
                      placeholder="0.0"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium hover:border-gray-400 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md focus:outline-none placeholder:text-gray-500"
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
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          larghezza: e.target.value,
                        }))
                      }
                      placeholder="0.0"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium hover:border-gray-400 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md focus:outline-none placeholder:text-gray-500"
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
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          altezza: e.target.value,
                        }))
                      }
                      placeholder="0.0"
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium hover:border-gray-400 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md focus:outline-none placeholder:text-gray-500"
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
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tipoSpedizione: e.target.value,
                        }))
                      }
                      required
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium hover:border-gray-400 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md focus:outline-none placeholder:text-gray-500"
                    >
                      <option value="standard">📦 Standard</option>
                      <option value="express">⚡ Express</option>
                      <option value="assicurata">🛡️ Assicurata</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                      Note (opzionale)
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          note: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Note aggiuntive..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium hover:border-gray-400 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md focus:outline-none placeholder:text-gray-500 resize-none"
                    />
                  </div>
                </div>

                {/* Contrassegno (COD) - Campo numerico */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
                    💰 Contrassegno (COD - €){' '}
                    <span className="text-gray-400 text-xs">(opzionale)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.contrassegnoAmount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          contrassegnoAmount: value,
                        }));
                      }}
                      placeholder="0.00"
                      className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
                        formData.contrassegnoAmount && parseFloat(formData.contrassegnoAmount) > 0
                          ? validation.contrassegnoAmount
                            ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                            : 'border-red-500 ring-2 ring-red-200 bg-red-50'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
                      } focus:outline-none placeholder:text-gray-500`}
                    />
                    {formData.contrassegnoAmount &&
                      parseFloat(formData.contrassegnoAmount) > 0 &&
                      validation.contrassegnoAmount && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                    {formData.contrassegnoAmount &&
                      parseFloat(formData.contrassegnoAmount) > 0 &&
                      !validation.contrassegnoAmount && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                      )}
                  </div>
                  {formData.contrassegnoAmount &&
                    parseFloat(formData.contrassegnoAmount) > 0 &&
                    !formData.destinatarioTelefono && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Il telefono destinatario è obbligatorio per il contrassegno
                      </p>
                    )}
                </div>

                {/* ✨ Servizi Accessori spostati DOPO la selezione del corriere nel preventivatore */}
              </div>
            </SmartCard>
          </div>

          {/* RIGHT COLUMN - Live Ticket Preview (STICKY) */}
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
                  {formData.destinatarioCitta &&
                    formData.destinatarioProvincia &&
                    estimatedCost > 0 && (
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

                  {/* ✨ ENTERPRISE: Preventivatore Intelligente */}
                  <div className="pt-6 border-t border-gray-200">
                    {couriersLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        <span className="ml-2 text-sm text-gray-500">Caricamento corrieri...</span>
                      </div>
                    ) : availableCouriers.length > 0 ? (
                      <IntelligentQuoteComparator
                        key={`quote-comparator-${formResetCounter}`}
                        resetKey={formResetCounter}
                        useDbFirst={true} // ✨ ENTERPRISE: DB-first per sicurezza e performance
                        couriers={availableCouriers}
                        weight={formData.peso ? parseFloat(formData.peso) : 0}
                        zip={formData.destinatarioCap}
                        province={formData.destinatarioProvincia}
                        city={formData.destinatarioCitta}
                        services={formData.tipoSpedizione === 'express' ? ['express'] : []}
                        insuranceValue={0}
                        codValue={
                          formData.contrassegnoAmount && parseFloat(formData.contrassegnoAmount) > 0
                            ? parseFloat(formData.contrassegnoAmount)
                            : 0
                        }
                        dimensions={{
                          length: formData.lunghezza ? parseFloat(formData.lunghezza) : undefined,
                          width: formData.larghezza ? parseFloat(formData.larghezza) : undefined,
                          height: formData.altezza ? parseFloat(formData.altezza) : undefined,
                        }}
                        onQuoteReceived={(courierName, contractCode, quote) => {
                          setCourierQuotes((prev) => {
                            const next = new Map(prev);
                            next.set(`${courierName}::${contractCode}`, quote);
                            return next;
                          });

                          // ✨ ENTERPRISE: Se questo è il corriere selezionato, aggiorna il prezzo esatto
                          if (
                            formData.corriere === courierName &&
                            quote &&
                            quote.rates &&
                            quote.rates.length > 0
                          ) {
                            const bestRate = quote.rates[0];
                            const exactPrice = parseFloat(bestRate.total_price || '0');
                            // ✨ NUOVO: Aggiorna anche VAT context se quote selezionato (ADR-001)
                            setSelectedVATContext({
                              vat_mode: bestRate.vat_mode || null,
                              vat_rate: bestRate.vat_rate
                                ? parseFloat(bestRate.vat_rate)
                                : undefined,
                            });
                            setSelectedQuoteExactPrice((prev) => {
                              if (prev && prev.courierName === courierName) {
                                return { ...prev, price: exactPrice };
                              }
                              // Se non c'è ancora un quote selezionato, crealo
                              return {
                                courierName,
                                price: exactPrice,
                                contractCode,
                              };
                            });
                          }
                        }}
                        onContractSelected={(
                          courierName,
                          contractCode,
                          accessoryService,
                          configId, // ✨ ENTERPRISE: ConfigId della configurazione API
                          finalPrice // ✨ FIX: Prezzo finale dal comparatore (include servizi accessori)
                        ) => {
                          console.log('✅ [FORM] Corriere confermato dal preventivatore:', {
                            courierName,
                            contractCode,
                            accessoryService,
                            configId, // ✨ Salva configId per usarlo nella creazione
                            finalPrice, // ✨ FIX: Prezzo finale ricevuto dal comparatore
                          });
                          setFormData((prev) => ({
                            ...prev,
                            corriere: courierName,
                            serviziAccessori: accessoryService ? [accessoryService] : [],
                          }));
                          // ✨ ENTERPRISE: Salva configId per usarlo nella creazione spedizione
                          setSelectedConfigId(configId);

                          // ✨ FIX: Usa prezzo finale dal comparatore (già calcolato con servizi accessori)
                          console.log('🔍 [FORM] finalPrice ricevuto dal comparatore:', finalPrice);
                          if (finalPrice && finalPrice > 0) {
                            console.log(
                              '✅ [FORM] Settando selectedQuoteExactPrice con finalPrice:',
                              finalPrice
                            );
                            setSelectedQuoteExactPrice({
                              courierName,
                              price: finalPrice,
                              contractCode,
                            });
                          } else {
                            console.warn(
                              '⚠️ [FORM] finalPrice mancante o 0, cerco in courierQuotes'
                            );
                            // ✨ FALLBACK: Cerca quote in courierQuotes solo se finalPrice manca
                            const selectedQuote = courierQuotes.get(
                              `${courierName}::${contractCode}`
                            );
                            if (
                              selectedQuote &&
                              selectedQuote.rates &&
                              selectedQuote.rates.length > 0
                            ) {
                              const bestRate = selectedQuote.rates[0];
                              const exactPrice = parseFloat(bestRate.total_price || '0');
                              setSelectedQuoteExactPrice({
                                courierName,
                                price: exactPrice,
                                contractCode,
                              });
                              // ✨ NUOVO: Estrai VAT context dal quote selezionato (ADR-001)
                              setSelectedVATContext({
                                vat_mode: bestRate.vat_mode || null,
                                vat_rate: bestRate.vat_rate
                                  ? parseFloat(bestRate.vat_rate)
                                  : undefined,
                              });
                            } else {
                              // Se non abbiamo il quote, usa placeholder
                              setSelectedQuoteExactPrice({
                                courierName,
                                price: 0, // Placeholder, verrà aggiornato
                                contractCode,
                              });
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600">Nessun corriere disponibile</p>
                      </div>
                    )}
                  </div>

                  {/* ✨ NUOVO: Confronto Contratti (per reseller) - NASCOSTO quando IntelligentQuoteComparator è attivo */}
                  {false &&
                    formData.peso &&
                    parseFloat(formData.peso) > 0 &&
                    formData.destinatarioCap && (
                      <ContractComparison
                        weight={parseFloat(formData.peso)}
                        destination={{
                          zip: formData.destinatarioCap,
                          province: formData.destinatarioProvincia,
                          region: undefined,
                          country: 'IT',
                        }}
                        serviceType={formData.tipoSpedizione}
                        options={{
                          cashOnDelivery: !!(
                            formData.contrassegnoAmount &&
                            parseFloat(formData.contrassegnoAmount) > 0
                          ),
                          declaredValue:
                            formData.contrassegnoAmount &&
                            parseFloat(formData.contrassegnoAmount) > 0
                              ? parseFloat(formData.contrassegnoAmount)
                              : undefined,
                        }}
                        onSelectContract={(contractId, contractType) => {
                          setSelectedContractId(contractId);
                          setSelectedContractType(contractType);
                        }}
                        selectedContractId={selectedContractId}
                      />
                    )}

                  {/* ✨ RIMOSSA: Sezione Routing Corrieri - funzionalità già coperta dal preventivatore */}

                  {/* ✨ COSTO ESATTO: Mostra solo quando viene selezionato un corriere (sostituisce placeholder) */}
                  {formData.corriere &&
                    selectedQuoteExactPrice &&
                    selectedQuoteExactPrice.price > 0 && (
                      <div className="pt-6 border-t border-gray-200">
                        <div className="mb-4">
                          <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">
                            Costo Esatto
                          </p>
                          <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FF9500] to-[#E88500]">
                            {formatPrice(selectedQuoteExactPrice.price)}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">
                            Corriere: {selectedQuoteExactPrice.courierName}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Action Area */}
                  <div className="pt-6 border-t border-gray-200 space-y-3">
                    {/* ⚠️ Avviso se manca il corriere */}
                    {!formData.corriere && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>
                          <strong>Seleziona un corriere</strong> dalla tabella preventivi per
                          continuare
                        </span>
                      </div>
                    )}

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
                        className="px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-sm font-medium text-gray-900 bg-white"
                      >
                        <Save className="w-4 h-4" />
                        Salva Bozza
                      </button>
                      <button
                        type="button"
                        onClick={() => window.history.back()}
                        className="px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all flex items-center justify-center gap-2 text-sm font-medium text-gray-900 bg-white"
                      >
                        <X className="w-4 h-4" />
                        Annulla
                      </button>
                    </div>
                  </div>

                  {/* Error/Success Messages - Legacy (solo se Enterprise Feedback disabilitato) */}
                  {!useEnterpriseFeedback && submitError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                      {submitError}
                    </div>
                  )}

                  {!useEnterpriseFeedback && submitSuccess && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                      <div className="flex items-center gap-2 text-green-700 mb-2">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="font-semibold">Spedizione creata con successo!</span>
                      </div>
                      {createdTracking && (
                        <div className="mt-2 p-3 bg-white rounded-lg border border-green-200">
                          <div className="text-xs text-gray-600 mb-1">Tracking Number:</div>
                          <div className="text-lg font-mono font-bold text-green-700">
                            {createdTracking}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-green-600">
                        Il form verrà resettato tra poco per inserire una nuova spedizione...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Feedback UX Modals */}
      {useEnterpriseFeedback && (
        <>
          {/* Success Modal */}
          <SuccessModal
            open={showSuccessModal}
            onOpenChange={setShowSuccessModal}
            trackingNumber={createdShipmentData?.tracking || createdTracking || ''}
            courier={createdShipmentData?.courier}
            cost={createdShipmentData?.cost}
            onPrintLabel={() => {
              // Il download del PDF è già gestito nel handleSubmit
              // Chiudi modal
              setShowSuccessModal(false);
            }}
            onTrackShipment={() => {
              // Naviga a tracking page
              const tracking = createdShipmentData?.tracking || createdTracking;
              if (tracking) {
                window.open(`/track/${tracking}`, '_blank');
              }
              setShowSuccessModal(false);
            }}
            onCreateAnother={() => {
              // Il reset form è già schedulato nel handleSubmit
              // Chiudi modal per mostrare form pulito
              setShowSuccessModal(false);
              setSubmitSuccess(false);
              setCreatedTracking(null);
              setCreatedShipmentData(null);
            }}
          />

          {/* Error Dialog */}
          {formattedError && (
            <ErrorDialog
              open={showErrorDialog}
              onOpenChange={(open) => {
                setShowErrorDialog(open);
                if (!open) {
                  setSubmitError(null);
                  setFormattedError(null);
                }
              }}
              error={formattedError.error}
              actions={formattedError.actions}
              canRetry={formattedError.canRetry}
              onRetry={() => {
                // Reset errore e riprova submit
                setShowErrorDialog(false);
                setSubmitError(null);
                setFormattedError(null);
                // Trigger nuovo submit
                const form = document.querySelector('form');
                if (form) {
                  form.requestSubmit();
                }
              }}
              onAction={(action) => {
                // Gestisci azioni di recovery
                if (action.destination) {
                  router.push(action.destination);
                } else {
                  // Azioni locali (es. focus su campo)
                  switch (action.id) {
                    case 'select_courier':
                    case 'change_courier':
                      // Scroll al preventivatore
                      document.querySelector('[class*="IntelligentQuote"]')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                      break;
                    case 'fix_address':
                    case 'fix_sender':
                      // Scroll a mittente
                      document.querySelector('[class*="Mittente"]')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                      break;
                    case 'fix_recipient':
                      // Scroll a destinatario
                      document.querySelector('[class*="Destinatario"]')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                      break;
                  }
                }
                setShowErrorDialog(false);
              }}
              isRetrying={isSubmitting}
            />
          )}
        </>
      )}
    </div>
  );
}
