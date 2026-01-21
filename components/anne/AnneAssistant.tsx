/**
 * Anne Assistant - Floating Ghost Assistant
 *
 * Assistente virtuale che appare come un fantasmino discreto in basso a destra.
 * Offre suggerimenti proattivi, tutorial contestuali e supporto all'utente.
 *
 * Features:
 * - Icona fantasmino animata floating
 * - Mini-chat panel espandibile
 * - Suggerimenti contestuali basati su pagina/ruolo
 * - Persistenza preferenze in localStorage
 * - Integrazione con API Claude/Gemini
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ghost,
  X,
  Send,
  Minimize2,
  Lightbulb,
  MessageCircle,
  Sparkles,
  HelpCircle,
  Settings as SettingsIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAnneContext } from './AnneContext';
import { AgentDebugPanel } from '@/components/agent/AgentDebugPanel';
import type { SupervisorRouterTelemetry } from '@/lib/telemetry/logger';
import { ValueDashboard } from './ValueDashboard';
import { HumanError } from './HumanError';
import { SmartSuggestions } from './SmartSuggestions';
import { AutoProceedBanner } from './AutoProceedBanner';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import { autoProceedConfig } from '@/lib/config';

interface Message {
  role: 'user' | 'assistant' | 'suggestion';
  content: string;
  timestamp: Date;
}

interface AnneAssistantProps {
  userId: string;
  userRole: 'user' | 'admin' | 'superadmin';
  userName?: string;
  currentPage?: string;
}

export function AnneAssistant({
  userId,
  userRole,
  userName = 'Utente',
  currentPage = '/dashboard',
}: AnneAssistantProps) {
  // Disabilita Anne durante i test Playwright
  const isTestMode =
    typeof window !== 'undefined' &&
    (window.location.search.includes('test=true') ||
      document.documentElement.getAttribute('data-test-mode') === 'true' ||
      document.documentElement.getAttribute('x-test-mode') === 'playwright');

  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // P2: Telemetria per debug panel (solo admin)
  const [lastTelemetry, setLastTelemetry] = useState<SupervisorRouterTelemetry | undefined>(
    undefined
  );

  // P4: AgentState corrente (per componenti P4)
  const [currentAgentState, setCurrentAgentState] = useState<AgentState | null>(null);
  const [showAutoProceed, setShowAutoProceed] = useState(false);

  // Preferenze utente (localStorage)
  const [preferences, setPreferences] = useState({
    showSuggestions: true,
    autoGreet: true,
    notificationLevel: 'normal' as 'minimal' | 'normal' | 'proactive',
  });

  // Context per suggerimenti proattivi
  const { currentSuggestion, dismissSuggestion } = useAnneContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carica preferenze da localStorage
  useEffect(() => {
    const savedPrefs = localStorage.getItem('anne-preferences');
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error('Errore caricamento preferenze Anne:', e);
      }
    }

    // Auto-saluto al primo accesso (ritardato per non interferire con le azioni)
    const hasGreeted = sessionStorage.getItem('anne-greeted');
    if (!hasGreeted && preferences.autoGreet) {
      // Ritarda molto di più (30 secondi) per non interferire con le azioni iniziali
      // E solo se non siamo in modalità test
      const isTestMode =
        typeof window !== 'undefined' &&
        (window.location.search.includes('test=true') ||
          document.documentElement.getAttribute('data-test-mode') === 'true');

      if (!isTestMode) {
        setTimeout(() => {
          setIsMinimized(false);
          addSuggestionMessage(getGreetingMessage(userName, userRole));
          sessionStorage.setItem('anne-greeted', 'true');
        }, 30000); // 30 secondi invece di 2
      }
    }
  }, []);

  // Salva preferenze
  useEffect(() => {
    localStorage.setItem('anne-preferences', JSON.stringify(preferences));
  }, [preferences]);

  // Auto-scroll messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input quando espanso
  useEffect(() => {
    if (isExpanded && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isExpanded, isMinimized]);

  // Suggerimenti contestuali quando cambia pagina
  useEffect(() => {
    if (preferences.showSuggestions && preferences.notificationLevel !== 'minimal') {
      const suggestion = getContextualSuggestion(currentPage, userRole);
      if (suggestion && messages.length > 0) {
        // Mostra suggerimento solo se non è il primo messaggio
        setTimeout(() => {
          addSuggestionMessage(suggestion);
        }, 1500);
      }
    }
  }, [currentPage]);

  // Ascolta evento personalizzato per aprire Anne (da mobile nav)
  useEffect(() => {
    const handleOpenAnne = () => {
      if (isMinimized) {
        setIsMinimized(false);
        setIsExpanded(true);
      }
    };

    window.addEventListener('openAnneAssistant', handleOpenAnne);

    return () => {
      window.removeEventListener('openAnneAssistant', handleOpenAnne);
    };
  }, [isMinimized]);

  // Aggiungi messaggio di suggerimento
  const addSuggestionMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        role: 'suggestion',
        content,
        timestamp: new Date(),
      },
    ]);
  };

  // Invia messaggio all'API
  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Timeout controller per gestire richieste lente su mobile
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondi timeout

    try {
      const response = await fetch('/api/ai/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          userId,
          userRole,
          currentPage,
          context: {
            previousMessages: messages.slice(-5), // Ultimi 5 messaggi per contesto
          },
        }),
        signal: controller.signal, // Timeout support
      });

      // Verifica che la risposta sia valida prima di fare parse JSON
      if (!response.ok) {
        // Prova a leggere il JSON anche se la risposta non è OK
        let errorData;
        try {
          const text = await response.text();
          errorData = text ? JSON.parse(text) : {};
        } catch {
          errorData = { error: `Errore HTTP ${response.status}` };
        }
        throw new Error(errorData.error || `Errore di comunicazione con Anne (${response.status})`);
      }

      // Leggi il testo prima di fare parse JSON per evitare errori su mobile
      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Risposta vuota dal server. Riprova tra qualche secondo.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Errore parsing JSON:', parseError);
        throw new Error('Risposta non valida dal server. Riprova tra qualche secondo.');
      }

      // P2: Salva telemetria se disponibile (solo per admin)
      if (data.metadata?.telemetry && (userRole === 'admin' || userRole === 'superadmin')) {
        setLastTelemetry(data.metadata.telemetry);
      }

      // P4: Salva AgentState corrente (per componenti P4)
      if (data.metadata?.agentState) {
        setCurrentAgentState(data.metadata.agentState);

        // P4 Task 2: Mostra auto-proceed banner se attivato
        if (data.metadata.agentState.autoProceed) {
          setShowAutoProceed(true);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message || 'Nessuna risposta ricevuta.',
          timestamp: new Date(),
        },
      ]);
    } catch (error: any) {
      console.error('Errore Anne:', error);

      // Gestione errori più specifica per mobile
      let errorMessage = 'Mi dispiace, ho avuto un problema tecnico.';

      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        errorMessage = '⏱️ La richiesta è scaduta. Verifica la connessione internet e riprova.';
      } else if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError')
      ) {
        errorMessage = '📡 Errore di connessione. Verifica la connessione internet e riprova.';
      } else if (error.message) {
        // Usa il messaggio di errore originale se disponibile
        errorMessage = error.message;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date(),
        },
      ]);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Toggle espansione
  const toggleExpand = () => {
    if (isMinimized) {
      setIsMinimized(false);
      setIsExpanded(true);
    } else {
      setIsExpanded(!isExpanded);
    }
  };

  // Minimizza
  const minimize = () => {
    setIsMinimized(true);
    setIsExpanded(false);
  };

  // Se siamo in test mode, non renderizzare Anne
  if (isTestMode) {
    return null;
  }

  return (
    <>
      {/* Floating Ghost Icon */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed top-6 right-6 z-30"
          >
            <motion.button
              onClick={toggleExpand}
              className="relative group"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />

              {/* Ghost container */}
              <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl">
                <Ghost className="w-8 h-8 text-white" />

                {/* Pulse animation */}
                <span className="absolute top-0 right-0 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                </span>
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                  Ciao! Sono Anne 👋
                  <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-900"></div>
                </div>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-40"
          >
            <div
              className={`bg-white rounded-2xl shadow-2xl border border-purple-100 flex flex-col transition-all duration-300 ${
                isExpanded ? 'w-96 h-[600px]' : 'w-80 h-96'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-50 via-pink-50 to-purple-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Ghost className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      Anne
                      <Sparkles className="w-4 h-4 text-purple-500" />
                    </h3>
                    <p className="text-xs text-purple-600">Assistente Virtuale</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                    title="Impostazioni"
                  >
                    <SettingsIcon className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={toggleExpand}
                    className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                    title={isExpanded ? 'Riduci' : 'Espandi'}
                  >
                    {isExpanded ? (
                      <Minimize2 className="w-4 h-4 text-gray-600" />
                    ) : (
                      <MessageCircle className="w-4 h-4 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={minimize}
                    className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                    title="Chiudi"
                  >
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div className="p-4 border-b bg-purple-50 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Preferenze Anne</h4>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preferences.showSuggestions}
                      onChange={(e) =>
                        setPreferences({ ...preferences, showSuggestions: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Mostra suggerimenti contestuali</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={preferences.autoGreet}
                      onChange={(e) =>
                        setPreferences({ ...preferences, autoGreet: e.target.checked })
                      }
                      className="rounded"
                    />
                    <span>Saluto automatico</span>
                  </label>

                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Livello notifiche</label>
                    <select
                      value={preferences.notificationLevel}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          notificationLevel: e.target.value as any,
                        })
                      }
                      className="text-sm border rounded px-2 py-1 w-full"
                    >
                      <option value="minimal">Minimale</option>
                      <option value="normal">Normale</option>
                      <option value="proactive">Proattivo</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* P4: Componenti Business Value */}
                {isExpanded && (
                  <>
                    {/* P4 Task 1: Value Dashboard */}
                    <ValueDashboard userId={userId} />

                    {/* P4 Task 3: Human Error Messages */}
                    <HumanError
                      agentState={currentAgentState}
                      onResolved={() => setCurrentAgentState(null)}
                    />

                    {/* P4 Task 2: Auto-Proceed Banner */}
                    {showAutoProceed && currentAgentState?.autoProceed && (
                      <AutoProceedBanner
                        message={
                          currentAgentState.userMessage ||
                          '✅ Dati verificati, procedo automaticamente'
                        }
                        cancellationWindowMs={autoProceedConfig.CANCELLATION_WINDOW_MS}
                        onCancel={() => {
                          setShowAutoProceed(false);
                          // TODO: Invia richiesta di annullamento al backend
                        }}
                        onComplete={() => {
                          setShowAutoProceed(false);
                        }}
                        operationType="pricing"
                      />
                    )}

                    {/* P4 Task 4: Smart Suggestions */}
                    <SmartSuggestions
                      userId={userId}
                      onAccept={(suggestion) => {
                        // TODO: Implementare logica accettazione suggerimento
                        console.log('Suggerimento accettato:', suggestion);
                      }}
                      onDismiss={(suggestion) => {
                        console.log('Suggerimento rifiutato:', suggestion);
                      }}
                    />
                  </>
                )}

                {messages.length === 0 && (
                  <div className="text-center text-gray-500 text-sm mt-8">
                    <Ghost className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                    <p className="font-medium">Ciao {userName}! 👋</p>
                    <p className="text-xs mt-1">Come posso aiutarti oggi?</p>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : msg.role === 'suggestion'
                            ? 'bg-amber-50 border border-amber-200 text-amber-900'
                            : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.role === 'suggestion' && (
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb className="w-3 h-3 text-amber-600" />
                          <span className="text-xs font-semibold">Suggerimento</span>
                        </div>
                      )}
                      <ReactMarkdown className="prose prose-sm max-w-none">
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-xl px-4 py-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <div
                          className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Scrivi ad Anne..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="p-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Anne può commettere errori</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* P2: Agent Debug Panel - Solo per admin/superadmin */}
      {(userRole === 'admin' || userRole === 'superadmin') && (
        <AgentDebugPanel telemetry={lastTelemetry} />
      )}
    </>
  );
}

/**
 * Genera messaggio di saluto personalizzato
 */
function getGreetingMessage(userName: string, userRole: string): string {
  const greetings = [
    `Ciao ${userName}! 👋 Sono Anne, il tuo assistente virtuale. Posso aiutarti con le spedizioni, calcolare costi e rispondere alle tue domande.`,
    `Benvenuto ${userName}! Hai bisogno di aiuto? Sono qui per guidarti nella dashboard.`,
    `Hey ${userName}! 🎉 Pronto a spedire? Fammi sapere se serve una mano!`,
  ];

  return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * Genera suggerimenti contestuali in base alla pagina
 */
function getContextualSuggestion(page: string, userRole: string): string | null {
  const suggestions: Record<string, string> = {
    '/dashboard':
      '💡 Da qui puoi vedere un riepilogo completo. Vuoi che ti aiuti a trovare qualcosa?',
    '/dashboard/spedizioni':
      '📦 Gestisci le tue spedizioni qui. Posso aiutarti a filtrare o cercare una spedizione specifica.',
    '/dashboard/spedizioni/nuova':
      '🚀 Pronto a creare una nuova spedizione? Posso suggerirti il corriere più conveniente!',
    '/dashboard/wallet': "💰 Tieni d'occhio il tuo saldo. Ti serve aiuto per ricaricare il wallet?",
    '/dashboard/impostazioni':
      '⚙️ Personalizza la tua esperienza! Posso spiegarti le varie opzioni.',
  };

  return suggestions[page] || null;
}
