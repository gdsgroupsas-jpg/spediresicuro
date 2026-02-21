/**
 * Hook: Voice I/O (STT + TTS)
 *
 * Speech-to-Text via Web Speech API (SpeechRecognition)
 * Text-to-Speech via Web Speech API (speechSynthesis)
 *
 * Zero cost, zero dependencies, browser-native.
 * Lingua: it-IT
 *
 * Phase 5: Voice I/O
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ==================== TYPES ====================

interface UseVoiceIOOptions {
  lang?: string;
  /** Called when STT produces a final transcript */
  onTranscript?: (text: string) => void;
  /** TTS enabled by default */
  ttsEnabled?: boolean;
}

interface UseVoiceIOReturn {
  /** Whether the browser supports STT */
  sttSupported: boolean;
  /** Whether the browser supports TTS */
  ttsSupported: boolean;
  /** Currently listening for speech */
  isListening: boolean;
  /** Currently speaking TTS */
  isSpeaking: boolean;
  /** Interim transcript (real-time, not final) */
  interimTranscript: string;
  /** Start listening for speech */
  startListening: () => void;
  /** Stop listening */
  stopListening: () => void;
  /** Speak text aloud */
  speak: (text: string) => void;
  /** Stop speaking */
  stopSpeaking: () => void;
  /** Toggle TTS on/off */
  ttsEnabled: boolean;
  setTtsEnabled: (enabled: boolean) => void;
}

// ==================== GLOBALS ====================

type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : any;

function getSpeechRecognition(): SpeechRecognitionType | null {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ==================== HOOK ====================

export function useVoiceIO({
  lang = 'it-IT',
  onTranscript,
  ttsEnabled: initialTts = true,
}: UseVoiceIOOptions = {}): UseVoiceIOReturn {
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [ttsEnabled, setTtsEnabledState] = useState(initialTts);

  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // ==================== INIT ====================

  useEffect(() => {
    setSttSupported(!!getSpeechRecognition());
    setTtsSupported(hasSpeechSynthesis());

    // Load TTS preference from localStorage
    try {
      const stored = localStorage.getItem('anne-tts-enabled');
      if (stored !== null) setTtsEnabledState(stored === 'true');
    } catch {}
  }, []);

  // ==================== TTS PERSISTENCE ====================

  const setTtsEnabled = useCallback((enabled: boolean) => {
    setTtsEnabledState(enabled);
    try {
      localStorage.setItem('anne-tts-enabled', String(enabled));
    } catch {}
  }, []);

  // ==================== STT ====================

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Stop any current recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim) setInterimTranscript(interim);

      if (final) {
        setInterimTranscript('');
        onTranscriptRef.current?.(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      // 'no-speech' and 'aborted' are expected, don't log
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[VOICE_IO] STT error:', event.error);
      }
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn('[VOICE_IO] STT start failed:', err);
      setIsListening(false);
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  // ==================== TTS ====================

  const speak = useCallback(
    (text: string) => {
      if (!hasSpeechSynthesis() || !text) return;

      // Stop any current speech
      window.speechSynthesis.cancel();

      // Strip markdown for cleaner speech
      const cleanText = text
        .replace(/[*_~`#>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, ', ')
        .slice(0, 2000); // Limit length

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      // Try to find an Italian voice
      const voices = window.speechSynthesis.getVoices();
      const italianVoice =
        voices.find((v) => v.lang.startsWith('it') && v.localService) ||
        voices.find((v) => v.lang.startsWith('it'));
      if (italianVoice) utterance.voice = italianVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [lang]
  );

  const stopSpeaking = useCallback(() => {
    if (hasSpeechSynthesis()) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  // ==================== CLEANUP ====================

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if (hasSpeechSynthesis()) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    sttSupported,
    ttsSupported,
    isListening,
    isSpeaking,
    interimTranscript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    ttsEnabled,
    setTtsEnabled,
  };
}
