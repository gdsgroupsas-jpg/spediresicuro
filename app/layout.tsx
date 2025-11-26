import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SpedireSicuro.it - Preventivi Spedizioni',
  description: 'Calcola il preventivo per le tue spedizioni in modo semplice e veloce',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}

