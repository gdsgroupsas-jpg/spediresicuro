import React from 'react'

interface LogoHorizontalProps {
  className?: string
  width?: number
  height?: number
}

/**
 * Logo Horizontal - Versione orizzontale colorata (simbolo + testo)
 * Basato su design Gemini - ottimizzato per React e header
 * Versione ottimizzata per non essere tagliata nell'header
 */
export default function LogoHorizontal({ className = '', width = 400, height = 133 }: LogoHorizontalProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 3000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SpedireSicuro - Powered by AI"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="arrowGradientH" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
        <linearGradient id="ringGradientH" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#00D4FF" />
        </linearGradient>
      </defs>

      {/* Simbolo - posizionato più in alto per evitare tagli */}
      <g transform="translate(100, 50) scale(0.7)">
        <path
          d="M512 850C325.3 850 174 698.7 174 512C174 325.3 325.3 174 512 174C605 174 690 211 751 272L810 213C733 136 627 88 512 88C277 88 88 277 88 512C88 747 277 936 512 936C627 936 733 888 810 811L751 752C690 813 605 850 512 850Z"
          fill="url(#ringGradientH)"
        />
        <path
          d="M280 800L580 150L450 450L650 450L350 1100L480 800L280 800Z"
          fill="url(#arrowGradientH)"
          opacity="0.9"
        />
        <path
          d="M380 700L680 50L550 350L750 350L450 1000L580 700L380 700Z"
          fill="url(#arrowGradientH)"
        />
      </g>

      {/* Testo principale - posizionato più in alto */}
      <text
        x="1000"
        y="480"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="280"
        fill="#000000"
        className="text-main"
      >
        SPEDIRESICURO
      </text>
      
      {/* Tagline - posizionata più in alto e più piccola */}
      <text
        x="1980"
        y="650"
        textAnchor="end"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="normal"
        fontSize="120"
        fill="#333333"
        className="text-tagline"
      >
        Powered by AI
      </text>
    </svg>
  )
}
