'use client';

/**
 * Universal Widget Card Component
 *
 * Card speciale per il Universal Tracking Widget
 * con codice HTML/JS copiabile
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, Code, Zap, ExternalLink } from 'lucide-react';
import { useSession } from 'next-auth/react';

export default function UniversalWidgetCard() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  // Genera widget code con user ID
  const userId = session?.user?.email || 'YOUR_USER_ID';
  const widgetCode = `<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://widget.spediresicuro.it/v1/loader.js';
    s.setAttribute('data-user-id', '${userId}');
    s.setAttribute('data-api-key', 'YOUR_API_KEY');
    s.async = true;
    document.head.appendChild(s);
  })();
</script>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(widgetCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Errore copia:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-xl p-8 border-2 border-[#FACC15]/50 relative overflow-hidden"
    >
      {/* Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#FACC15]/10 via-transparent to-[#FACC15]/10 opacity-50" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-[#FACC15] to-[#FBBF24] rounded-xl shadow-lg">
              <Zap className="w-8 h-8 text-[#09090b]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-1 flex items-center gap-2">
                Universal Tracking Widget
                <span className="px-2 py-0.5 text-xs font-semibold bg-[#FACC15] text-[#09090b] rounded-full">
                  BETA
                </span>
              </h2>
              <p className="text-sm text-gray-400">
                Inserisci questo codice nel footer del tuo sito per abilitare il tracking e i
                preventivi istantanei
              </p>
            </div>
          </div>
        </div>

        {/* Codice Widget */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Code className="w-4 h-4" />
              Codice Widget
            </label>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 glass border border-[#FACC15]/30 text-[#FACC15] rounded-lg hover:bg-[#FACC15]/10 transition-colors flex items-center gap-2 text-sm"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copiato!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copia
                </>
              )}
            </button>
          </div>
          <div className="relative">
            <pre className="p-4 bg-[#0f0f11] border border-[#FACC15]/20 rounded-lg overflow-x-auto">
              <code className="text-xs text-gray-300 font-mono">{widgetCode}</code>
            </pre>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3 p-4 glass-subtle rounded-lg">
            <div className="p-2 bg-[#FACC15]/20 rounded-lg">
              <Zap className="w-5 h-5 text-[#FACC15]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100 mb-1">Tracking Automatico</h3>
              <p className="text-xs text-gray-400">
                Rileva automaticamente gli ordini dal tuo store
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 glass-subtle rounded-lg">
            <div className="p-2 bg-[#FACC15]/20 rounded-lg">
              <Code className="w-5 h-5 text-[#FACC15]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100 mb-1">Preventivi Istantanei</h3>
              <p className="text-xs text-gray-400">
                Calcola preventivi in tempo reale nel checkout
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 glass-subtle rounded-lg">
            <div className="p-2 bg-[#FACC15]/20 rounded-lg">
              <ExternalLink className="w-5 h-5 text-[#FACC15]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-100 mb-1">Zero Configurazione</h3>
              <p className="text-xs text-gray-400">Funziona con qualsiasi piattaforma e-commerce</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
