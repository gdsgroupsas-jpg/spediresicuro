import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers'

export const metadata: Metadata = {
  title: 'SpedireSicuro.it - Spedizioni Intelligenti con AI',
  description: 'Da screenshot WhatsApp a spedizione pronta in 10 secondi. La nostra AI legge, compila e valida tutto automaticamente. Zero form, zero stress.',
  keywords: 'spedizioni, AI, WhatsApp, etichette spedizione, logistica, spedire sicuro',
  authors: [{ name: 'SpedireSicuro.it' }],
  creator: 'SpedireSicuro.it',
  publisher: 'SpedireSicuro.it',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://spediresicuro.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'SpedireSicuro.it - Spedizioni Intelligenti con AI',
    description: 'Da screenshot WhatsApp a spedizione pronta in 10 secondi. La nostra AI legge, compila e valida tutto automaticamente.',
    url: 'https://spediresicuro.vercel.app',
    siteName: 'SpedireSicuro.it',
    images: [
      {
        url: '/brand/logo/logo-icon.png',
        width: 1200,
        height: 630,
        alt: 'SpedireSicuro - Powered by AI',
      },
    ],
    locale: 'it_IT',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpedireSicuro.it - Spedizioni Intelligenti con AI',
    description: 'Da screenshot WhatsApp a spedizione pronta in 10 secondi. Powered by AI.',
    images: ['/brand/logo/logo-icon.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/brand/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/brand/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <head>
        {/* Favicon SVG (funziona subito, senza bisogno di file esterni) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Fallback per browser che non supportano SVG favicon */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

