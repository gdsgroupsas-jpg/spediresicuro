'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Plus, Printer, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tracking number della spedizione creata */
  trackingNumber: string;
  /** ID interno spedizione (opzionale) */
  shipmentId?: string;
  /** Costo della spedizione (opzionale) */
  cost?: string;
  /** Corriere utilizzato */
  courier?: string;
  /** Callback quando utente clicca "Stampa Etichetta" */
  onPrintLabel?: () => void;
  /** Callback quando utente clicca "Traccia Spedizione" */
  onTrackShipment?: () => void;
  /** Callback quando utente clicca "Crea Altra Spedizione" */
  onCreateAnother?: () => void;
  /** Messaggio custom (default: "Spedizione Creata") */
  title?: string;
  /** Descrizione aggiuntiva (opzionale) */
  description?: string;
}

/**
 * SuccessModal - Modal di conferma successo operazione
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - Modal centrato con animazione fade-in
 * - Checkmark animato
 * - Tracking number large, copyable
 * - 3 action buttons: Print, Track, Create Another
 * - No auto-dismiss (user controls)
 * - Accessibile (keyboard nav, aria labels)
 */
export function SuccessModal({
  open,
  onOpenChange,
  trackingNumber,
  shipmentId,
  cost,
  courier,
  onPrintLabel,
  onTrackShipment,
  onCreateAnother,
  title = 'Spedizione Creata',
  description,
}: SuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const trackingRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // Focus close button for accessibility
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  // Copy tracking number to clipboard
  const handleCopyTracking = async () => {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      if (trackingRef.current) {
        const range = document.createRange();
        range.selectNodeContents(trackingRef.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand('copy');
        selection?.removeAllRanges();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-modal-title"
    >
      {/* Backdrop - no dismiss on click per spec */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={() => onOpenChange(false)}
          className={cn(
            'absolute right-4 top-4 p-1 rounded-lg',
            'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
          )}
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Animated Checkmark */}
          <div className="mx-auto w-16 h-16 mb-6 relative">
            <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-25" />
            <div className="relative w-full h-full bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 animate-in zoom-in-50 duration-300" />
            </div>
          </div>

          {/* Title */}
          <h2 id="success-modal-title" className="text-xl font-bold text-gray-900 mb-2">
            {title}
          </h2>

          {/* Description */}
          {description && <p className="text-sm text-gray-500 mb-6">{description}</p>}

          {/* Tracking Number - Large, copyable */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Tracking Number
            </p>
            <div className="flex items-center justify-center gap-2">
              <div
                ref={trackingRef}
                className="text-2xl font-mono font-bold text-gray-900 select-all cursor-text"
                onClick={handleCopyTracking}
              >
                {trackingNumber}
              </div>
              <button
                onClick={handleCopyTracking}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  copied
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                )}
                title={copied ? 'Copiato!' : 'Copia tracking'}
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Additional Info */}
          {(courier || cost) && (
            <div className="flex justify-center gap-6 mb-6 text-sm text-gray-600">
              {courier && (
                <div>
                  <span className="text-gray-400">Corriere:</span>{' '}
                  <span className="font-medium">{courier}</span>
                </div>
              )}
              {cost && (
                <div>
                  <span className="text-gray-400">Costo:</span>{' '}
                  <span className="font-medium">{cost}</span>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {onPrintLabel && (
              <button
                onClick={onPrintLabel}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                  'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold',
                  'hover:opacity-90 transition-opacity',
                  'focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:ring-offset-2'
                )}
              >
                <Printer className="w-4 h-4" />
                Stampa Etichetta
              </button>
            )}

            {onTrackShipment && (
              <button
                onClick={onTrackShipment}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                  'border-2 border-gray-200 text-gray-700 font-semibold',
                  'hover:bg-gray-50 hover:border-gray-300 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
                )}
              >
                <ExternalLink className="w-4 h-4" />
                Traccia
              </button>
            )}

            {onCreateAnother && (
              <button
                onClick={() => {
                  onCreateAnother();
                  onOpenChange(false);
                }}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                  'border-2 border-gray-200 text-gray-700 font-semibold',
                  'hover:bg-gray-50 hover:border-gray-300 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2'
                )}
              >
                <Plus className="w-4 h-4" />
                Nuova
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SuccessModal;
