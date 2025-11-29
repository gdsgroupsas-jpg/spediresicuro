/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colori Brand Ufficiali SpedireSicuro.it
        brand: {
          // Gradiente Giallo/Arancione (fulmine)
          'yellow-start': '#FFD700',
          'yellow-end': '#FF9500',
          // Azzurro tech (orbita)
          'cyan': '#00B8D4',
          // Neutri
          'black': '#000000',
          'gray': '#666666',
        },
        // Colori legacy (mantenuti per compatibilità)
        primary: '#FF9500', // Arancione brand
        'primary-dark': '#FF6B00',
        'primary-light': '#FFB84D',
        secondary: '#00B8D4', // Azzurro brand
        'secondary-dark': '#0095B0',
        'secondary-light': '#33C5D9',
        // Palette Variante A - Tech Trust
        'tech-blue': '#0066FF',
        'tech-violet': '#7C3AED',
        // Palette Variante B - Energy Professional
        'energy-orange': '#FF6B35',
        'energy-navy': '#001F54',
        // Palette Variante C - Modern Minimal
        'minimal-black': '#0A0A0A',
        'minimal-lime': '#00FF87',
      },
    },
  },
  plugins: [],
}

