/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0D0D0F',
        surface: '#1A1A1E',
        'surface-elevated': '#242428',
        border: '#2E2E33',
        primary: '#00C853',
        'primary-muted': '#00C85333',
        warning: '#FFB300',
        danger: '#FF3D57',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A0A0A8',
        'text-muted': '#6B6B73',
      },
    },
  },
  plugins: [],
};
