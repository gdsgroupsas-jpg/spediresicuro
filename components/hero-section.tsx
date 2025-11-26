'use client'

import { useState } from 'react'

// Tipo per le varianti della hero section
type Variant = 'brand' | 'tech-trust' | 'energy-professional' | 'modern-minimal'

interface HeroSectionProps {
  variant?: Variant
}

export default function HeroSection({ variant = 'brand' }: HeroSectionProps) {
  // Configurazione varianti
  const variants = {
    'brand': {
      primaryColor: 'bg-gradient-to-r from-[#FFD700] to-[#FF9500]',
      primaryHover: 'hover:from-[#FFE033] hover:to-[#FFB84D]',
      accentColor: 'text-[#00B8D4]',
      accentBg: 'bg-[#00B8D4]',
      textColor: 'text-[#000000]',
      bgGradient: 'from-white to-gray-50',
      headline: 'Da WhatsApp a Spedizione in 10 Secondi',
      subheadline: 'Carica uno screenshot. La nostra AI legge, compila, valida tutto. Tu stampi l\'etichetta e spedisci. È davvero così semplice.',
      ctaPrimary: 'Prova Gratis - Carica Screenshot',
      ctaSecondary: 'Guarda come funziona',
    },
    'tech-trust': {
      primaryColor: 'bg-[#0066FF]',
      primaryHover: 'hover:bg-[#0052CC]',
      accentColor: 'text-[#00FF87]',
      accentBg: 'bg-[#00FF87]',
      textColor: 'text-[#0A0A0A]',
      bgGradient: 'from-blue-50 to-white',
      headline: 'Da WhatsApp a Spedizione in 10 Secondi',
      subheadline: 'Carica uno screenshot. La nostra AI legge, compila, valida tutto. Tu stampi l\'etichetta e spedisci. È davvero così semplice.',
      ctaPrimary: 'Prova Gratis - Carica Screenshot',
      ctaSecondary: 'Guarda come funziona',
    },
    'energy-professional': {
      primaryColor: 'bg-[#FF6B35]',
      primaryHover: 'hover:bg-[#E55A2B]',
      accentColor: 'text-[#001F54]',
      accentBg: 'bg-[#001F54]',
      textColor: 'text-[#001F54]',
      bgGradient: 'from-orange-50 to-white',
      headline: 'Il Futuro delle Spedizioni è Qui',
      subheadline: 'Carica uno screenshot. La nostra AI fa il resto. Benvenuto nell\'era delle spedizioni intelligenti.',
      ctaPrimary: 'Inizia Subito',
      ctaSecondary: 'Scopri di più',
    },
    'modern-minimal': {
      primaryColor: 'bg-[#0A0A0A]',
      primaryHover: 'hover:bg-[#1A1A1A]',
      accentColor: 'text-[#00FF87]',
      accentBg: 'bg-[#00FF87]',
      textColor: 'text-[#0A0A0A]',
      bgGradient: 'from-gray-50 to-white',
      headline: 'Spedisci 10x Più Veloce con l\'AI',
      subheadline: 'Basta screenshot WhatsApp. Il nostro sistema estrae dati, valida indirizzi e crea l\'etichetta. Automaticamente.',
      ctaPrimary: 'Carica Primo Screenshot',
      ctaSecondary: 'Vedi demo',
    },
  }

  const config = variants[variant]

  return (
    <section className={`min-h-screen flex items-center bg-gradient-to-b ${config.bgGradient} py-20 px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          {/* Contenuto Sinistra (60%) */}
          <div className="lg:col-span-3 space-y-8">
            {/* Trust Badges - Top */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00B8D4]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Dati protetti GDPR</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00B8D4]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <span>SSL Certificato</span>
              </div>
            </div>

            {/* Headline */}
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold ${config.textColor} leading-tight`}>
              {config.headline}
            </h1>

            {/* Subheadline */}
            <p className={`text-lg sm:text-xl ${config.textColor} opacity-80 max-w-2xl leading-relaxed`}>
              {config.subheadline}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* CTA Primario */}
              <button
                className={`${config.primaryColor} ${config.primaryHover} text-white px-8 py-4 rounded-lg font-semibold text-lg shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl`}
                onClick={() => {
                  // TODO: Implementare upload screenshot
                  console.log('Carica screenshot')
                }}
              >
                {config.ctaPrimary}
              </button>

              {/* CTA Secondario */}
              <button
                className={`border-2 ${config.textColor} border-current px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-50 transform transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2`}
                onClick={() => {
                  // TODO: Implementare video demo
                  console.log('Mostra demo')
                }}
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                {config.ctaSecondary}
              </button>
            </div>

            {/* Social Proof */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4">
              {/* Statistiche */}
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {/* Avatar placeholder */}
                    {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFD700] to-[#00B8D4] border-2 border-white"
                    />
                  ))}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Oltre 1.247 aziende</p>
                  <p className="text-sm text-gray-600">già spediscono senza stress</p>
                </div>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <div className="flex text-[#FFD700]">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-semibold text-gray-900">4.9/5</span>
                <span className="text-sm text-gray-600">(2.847 recensioni)</span>
              </div>
            </div>

            {/* Urgenza Soft */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${config.accentBg} bg-opacity-10 border border-current border-opacity-20`}>
              <svg className={`w-5 h-5 ${config.accentColor}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className={`text-sm font-medium ${config.textColor}`}>
                Posti limitati per piano gratuito
              </span>
            </div>
          </div>

          {/* Visual Destra (40%) */}
          <div className="lg:col-span-2 relative">
            {/* Mockup Animato - Screenshot WhatsApp che diventa etichetta */}
            <div className="relative">
              {/* Container principale */}
              <div className="relative bg-white rounded-2xl shadow-2xl p-6 transform transition-all duration-500 hover:scale-105">
                {/* Screenshot WhatsApp (placeholder) */}
                <div className="mb-6 relative">
                  <div className="bg-[#E5DDD5] rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500"></div>
                      <div className="flex-1">
                        <div className="h-3 bg-gray-300 rounded w-24 mb-2"></div>
                        <div className="h-2 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 ml-12 shadow-sm">
                      <div className="space-y-2">
                        <div className="h-2 bg-gray-300 rounded w-full"></div>
                        <div className="h-2 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-2 bg-gray-400 rounded w-1/2 mt-2"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Freccia animata */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                    <div className={`${config.accentBg} rounded-full p-3 shadow-lg animate-bounce`}>
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Etichetta Spedizione (placeholder) */}
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-4 bg-gray-200 rounded w-32"></div>
                      <div className="h-8 w-8 bg-gray-300 rounded"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-gray-200 rounded w-full"></div>
                      <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                      <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                    </div>
                    <div className="h-24 bg-gray-100 rounded flex items-center justify-center">
                      <div className="text-gray-400 text-xs">QR Code / Barcode</div>
                    </div>
                  </div>
                </div>

                {/* Badge AI Processing */}
                <div className={`absolute -top-4 -right-4 ${config.accentBg} text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-pulse`}>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold">AI Processing</span>
                </div>
              </div>

              {/* Effetto glow */}
              <div className={`absolute inset-0 ${config.accentBg} opacity-10 blur-3xl -z-10 rounded-2xl`}></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

