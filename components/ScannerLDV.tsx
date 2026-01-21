'use client';

/**
 * Componente Scanner LDV
 *
 * Scanner per lettura codice LDV (Lettera di Vettura) tramite fotocamera
 * Supporta barcode e QR code, con geolocalizzazione automatica
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { X, Camera, MapPin, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { confirmPickupScan } from '@/actions/logistics';

interface ScannerLDVProps {
  onClose: () => void;
  onSuccess?: (shipment: any) => void;
}

interface GPSLocation {
  lat: number;
  lng: number;
  error?: string;
}

export default function ScannerLDV({ onClose, onSuccess }: ScannerLDVProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const handleScanResultRef = useRef<((ldvNumber: string) => Promise<void>) | null>(null);

  // Inizializza scanner e richiedi geolocalizzazione
  useEffect(() => {
    initializeScanner();
    requestGeolocation();

    return () => {
      stopScanning();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (codeReaderRef.current && isScanningRef.current) {
        codeReaderRef.current.reset();
        isScanningRef.current = false;
      }
    };
  }, []);

  /**
   * Richiedi geolocalizzazione GPS
   */
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata dal browser');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0, // Non usare cache
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setError(null);
      },
      (err) => {
        console.warn('Errore geolocalizzazione:', err);
        setGpsLocation({
          lat: 0,
          lng: 0,
          error: `Geolocalizzazione non disponibile: ${err.message}`,
        });
        // Non bloccare lo scanning se GPS fallisce
      },
      options
    );
  }, []);

  /**
   * Inizializza scanner ZXing
   */
  const initializeScanner = useCallback(() => {
    try {
      codeReaderRef.current = new BrowserMultiFormatReader();
      startScanning();
    } catch (err: any) {
      console.error('Errore inizializzazione scanner:', err);
      setError(
        "Errore inizializzazione scanner. Assicurati di permettere l'accesso alla fotocamera."
      );
    }
  }, []);

  /**
   * Avvia scansione fotocamera
   */
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current || !videoRef.current) return;

    try {
      setIsScanning(true);
      setError(null);

      // Richiedi accesso alla fotocamera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Fotocamera posteriore su mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      // Avvia scansione continua
      isScanningRef.current = true;
      scanContinuously();
    } catch (err: any) {
      console.error('Errore accesso fotocamera:', err);
      setIsScanning(false);
      if (err.name === 'NotAllowedError') {
        setError("Accesso alla fotocamera negato. Consenti l'accesso e riprova.");
      } else if (err.name === 'NotFoundError') {
        setError('Nessuna fotocamera trovata sul dispositivo.');
      } else {
        setError(`Errore accesso fotocamera: ${err.message}`);
      }
    }
  }, []);

  /**
   * Scansione continua del video stream
   */
  const scanContinuously = useCallback(async () => {
    if (
      !codeReaderRef.current ||
      !videoRef.current ||
      !streamRef.current ||
      isProcessing ||
      successMessage
    )
      return;

    try {
      // Decodifica continua dal video stream
      await codeReaderRef.current.decodeFromStream(
        streamRef.current,
        videoRef.current,
        (result, err) => {
          if (result && handleScanResultRef.current) {
            const text = result.getText();
            handleScanResultRef.current(text);
          } else if (err && !(err instanceof NotFoundException)) {
            // NotFoundException è normale quando non trova codice
            console.debug('Nessun codice trovato:', err);
          }
        }
      );
    } catch (err: any) {
      if (!(err instanceof NotFoundException)) {
        console.error('Errore scansione:', err);
      }
    }
  }, [isProcessing, successMessage]);

  /**
   * Gestisce risultato scansione
   */
  const handleScanResult = useCallback(
    async (ldvNumber: string) => {
      // Salva riferimento per uso in scanContinuously
      handleScanResultRef.current = handleScanResult;
      if (isProcessing || successMessage) return;

      // Stop scanning temporaneo
      if (codeReaderRef.current && isScanningRef.current) {
        codeReaderRef.current.reset();
        isScanningRef.current = false;
      }

      setScanResult(ldvNumber);
      setIsProcessing(true);
      setError(null);

      try {
        // Prepara GPS location
        const gpsString = gpsLocation ? `${gpsLocation.lat},${gpsLocation.lng}` : null;

        // Chiama Server Action
        const result = await confirmPickupScan(ldvNumber, gpsString);

        if (result.success && result.shipment) {
          setSuccessMessage(
            `✅ Ritiro confermato!\nLDV: ${ldvNumber}\nDestinatario: ${result.shipment.recipient_name || 'N/A'}`
          );

          // Callback successo
          if (onSuccess) {
            onSuccess(result.shipment);
          }

          // Auto-close dopo 3 secondi
          setTimeout(() => {
            onClose();
          }, 3000);
        } else {
          setError(result.error || 'Errore durante la conferma del ritiro');
          setIsProcessing(false);

          // Riprendi scanning dopo errore
          setTimeout(() => {
            if (videoRef.current && streamRef.current) {
              scanContinuously();
            }
          }, 2000);
        }
      } catch (err: any) {
        console.error('Errore conferma ritiro:', err);
        setError(err.message || 'Errore sconosciuto');
        setIsProcessing(false);

        // Riprendi scanning dopo errore
        setTimeout(() => {
          if (videoRef.current && streamRef.current) {
            scanContinuously();
          }
        }, 2000);
      }
    },
    [gpsLocation, isProcessing, successMessage, onSuccess, onClose]
  );

  /**
   * Stop scanning
   */
  const stopScanning = useCallback(() => {
    setIsScanning(false);
    isScanningRef.current = false;
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Riavvia scansione
   */
  const restartScanning = useCallback(() => {
    stopScanning();
    setError(null);
    setScanResult(null);
    setSuccessMessage(null);
    setIsProcessing(false);
    setTimeout(() => {
      startScanning();
    }, 500);
  }, [stopScanning, startScanning]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Scanner Ritiro LDV</h2>
            <p className="text-sm text-gray-600 mt-1">
              Inquadra il codice LDV nella zona di scansione
            </p>
          </div>
          <button
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Video Scanner */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px]">
          {!isScanning && !error && (
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p>Inizializzazione scanner...</p>
            </div>
          )}

          {error && !isScanning && (
            <div className="text-center text-white p-6">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
              <p className="mb-4">{error}</p>
              <button
                onClick={restartScanning}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Riprova
              </button>
            </div>
          )}

          <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />

          {/* Overlay zona scansione */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                {/* Rettangolo zona scansione */}
                <div className="w-64 h-64 border-2 border-blue-500 rounded-lg shadow-lg">
                  {/* Angoli decorativi */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                </div>
              </div>
            </div>
          )}

          {/* Success overlay */}
          {successMessage && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-6">
              <div className="bg-white rounded-xl p-6 max-w-md text-center">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-gray-900 font-semibold whitespace-pre-line">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && !successMessage && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-900 font-semibold">Elaborazione ritiro...</p>
                {scanResult && <p className="text-sm text-gray-600 mt-2">LDV: {scanResult}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              {/* GPS Status */}
              <div className="flex items-center gap-2">
                <MapPin
                  className={`w-4 h-4 ${gpsLocation && !gpsLocation.error ? 'text-green-600' : 'text-gray-400'}`}
                />
                <span
                  className={gpsLocation && !gpsLocation.error ? 'text-green-600' : 'text-gray-500'}
                >
                  {gpsLocation && !gpsLocation.error
                    ? `GPS: ${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
                    : 'GPS non disponibile'}
                </span>
              </div>

              {/* Camera Status */}
              <div className="flex items-center gap-2">
                <Camera className={`w-4 h-4 ${isScanning ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={isScanning ? 'text-green-600' : 'text-gray-500'}>
                  {isScanning ? 'Scanner attivo' : 'Scanner fermo'}
                </span>
              </div>
            </div>

            {error && (
              <button
                onClick={restartScanning}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Riprova
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
