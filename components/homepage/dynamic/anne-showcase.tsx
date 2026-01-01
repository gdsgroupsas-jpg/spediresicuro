/**
 * Anne AI Showcase Section
 *
 * Sezione dedicata a presentare Anne AI con:
 * - Demo chat interattiva
 * - Features AI evidenziate
 * - Animazioni conversazione
 */

'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  MessageSquare,
  Zap,
  Shield,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Brain,
  Target,
  Clock
} from 'lucide-react';

const chatMessages = [
  {
    role: 'user',
    content: 'Devo spedire un pacco da 5kg a Milano, quanto costa?'
  },
  {
    role: 'assistant',
    content: 'Ho confrontato 6 corrieri per te. La migliore opzione e BRT Express a 7.90. Vuoi che prepari l\'etichetta?',
    features: ['Confronto prezzi', 'Suggerimento ottimale']
  },
  {
    role: 'user',
    content: 'Si, il destinatario e Mario Rossi, Via Roma 123, 20121 Milano'
  },
  {
    role: 'assistant',
    content: 'Indirizzo validato. Etichetta pronta! Peso: 5kg, Corriere: BRT, Prezzo: 7.90. Stampa quando vuoi.',
    features: ['Validazione indirizzo', 'Etichetta automatica']
  }
];

const aiFeatures = [
  {
    icon: Brain,
    title: 'Gemini Vision OCR',
    description: '90% confidence reale. Legge screenshot WhatsApp, foto pacchi, documenti PDF, vocali trascritti.'
  },
  {
    icon: Target,
    title: 'LangGraph Supervisor',
    description: '6 worker specializzati: OCR, Address, Pricing, Booking, Mentor, Debug. Orchestrazione intelligente.'
  },
  {
    icon: Clock,
    title: '10 Secondi End-to-End',
    description: 'Upload screenshot → validazione indirizzo → pricing → etichetta. 94% time-saving reale (3 min → 10s).'
  },
  {
    icon: TrendingUp,
    title: 'Production Beta',
    description: 'In test su spedizioni reali. Fine settimana: end-to-end completo. Building in public.'
  }
];

export default function AnneShowcase() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [visibleMessages, setVisibleMessages] = useState<number>(0);

  // Animazione chat progressiva
  useEffect(() => {
    if (!isInView) return;

    const interval = setInterval(() => {
      setVisibleMessages(prev => {
        if (prev >= chatMessages.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 bg-gradient-to-b from-white to-gray-50 overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-violet-100 rounded-full blur-[200px] opacity-50 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-amber-100 rounded-full blur-[150px] opacity-50 translate-y-1/2" />
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
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-100 to-purple-100 border border-violet-200 mb-6"
          >
            <Bot className="w-5 h-5 text-violet-600" />
            <span className="text-sm font-semibold text-violet-700">Incontra Anne</span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Incontra{' '}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                Anne
              </span>
              <motion.div
                initial={{ width: 0 }}
                animate={isInView ? { width: '100%' } : {}}
                transition={{ duration: 1, delay: 0.5 }}
                className="absolute -bottom-2 left-0 h-3 bg-violet-200/50 rounded-full -z-10"
              />
            </span>
            <br />
            Gemini Vision + LangGraph
          </h2>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Non un chatbot. Un <span className="font-semibold text-gray-900">AI Supervisor</span> con 6 worker specializzati.
            Gemini 2.0 Flash multimodal + LangGraph orchestration. <span className="font-semibold text-violet-600">90% OCR confidence</span> reale.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Chat Demo */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 to-purple-500/20 rounded-3xl blur-2xl" />

              {/* Chat Window */}
              <div className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white flex items-center gap-2">
                        Anne
                        <Sparkles className="w-4 h-4 text-amber-300" />
                      </h3>
                      <p className="text-sm text-white/70">AI Logistic Assistant</p>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-6 space-y-4 min-h-[350px] bg-gradient-to-b from-gray-50 to-white">
                  <AnimatePresence mode="popLayout">
                    {chatMessages.slice(0, visibleMessages).map((message, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${message.role === 'user' ? 'order-1' : ''}`}>
                          <div className={`px-4 py-3 rounded-2xl ${
                            message.role === 'user'
                              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-tr-none'
                              : 'bg-white border border-gray-200 text-gray-900 rounded-tl-none shadow-sm'
                          }`}>
                            <p className="text-sm leading-relaxed">{message.content}</p>
                          </div>

                          {/* Feature tags for assistant messages */}
                          {message.role === 'assistant' && message.features && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {message.features.map((feature, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium"
                                >
                                  <Zap className="w-3 h-3" />
                                  {feature}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Typing indicator */}
                  {visibleMessages < chatMessages.length && visibleMessages > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-violet-600" />
                      </div>
                      <div className="flex gap-1 px-4 py-3 bg-gray-100 rounded-2xl">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                            className="w-2 h-2 bg-gray-400 rounded-full"
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Input */}
                <div className="px-6 py-4 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Chiedi qualsiasi cosa ad Anne..."
                      className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      disabled
                    />
                    <button className="p-3 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl text-white">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right - Features */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Architettura AI-First Reale
              </h3>
              <p className="text-gray-600 leading-relaxed">
                <span className="font-semibold text-violet-600">Gemini 2.0 Flash</span> multimodal (text + vision).{' '}
                <span className="font-semibold text-violet-600">LangGraph</span> con supervisor pattern.{' '}
                6 worker specializzati che collaborano. Validazione indirizzi IT (CAP, comuni, frazioni).{' '}
                <span className="font-semibold text-gray-900">In beta testing su spedizioni reali.</span>
              </p>
            </div>

            <div className="grid gap-4">
              {aiFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                    className="group flex gap-4 p-4 rounded-2xl hover:bg-violet-50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center group-hover:from-violet-200 group-hover:to-purple-200 transition-colors">
                      <Icon className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{feature.title}</h4>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Stats REALI */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  90%
                </div>
                <div className="text-sm text-gray-500">OCR Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  10s
                </div>
                <div className="text-sm text-gray-500">Screenshot → Label</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  6
                </div>
                <div className="text-sm text-gray-500">AI Workers</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
