/**
 * Dynamic Features Section
 *
 * Sezione features con:
 * - Scroll-triggered animations
 * - 3D card hover effects
 * - Staggered animations
 * - Interactive icons
 */

'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Zap,
  Shield,
  Clock,
  TrendingUp,
  Globe,
  Sparkles,
  Bot,
  Camera,
  FileText,
  Truck
} from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: '10 Secondi',
    description: 'Da screenshot a etichetta pronta. Zero form da compilare, zero stress, zero errori.',
    gradient: 'from-amber-500 to-orange-600',
    shadowColor: 'shadow-amber-500/25',
    stat: '90%',
    statLabel: 'tempo risparmiato'
  },
  {
    icon: Bot,
    title: 'Annie AI',
    description: 'La tua assistente personale che legge, comprende e compila automaticamente ogni spedizione.',
    gradient: 'from-violet-500 to-purple-600',
    shadowColor: 'shadow-violet-500/25',
    stat: '99.7%',
    statLabel: 'accuratezza'
  },
  {
    icon: Camera,
    title: 'OCR Avanzato',
    description: 'Riconosce testo da foto, screenshot, documenti. Anche scritte a mano.',
    gradient: 'from-cyan-500 to-blue-600',
    shadowColor: 'shadow-cyan-500/25',
    stat: '50+',
    statLabel: 'formati supportati'
  },
  {
    icon: Shield,
    title: '100% Sicuro',
    description: 'Dati protetti GDPR, crittografia end-to-end, server in Europa. Privacy garantita.',
    gradient: 'from-emerald-500 to-green-600',
    shadowColor: 'shadow-emerald-500/25',
    stat: 'GDPR',
    statLabel: 'compliant'
  },
  {
    icon: Globe,
    title: 'Tutta Italia',
    description: 'Validazione automatica di ogni indirizzo italiano. CAP, comuni, frazioni inclusi.',
    gradient: 'from-rose-500 to-pink-600',
    shadowColor: 'shadow-rose-500/25',
    stat: '8.000+',
    statLabel: 'comuni coperti'
  },
  {
    icon: TrendingUp,
    title: 'Risparmia',
    description: 'Confronta prezzi di tutti i corrieri in tempo reale. Scegli sempre il migliore.',
    gradient: 'from-indigo-500 to-blue-600',
    shadowColor: 'shadow-indigo-500/25',
    stat: '-35%',
    statLabel: 'sui costi medi'
  },
];

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

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export default function FeaturesDynamic() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section
      ref={sectionRef}
      className="relative py-32 bg-white overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#09090b] to-transparent" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-amber-100 rounded-full blur-[150px] opacity-50" />
        <div className="absolute bottom-1/4 left-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-[150px] opacity-50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={isInView ? { scale: 1, opacity: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 mb-6"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Funzionalita Premium</span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Tutto cio di cui hai{' '}
            <span className="relative">
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                bisogno
              </span>
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <motion.path
                  d="M2 10C50 2 150 2 198 10"
                  stroke="url(#gradient)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={isInView ? { pathLength: 1 } : {}}
                  transition={{ duration: 1, delay: 0.5 }}
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h2>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Strumenti potenti, interfaccia semplice. Tutto progettato per farti risparmiare tempo.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${feature.gradient} rounded-3xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />

                <div className="relative h-full p-8 rounded-3xl bg-white border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden">
                  {/* Decorative corner */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.gradient} opacity-5 rounded-bl-full`} />

                  {/* Icon */}
                  <div className={`relative inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.gradient} ${feature.shadowColor} shadow-lg mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  {/* Content */}
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-all duration-300">
                    {feature.title}
                  </h3>

                  <p className="text-gray-600 leading-relaxed mb-6">
                    {feature.description}
                  </p>

                  {/* Stat */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <span className={`text-2xl font-bold bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>
                      {feature.stat}
                    </span>
                    <span className="text-sm text-gray-500">{feature.statLabel}</span>
                  </div>

                  {/* Hover line */}
                  <div className={`absolute bottom-0 left-0 w-0 h-1 bg-gradient-to-r ${feature.gradient} group-hover:w-full transition-all duration-500`} />
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-gray-500 mb-4">E molto altro ancora...</p>
          <div className="inline-flex items-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>24/7 Disponibile</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4" />
              <span>Multi-corriere</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
