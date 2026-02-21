'use client';

/**
 * Pagina Configurazioni Corrieri
 *
 * Centro di configurazione API corrieri con wizard guidati.
 * Accessibile a tutti gli utenti (user, reseller, BYOC, admin).
 */

import { motion } from 'framer-motion';
import DashboardNav from '@/components/dashboard-nav';
import CourierAPIConfig from '@/components/integrazioni/courier-api-config';

export default function ConfigurazioniCorrieriPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav
        title="Configurazioni Corrieri"
        subtitle="Configura le credenziali API dei corrieri. Usa i wizard guidati per collegare SpedisciOnline, SpediamoPro, Poste e altri."
      />

      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <CourierAPIConfig />
        </motion.div>
      </div>
    </div>
  );
}
