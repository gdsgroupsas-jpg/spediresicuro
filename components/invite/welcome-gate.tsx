/**
 * WelcomeGate — Schermata Cinematografica di Benvenuto
 *
 * Il logo SpedireSicuro prende vita con animazioni sequenziali,
 * poi Anne (l'AI assistant) accoglie l'utente con typing effect.
 *
 * Sequenza (~5.5s):
 * 1. Sfondo scuro + particelle floating
 * 2. Anello del logo si disegna (stroke animation)
 * 3. Freccia scatta con spring bounce
 * 4. Pulse di luce dal logo
 * 5. "SpedireSicuro" reveal
 * 6. Anne typing: "Ciao Marco! 👋" + messaggio personalizzato
 * 7. Badge ruolo (solo invitati)
 * 8. Fade-out → redirect dashboard
 *
 * Performance: framer-motion (già installato), puro CSS, zero dipendenze nuove.
 * Accessibilità: rispetta prefers-reduced-motion.
 *
 * @module components/invite/welcome-gate
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import {
  getRoleLabel,
  getWelcomeLines,
  generateParticles,
  getAutoCloseDelay,
} from '@/lib/welcome-gate-helpers';

// ============================================
// TYPES
// ============================================

interface WelcomeGateProps {
  userName: string;
  workspaceName?: string;
  organizationName?: string;
  role?: string;
  onComplete: () => void;
}

// ============================================
// SUB-COMPONENTI
// ============================================

/**
 * Logo SVG animato — l'anello si disegna, la freccia scatta, pulse di luce.
 */
function AnimatedLogo({ size, reducedMotion }: { size: number; reducedMotion: boolean }) {
  if (reducedMotion) {
    // Versione statica per reduced motion
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 1024 1024"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="wg-arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFA500" />
          </linearGradient>
          <linearGradient id="wg-ringGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#0066FF" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
        </defs>
        <path
          d="M512 850C325.3 850 174 698.7 174 512C174 325.3 325.3 174 512 174C605 174 690 211 751 272L810 213C733 136 627 88 512 88C277 88 88 277 88 512C88 747 277 936 512 936C627 936 733 888 810 811L751 752C690 813 605 850 512 850Z"
          fill="url(#wg-ringGrad)"
        />
        <path
          d="M280 800L580 150L450 450L650 450L350 1100L480 800L280 800Z"
          fill="url(#wg-arrowGrad)"
          opacity="0.9"
        />
        <path
          d="M380 700L680 50L550 350L750 350L450 1000L580 700L380 700Z"
          fill="url(#wg-arrowGrad)"
        />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wg-arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
        <linearGradient id="wg-ringGrad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#00D4FF" />
        </linearGradient>
      </defs>

      {/* Anello — si disegna con stroke animation */}
      <motion.path
        d="M512 850C325.3 850 174 698.7 174 512C174 325.3 325.3 174 512 174C605 174 690 211 751 272L810 213C733 136 627 88 512 88C277 88 88 277 88 512C88 747 277 936 512 936C627 936 733 888 810 811L751 752C690 813 605 850 512 850Z"
        stroke="url(#wg-ringGrad)"
        strokeWidth={36}
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0, duration: 1, ease: 'easeInOut' }}
      />

      {/* Freccia (layer 1 — ombra) — scatta con spring */}
      <motion.path
        d="M280 800L580 150L450 450L650 450L350 1100L480 800L280 800Z"
        fill="url(#wg-arrowGrad)"
        opacity="0.9"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{
          delay: 0.5,
          type: 'spring',
          damping: 12,
          stiffness: 200,
        }}
        style={{ transformOrigin: '480px 550px' }}
      />

      {/* Freccia (layer 2 — principale) — scatta con spring */}
      <motion.path
        d="M380 700L680 50L550 350L750 350L450 1000L580 700L380 700Z"
        fill="url(#wg-arrowGrad)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          delay: 0.5,
          type: 'spring',
          damping: 12,
          stiffness: 200,
        }}
        style={{ transformOrigin: '560px 500px' }}
      />

      {/* Pulse ring — onda d'urto che si espande e svanisce */}
      <motion.circle
        cx="512"
        cy="512"
        r="380"
        stroke="url(#wg-ringGrad)"
        strokeWidth={2}
        fill="none"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1.8, opacity: [0, 0.5, 0] }}
        transition={{ delay: 1.1, duration: 0.9, ease: 'easeOut' }}
        style={{ transformOrigin: '512px 512px' }}
      />

      {/* Flash arancio dietro la freccia */}
      <motion.circle
        cx="512"
        cy="500"
        r="120"
        fill="#FFA500"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.3, 0], scale: [0.5, 1.5, 2] }}
        transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
        style={{ transformOrigin: '512px 500px' }}
      />
    </svg>
  );
}

/**
 * Typing message — tre puntini, poi typing riga per riga.
 */
