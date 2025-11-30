'use client'

/**
 * Integration Dialog Component
 * 
 * Dialog per inserire e configurare le credenziali delle integrazioni
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  X, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  TestTube
} from 'lucide-react'
import { testIntegration, saveIntegration } from '@/lib/actions/integrations'

interface Platform {
  id: string
  name: string
  icon: any
  description: string
  color: string
  credentials: Record<string, string>
}

interface IntegrationDialogProps {
  platform: Platform
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  status: 'connected' | 'disconnected'
}

// Schema validazione per URL
const urlSchema = z.string().url('URL non valido').or(z.literal(''))

// Schema base per credenziali
const baseCredentialsSchema = z.object({
  store_url: urlSchema,
})

// Schema per Shopify
const shopifySchema = z.object({
  store_url: z.string().min(1, 'Shop URL obbligatorio'),
  access_token: z.string().min(1, 'Access Token obbligatorio'),
})

// Schema per WooCommerce
const woocommerceSchema = baseCredentialsSchema.extend({
  api_key: z.string().min(1, 'Consumer Key obbligatorio'),
  api_secret: z.string().min(1, 'Consumer Secret obbligatorio'),
})

// Schema per Magento
const magentoSchema = baseCredentialsSchema.extend({
  access_token: z.string().min(1, 'Access Token obbligatorio'),
})

// Schema per PrestaShop
const prestashopSchema = baseCredentialsSchema.extend({
  api_key: z.string().min(1, 'API Key obbligatoria'),
  api_secret: z.string().min(1, 'API Secret obbligatorio'),
})

// Schema per Amazon
const amazonSchema = z.object({
  lwa_client_id: z.string().min(1, 'LWA Client ID obbligatorio'),
  lwa_client_secret: z.string().min(1, 'LWA Client Secret obbligatorio'),
  lwa_refresh_token: z.string().min(1, 'LWA Refresh Token obbligatorio'),
  aws_access_key: z.string().min(1, 'AWS Access Key obbligatorio'),
  aws_secret_key: z.string().min(1, 'AWS Secret Key obbligatorio'),
  seller_id: z.string().min(1, 'Seller ID obbligatorio'),
  region: z.string().default('eu-west-1'),
})

// Schema per Custom API
const customSchema = baseCredentialsSchema.extend({
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
})

function getSchemaForPlatform(platformId: string) {
  switch (platformId) {
    case 'shopify':
      return shopifySchema
    case 'woocommerce':
      return woocommerceSchema
    case 'magento':
      return magentoSchema
    case 'prestashop':
      return prestashopSchema
    case 'amazon':
      return amazonSchema
    case 'custom':
      return customSchema
    default:
      return baseCredentialsSchema
  }
}

export default function IntegrationDialog({
  platform,
  isOpen,
  onClose,
  onSuccess,
  status,
}: IntegrationDialogProps) {
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const schema = getSchemaForPlatform(platform.id)
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: platform.credentials,
  })

  if (!isOpen) return null

  const handleTest = async (data: any) => {
    setIsTesting(true)
    setTestResult(null)
    setError(null)

    try {
      const result = await testIntegration(platform.id, data)

      if (result.success) {
        setTestResult({ success: true, message: result.message || 'Connessione riuscita!' })
      } else {
        setTestResult({ success: false, message: result.error || 'Impossibile connettersi allo shop. Controlla i dati.' })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Errore durante il test' })
    } finally {
      setIsTesting(false)
    }
  }

  const onSubmit = async (data: any) => {
    setIsSaving(true)
    setError(null)
    setTestResult(null)

    try {
      // Salva usando Server Action (che testa automaticamente la connessione)
      const result = await saveIntegration(platform.id, data)

      if (result.success) {
        onSuccess()
        onClose()
        reset()
      } else {
        setError(result.error || 'Errore durante il salvataggio')
        // Mostra anche come test result se è un errore di connessione
        if (result.error?.includes('connettersi')) {
          setTestResult({ success: false, message: result.error })
        }
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio')
    } finally {
      setIsSaving(false)
    }
  }

  const getFieldLabel = (key: string) => {
    const labels: Record<string, string> = {
      store_url: platform.id === 'shopify' ? 'Shop URL' : 'URL Sito',
      access_token: 'Access Token',
      api_key: platform.id === 'woocommerce' ? 'Consumer Key' : 'API Key',
      api_secret: platform.id === 'woocommerce' ? 'Consumer Secret' : 'API Secret',
      // Amazon
      lwa_client_id: 'LWA Client ID',
      lwa_client_secret: 'LWA Client Secret',
      lwa_refresh_token: 'LWA Refresh Token',
      aws_access_key: 'AWS Access Key',
      aws_secret_key: 'AWS Secret Key',
      seller_id: 'Seller ID',
      region: 'Region',
    }
    return labels[key] || key
  }

  const getFieldPlaceholder = (key: string) => {
    const placeholders: Record<string, string> = {
      store_url: platform.id === 'shopify' ? 'mystore.myshopify.com' : 'https://example.com',
      access_token: 'shpat_xxxxxxxxxxxxx',
      api_key: 'ck_xxxxxxxxxxxxx',
      api_secret: 'cs_xxxxxxxxxxxxx',
      // Amazon
      lwa_client_id: 'amzn1.application-oa2-client.xxxxx',
      lwa_client_secret: 'xxxxxxxxxxxxx',
      lwa_refresh_token: 'Atzr|xxxxxxxxxxxxx',
      aws_access_key: 'AKIAIOSFODNN7EXAMPLE',
      aws_secret_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      seller_id: 'A1EXAMPLE123',
      region: 'eu-west-1',
    }
    return placeholders[key] || ''
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#FACC15]/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#FACC15]/10">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{platform.name}</h2>
            <p className="text-sm text-gray-400 mt-1">{platform.description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#FACC15]/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {error && (
            <div className="p-4 glass border border-red-500/30 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {testResult && (
            <div className={`p-4 glass border rounded-lg flex items-start gap-3 ${
              testResult.success 
                ? 'border-green-500/30' 
                : 'border-red-500/30'
            }`}>
              {testResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${
                testResult.success ? 'text-green-300' : 'text-red-300'
              }`}>
                {testResult.message}
              </p>
            </div>
          )}

          {/* Campi Credenziali */}
          {Object.keys(platform.credentials).map((key) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {getFieldLabel(key)}
                {(key === 'store_url' || key.includes('lwa_') || key.includes('aws_') || key === 'seller_id' || key === 'api_key' || key === 'api_secret' || key === 'access_token') && (
                  <span className="text-red-400 ml-1">*</span>
                )}
              </label>
              <input
                type={key.includes('secret') || key.includes('token') ? 'password' : 'text'}
                {...register(key)}
                placeholder={getFieldPlaceholder(key)}
                className="w-full px-4 py-2.5 bg-[#0f0f11] border border-[#FACC15]/20 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#FACC15] glow-on-focus transition-all"
              />
              {errors[key] && (
                <p className="text-xs text-red-400 mt-1">{errors[key]?.message as string}</p>
              )}
            </div>
          ))}

          {/* Azioni */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-[#FACC15]/10">
            <button
              type="button"
              onClick={handleSubmit(handleTest)}
              disabled={isTesting || isSaving}
              className="px-4 py-2 glass border border-[#FACC15]/30 text-[#FACC15] rounded-lg hover:bg-[#FACC15]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Test in corso...
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4" />
                  Test Connessione
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 glass border border-gray-500/30 text-gray-300 rounded-lg hover:bg-gray-500/10 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isSaving || isTesting}
                className="px-6 py-2 bg-gradient-to-r from-[#FACC15] to-[#FBBF24] text-[#09090b] font-bold rounded-lg shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 btn-tactile"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {status === 'connected' ? 'Aggiorna' : 'Connetti'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

