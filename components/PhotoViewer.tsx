/**
 * PhotoViewer Component
 *
 * Visualizzatore foto ottimizzato per mobile con:
 * - Full-screen responsive
 * - Pinch-to-zoom e doppio tap per zoom
 * - Swipe per navigare tra foto
 * - Touch gestures ottimizzati
 * - Chiusura con swipe down
 */

'use client';

import { useState, useEffect, useRef, TouchEvent } from 'react';
import Image from 'next/image';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Photo {
  url: string;
  alt?: string;
  title?: string;
}

interface PhotoViewerProps {
  photos: Photo[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function PhotoViewer({
  photos,
  initialIndex = 0,
  isOpen,
  onClose
}: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, distance: 0 });
  const imageRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  const currentPhoto = photos[currentIndex];

  // Reset su cambio foto
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Reset su apertura
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  // Impedisci scroll del body quando aperto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Doppio tap per zoom
  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Doppio tap rilevato
      if (scale === 1) {
        setScale(2);
      } else {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    }

    lastTapRef.current = now;
  };

  // Calcola distanza tra due tocchi (per pinch zoom)
  const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch start
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        distance: 0,
      });
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      // Pinch zoom start
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setTouchStart({
        x: 0,
        y: 0,
        distance,
      });
    }
  };

  // Touch move
  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      // Pan
      const deltaX = e.touches[0].clientX - touchStart.x;
      const deltaY = e.touches[0].clientY - touchStart.y;

      if (scale > 1) {
        // Se zoomato, permetti pan
        setPosition({
          x: position.x + deltaX,
          y: position.y + deltaY,
        });
        setTouchStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          distance: 0,
        });
      } else {
        // Se non zoomato, swipe per cambiare foto
        if (Math.abs(deltaX) > 50) {
          if (deltaX > 0 && currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setIsDragging(false);
          } else if (deltaX < 0 && currentIndex < photos.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsDragging(false);
          }
        }
      }
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale_delta = distance / touchStart.distance;
      const newScale = Math.min(Math.max(scale * scale_delta, 0.5), 4);
      setScale(newScale);
      setTouchStart({
        ...touchStart,
        distance,
      });
    }
  };

  // Touch end
  const handleTouchEnd = () => {
    setIsDragging(false);

    // Reset se scale < 1
    if (scale < 1) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Navigazione
  const goToNext = () => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Zoom buttons
  const zoomIn = () => {
    setScale(Math.min(scale + 0.5, 4));
  };

  const zoomOut = () => {
    const newScale = Math.max(scale - 0.5, 1);
    setScale(newScale);
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  // Download
  const handleDownload = async () => {
    try {
      const response = await fetch(currentPhoto.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foto-${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore download:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 safe-area-inset-top">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {currentPhoto.title && (
                <h3 className="text-white font-semibold truncate">{currentPhoto.title}</h3>
              )}
              <p className="text-white/70 text-sm">
                {currentIndex + 1} / {photos.length}
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div
          ref={imageRef}
          className="absolute inset-0 flex items-center justify-center overflow-hidden touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleDoubleTap}
        >
          <motion.div
            animate={{
              scale,
              x: position.x,
              y: position.y,
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            className="relative w-full h-full"
          >
            <Image
              src={currentPhoto.url}
              alt={currentPhoto.alt || `Foto ${currentIndex + 1}`}
              fill
              className="object-contain"
              priority
              quality={90}
              unoptimized
            />
          </motion.div>
        </div>

        {/* Navigation Arrows - Desktop */}
        {photos.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={goToPrev}
                className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                aria-label="Foto precedente"
              >
                <ChevronLeft className="w-8 h-8 text-white" />
              </button>
            )}
            {currentIndex < photos.length - 1 && (
              <button
                onClick={goToNext}
                className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
                aria-label="Foto successiva"
              >
                <ChevronRight className="w-8 h-8 text-white" />
              </button>
            )}
          </>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4 safe-area-inset-bottom">
          <div className="flex items-center justify-center gap-4">
            {/* Zoom Out */}
            <button
              onClick={zoomOut}
              disabled={scale <= 1}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-5 h-5 text-white" />
            </button>

            {/* Zoom indicator */}
            <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
              <span className="text-white text-sm font-medium">{Math.round(scale * 100)}%</span>
            </div>

            {/* Zoom In */}
            <button
              onClick={zoomIn}
              disabled={scale >= 4}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-5 h-5 text-white" />
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-3 rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors"
              aria-label="Scarica foto"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Photo indicators */}
          {photos.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentIndex
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/40 hover:bg-white/60'
                  }`}
                  aria-label={`Vai alla foto ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Help Hint - Solo mobile, scompare dopo qualche secondo */}
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 3, duration: 1 }}
          className="md:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        >
          <div className="bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-3">
            <p className="text-white text-sm text-center">
              👆 Doppio tap per zoom<br />
              👈👉 Swipe per navigare
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
