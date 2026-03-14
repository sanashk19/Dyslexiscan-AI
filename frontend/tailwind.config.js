/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Atkinson Hyperlegible',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        card: '18px',
      },
      colors: {
        brand: {
          primary: '#0F766E',
          accent: '#F59E0B',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          text: '#0F172A',
          muted: '#64748B',
        },
      },
    },
  },
  plugins: [],
}
