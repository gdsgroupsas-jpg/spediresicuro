'use client'

/**
 * Form API Corrieri - Creazione LDV
 * 
 * Form completo per creare spedizioni e generare LDV tramite API corrieri
 */

import { useState } from 'react'
import { 
  Package, 
  User, 
  MapPin, 
  Truck, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download
} from 'lucide-react'
import { createShipmentWithOrchestrator } from '@/lib/actions/spedisci-online'

interface FormData {
  // Mittente
  sender_name: string
  sender_address: string
  sender_city: string
  sender_province: string
  sender_zip: string
  sender_country: string
  sender_phone: string
  sender_email: string

  // Destinatario
  recipient_name: string
  recipient_address: string
  recipient_city: string
  recipient_province: string
  recipient_zip: string
  recipient_country: string
  recipient_phone: string
  recipient_email: string
  recipient_type: 'B2C' | 'B2B'

  // Pacco
  weight: string
  length: string
  width: string
  height: string
  packages_count: string

  // Servizio
  courier_id: string
  service_type: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day'
  
  // Valore
  declared_value: string
  currency: string
  
  // Servizi aggiuntivi
  cash_on_delivery: boolean
  cash_on_delivery_amount: string
  insurance: boolean
  
  // Note
  notes: string
}

export default function CourierAPIForm() {
  const [formData, setFormData] = useState<FormData>({
    // Mittente
    sender_name: '',
    sender_address: '',
    sender_city: '',
    sender_province: '',
    sender_zip: '',
    sender_country: 'IT',
    sender_phone: '',
    sender_email: '',

    // Destinatario
    recipient_name: '',
    recipient_address: '',
    recipient_city: '',
    recipient_province: '',
    recipient_zip: '',
    recipient_country: 'IT',
    recipient_phone: '',
    recipient_email: '',
    recipient_type: 'B2C',

    // Pacco
    weight: '',
    length: '',
    width: '',
    height: '',
    packages_count: '1',

    // Servizio
    courier_id: 'spedisci_online',
    service_type: 'standard',
    
    // Valore
    declared_value: '',
    currency: 'EUR',
    
    // Servizi aggiuntivi
    cash_on_delivery: false,
    cash_on_delivery_amount: '',
    insurance: false,
    
    // Note
    notes: '',
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message?: string
    tracking_number?: string
    label_url?: string
    error?: string
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setResult(null)

    try {
      // Prepara dati spedizione
      const shipmentData = {
        // Mittente
        sender_name: formData.sender_name,
        sender_address: formData.sender_address,
        sender_city: formData.sender_city,
        sender_province: formData.sender_province,
        sender_zip: formData.sender_zip,
        sender_country: formData.sender_country,
        sender_phone: formData.sender_phone,
        sender_email: formData.sender_email,

        // Destinatario
        recipient_name: formData.recipient_name,
        recipient_address: formData.recipient_address,
        recipient_city: formData.recipient_city,
        recipient_province: formData.recipient_province,
        recipient_zip: formData.recipient_zip,
        recipient_country: formData.recipient_country,
        recipient_phone: formData.recipient_phone,
        recipient_email: formData.recipient_email,
        recipient_type: formData.recipient_type,

        // Pacco
        weight: parseFloat(formData.weight) || 1,
        length: formData.length ? parseFloat(formData.length) : undefined,
        width: formData.width ? parseFloat(formData.width) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        packages_count: parseInt(formData.packages_count) || 1,

        // Servizio
        courier_id: formData.courier_id,
        service_type: formData.service_type,
        
        // Valore
        declared_value: formData.declared_value ? parseFloat(formData.declared_value) : undefined,
        currency: formData.currency,
        
        // Servizi aggiuntivi
        cash_on_delivery: formData.cash_on_delivery,
        cash_on_delivery_amount: formData.cash_on_delivery_amount ? parseFloat(formData.cash_on_delivery_amount) : undefined,
        insurance: formData.insurance,
        
        // Note
        notes: formData.notes,
      }

      // Chiama API per creare spedizione e LDV
      const response = await fetch('/api/spedizioni', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...shipmentData,
          corriere: formData.courier_id,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResult({
          success: true,
          message: 'Spedizione creata con successo!',
          tracking_number: data.data?.tracking || data.ldv?.tracking_number,
          label_url: data.ldv?.label_url,
        })
      } else {
        setResult({
          success: false,
          error: data.error || data.message || 'Errore durante la creazione della spedizione',
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || 'Errore durante la creazione della spedizione',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Truck className="w-6 h-6 text-blue-600" />
          Creazione LDV tramite API Corrieri
        </h2>
        <p className="text-gray-600">
          Compila il form per creare una spedizione e generare la Lettera di Vettura tramite API del corriere selezionato.
        </p>
      </div>

      {result && (
        <div className={`mb-6 p-4 rounded-xl border ${
          result.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-semibold">{result.success ? 'Successo!' : 'Errore'}</p>
              <p className="text-sm mt-1">{result.message || result.error}</p>
              {result.tracking_number && (
                <p className="text-sm mt-2 font-mono bg-white/50 px-2 py-1 rounded">
                  Tracking: {result.tracking_number}
                </p>
              )}
              {result.label_url && (
                <a
                  href={result.label_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-2 text-sm font-medium hover:underline"
                >
                  <Download className="w-4 h-4" />
                  Scarica LDV
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Mittente */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Dati Mittente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sender_name}
                onChange={(e) => updateField('sender_name', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Indirizzo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sender_address}
                onChange={(e) => updateField('sender_address', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Città <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sender_city}
                onChange={(e) => updateField('sender_city', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provincia <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sender_province}
                onChange={(e) => updateField('sender_province', e.target.value)}
                required
                maxLength={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CAP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.sender_zip}
                onChange={(e) => updateField('sender_zip', e.target.value)}
                required
                maxLength={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Paese
              </label>
              <input
                type="text"
                value={formData.sender_country}
                onChange={(e) => updateField('sender_country', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono
              </label>
              <input
                type="tel"
                value={formData.sender_phone}
                onChange={(e) => updateField('sender_phone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.sender_email}
                onChange={(e) => updateField('sender_email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Destinatario */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            Dati Destinatario
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipient_name}
                onChange={(e) => updateField('recipient_name', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Indirizzo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipient_address}
                onChange={(e) => updateField('recipient_address', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Città <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipient_city}
                onChange={(e) => updateField('recipient_city', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provincia <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipient_province}
                onChange={(e) => updateField('recipient_province', e.target.value)}
                required
                maxLength={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CAP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.recipient_zip}
                onChange={(e) => updateField('recipient_zip', e.target.value)}
                required
                maxLength={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo Destinatario
              </label>
              <select
                value={formData.recipient_type}
                onChange={(e) => updateField('recipient_type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="B2C">Privato (B2C)</option>
                <option value="B2B">Azienda (B2B)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.recipient_phone}
                onChange={(e) => updateField('recipient_phone', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.recipient_email}
                onChange={(e) => updateField('recipient_email', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Pacco */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            Dati Pacco
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peso (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={formData.weight}
                onChange={(e) => updateField('weight', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lunghezza (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.length}
                onChange={(e) => updateField('length', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Larghezza (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.width}
                onChange={(e) => updateField('width', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Altezza (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.height}
                onChange={(e) => updateField('height', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Numero Colli
              </label>
              <input
                type="number"
                min="1"
                value={formData.packages_count}
                onChange={(e) => updateField('packages_count', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Servizio */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            Servizio di Spedizione
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Corriere <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.courier_id}
                onChange={(e) => updateField('courier_id', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="spedisci_online">Spedisci.Online</option>
                <option value="gls">GLS</option>
                <option value="brt">BRT</option>
                <option value="poste">Poste Italiane</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo Servizio
              </label>
              <select
                value={formData.service_type}
                onChange={(e) => updateField('service_type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="standard">Standard</option>
                <option value="express">Express</option>
                <option value="economy">Economy</option>
                <option value="same_day">Stesso Giorno</option>
                <option value="next_day">Giorno Successivo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valore Dichiarato (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.declared_value}
                onChange={(e) => updateField('declared_value', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Valuta
              </label>
              <select
                value={formData.currency}
                onChange={(e) => updateField('currency', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>
        </div>

        {/* Servizi Aggiuntivi */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Servizi Aggiuntivi</h3>
          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.cash_on_delivery}
                onChange={(e) => updateField('cash_on_delivery', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Contrassegno</span>
            </label>
            {formData.cash_on_delivery && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importo Contrassegno (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cash_on_delivery_amount}
                  onChange={(e) => updateField('cash_on_delivery_amount', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.insurance}
                onChange={(e) => updateField('insurance', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Assicurazione</span>
            </label>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creazione in corso...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Crea Spedizione e Genera LDV
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

