'use client'

/**
 * Componente Scanner LDV Import - Mobile-Optimized con Real-Time
 * 
 * Scanner per importare spedizioni tramite fotocamera/barcode
 * Ottimizzato per smartphone/tablet con:
 * - Fullscreen mode
 * - Vibrazione feedback
 * - Suono feedback
 * - Sincronizzazione real-time (mobile → desktop)
 * - Supporto landscape/portrait
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { X, Camera, CheckCircle2, AlertCircle, Loader2, Package, RotateCcw } from 'lucide-react'
import { importShipmentFromLDV, checkLDVDuplicate } from '@/actions/ldv-import'
import { vibrateDevice, playBeepSound } from '@/hooks/useRealtimeShipments'

interface ScannerLDVImportProps {
  onClose: () => void
  onSuccess?: (shipment: any) => void
  mode?: 'import' | 'return' // import = nuova spedizione, return = reso
}

interface GPSLocation {
  lat: number
  lng: number
  error?: string
}

export default function ScannerLDVImport({ onClose, onSuccess, mode = 'import' }: ScannerLDVImportProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [gpsLocation, setGpsLocation] = useState<GPSLocation | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const isScanningRef = useRef<boolean>(false)
  const handleScanResultRef = useRef<((ldvNumber: string) => Promise<void>) | null>(null)

  // Rileva se è mobile
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined' || typeof navigator === 'undefined') return
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768)
    }
    checkMobile()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile)
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])

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
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsLocation({ lat: 0, lng: 0, error: 'Geolocalizzazione non supportata' })
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
      },
      (err) => {
        console.warn('Errore geolocalizzazione:', err)
        setGpsLocation({
          lat: 0,
          lng: 0,
          error: `GPS non disponibile: ${err.message}`,
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
      startScanning()
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
    
    // Safety check per browser support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('La fotocamera non è supportata su questo browser')
      return
    }

    try {
      setIsScanning(true)
      setError(null)
      setDuplicateWarning(null)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Fotocamera posteriore su mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.setAttribute('playsinline', 'true') // Importante per iOS
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
            // NotFoundException è normale quando non trova codice
            console.debug('Nessun codice trovato')
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

    const ldvClean = ldvNumber.trim().toUpperCase()
    setScanResult(ldvClean)
    setIsProcessing(true)
    setError(null)
    setDuplicateWarning(null)

    // Vibrazione breve quando trova codice
    vibrateDevice(100)

    try {
      // 1. Verifica duplicati PRIMA di importare
      const duplicateCheck = await checkLDVDuplicate(ldvClean)
      
      if (duplicateCheck.exists && duplicateCheck.shipment) {
        // Duplicato trovato
        setDuplicateWarning(
          `⚠️ LDV già presente!\nTracking: ${duplicateCheck.shipment.tracking_number || 'N/A'}\nCreata: ${new Date(duplicateCheck.shipment.created_at).toLocaleString('it-IT')}`
        )
        setIsProcessing(false)
        vibrateDevice([100, 50, 100]) // Vibrazione doppia per errore
        
        // Riprendi scanning dopo 3 secondi
        setTimeout(() => {
          setDuplicateWarning(null)
          if (videoRef.current && streamRef.current) {
            scanContinuously()
          }
        }, 3000)
        return
      }

      // 2. Prepara GPS location
      const gpsString = gpsLocation && !gpsLocation.error
        ? `${gpsLocation.lat},${gpsLocation.lng}`
        : null

      // 3. Importa spedizione
      const result = await importShipmentFromLDV(ldvClean, gpsString)

      if (result.success && result.shipment) {
        // Successo!
        setSuccessMessage(
          `✅ Importata!\nLDV: ${ldvClean}\nTracking: ${result.shipment.tracking_number || 'N/A'}`
        )

        // Feedback successo
        vibrateDevice([100, 50, 100, 50, 100]) // Vibrazione successo
        playBeepSound() // Suono beep

        // Callback successo
        if (onSuccess) {
          onSuccess(result.shipment)
        }

        // Auto-close dopo 2 secondi (più veloce per mobile)
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        // Errore
        setError(result.error || 'Errore durante l\'importazione')
        setIsProcessing(false)
        vibrateDevice([200, 100, 200]) // Vibrazione errore

        // Riprendi scanning dopo errore
        setTimeout(() => {
          if (videoRef.current && streamRef.current) {
            scanContinuously()
          }
        }, 2000)
      }
    } catch (err: any) {
      console.error('Errore import spedizione:', err)
      setError(err.message || 'Errore sconosciuto')
      setIsProcessing(false)
      vibrateDevice([200, 100, 200]) // Vibrazione errore

      // Riprendi scanning
      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          scanContinuously()
        }
      }, 2000)
    }
  }, [gpsLocation, isProcessing, successMessage, onSuccess, onClose])

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
    setDuplicateWarning(null)
    setIsProcessing(false)
    setTimeout(() => {
      startScanning()
    }, 500)
  }, [stopScanning, startScanning])

  // Layout mobile-optimized (fullscreen)
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {/* Video Scanner Fullscreen */}
        <div className="relative w-full h-full">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Overlay zona scansione */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative">
                <div className="w-[80vw] h-[80vw] max-w-[400px] max-h-[400px] border-2 border-green-500 rounded-lg shadow-2xl">
                  <div className="absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 border-green-500 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 border-green-500 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 border-green-500 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 border-green-500 rounded-br-lg" />
                </div>
                <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-white text-center">
                  <p className="text-lg font-bold mb-1">Inquadra il codice</p>
                  <p className="text-sm opacity-75">LDV / Barcode / QR Code</p>
                </div>
              </div>
            </div>
          )}

          {/* Header mobile */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">Scanner LDV</h2>
                <p className="text-white/70 text-xs">
                  {mode === 'return' ? 'Importa Reso' : 'Importa Spedizione'}
                </p>
              </div>
              <button
                onClick={() => {
                  stopScanning()
                  onClose()
                }}
                className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Processing overlay */}
          {isProcessing && !successMessage && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
              <div className="bg-white rounded-2xl p-8 text-center max-w-[90vw]">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-900 font-semibold text-lg">Elaborazione...</p>
                {scanResult && (
                  <p className="text-sm text-gray-600 mt-2">LDV: {scanResult}</p>
                )}
              </div>
            </div>
          )}

          {/* Success overlay */}
          {successMessage && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
              <div className="bg-green-500 rounded-2xl p-8 text-center max-w-[90vw]">
                <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-4" />
                <p className="text-white font-bold text-lg whitespace-pre-line">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && !isProcessing && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20 p-4">
              <div className="bg-red-500 rounded-2xl p-6 text-center max-w-[90vw]">
                <AlertCircle className="w-12 h-12 text-white mx-auto mb-4" />
                <p className="text-white font-semibold mb-4">{error}</p>
                <button
                  onClick={restartScanning}
                  className="px-6 py-3 bg-white text-red-600 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                >
                  Riprova
                </button>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20 p-4">
              <div className="bg-orange-500 rounded-2xl p-6 text-center max-w-[90vw]">
                <AlertCircle className="w-12 h-12 text-white mx-auto mb-4" />
                <p className="text-white font-semibold whitespace-pre-line mb-4">{duplicateWarning}</p>
                <button
                  onClick={restartScanning}
                  className="px-6 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-gray-100 transition-colors"
                >
                  Scansiona Altro
                </button>
              </div>
            </div>
          )}

          {/* Footer info mobile */}
          {!isProcessing && !successMessage && !error && !duplicateWarning && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 z-10">
              <div className="flex items-center justify-center gap-4 text-white text-xs">
                <div className="flex items-center gap-2">
                  <Camera className={`w-4 h-4 ${isScanning ? 'text-green-400' : 'text-gray-400'}`} />
                  <span>{isScanning ? 'Scanner attivo' : 'Scanner fermo'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Layout desktop (modal)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'return' ? 'Scanner Importa Reso' : 'Scanner Importa LDV'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Scansiona il codice LDV per importare la spedizione
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

        {/* Video Scanner */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px]">
          {!isScanning && !error && (
            <div className="text-center text-white">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
              <p>Inizializzazione scanner...</p>
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
                <div className="w-64 h-64 border-2 border-green-500 rounded-lg shadow-lg">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg" />
                </div>
              </div>
            </div>
          )}

          {/* Processing overlay */}
          {isProcessing && !successMessage && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="bg-white rounded-xl p-6 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-900 font-semibold">Elaborazione...</p>
                {scanResult && (
                  <p className="text-sm text-gray-600 mt-2">LDV: {scanResult}</p>
                )}
              </div>
            </div>
          )}

          {/* Success overlay */}
          {successMessage && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="bg-green-500 rounded-xl p-6 text-center">
                <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-4" />
                <p className="text-white font-semibold whitespace-pre-line">{successMessage}</p>
              </div>
            </div>
          )}

          {/* Error overlay */}
          {error && !isProcessing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="bg-red-500 rounded-xl p-6 text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-white mx-auto mb-4" />
                <p className="text-white font-semibold mb-4">{error}</p>
                <button
                  onClick={restartScanning}
                  className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Riprova
                </button>
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="bg-orange-500 rounded-xl p-6 text-center max-w-md">
                <AlertCircle className="w-12 h-12 text-white mx-auto mb-4" />
                <p className="text-white font-semibold whitespace-pre-line mb-4">{duplicateWarning}</p>
                <button
                  onClick={restartScanning}
                  className="px-4 py-2 bg-white text-orange-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Scansiona Altro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
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
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Riprova
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

