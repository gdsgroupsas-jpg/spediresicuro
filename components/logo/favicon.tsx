import React from 'react'

interface FaviconProps {
  size?: number
}

/**
 * Favicon SVG - Versione piccola dell'icona per browser tab
 * Basato su design Gemini - usa lo stesso simbolo dell'icona
 */
export default function Favicon({ size = 32 }: FaviconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="arrowGradientFavicon" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FFA500" />
        </linearGradient>
        <linearGradient id="ringGradientFavicon" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0066FF" />
          <stop offset="100%" stopColor="#00D4FF" />
        </linearGradient>
      </defs>

      <g id="LogoSymbol">
        <path
          d="M512 850C325.3 850 174 698.7 174 512C174 325.3 325.3 174 512 174C605 174 690 211 751 272L810 213C733 136 627 88 512 88C277 88 88 277 88 512C88 747 277 936 512 936C627 936 733 888 810 811L751 752C690 813 605 850 512 850Z"
          fill="url(#ringGradientFavicon)"
        />
        <path
          d="M280 800L580 150L450 450L650 450L350 1100L480 800L280 800Z"
          fill="url(#arrowGradientFavicon)"
          opacity="0.9"
        />
        <path
          d="M380 700L680 50L550 350L750 350L450 1000L580 700L380 700Z"
          fill="url(#arrowGradientFavicon)"
        />
      </g>
    </svg>
  )
}
