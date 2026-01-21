/**
 * Pagina: AI OCR Scanner
 *
 * Scanner OCR per estrazione automatica dati da immagini
 * Supporta screenshot WhatsApp, foto documenti, etc.
 */

'use client';

import { useState } from 'react';
import DashboardNav from '@/components/dashboard-nav';
import OCRUpload from '@/components/ocr/ocr-upload';
import { ScanLine, Copy, CheckCircle2, AlertCircle } from 'lucide-react';

interface ExtractedData {
  nome?: string;
  cognome?: string;
  indirizzo?: string;
  cap?: string;
  citta?: string;
  provincia?: string;
  telefono?: string;
  email?: string;
  [key: string]: any;
}

export default function OCRScannerPage() {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleDataExtracted = (data: ExtractedData) => {
    setExtractedData(data);
  };

  const handleError = (error: string) => {
    console.error('OCR Error:', error);
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Errore copia:', err);
    }
  };

  const formatData = (data: ExtractedData) => {
    const fields = [
      { key: 'nome', label: 'Nome' },
      { key: 'cognome', label: 'Cognome' },
      { key: 'indirizzo', label: 'Indirizzo' },
      { key: 'cap', label: 'CAP' },
      { key: 'citta', label: 'Città' },
      { key: 'provincia', label: 'Provincia' },
      { key: 'telefono', label: 'Telefono' },
      { key: 'email', label: 'Email' },
    ];

    return fields.filter((field) => data[field.key]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav
        title="AI OCR Scanner"
        subtitle="Estrai automaticamente dati da immagini e documenti"
        showBackButton={true}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Area */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                <ScanLine className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Carica Immagine</h2>
                <p className="text-sm text-gray-600">Screenshot, foto documento, etc.</p>
              </div>
            </div>

            <OCRUpload onDataExtracted={handleDataExtracted} onError={handleError} />
          </div>

          {/* Results Area */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Dati Estratti</h2>
                <p className="text-sm text-gray-600">Verifica e copia i dati</p>
              </div>
            </div>

            {!extractedData ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ScanLine className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium">Nessun dato estratto</p>
                <p className="text-sm text-gray-500 mt-2">
                  Carica un&apos;immagine per iniziare l&apos;estrazione OCR
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {formatData(extractedData).map((field) => {
                  const value = extractedData[field.key];
                  const fieldId = `field-${field.key}`;
                  const isCopied = copied === field.key;

                  return (
                    <div
                      key={field.key}
                      className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            {field.label}
                          </label>
                          <p className="text-base font-medium text-gray-900 break-words">
                            {value || '—'}
                          </p>
                        </div>
                        {value && (
                          <button
                            onClick={() => copyToClipboard(value, field.key)}
                            className="flex-shrink-0 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Copia negli appunti"
                          >
                            {isCopied ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <Copy className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Raw Data (opzionale, per debug) */}
                {process.env.NODE_ENV === 'development' && (
                  <details className="mt-6">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                      Dati completi (debug)
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-auto max-h-64">
                      {JSON.stringify(extractedData, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Suggerimenti per migliori risultati
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Usa immagini ad alta risoluzione e ben illuminate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Assicurati che il testo sia chiaro e leggibile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>
                    Funziona meglio con screenshot WhatsApp, foto documenti di identità, etichette
                    spedizione
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Verifica sempre i dati estratti prima di utilizzarli</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
