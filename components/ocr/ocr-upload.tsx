'use client';

/**
 * Agent Upload Component (ex OCR Upload)
 *
 * Interfaccia Premium per il "Testa" del Logistics Brain.
 * Gestisce upload, animazioni "thinking" e feedback dell'Agente.
 */

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, Sparkles, Brain, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentUploadProps {
  onDataExtracted: (data: any) => void;
  onError?: (error: string) => void;
}

export default function AgentUpload({ onDataExtracted, onError }: AgentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('Sto analizzando l\'immagine...');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confidence, setConfidence] = useState<number>(0);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validazione file
    if (!file.type.startsWith('image/')) {
      const err = 'Il file deve essere un&apos;immagine (JPG, PNG, etc.)';
      setError(err);
      onError?.(err);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      const err = 'Il file è troppo grande (max 10MB)';
      setError(err);
      onError?.(err);
      return;
    }

    setError(null);
    setSuccess(false);
    setUploading(true);
    setAgentStatus('Caricamento immagine...');

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Converti in base64
      const base64 = await fileToBase64(file);

      setUploading(false);
      setAnalyzing(true);
      setAgentStatus('Gemini sta analizzando la chat...');

      // 🧠 Chiamata al nuovo LOGISTICS AGENT
      const response = await fetch('/api/agent/process-shipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          // text: opzionale, se volessimo passare testo manuale
        }),
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'analisi dell\'Agente');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'L\'agente non è riuscito a elaborare la richiesta');
      }

      // Successo!
      setSuccess(true);
      setConfidence(result.confidence || 0);
      onDataExtracted(result.data); // Passa i dati "intelligenti" al form
      
    } catch (err: any) {
      const errorMsg = err.message || 'Errore imprevisto';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }, [onDataExtracted, onError]);

  const handleClear = () => {
    setPreview(null);
    setError(null);
    setSuccess(false);
    setConfidence(0);
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <label className="group relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-slate-50 hover:bg-white hover:border-blue-400 hover:shadow-lg transition-all duration-300 overflow-hidden">
              
              {/* Sfondo animato hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-blue-50/0 group-hover:from-blue-50/50 group-hover:to-indigo-50/50 transition-all duration-500" />
              
              <div className="relative z-10 flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                <div className="mb-4 p-4 bg-white rounded-full shadow-sm group-hover:shadow-md group-hover:scale-110 transition-all duration-300">
                   <Sparkles className="w-8 h-8 text-blue-500" />
                </div>
                <p className="mb-2 text-lg font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                  Carica Screenshot o Documento
                </p>
                <p className="text-sm text-gray-500 max-w-xs mx-auto mb-4">
                  L&apos;IA estrarrà destinatario, indirizzo, note e contrassegno automaticamente.
                </p>
                <div className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 shadow-sm group-hover:border-blue-200">
                  Supporta WhatsApp, Email, Foto
                </div>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading || analyzing}
              />
            </label>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-md"
          >
            <div className="relative aspect-video max-h-[400px] bg-slate-100 flex items-center justify-center overflow-hidden group">
              <Image
                src={preview}
                alt="Analisi Agente"
                width={800}
                height={600}
                className={`w-full h-full object-contain transition-all duration-700 ${analyzing ? 'blur-sm scale-105' : ''}`}
                unoptimized
              />
              
              {/* Overlay Analisi in corso */}
              {analyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-20">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                      boxShadow: ["0px 0px 0px 0px rgba(59, 130, 246, 0.5)", "0px 0px 20px 10px rgba(59, 130, 246, 0.3)", "0px 0px 0px 0px rgba(59, 130, 246, 0.5)"]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-xl"
                  >
                    <Brain className="w-10 h-10 text-blue-600" />
                  </motion.div>
                  <p className="text-white font-medium text-lg drop-shadow-md animate-pulse">
                    {agentStatus}
                  </p>
                </div>
              )}

              {/* Pulsante Chiudi */}
              {!analyzing && (
                <button
                  onClick={handleClear}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur text-gray-600 rounded-full hover:bg-red-50 hover:text-red-500 shadow-sm transition-all z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Footer Risultato */}
            <div className="p-4 bg-white border-t border-gray-100">
               {analyzing ? (
                 <div className="flex items-center gap-3 text-blue-600">
                   <Loader2 className="w-5 h-5 animate-spin" />
                   <span className="text-sm font-medium">Elaborazione in corso...</span>
                 </div>
               ) : success ? (
                 <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center justify-between"
                 >
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-green-100 text-green-600 rounded-full">
                       <CheckCircle2 className="w-5 h-5" />
                     </div>
                     <div>
                       <p className="text-sm font-bold text-gray-900">Analisi Completata</p>
                       <p className="text-xs text-gray-500">I dati sono stati inseriti nel form</p>
                     </div>
                   </div>
                   
                   {confidence > 0 && (
                     <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                       confidence > 80 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                     }`}>
                       {confidence}% Sicurezza
                     </div>
                   )}
                 </motion.div>
               ) : error ? (
                 <div className="flex items-center gap-3 text-red-600">
                   <AlertTriangle className="w-5 h-5" />
                   <span className="text-sm font-medium">{error}</span>
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-gray-500 text-sm">
                   <Sparkles className="w-4 h-4" />
                   <span>Immagine pronta per l&apos;invio</span>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper: File to Base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      // Rimuovi prefix "data:image/...;base64,"
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
}
