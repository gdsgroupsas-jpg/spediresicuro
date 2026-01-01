/**
 * Building in Public Section
 *
 * Sezione transparenza totale:
 * - Roadmap live
 * - Metriche reali beta
 * - Case study PostaPrivata
 * - Founding customer CTA
 */

'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Rocket,
  CheckCircle2,
  Circle,
  Clock,
  Target,
  Users,
  TrendingUp,
  Sparkles,
  Quote,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

const roadmapItems = [
  {
    phase: 'FASE 1-2.8',
    status: 'completed',
    title: 'Core Architecture',
    items: [
      'AI Orchestrator (LangGraph + Gemini Vision)',
      'Wallet System (atomic operations)',
      'Multi-tenant RLS',
      'Acting Context (impersonation)',
      'Courier Adapters (GLS, BRT, Poste)'
    ]
  },
  {
    phase: 'FASE 3',
    status: 'in_progress',
    title: 'Beta Testing',
    items: [
      'End-to-end testing su spedizioni reali',
      'Validazione pricing + unit economics',
      'Primi 10-20 founding customers',
      'Feedback loop + iterations',
      'Completamento: Fine Settimana'
    ]
  },
  {
    phase: 'FASE 4',
    status: 'planned',
    title: 'Production 1.0',
    items: [
      'Fix debito tecnico P0 (logger, coverage)',
      'APM monitoring (Sentry)',
      'API documentation (OpenAPI)',
      'Primi 100 clienti paganti',
      'Stima: 2-3 mesi'
    ]
  }
];

const betaMetrics = [
  {
    icon: Users,
    label: 'Beta Tester',
    value: 'In corso',
    description: 'PostaPrivata + early adopters'
  },
  {
    icon: Target,
    label: 'OCR Tests',
    value: 'Diverse',
    description: '90% confidence validation'
  },
  {
    icon: TrendingUp,
    label: 'Time-Saving',
    value: '94%',
    description: '3 min → 10 sec reale'
  },
  {
    icon: Rocket,
    label: 'Go-Live',
    value: 'Q1 2026',
    description: 'Production readiness'
  }
];

export default function BuildingInPublic() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  return (
    <section
      ref={sectionRef}
      className="relative py-32 bg-gradient-to-b from-gray-50 to-white overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-amber-100 rounded-full blur-[150px] opacity-40" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-[120px] opacity-40" />
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 mb-6"
          >
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Transparenza Totale</span>
          </motion.div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            Building in{' '}
            <span className="relative">
              <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                Public
              </span>
            </span>
          </h2>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Niente marketing fasullo. Metriche reali, roadmap onesta, feedback pubblico.{' '}
            <span className="font-semibold text-gray-900">Unisciti al viaggio.</span>
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Roadmap */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
              <Rocket className="w-7 h-7 text-amber-500" />
              Roadmap Live
            </h3>

            <div className="space-y-6">
              {roadmapItems.map((phase, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className="relative"
                >
                  {/* Timeline line */}
                  {index < roadmapItems.length - 1 && (
                    <div className="absolute left-3 top-12 bottom-0 w-0.5 bg-gray-200" />
                  )}

                  <div className="flex gap-4">
                    {/* Status icon */}
                    <div className={`flex-shrink-0 w-6 h-6 mt-1 rounded-full flex items-center justify-center ${
                      phase.status === 'completed'
                        ? 'bg-emerald-100'
                        : phase.status === 'in_progress'
                        ? 'bg-amber-100'
                        : 'bg-gray-100'
                    }`}>
                      {phase.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : phase.status === 'in_progress' ? (
                        <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          phase.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : phase.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {phase.phase}
                        </span>
                        <h4 className="font-semibold text-gray-900">{phase.title}</h4>
                      </div>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {phase.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-gray-400 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Metriche Beta + Testimonial */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-8"
          >
            {/* Beta Metrics */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <TrendingUp className="w-7 h-7 text-violet-500" />
                Metriche Beta Reali
              </h3>

              <div className="grid grid-cols-2 gap-4">
                {betaMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={isInView ? { opacity: 1, scale: 1 } : {}}
                      transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
                      className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <Icon className="w-6 h-6 text-amber-500 mb-3" />
                      <div className="text-sm text-gray-500 mb-1">{metric.label}</div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">{metric.value}</div>
                      <div className="text-xs text-gray-400">{metric.description}</div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* PostaPrivata Testimonial */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="relative p-8 rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100"
            >
              <Quote className="absolute top-4 right-4 w-12 h-12 text-violet-200" />

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                    PP
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">PostaPrivata</div>
                    <div className="text-sm text-gray-600">Agenzia Spedizioni - Milano</div>
                  </div>
                </div>

                <p className="text-gray-700 leading-relaxed mb-4">
                  &quot;Elimino 3 minuti per ogni spedizione al banco. Prima scrivevo a mano i dati dal
                  cliente, ora faccio screenshot del documento e Annie compila tutto.
                  <span className="font-semibold text-violet-700"> Zero errori di battitura.</span>
                  &quot;
                </p>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-gray-600">Early Adopter</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-gray-600">Beta Testing</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1 }}
          className="text-center"
        >
          <div className="inline-block p-8 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-3">
              Diventa Founding Customer
            </h3>
            <p className="text-amber-50 mb-6 max-w-lg">
              Primi 100 clienti: listino bloccato €79/mese (poi €149).
              Accesso prioritario, feedback diretto, roadmap condivisa.
            </p>
            <Link
              href="/preventivo"
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg bg-white text-amber-600 hover:bg-gray-50 transition-all duration-300 hover:scale-105"
            >
              <span>Unisciti alla Beta</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
