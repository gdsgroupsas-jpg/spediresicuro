/**
 * Componente: Anne Pilot Modal
 * 
 * Modal per la chat con Anne, Executive Business Partner.
 * Design moderno con supporto voice input e quick actions.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Mic, MicOff, Sparkles, TrendingUp, AlertCircle, Package } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userRole: 'admin' | 'user';
  userName?: string;
}

export function PilotModal({
  isOpen,
  onClose,
  userId,
  userRole,
  userName = 'Utente',
}: PilotModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input quando si apre
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = async (messageText: string, isVoice = false) => {
    if (!messageText.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: isVoice ? `[VOX]${messageText}` : messageText,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      });

      // ⚠️ Leggi il testo prima di fare parse JSON per evitare "Unexpected end of JSON input"
      const responseText = await response.text();
      
      // Verifica che ci sia contenuto
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Risposta vuota dal server. Verifica che il server sia in esecuzione e che ANTHROPIC_API_KEY sia configurata.');
      }

      // Prova a fare parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Errore parsing JSON:', parseError);
        console.error('Risposta ricevuta:', responseText.substring(0, 500));
        throw new Error(`Risposta non valida dal server: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        // ⚠️ Mostra dettagli errore in sviluppo
        const errorMessage = data.error || data.message || 'Errore sconosciuto';
        const errorDetails = data.details ? `\n\nDettagli: ${JSON.stringify(data.details, null, 2)}` : '';
        const errorHint = data.hint ? `\n\n💡 ${data.hint}` : '';
        
        throw new Error(`${errorMessage}${errorDetails}${errorHint}`);
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
        },
      ]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setError(error.message || 'Errore di connessione');

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `⚠️ ${error.message || 'Si è verificato un errore. Riprova tra qualche secondo.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const quickActions = userRole === 'admin'
    ? [
        {
          icon: <TrendingUp size={16} />,
          label: '📊 Analizza business',
          action: 'Analizza il business dell\'ultimo mese con confronto periodo precedente',
        },
        {
          icon: <AlertCircle size={16} />,
          label: '⚠️ Check sistema',
          action: 'Controlla gli ultimi errori di sistema e dimmi se ci sono criticità',
        },
        {
          icon: <Package size={16} />,
          label: '💰 Report fatturato',
          action: 'Genera report fatturato mese corrente con breakdown per corriere',
        },
        {
          icon: <Sparkles size={16} />,
          label: '💡 Suggerimenti',
          action: 'Dammi 3 suggerimenti operativi per ottimizzare margini basandoti sui dati attuali',
        },
      ]
    : [
        {
          icon: <Package size={16} />,
          label: '📦 Nuova spedizione',
          action: 'Voglio spedire un pacco, aiutami a calcolare il costo',
        },
        {
          icon: <TrendingUp size={16} />,
          label: '📊 Le mie spedizioni',
          action: 'Fammi un riepilogo delle mie spedizioni questo mese',
        },
        {
          icon: <AlertCircle size={16} />,
          label: '🔍 Traccia pacco',
          action: 'Voglio tracciare una spedizione',
        },
        {
          icon: <Sparkles size={16} />,
          label: '💰 Calcola costo',
          action: 'Calcola il costo per una spedizione',
        },
      ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">A</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                Anne
                <Sparkles className="text-purple-500" size={20} />
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                  Executive Business Partner
                </span>
                {userRole === 'admin' && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                    👑 Admin Mode
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-6">
              {/* Welcome Message */}
              <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-start gap-3">
                  <Sparkles className="text-purple-500 mt-1" size={24} />
                  <div>
                    <p className="text-gray-800 leading-relaxed font-medium">
                      👋 Ciao <strong>{userName}</strong>! Sono Anne, il tuo Executive Business Partner.
                    </p>
                    <p className="text-gray-600 text-sm mt-2">
                      {userRole === 'admin'
                        ? 'Monitoro business, finanza e sistemi. Posso analizzare margini, diagnosticare errori tecnici e proporre strategie di ottimizzazione.'
                        : 'Sono qui per aiutarti con le tue spedizioni, calcolare costi ottimali e risolvere problemi operativi.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-500" />
                  Azioni rapide
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => sendMessage(action.action)}
                      className="text-left p-4 bg-white rounded-xl border-2 border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-purple-500 group-hover:scale-110 transition-transform">
                          {action.icon}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700 group-hover:text-purple-600 font-medium">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Context Info */}
              <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">💡 Suggerimento</p>
                    <p>
                      {userRole === 'admin'
                        ? 'Puoi chiedermi di analizzare errori di sistema, ottimizzare margini, confrontare corrieri o generare report finanziari.'
                        : 'Puoi dettarmi i dati di una spedizione e la registro immediatamente con il costo ottimale.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-900 border border-gray-200'
                }`}
              >
                <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : ''}`}>
                  <ReactMarkdown>{message.content.replace('[VOX]', '')}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-5 py-3 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">Anne sta pensando...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                <div>
                  <p className="text-sm font-semibold text-red-800">Errore</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRecording(!isRecording)}
              className={`p-3 rounded-full transition-all flex-shrink-0 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
              title={isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Scrivi un messaggio ad Anne..."
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isLoading}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 hover:scale-105"
            >
              <Send size={20} />
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center">
            Anne può commettere errori. Verifica sempre le informazioni critiche.
          </p>
        </div>
      </div>
    </div>
  );
}





