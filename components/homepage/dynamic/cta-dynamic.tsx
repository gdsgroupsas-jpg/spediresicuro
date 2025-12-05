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
  { icon: CheckCircle, text: 'Setup in 2 minuti' },
  { icon: Shield, text: 'Nessuna carta richiesta' },
  { icon: Clock, text: 'Cancella quando vuoi' },
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
          <span className="text-sm font-medium text-white">Prova gratuita disponibile</span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
        >
          Pronto a rivoluzionare
          <br />
          le tue spedizioni?
        </motion.h2>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-xl text-white/80 mb-10 max-w-2xl mx-auto"
        >
          Unisciti a oltre 1.200 aziende che hanno gia scelto SpedireSicuro.
          Inizia gratis, nessun impegno.
        </motion.p>

        {/* CTA Buttons */}
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
            <span className="relative text-violet-700">Inizia Gratis Ora</span>
            <ArrowRight className="relative w-5 h-5 text-violet-700 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            href="/come-funziona"
            className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-semibold text-lg border-2 border-white/30 text-white hover:bg-white/10 transition-all duration-300"
          >
            Scopri come funziona
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

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 pt-10 border-t border-white/10"
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5 text-amber-300 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-white font-semibold">4.9/5</span>
              <span className="text-white/60 text-sm">(2.847 recensioni)</span>
            </div>

            {/* Separator */}
            <div className="hidden sm:block w-px h-8 bg-white/20" />

            {/* Users */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-violet-600"
                  />
                ))}
              </div>
              <span className="text-white/80 text-sm">
                <span className="font-semibold text-white">1.247+</span> aziende attive
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
