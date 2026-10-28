/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EAF4FC',
          100: '#D2E8FA',
          200: '#A6D1F5',
          300: '#6FB3EC',
          400: '#3A93DE',
          500: '#0072CE',
          600: '#0062B4',
          700: '#00508F',
          800: '#003E6E',
          900: '#002C4F',
        },
        cyanx: '#00A9E0',
        ink: {
          900: '#0F1C2E',
          700: '#33445C',
          500: '#5A6B80',
          400: '#8494A8',
        },
        line: '#E3E9F0',
        canvas: '#F4F7FB',
        ok: '#1F9E62',
        warn: '#D98A22',
        danger: '#D64D4D',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,28,46,0.04), 0 8px 24px -12px rgba(15,28,46,0.12)',
        pop: '0 12px 40px -12px rgba(15,28,46,0.24)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(31,158,98,0.45)' },
          '100%': { boxShadow: '0 0 0 8px rgba(31,158,98,0)' },
        },
        'dash-flow': {
          to: { strokeDashoffset: '-20' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up .3s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s ease-out infinite',
        'dash-flow': 'dash-flow 1s linear infinite',
      },
    },
  },
  plugins: [],
}