function TypingMessage({
  delay,
  lines,
  reducedMotion,
}: {
  delay: number;
  lines: string[];
  reducedMotion: boolean;
}) {
  const [phase, setPhase] = useState<'waiting' | 'dots' | 'typing' | 'done'>('waiting');
  const [currentLine, setCurrentLine] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [completedLines, setCompletedLines] = useState<string[]>([]);

  useEffect(() => {
    if (reducedMotion) {
      // Mostra tutto subito
      setCompletedLines(lines);
      setPhase('done');
      return;
    }

    // Fase 1: attesa iniziale
    const waitTimer = setTimeout(() => setPhase('dots'), delay * 1000);
    return () => clearTimeout(waitTimer);
  }, [delay, lines, reducedMotion]);

  useEffect(() => {
    if (phase === 'dots') {
      // Mostra puntini per 0.5s poi inizia typing
      const dotsTimer = setTimeout(() => {
        setPhase('typing');
        setCurrentLine(0);
        setDisplayText('');
      }, 500);
      return () => clearTimeout(dotsTimer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'typing') return;
    if (currentLine >= lines.length) {
      setPhase('done');
      return;
    }

    const text = lines[currentLine];
    if (displayText.length < text.length) {
      // Typing: 70ms per prima riga, 50ms per le successive (più veloce)
      const speed = currentLine === 0 ? 70 : 50;
      const timer = setTimeout(() => {
        setDisplayText(text.slice(0, displayText.length + 1));
      }, speed);
      return () => clearTimeout(timer);
    } else {
      // Riga completata, pausa 0.3s poi prossima
      const timer = setTimeout(() => {
        setCompletedLines((prev) => [...prev, text]);
        setDisplayText('');
        setCurrentLine((prev) => prev + 1);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [phase, currentLine, displayText, lines]);

  if (phase === 'waiting') return null;

  return (
    <div className="flex flex-col items-center gap-2 max-w-sm text-center">
      {/* Righe completate */}
      {completedLines.map((line, i) => (
        <p key={i} className="text-white font-medium text-lg">
          {line}
        </p>
      ))}

      {/* Puntini (fase dots) */}
      {phase === 'dots' && (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.8,
                delay: i * 0.15,
                repeat: Infinity,
              }}
            />
          ))}
        </div>
      )}

      {/* Riga in corso di typing */}
      {phase === 'typing' && displayText && (
        <p className="text-white font-medium text-lg">
          {displayText}
          <motion.span
            className="inline-block w-0.5 h-5 bg-amber-400 ml-0.5 align-middle"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </p>
      )}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

export function WelcomeGate({
  userName,
  workspaceName,
  organizationName,
  role,
  onComplete,
}: WelcomeGateProps) {
  const [fadeOut, setFadeOut] = useState(false);

  // Reduced motion detection
  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  // Genera particelle (stabili tra render)
  const particles = useMemo(
    () => (prefersReducedMotion ? [] : generateParticles(25)),
    [prefersReducedMotion]
  );

  // Messaggi di Anne
  const welcomeLines = useMemo(
    () => getWelcomeLines(userName, workspaceName, organizationName),
    [userName, workspaceName, organizationName]
  );

  // Stabile tra render
  const stableOnComplete = useCallback(onComplete, [onComplete]);

  // Auto-dismiss con fade-out
  useEffect(() => {
    const closeDelay = getAutoCloseDelay(prefersReducedMotion);
    const fadeTimer = setTimeout(() => setFadeOut(true), closeDelay - 800);
    const completeTimer = setTimeout(stableOnComplete, closeDelay);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [stableOnComplete, prefersReducedMotion]);

  // Dimensione logo responsive
  const logoSize = typeof window !== 'undefined' && window.innerWidth < 640 ? 80 : 120;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #09090b, #111827)' }}
      animate={{ opacity: fadeOut ? 0 : 1 }}
      transition={{ duration: 0.8 }}
    >
      {/* LAYER 1: Particelle floating */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${
            p.color === 'amber' ? 'bg-amber-400/20' : 'bg-cyan-400/15'
          }`}
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.sin(p.id) * 20, 0],
            opacity: [0.15, 0.4, 0.15],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* LAYER 2: Glow blob dietro il logo */}
      {!prefersReducedMotion && (
        <motion.div
          className="absolute w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full blur-[120px] bg-gradient-to-br from-cyan-500/15 to-amber-500/10"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* LAYER 3: Contenuto centrale */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6">
        {/* Logo animato */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            prefersReducedMotion
              ? undefined
              : { delay: 0.2, type: 'spring', damping: 20, stiffness: 100 }
          }
        >
          <AnimatedLogo size={logoSize} reducedMotion={prefersReducedMotion} />
        </motion.div>

        {/* "SpedireSicuro" — reveal */}
        <motion.h1
          className="text-2xl sm:text-3xl font-bold text-white tracking-wide"
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { delay: 1.6, duration: 0.5 }}
        >
          SpedireSicuro
        </motion.h1>

        {/* Divider animato */}
        <motion.div
          className="w-48 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent"
          initial={prefersReducedMotion ? undefined : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={prefersReducedMotion ? undefined : { delay: 2.0, duration: 0.6 }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Typing Message di Anne */}
        <TypingMessage delay={2.2} lines={welcomeLines} reducedMotion={prefersReducedMotion} />

        {/* Badge ruolo (solo invitati) */}
        {role && (
          <motion.span
            className="px-4 py-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-300 text-sm font-medium"
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              prefersReducedMotion ? undefined : { delay: 3.8, type: 'spring', damping: 15 }
            }
          >
            {getRoleLabel(role)}
          </motion.span>
        )}

        {/* "Sono qui per aiutarti" — firma di Anne */}
        <motion.p
          className="text-gray-500 text-sm flex items-center gap-1.5"
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? undefined : { delay: 4.0, duration: 0.5 }}
        >
          Sono qui per aiutarti
          <Sparkles className="w-3.5 h-3.5 text-amber-400/60" />
        </motion.p>
      </div>
    </motion.div>
  );
}

export default WelcomeGate;
