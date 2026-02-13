/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        hacker: {
          bg: '#0a0a0a',
          card: '#111111',
          'card-hover': '#161616',
          terminal: '#0d1117',
          border: '#1a1f26',
          'border-glow': '#00ff4133',
          green: '#00ff41',
          'green-dim': '#00ff4122',
          'green-muted': '#00ff4166',
          cyan: '#00d4ff',
          'cyan-dim': '#00d4ff22',
          amber: '#ffb800',
          'amber-dim': '#ffb80022',
          red: '#ff3e3e',
          'red-dim': '#ff3e3e22',
          purple: '#a855f7',
          text: '#c9d1d9',
          muted: '#484f58',
          'muted-light': '#6e7681',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'typing': 'typing 3s steps(40) infinite',
        'blink': 'blink 1s step-end infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
        'matrix-rain': 'matrix-rain 2s linear infinite',
        'counter': 'counter 0.3s ease-out',
        'border-glow': 'border-glow 3s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1', textShadow: '0 0 10px #00ff41, 0 0 20px #00ff4166' },
          '50%': { opacity: '0.8', textShadow: '0 0 5px #00ff41, 0 0 10px #00ff4133' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'typing': {
          '0%': { width: '0' },
          '50%': { width: '100%' },
          '100%': { width: '100%' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'matrix-rain': {
          '0%': { transform: 'translateY(-100%)', opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        'counter': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: '#1a1f26' },
          '50%': { borderColor: '#00ff4133' },
        },
      },
    },
  },
  plugins: [],
}
