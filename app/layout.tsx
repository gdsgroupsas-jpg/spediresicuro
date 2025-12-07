import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/providers'
import CookieBanner from '@/components/legal/CookieBanner'
import PWAInstallPrompt from '@/components/pwa/pwa-install-prompt'
import NotificationPrompt from '@/components/pwa/notification-prompt'

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
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/favicon.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SpedireSicuro',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        {/* Favicon SVG (funziona subito, senza bisogno di file esterni) */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* Fallback per browser che non supportano SVG favicon */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <CookieBanner />
          <PWAInstallPrompt />
          <NotificationPrompt />
        </Providers>
      </body>
    </html>
  )
}

