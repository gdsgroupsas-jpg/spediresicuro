/**
 * Dynamic CTA Section
 *
 * Call to Action finale con:
 * - Background animato
 * - Effetto glow
 * - Urgenza soft
 */

'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Sparkles, Shield, Clock, CheckCircle } from 'lucide-react';

const benefits = [
  { icon: CheckCircle, text: 'Beta Testing Gratuito' },
  { icon: Shield, text: 'Listino Bloccato €79/mese' },
  { icon: Clock, text: 'Accesso Prioritario Roadmap' },
];

export default function CTADynamic() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <section
      ref={sectionRef}
      className="relative py-32 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />

      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-amber-500/30 rounded-full blur-[150px]"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-pink-500/30 rounded-full blur-[120px]"
        />
      </div>

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-8"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span className="text-sm font-medium text-white">🚀 Beta Testing - Primi 100 Founding Customers</span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
        >
          Scegli il Tuo Modello.
          <br />
          Inizia Oggi.
        </motion.h2>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
        >
          Broker per agenzie. BYOC per e-commerce. Web checkout per privati.{' '}
          <span className="font-semibold text-white">3 modelli, 1 piattaforma AI-First.</span>
        </motion.p>

        {/* CTA Buttons - Multi-Target */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-10"
        >
          <Link
            href="/preventivo"
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-105"
          >
            {/* Button Background */}
            <div className="absolute inset-0 bg-white" />
            {/* Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <span className="relative text-violet-700">Unisciti alla Beta</span>
            <ArrowRight className="relative w-5 h-5 text-violet-700 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/come-funziona"
            className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-semibold text-lg border-2 border-white/30 text-white hover:bg-white/10 transition-all duration-300"
          >
            Vedi Roadmap
          </Link>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex flex-wrap justify-center gap-6"
        >
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-2 text-white/80"
              >
                <Icon className="w-5 h-5 text-emerald-300" />
                <span className="text-sm font-medium">{benefit.text}</span>
              </div>
            );
          })}
        </motion.div>

        {/* Trust Badge - METRICHE REALI */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 pt-10 border-t border-white/10"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            {/* Beta Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/30">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-semibold text-sm">Beta Testing Live</span>
              </div>
            </div>

            {/* Separator */}
            <div className="hidden sm:block w-px h-8 bg-white/20" />

            {/* Tech Stack */}
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm">
                Powered by <span className="font-semibold text-white">Gemini Vision + LangGraph</span>
              </span>
            </div>

            {/* Separator */}
            <div className="hidden sm:block w-px h-8 bg-white/20" />

            {/* Metrics */}
            <div className="flex items-center gap-3">
              <span className="text-white/80 text-sm">
                <span className="font-semibold text-amber-300">90%</span> OCR Confidence •{' '}
                <span className="font-semibold text-emerald-300">94%</span> Time-Saving
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
