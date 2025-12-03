'use client'

/**
 * Pagina Integrazioni - Command Center
 * 
 * Centro di controllo per collegare store e-commerce e configurare
 * il Universal Widget per importare ordini in 1 click.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import DashboardNav from '@/components/dashboard-nav'
import IntegrationCard from '@/components/integrazioni/integration-card'
import UniversalWidgetCard from '@/components/integrazioni/universal-widget-card'
import SpedisciOnlineConfigMulti from '@/components/integrazioni/spedisci-online-config-multi'
import { 
  ShoppingBag, 
  Store, 
  Zap,
  Code
} from 'lucide-react'

// Piattaforme supportate
const platforms = [
  {
    id: 'shopify',
    name: 'Shopify',
    icon: Store,
    description: 'Collega il tuo store Shopify',
    color: 'from-green-500 to-emerald-600',
    credentials: {
      store_url: '',
      access_token: '',
    } as Record<string, string>,
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    icon: ShoppingBag,
    description: 'Integra il tuo negozio WooCommerce',
    color: 'from-blue-500 to-indigo-600',
    credentials: {
      store_url: '',
      api_key: '',
      api_secret: '',
    } as Record<string, string>,
  },
  {
    id: 'amazon',
    name: 'Amazon',
    icon: Store,
    description: 'Connetti Amazon Seller Central',
    color: 'from-yellow-500 to-orange-600',
    credentials: {
      lwa_client_id: '',
      lwa_client_secret: '',
      lwa_refresh_token: '',
      aws_access_key: '',
      aws_secret_key: '',
      seller_id: '',
      region: 'eu-west-1',
    } as Record<string, string>,
  },
  {
    id: 'magento',
    name: 'Magento',
    icon: Store,
    description: 'Connetti il tuo store Magento',
    color: 'from-orange-500 to-red-600',
    credentials: {
      store_url: '',
      access_token: '',
    } as Record<string, string>,
  },
  {
    id: 'prestashop',
    name: 'PrestaShop',
    icon: Store,
    description: 'Integra PrestaShop',
    color: 'from-purple-500 to-pink-600',
    credentials: {
      store_url: '',
      api_key: '',
      api_secret: '',
    } as Record<string, string>,
  },
  {
    id: 'custom',
    name: 'Custom API',
    icon: Code,
    description: 'Collega tramite API personalizzata',
    color: 'from-gray-500 to-slate-600',
    credentials: {
      store_url: '',
      api_key: '',
      api_secret: '',
    } as Record<string, string>,
  },
] as const

// Varianti animazione container
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

// Varianti animazione card
const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 20,
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
}

export default function IntegrazioniPage() {
  const [integrations, setIntegrations] = useState<any[]>([])

  // Carica integrazioni esistenti
  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      const { getIntegrations } = await import('@/lib/actions/integrations')
      const result = await getIntegrations()
      if (result.success) {
        setIntegrations(result.integrations || [])
      }
    } catch (err) {
      console.error('Errore caricamento integrazioni:', err)
    }
  }

  const getIntegrationStatus = (platformId: string) => {
    const integration = integrations.find(i => i.platform === platformId)
    return integration ? 'connected' : 'disconnected'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav 
        title="Integrazioni Store & Widget"
        subtitle="Collega il tuo e-commerce o usa il nostro Universal Widget per importare ordini in 1 click"
      />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* Universal Widget - Card Speciale */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <UniversalWidgetCard />
        </motion.div>

        {/* Sezione API Corrieri - Configurazione Credenziali Spedisci.Online */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <SpedisciOnlineConfigMulti />
        </motion.div>

        {/* Grid Integrazioni */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {platforms.map((platform) => {
            const Icon = platform.icon
            const status = getIntegrationStatus(platform.id)
            
            return (
              <motion.div
                key={platform.id}
                variants={cardVariants}
                whileHover={{ scale: 1.02 }}
                className="w-full"
              >
                <IntegrationCard
                  platform={platform}
                  status={status}
                  onConnect={loadIntegrations}
                />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}

