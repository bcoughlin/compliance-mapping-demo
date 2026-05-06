import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          green: {
            bg: 'rgb(220 252 231)',
            border: 'rgb(34 197 94)',
            text: 'rgb(21 128 61)',
          },
          yellow: {
            bg: 'rgb(254 249 195)',
            border: 'rgb(234 179 8)',
            text: 'rgb(133 77 14)',
          },
          red: {
            bg: 'rgb(254 226 226)',
            border: 'rgb(239 68 68)',
            text: 'rgb(153 27 27)',
          },
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
