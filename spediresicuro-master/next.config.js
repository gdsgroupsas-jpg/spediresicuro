/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurazione per performance ottimali
  reactStrictMode: true,
  swcMinify: true,
  
  // Ottimizzazioni per Vercel
  compress: true,
  
  // Configurazione immagini (se necessario in futuro)
  images: {
    formats: ['image/avif', 'image/webp'],
  },
}

module.exports = nextConfig

