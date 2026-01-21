'use client';

/**
 * Integration Card Component
 *
 * Card per visualizzare e gestire le integrazioni e-commerce
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Settings, ExternalLink } from 'lucide-react';
import IntegrationDialog from './integration-dialog';

interface Platform {
  id: string;
  name: string;
  icon: any;
  description: string;
  color: string;
  credentials: Record<string, string>;
}

interface IntegrationCardProps {
  platform: Platform;
  status: 'connected' | 'disconnected';
  onConnect: () => void;
}

export default function IntegrationCard({ platform, status, onConnect }: IntegrationCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const Icon = platform.icon;

  return (
    <>
      <motion.div
        className="glass-strong rounded-xl p-6 border border-[#FACC15]/20 card-lift cursor-pointer"
        onClick={() => setIsDialogOpen(true)}
        whileHover={{
          scale: 1.02,
          borderColor: 'rgba(250, 204, 21, 0.5)',
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Header con Logo e Status */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-gradient-to-br ${platform.color} shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>

          {status === 'connected' ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/30">
              <CheckCircle2 className="w-4 h-4 text-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-400">Attivo</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-500/20 border border-gray-500/30">
              <XCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-400">Non Connesso</span>
            </div>
          )}
        </div>

        {/* Nome e Descrizione */}
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-100 mb-1">{platform.name}</h3>
          <p className="text-sm text-gray-400">{platform.description}</p>
        </div>

        {/* Footer con Azione */}
        <div className="flex items-center justify-between pt-4 border-t border-[#FACC15]/10">
          <span className="text-xs text-gray-500">
            {status === 'connected' ? 'Configurato' : 'Clicca per configurare'}
          </span>
          <Settings className="w-4 h-4 text-gray-400" />
        </div>
      </motion.div>

      {/* Dialog per Configurazione */}
      <IntegrationDialog
        platform={platform}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={onConnect}
        status={status}
      />
    </>
  );
}
