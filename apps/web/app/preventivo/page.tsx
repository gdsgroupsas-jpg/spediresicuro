'use client';

/**
 * Pagina Preventivo - World-Class Design
 *
 * Conversion path ottimizzato con:
 * - Form dati spedizione
 * - Card corrieri con animazioni a cascata (framer-motion)
 * - Stile cruscotto finanziario per prezzi
 * - Micro-interazioni e feedback visivo
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent, FinancialDisplay } from '@/components/ui/card';
import { Truck, Package, MapPin, Euro } from 'lucide-react';

// Dati mock per i corrieri (simulazione)
const corrieriMock = [
  {
    id: 'dhl',
    nome: 'DHL Express',
    prezzo: 24.9,
    tempo: '24-48h',
    status: 'success' as const,
    icon: Truck,
  },
  {
    id: 'bartolini',
    nome: 'Bartolini',
    prezzo: 18.5,
    tempo: '2-3 giorni',
    status: 'info' as const,
    icon: Package,
  },
  {
    id: 'sda',
    nome: 'SDA Express',
    prezzo: 22.0,
    tempo: '1-2 giorni',
    status: 'warning' as const,
    icon: Truck,
  },
  {
    id: 'poste',
    nome: 'Poste Italiane',
    prezzo: 12.9,
    tempo: '3-5 giorni',
    status: 'info' as const,
    icon: Package,
  },
];

// Varianti animazione per container
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Varianti animazione per card corriere
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
};

export default function PreventivoPage() {
  const [peso, setPeso] = useState('');
  const [cittaDestino, setCittaDestino] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  // Funzione per calcolare il preventivo (simulazione con pricing realistico)
  const handleCalculate = () => {
    if (!peso || !cittaDestino) return;

    setIsCalculating(true);
    // Simula un breve delay per feedback UX
    setTimeout(() => {
      setShowResults(true);
      setIsCalculating(false);
    }, 800);
  };

  // Calcola prezzi dinamici basati sul peso
  const getPriceForWeight = (basePrice: number) => {
    const pesoNum = parseFloat(peso) || 1;
    if (pesoNum <= 1) return basePrice;
    if (pesoNum <= 5) return basePrice + (pesoNum - 1) * 2.5;
    if (pesoNum <= 10) return basePrice + 10 + (pesoNum - 5) * 2;
    return basePrice + 20 + (pesoNum - 10) * 1.5;
  };

  return (
    <div className="min-h-screen bg-[#09090b] py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* Noise texture overlay già applicato via globals.css */}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 gradient-animated">
            Calcola Preventivo
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Inserisci i dati della spedizione e confronta i migliori corrieri disponibili
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form Sinistra */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-1"
          >
            <Card glass>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#FACC15]" />
                  Dati Spedizione
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Peso (kg)</label>
                  <input
                    type="number"
                    value={peso}
                    onChange={(e) => setPeso(e.target.value)}
                    placeholder="Es. 2.5"
                    className="w-full px-4 py-2.5 bg-[#0f0f11] border border-[#FACC15]/20 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#FACC15] glow-on-focus transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Città Destino
                  </label>
                  <input
                    type="text"
                    value={cittaDestino}
                    onChange={(e) => setCittaDestino(e.target.value)}
                    placeholder="Es. Milano"
                    className="w-full px-4 py-2.5 bg-[#0f0f11] border border-[#FACC15]/20 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#FACC15] glow-on-focus transition-all"
                  />
                </div>
                <button
                  onClick={handleCalculate}
                  disabled={!peso || !cittaDestino || isCalculating}
                  className="w-full bg-gradient-to-r from-[#FACC15] to-[#FBBF24] text-[#09090b] px-6 py-3 rounded-lg font-bold btn-tactile flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {isCalculating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-[#09090b] border-t-transparent rounded-full animate-spin" />
                      Calcolo in corso...
                    </>
                  ) : (
                    <>
                      <Euro className="w-5 h-5" />
                      Calcola Preventivi
                    </>
                  )}
                </button>
                {(!peso || !cittaDestino) && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Inserisci peso e destinazione per calcolare
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Card Corrieri Destra - Animazione a Cascata */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={showResults ? 'visible' : 'hidden'}
            className="lg:col-span-2 space-y-4"
          >
            {!showResults ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <div className="text-center">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Inserisci i dati della spedizione</p>
                  <p className="text-sm">per visualizzare i preventivi disponibili</p>
                </div>
              </div>
            ) : (
              <>
                {/* Header risultati */}
                <div className="mb-4 p-4 bg-[#FACC15]/10 border border-[#FACC15]/20 rounded-lg">
                  <p className="text-[#FACC15] font-semibold">
                    Preventivi per spedizione di {peso} kg verso {cittaDestino}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Prezzi indicativi IVA esclusa - tariffe definitive alla conferma
                  </p>
                </div>
                {corrieriMock.map((corriere, index) => {
                  const Icon = corriere.icon;
                  const calculatedPrice = getPriceForWeight(corriere.prezzo);
                  return (
                    <motion.div
                      key={corriere.id}
                      variants={cardVariants}
                      whileHover={{ scale: 1.02 }}
                      className="w-full"
                    >
                      <Card hover glass>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="p-3 bg-gradient-to-br from-[#FACC15]/20 to-[#FBBF24]/20 rounded-lg border border-[#FACC15]/30">
                              <Icon className="w-6 h-6 text-[#FACC15]" />
                            </div>
                            <div className="flex-1">
                              <CardHeader className="p-0 mb-2">
                                <CardTitle className="text-xl">{corriere.nome}</CardTitle>
                              </CardHeader>
                              <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {corriere.tempo}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono-numbers text-2xl font-bold text-gray-100 mb-1">
                              € {calculatedPrice.toFixed(2).replace('.', ',')}
                            </div>
                            <span className={`status-badge status-${corriere.status}`}>
                              {corriere.status === 'success'
                                ? 'Consigliato'
                                : corriere.status === 'warning'
                                  ? 'Popolare'
                                  : 'Disponibile'}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
