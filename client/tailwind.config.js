/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        }
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(22px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-down': {
          '0%': { opacity: '0', transform: 'translateY(-14px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.82)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'float-gentle': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-7px)' },
        },
        'shimmer-sweep': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(16, 185, 129, 0.28)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(16, 185, 129, 0.48)' },
        },
        'aurora-breathe': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.06)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.52s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-down': 'fade-down 0.38s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'float-gentle': 'float-gentle 3.2s ease-in-out infinite',
        'shimmer-sweep': 'shimmer-sweep 2.2s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        'aurora-breathe': 'aurora-breathe 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
