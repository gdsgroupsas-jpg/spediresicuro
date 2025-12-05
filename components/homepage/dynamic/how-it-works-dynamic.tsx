/**
 * Dynamic How It Works Section
 *
 * Sezione interattiva che mostra il processo:
 * - Step-by-step animato
 * - Progress bar che segue lo scroll
 * - Demo interattiva
 */

'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Sparkles,
  CheckCircle,
  Printer,
  ArrowRight,
  Image,
  MessageSquare,
  Mail,
  FileText
} from 'lucide-react';

const steps = [
  {
    number: '01',
    title: 'Carica Qualsiasi Cosa',
    description: 'Screenshot WhatsApp, foto del pacco, email, documento. Annie capisce tutto.',
    icon: Upload,
    gradient: 'from-blue-500 to-cyan-500',
    examples: [
      { icon: Image, label: 'Screenshot' },
      { icon: MessageSquare, label: 'WhatsApp' },
      { icon: Mail, label: 'Email' },
      { icon: FileText, label: 'Documento' },
    ]
  },
  {
    number: '02',
    title: 'Annie AI Elabora',
    description: 'La nostra AI legge, estrae i dati, valida l\'indirizzo e trova il corriere migliore.',
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-500',
    features: ['OCR Avanzato', 'Validazione Indirizzo', 'Confronto Prezzi', 'Suggerimenti AI']
  },
  {
    number: '03',
    title: 'Conferma con un Click',
    description: 'Verifica i dati estratti, modifica se necessario, e conferma. Un solo click.',
    icon: CheckCircle,
    gradient: 'from-emerald-500 to-green-500',
    time: '~3 secondi'
  },
  {
    number: '04',
    title: 'Stampa e Spedisci',
    description: 'Etichetta pronta. Stampala, attaccala al pacco, consegna al corriere. Fatto!',
    icon: Printer,
    gradient: 'from-amber-500 to-orange-500',
    badge: 'Tutto qui!'
  },
];

export default function HowItWorksDynamic() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 bg-[#09090b] overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-0 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[150px]" />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 mb-6"
          >
            <span className="text-sm font-semibold text-amber-400">Come Funziona</span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            4 Step.{' '}
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              10 Secondi.
            </span>
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Il processo piu semplice che tu abbia mai visto per creare una spedizione.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Left - Steps List */}
          <div className="space-y-6">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  onClick={() => setActiveStep(index)}
                  className={`group relative cursor-pointer ${isActive ? 'z-10' : ''}`}
                >
                  {/* Connection Line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-[39px] top-[80px] w-0.5 h-[calc(100%-20px)] bg-gradient-to-b from-white/20 to-transparent" />
                  )}

                  <div className={`relative p-6 rounded-2xl border transition-all duration-500 ${
                    isActive
                      ? 'bg-white/10 border-white/20 shadow-2xl shadow-white/5'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                    <div className="flex gap-6">
                      {/* Icon */}
                      <div className={`relative flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}>
                        <Icon className="w-8 h-8 text-white" />
                        <span className="absolute -top-2 -right-2 w-7 h-7 bg-[#09090b] rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white/20">
                          {step.number}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-amber-400 transition-colors">
                          {step.title}
                        </h3>
                        <p className="text-gray-400 leading-relaxed">
                          {step.description}
                        </p>

                        {/* Step-specific content */}
                        <AnimatePresence mode="wait">
                          {isActive && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-4 pt-4 border-t border-white/10"
                            >
                              {step.examples && (
                                <div className="flex flex-wrap gap-2">
                                  {step.examples.map((example, i) => {
                                    const ExIcon = example.icon;
                                    return (
                                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full text-sm text-white/80">
                                        <ExIcon className="w-3.5 h-3.5" />
                                        {example.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {step.features && (
                                <div className="grid grid-cols-2 gap-2">
                                  {step.features.map((feature, i) => (
                                    <span key={i} className="flex items-center gap-2 text-sm text-white/80">
                                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                                      {feature}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {step.time && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 rounded-full">
                                  <span className="text-emerald-400 font-semibold">{step.time}</span>
                                </div>
                              )}
                              {step.badge && (
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full">
                                  <Sparkles className="w-4 h-4 text-amber-400" />
                                  <span className="text-amber-400 font-semibold">{step.badge}</span>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Arrow indicator */}
                      <ArrowRight className={`w-5 h-5 text-white/40 flex-shrink-0 mt-1 transition-all duration-300 ${isActive ? 'text-amber-400 translate-x-1' : ''}`} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right - Interactive Demo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="sticky top-8"
          >
            <div className="relative">
              {/* Glow */}
              <div className={`absolute -inset-4 rounded-3xl blur-2xl opacity-40 transition-all duration-500 bg-gradient-to-r ${steps[activeStep].gradient}`} />

              {/* Demo Card */}
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 overflow-hidden">
                {/* Browser Chrome */}
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div className="flex-1 mx-4">
                    <div className="bg-white/10 rounded-full px-4 py-1.5 text-sm text-gray-400 text-center">
                      app.spediresicuro.it
                    </div>
                  </div>
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="min-h-[300px]"
                  >
                    {activeStep === 0 && (
                      <div className="space-y-4">
                        <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:border-amber-500/50 transition-colors cursor-pointer">
                          <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
                          <p className="text-white/60">Trascina qui il tuo file</p>
                          <p className="text-white/40 text-sm mt-2">oppure clicca per selezionare</p>
                        </div>
                        <div className="flex justify-center gap-4">
                          {steps[0].examples?.map((ex, i) => {
                            const ExIcon = ex.icon;
                            return (
                              <div key={i} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer">
                                <ExIcon className="w-6 h-6 text-white/60" />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {activeStep === 1 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-center">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                            className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500"
                          />
                        </div>
                        <div className="space-y-3">
                          {['Lettura OCR...', 'Estrazione dati...', 'Validazione indirizzo...', 'Calcolo prezzi...'].map((text, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.3 }}
                              className="flex items-center gap-3"
                            >
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.5, delay: i * 0.3 }}
                              >
                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                              </motion.div>
                              <span className="text-white/80">{text}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeStep === 2 && (
                      <div className="space-y-4">
                        <div className="bg-white/5 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Destinatario</span>
                            <span className="text-white font-medium">Mario Rossi</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Indirizzo</span>
                            <span className="text-white font-medium">Via Roma 123</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Citta</span>
                            <span className="text-white font-medium">20121 Milano</span>
                          </div>
                          <div className="flex justify-between items-center pt-3 border-t border-white/10">
                            <span className="text-gray-400">Corriere consigliato</span>
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                              BRT - 5.90
                            </span>
                          </div>
                        </div>
                        <button className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl text-white font-bold hover:opacity-90 transition-opacity">
                          Conferma Spedizione
                        </button>
                      </div>
                    )}

                    {activeStep === 3 && (
                      <div className="text-center space-y-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', bounce: 0.5 }}
                          className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                        >
                          <CheckCircle className="w-10 h-10 text-white" />
                        </motion.div>
                        <div>
                          <h4 className="text-2xl font-bold text-white mb-2">Etichetta Pronta!</h4>
                          <p className="text-gray-400">La tua spedizione e stata creata con successo</p>
                        </div>
                        <div className="flex justify-center gap-4">
                          <button className="px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                            <Printer className="w-5 h-5 inline mr-2" />
                            Stampa
                          </button>
                          <button className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors">
                            Scarica PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
