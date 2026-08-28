/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#dceaff',
          200: '#bdd6ff',
          300: '#91b9ff',
          400: '#6697ff',
          500: '#4f7cff',
          600: '#3d63dd',
          700: '#304ec2',
          800: '#293f9d',
          900: '#263879',
          950: '#172047',
        },
        app: {
          bg: '#080d1a',
          surface: '#0f1729',
          'surface-2': '#151f35',
          'surface-3': '#1c2942',
          border: '#22304a',
          'border-light': '#30415f',
          text: '#f3f7ff',
          muted: '#9aabc5',
          'muted-2': '#66758f',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'glow-brand': '0 10px 32px -8px rgba(79, 124, 255, 0.48)',
        'glow-emerald': '0 0 24px -4px rgba(16, 185, 129, 0.35)',
        'glow-rose': '0 0 24px -4px rgba(244, 63, 94, 0.35)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.15s ease-out',
        'scale-in': 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
