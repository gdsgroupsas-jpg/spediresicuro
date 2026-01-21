import React from 'react';

interface LogoWhiteProps {
  className?: string;
  width?: number;
  height?: number;
}

/**
 * Logo White - Versione monocromatica bianca orizzontale
 * Basato su design Gemini - ottimizzato per React
 * Nota: Sfondo trasparente, da usare su sfondi scuri
 */
export default function LogoWhite({ className = '', width = 600, height = 200 }: LogoWhiteProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 3000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SpedireSicuro - Powered by AI"
    >
      <g transform="translate(100, 100) scale(0.8)">
        <path
          d="M512 850C325.3 850 174 698.7 174 512C174 325.3 325.3 174 512 174C605 174 690 211 751 272L810 213C733 136 627 88 512 88C277 88 88 277 88 512C88 747 277 936 512 936C627 936 733 888 810 811L751 752C690 813 605 850 512 850Z"
          fill="#FFFFFF"
        />
        <path d="M280 800L580 150L450 450L650 450L350 1100L480 800L280 800Z" fill="#FFFFFF" />
        <path d="M380 700L680 50L550 350L750 350L450 1000L580 700L380 700Z" fill="#FFFFFF" />
      </g>

      <text
        x="1000"
        y="550"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fontSize="300"
        fill="#FFFFFF"
        className="text-main"
      >
        SPEDIRESICURO
      </text>
      <text
        x="1980"
        y="750"
        textAnchor="end"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="normal"
        fontSize="140"
        fill="#FFFFFF"
        className="text-tagline"
      >
        Powered by AI
      </text>
    </svg>
  );
}
