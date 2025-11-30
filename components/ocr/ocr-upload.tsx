'use client';

/**
 * OCR Upload Component
 *
 * Upload immagine per estrazione dati spedizione via OCR
 */

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, Image as ImageIcon, X, AlertCircle, CheckCircle } from 'lucide-react';

interface OCRUploadProps {
  onDataExtracted: (data: any) => void;
  onError?: (error: string) => void;
}

export default function OCRUpload({ onDataExtracted, onError }: OCRUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      // Converti in base64
      const base64 = await fileToBase64(file);

      setExtracting(true);

      // Chiamata API OCR
      const response = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64,
          options: {
            language: 'ita',
            enhance: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Errore estrazione OCR');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Errore durante l\'estrazione');
      }

      setSuccess(true);
      onDataExtracted(result.extractedData);
    } catch (err: any) {
      const errorMsg = err.message || 'Errore durante l\'upload';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  }, [onDataExtracted, onError]);

  const handleClear = () => {
    setPreview(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!preview && (
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 border-gray-300 hover:border-gray-400 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-12 h-12 mb-3 text-gray-400" />
            <p className="mb-2 text-sm text-gray-700">
              <span className="font-semibold">Clicca per caricare</span> o trascina un&apos;immagine
            </p>
            <p className="text-xs text-gray-500">PNG, JPG, GIF fino a 10MB</p>
            <p className="mt-2 text-xs text-gray-400">
              Screenshot WhatsApp, foto documento, etc.
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}

      {/* Preview & Status */}
      {preview && (
        <div className="relative">
          <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
            <Image
              src={preview}
              alt="Anteprima immagine caricata per estrazione OCR"
              width={800}
              height={600}
              className="w-full h-auto max-h-96 object-contain"
              unoptimized
            />

            {/* Overlay durante estrazione */}
            {extracting && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-sm font-medium text-gray-900">
                    Estrazione dati in corso...
                  </p>
                  <p className="text-xs text-gray-500">
                    Analisi OCR dell&apos;immagine
                  </p>
                </div>
              </div>
            )}

            {/* Pulsante rimuovi */}
            {!extracting && (
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                title="Rimuovi immagine"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Messages */}
          {success && !extracting && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">
                  Dati estratti con successo!
                </p>
                <p className="text-xs text-green-700 mt-1">
                  I campi sono stati compilati automaticamente. Verifica e modifica se necessario.
                </p>
              </div>
            </div>
          )}

          {error && !extracting && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Errore</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <Image className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-label="Informazioni OCR" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Come funziona l&apos;OCR:</p>
            <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
              <li>Carica uno screenshot o foto del documento di spedizione</li>
              <li>Il sistema estrae automaticamente: nome, indirizzo, CAP, città, telefono</li>
              <li>Verifica i dati estratti e modifica se necessario</li>
              <li>Risparmia tempo ed evita errori di digitazione!</li>
            </ul>
          </div>
        </div>
      </div>
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
