import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pln: {
          blue: '#005b96',
          sky: '#00a8e8',
          yellow: '#ffcc00',
          red: '#d90429',
          dark: '#0b132b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
