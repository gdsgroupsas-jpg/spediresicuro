import React from 'react'

interface LogoStackedProps {
  className?: string
  width?: number
  height?: number
}

/**
 * Logo Stacked - Versione verticale colorata (simbolo sopra, testo sotto)
 * Basato su design Gemini - ottimizzato per React
 */
export default function LogoStacked({ className = '', width = 300, height = 360 }: LogoStackedProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 1000 1200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SpedireSicuro - Powered by AI"
    >
      <defs>
        <linearGradient id="arrowGradientV" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
        <linearGradient id="ringGradientV" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#00D4FF" />
        </linearGradient>
      </defs>

      <g transform="translate(150, 50) scale(0.7)">
        <path
          d="M512 850C325.3 850 174 698.7 174 512C174 325.3 325.3 174 512 174C605 174 690 211 751 272L810 213C733 136 627 88 512 88C277 88 88 277 88 512C88 747 277 936 512 936C627 936 733 888 810 811L751 752C690 813 605 850 512 850Z"
          fill="url(#ringGradientV)"
        />
        <path
          d="M280 800L580 150L450 450L650 450L350 1100L480 800L280 800Z"
          fill="url(#arrowGradientV)"
          opacity="0.9"
        />
        <path
          d="M380 700L680 50L550 350L750 350L450 1000L580 700L380 700Z"
          fill="url(#arrowGradientV)"
        />
      </g>

      <text
        x="500"
        y="850"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="120"
        fill="#000000"
        className="text-main"
      >
        SPEDIRESICURO
      </text>
      <text
        x="500"
        y="980"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="normal"
        fontSize="70"
        fill="#333333"
        className="text-tagline"
      >
        Powered by AI
      </text>
    </svg>
  )
}
