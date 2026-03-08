import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        forest: '#1B4D2E',
        lime:   '#3DB840',
        clay:   '#C85A1E',
        gold:   '#B07D1A',
      },
      fontFamily: {
        oswald: ['Oswald', 'sans-serif'],
        noto:   ['Noto Sans KR', 'sans-serif'],
        serif:  ['Noto Serif KR', 'serif'],
        mono:   ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config