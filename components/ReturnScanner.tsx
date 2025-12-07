'use client'

/**
 * Componente Scanner Resi
 * 
 * Scanner per registrazione resi tramite fotocamera/barcode
 * Basato su ScannerLDV.tsx ma adattato per resi
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { X, Camera, MapPin, CheckCircle2, AlertCircle, Loader2, Package, ArrowLeftRight } from 'lucide-react'
import { processReturnScan } from '@/actions/returns'

interface ReturnScannerProps {
  onClose: () => void
  onSuccess?: (returnShipment: any, originalShipment: any) => void
}

interface GPSLocation {
  lat: number
  lng: number
  error?: string
}

export default function ReturnScanner({ onClose, onSuccess }: ReturnScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Input manuale
  const [originalTracking, setOriginalTracking] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const isScanningRef = useRef<boolean>(false)
  const handleScanResultRef = useRef<((ldvNumber: string) => Promise<void>) | null>(null)

  // Inizializza scanner e richiedi geolocalizzazione
  useEffect(() => {
    initializeScanner()
    requestGeolocation()

    return () => {
      stopScanning()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (codeReaderRef.current && isScanningRef.current) {
        codeReaderRef.current.reset()
        isScanningRef.current = false
      }
    }
  }, [])

  /**
   * Richiedi geolocalizzazione GPS
   */
  const requestGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalizzazione non supportata dal browser')
      return
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setError(null)
      },
      (err) => {
        console.warn('Errore geolocalizzazione:', err)
        setGpsLocation({
          lat: 0,
          lng: 0,
          error: `Geolocalizzazione non disponibile: ${err.message}`,
        })
      },
      options
    )
  }, [])

  /**
   * Inizializza scanner ZXing
   */
  const initializeScanner = useCallback(() => {
    try {
      codeReaderRef.current = new BrowserMultiFormatReader()
    } catch (err: any) {
      console.error('Errore inizializzazione scanner:', err)
      setError('Errore inizializzazione scanner. Assicurati di permettere l\'accesso alla fotocamera.')
    }
  }, [])

  /**
   * Avvia scansione fotocamera
   */
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current || !videoRef.current) return

    try {
      setIsScanning(true)
      setError(null)
      setShowManualInput(false)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      isScanningRef.current = true
      scanContinuously()
    } catch (err: any) {
      console.error('Errore accesso fotocamera:', err)
      setIsScanning(false)
      if (err.name === 'NotAllowedError') {
        setError('Accesso alla fotocamera negato. Consenti l\'accesso e riprova.')
      } else if (err.name === 'NotFoundError') {
        setError('Nessuna fotocamera trovata sul dispositivo.')
      } else {
        setError(`Errore accesso fotocamera: ${err.message}`)
      }
    }
  }, [])

  /**
   * Scansione continua del video stream
   */
  const scanContinuously = useCallback(async () => {
    if (!codeReaderRef.current || !videoRef.current || !streamRef.current || isProcessing || successMessage) return

    try {
      await codeReaderRef.current.decodeFromStream(
        streamRef.current,
        videoRef.current,
        (result, err) => {
          if (result && handleScanResultRef.current) {
            const text = result.getText()
            handleScanResultRef.current(text)
          } else if (err && !(err instanceof NotFoundException)) {
            console.debug('Nessun codice trovato:', err)
          }
        }
      )
    } catch (err: any) {
      if (!(err instanceof NotFoundException)) {
        console.error('Errore scansione:', err)
      }
    }
  }, [isProcessing, successMessage])

  /**
   * Gestisce risultato scansione
   */
  const handleScanResult = useCallback(async (ldvNumber: string) => {
    handleScanResultRef.current = handleScanResult

    if (isProcessing || successMessage) return

    // Stop scanning temporaneo
    if (codeReaderRef.current && isScanningRef.current) {
      codeReaderRef.current.reset()
      isScanningRef.current = false
    }

    setScanResult(ldvNumber)

    // Mostra form per inserire tracking originale e motivo
    setShowManualInput(true)
    setError(null)
  }, [isProcessing, successMessage])

  /**
   * Processa reso con dati completi
   */
  const handleProcessReturn = useCallback(async () => {
    if (!scanResult || !originalTracking.trim() || !returnReason.trim()) {
      setError('Compila tutti i campi obbligatori')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const gpsString = gpsLocation
        ? `${gpsLocation.lat},${gpsLocation.lng}`
        : null

      const result = await processReturnScan(
        scanResult,
        originalTracking.trim(),
        returnReason.trim(),
        gpsString
      )

      if (result.success && result.returnShipment) {
        setSuccessMessage(
          `✅ Reso registrato!\nLDV Reso: ${scanResult}\nTracking Reso: ${result.returnShipment.tracking_number || 'N/A'}`
        )

        if (onSuccess) {
          onSuccess(result.returnShipment, result.originalShipment)
        }

        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        setError(result.error || 'Errore durante la registrazione del reso')
        setIsProcessing(false)
      }
    } catch (err: any) {
      console.error('Errore conferma reso:', err)
      setError(err.message || 'Errore sconosciuto')
      setIsProcessing(false)
    }
  }, [scanResult, originalTracking, returnReason, gpsLocation, onSuccess, onClose])

  /**
   * Stop scanning
   */
  const stopScanning = useCallback(() => {
    setIsScanning(false)
    isScanningRef.current = false
    if (codeReaderRef.current) {
      codeReaderRef.current.reset()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  /**
   * Riavvia scansione
   */
  const restartScanning = useCallback(() => {
    stopScanning()
    setError(null)
    setScanResult(null)
    setSuccessMessage(null)
    setOriginalTracking('')
    setReturnReason('')
    setShowManualInput(false)
    setIsProcessing(false)
    setTimeout(() => {
      startScanning()
    }, 500)
  }, [stopScanning, startScanning])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Registra Reso</h2>
            <p className="text-sm text-gray-600 mt-1">
              {showManualInput
                ? 'Compila i dati per completare il reso'
                : 'Inquadra il codice LDV del reso o inserisci manualmente'}
            </p>
          </div>
          <button
            onClick={() => {
              stopScanning()
              onClose()
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!showManualInput ? (
            /* Scanner Mode */
            <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px]">
              {!isScanning && !error && (
                <div className="text-center text-white">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
                  <p>Pronto per la scansione...</p>
                  <button
                    onClick={startScanning}
                    className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Avvia Scansione
                  </button>
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

              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                muted
              />

              {/* Overlay zona scansione */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative">
                    <div className="w-64 h-64 border-2 border-blue-500 rounded-lg shadow-lg">
                      <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
                    </div>
                  </div>
                </div>
              )}

              {/* Processing overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="bg-white rounded-xl p-6 text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-900 font-semibold">
                      Elaborazione reso...
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Manual Input Mode */
            <div className="p-6 space-y-6">
              {/* LDV Scansionato */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-900">LDV Reso Scansionato</div>
                    <div className="text-lg font-bold text-blue-700">{scanResult}</div>
                  </div>
                  <button
                    onClick={restartScanning}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Cambia
                  </button>
                </div>
              </div>

              {/* Tracking Originale */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tracking Spedizione Originale <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={originalTracking}
                  onChange={(e) => setOriginalTracking(e.target.value.toUpperCase())}
                  placeholder="Inserisci tracking o LDV spedizione originale"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-md transition-all bg-white text-gray-900 font-medium placeholder:text-gray-500 hover:border-gray-400"
                  disabled={isProcessing}
                />
              </div>

              {/* Motivo Reso */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Motivo del Reso <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Es: Prodotto difettoso, Cambio taglia, Cliente non soddisfatto..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder:text-gray-400 resize-none"
                  disabled={isProcessing}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="whitespace-pre-line">{successMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleProcessReturn}
                  disabled={isProcessing || !scanResult || !originalTracking.trim() || !returnReason.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Registra Reso
                    </>
                  )}
                </button>
                <button
                  onClick={restartScanning}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                >
                  Annulla
                </button>
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
                <MapPin className={`w-4 h-4 ${gpsLocation && !gpsLocation.error ? 'text-green-600' : 'text-gray-400'}`} />
                <span className={gpsLocation && !gpsLocation.error ? 'text-green-600' : 'text-gray-500'}>
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

            {!showManualInput && error && (
              <button
                onClick={() => setShowManualInput(true)}
                className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Inserisci Manualmente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

