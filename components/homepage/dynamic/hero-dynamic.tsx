/**
 * Dynamic Hero Section - Effetto WOW
 *
 * Hero ultra-dinamico con:
 * - Particelle animate fluttuanti
 * - Testo con typing effect
 * - Gradient animati
 * - Mouse tracking per effetto parallax
 * - Counter animato
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Play, Package, Zap, Shield, Sparkles } from 'lucide-react';

// Configurazione particelle
const PARTICLES_COUNT = 50;

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLES_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 1,
    duration: Math.random() * 20 + 10,
    delay: Math.random() * 5,
  }));
}

// Hook per counter animato
function useAnimatedCounter(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView || hasStarted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, hasStarted]);

  return { count, ref };
}

// Typing Effect Hook
function useTypingEffect(texts: string[], typingSpeed: number = 100, deleteSpeed: number = 50, pauseDuration: number = 2000) {
  const [displayText, setDisplayText] = useState('');
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentText = texts[textIndex];

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < currentText.length) {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseDuration);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setTextIndex((prev) => (prev + 1) % texts.length);
        }
      }
    }, isDeleting ? deleteSpeed : typingSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, textIndex, isDeleting, texts, typingSpeed, deleteSpeed, pauseDuration]);

  return displayText;
}

export default function HeroDynamic() {
  const [particles] = useState<Particle[]>(generateParticles);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 150 };
  const mouseXSpring = useSpring(mouseX, springConfig);
  const mouseYSpring = useSpring(mouseY, springConfig);

  // Parallax transforms
  const layer1X = useTransform(mouseXSpring, [0, 1], [-20, 20]);
  const layer1Y = useTransform(mouseYSpring, [0, 1], [-20, 20]);
  const layer2X = useTransform(mouseXSpring, [0, 1], [-10, 10]);
  const layer2Y = useTransform(mouseYSpring, [0, 1], [-10, 10]);

  // Typing effect per tagline
  const typingText = useTypingEffect([
    'Screenshot WhatsApp',
    'Foto del pacco',
    'Messaggio vocale',
    'Email del cliente'
  ], 80, 40, 2500);

  // Counters
  const { count: shipmentsCount, ref: shipmentsRef } = useAnimatedCounter(50000, 2500);
  const { count: companiesCount, ref: companiesRef } = useAnimatedCounter(1247, 2000);
  const { count: satisfactionCount, ref: satisfactionRef } = useAnimatedCounter(99, 1800);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    mouseX.set(x);
    mouseY.set(y);
  }, [mouseX, mouseY]);

  return (
    <section
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-screen flex items-center overflow-hidden bg-[#09090b]"
    >
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/50 via-transparent to-amber-900/30 animate-gradient-shift" />
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-amber-500/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-500/20 rounded-full blur-[100px] animate-pulse-slow-delayed" />
      </div>

      {/* Floating Particles */}
      {mounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full bg-amber-400/30"
              style={{
                width: particle.size,
                height: particle.size,
                left: `${particle.x}%`,
                top: `${particle.y}%`,
              }}
              animate={{
                y: [0, -30, 0],
                x: [0, Math.sin(particle.id) * 20, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            style={{ x: layer1X, y: layer1Y }}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-sm font-medium text-amber-400">
                Rivoluziona le tue spedizioni con l&apos;AI
              </span>
            </motion.div>

            {/* Headline */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight">
                <span className="text-white">Da </span>
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                    {typingText}
                  </span>
                  <span className="animate-blink text-amber-400">|</span>
                </span>
                <br />
                <span className="text-white">a </span>
                <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                  Spedizione
                </span>
                <br />
                <span className="text-white">in </span>
                <span className="relative">
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    10 Secondi
                  </span>
                  <motion.span
                    className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 1, delay: 1 }}
                  />
                </span>
              </h1>
            </motion.div>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-xl text-gray-400 max-w-xl leading-relaxed"
            >
              Carica qualsiasi cosa. La nostra <span className="text-amber-400 font-semibold">AI Annie</span> legge,
              compila, valida e crea l&apos;etichetta. Tu stampi e spedisci.{' '}
              <span className="text-white font-medium">Tutto qui.</span>
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/preventivo"
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-105"
              >
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 transition-all duration-300 group-hover:scale-110" />
                {/* Shine Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span className="relative text-black">Inizia Gratis</span>
                <ArrowRight className="relative w-5 h-5 text-black group-hover:translate-x-1 transition-transform" />
              </Link>

              <button className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-semibold text-lg border-2 border-white/10 text-white hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-300">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-20" />
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <span>Guarda Demo</span>
              </button>
            </motion.div>

            {/* Mini Stats */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="flex flex-wrap gap-8 pt-8 border-t border-white/10"
            >
              <div ref={shipmentsRef} className="text-center">
                <div className="text-3xl font-bold text-white">
                  {shipmentsCount.toLocaleString()}+
                </div>
                <div className="text-sm text-gray-500">Spedizioni/mese</div>
              </div>
              <div ref={companiesRef} className="text-center">
                <div className="text-3xl font-bold text-white">
                  {companiesCount.toLocaleString()}+
                </div>
                <div className="text-sm text-gray-500">Aziende attive</div>
              </div>
              <div ref={satisfactionRef} className="text-center">
                <div className="text-3xl font-bold text-white">
                  {satisfactionCount}%
                </div>
                <div className="text-sm text-gray-500">Soddisfazione</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            style={{ x: layer2X, y: layer2Y }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3 }}
            className="relative"
          >
            {/* Main Card - Screenshot to Label Animation */}
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-cyan-500/20 rounded-3xl blur-2xl opacity-60" />

              {/* Card Container */}
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 overflow-hidden">
                {/* Screenshot WhatsApp Mock */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="ml-2 text-xs text-gray-500">WhatsApp Screenshot</span>
                  </div>
                  <div className="bg-[#0B141A] rounded-xl p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex-shrink-0" />
                      <div className="bg-[#1F2C34] rounded-2xl rounded-tl-none p-3 max-w-[80%]">
                        <p className="text-white text-sm">
                          Ciao! Mi servirebbe spedire un pacco a:<br />
                          <span className="text-green-400">Mario Rossi</span><br />
                          Via Roma 123, 20121 Milano
                        </p>
                        <span className="text-[10px] text-gray-400 float-right mt-1">14:32</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrow Animation */}
                <div className="flex justify-center my-4">
                  <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-full p-3"
                  >
                    <Sparkles className="w-6 h-6 text-white" />
                  </motion.div>
                </div>

                {/* Label Result */}
                <div className="bg-white rounded-xl p-4 shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-500" />
                      <span className="font-bold text-gray-900">Etichetta Pronta</span>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      Validato AI
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Destinatario:</span>
                      <span className="font-medium text-gray-900">Mario Rossi</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Indirizzo:</span>
                      <span className="font-medium text-gray-900">Via Roma 123</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">CAP/Citta:</span>
                      <span className="font-medium text-gray-900">20121 Milano</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="h-16 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 rounded flex items-center justify-center">
                      <div className="flex gap-0.5">
                        {[...Array(30)].map((_, i) => (
                          <div
                            key={i}
                            className="w-0.5 bg-white"
                            style={{ height: `${Math.random() * 30 + 10}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute -top-4 -right-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl"
                >
                  <Zap className="w-4 h-4 inline mr-1" />
                  AI Powered
                </motion.div>

                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                  className="absolute -bottom-4 -left-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl"
                >
                  <Shield className="w-4 h-4 inline mr-1" />
                  100% Sicuro
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2"
        >
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 bg-amber-500 rounded-full"
          />
        </motion.div>
      </motion.div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes gradient-shift {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(50px, 50px) rotate(180deg); }
        }
        .animate-gradient-shift {
          animation: gradient-shift 20s ease-in-out infinite;
        }
        .animate-pulse-slow {
          animation: pulse 4s ease-in-out infinite;
        }
        .animate-pulse-slow-delayed {
          animation: pulse 4s ease-in-out infinite 2s;
        }
        .animate-blink {
          animation: blink 1s step-end infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
