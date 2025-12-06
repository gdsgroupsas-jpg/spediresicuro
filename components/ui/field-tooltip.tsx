/**
 * Componente Tooltip per Campi Form
 * 
 * Mostra un tooltip automatico quando l'utente passa il mouse sul campo
 */

'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface FieldTooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function FieldTooltip({ 
  content, 
  children, 
  position = 'top' 
}: FieldTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl pointer-events-none`}
        >
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-white leading-relaxed">{content}</p>
          </div>
          {/* Freccia */}
          <div
            className={`absolute ${
              position === 'top'
                ? 'top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900'
                : position === 'bottom'
                ? 'bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900'
                : position === 'left'
                ? 'left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900'
                : 'right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900'
            }`}
          />
        </div>
      )}
    </div>
  );
}





