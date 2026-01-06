/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurazione per performance ottimali
  reactStrictMode: true,
  swcMinify: true,
  
  // Ottimizzazioni per Vercel
  compress: true,
  
  // ⚠️ OTTIMIZZAZIONE: Prefetch più aggressivo per navigazione veloce
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
  },
  
  // Configurazione immagini (se necessario in futuro)
  images: {
    formats: ['image/avif', 'image/webp'],
  },

  // Headers di sicurezza
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // script-src: unsafe-eval necessario per jsPDF, Tesseract.js che usano eval() internamente
              // ⚠️ NOTA: unsafe-eval è un rischio di sicurezza, ma necessario per queste librerie
              // ⚠️ xlsx è stato migrato a exceljs (server-side), non richiede più unsafe-eval
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://widget.spediresicuro.it https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai data:",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https://*.supabase.co https://*.vercel.app wss://*.supabase.co https://api.anthropic.com",
              "worker-src 'self' blob:", // Necessario per Tesseract.js workers
              "frame-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
              "upgrade-insecure-requests",
              // CSP Reporting: invia violazioni a /api/csp-report
              "report-uri /api/csp-report"
            ].join('; ')
          }
        ],
      },
    ]
  },
}

module.exports = nextConfig

