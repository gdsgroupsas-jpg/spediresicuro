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
        // Colori personalizzati per SpedireSicuro.it
        primary: '#2563eb',
        'primary-dark': '#1e40af',
        'primary-light': '#3b82f6',
        secondary: '#10b981',
        'secondary-dark': '#059669',
        'secondary-light': '#34d399',
      },
    },
  },
  plugins: [],
}

