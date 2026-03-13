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
        accent:     '#2563eb',
        accentSoft: 'rgba(37, 99, 235, 0.10)',
        sub:        '#6b7280',
        line:       '#e5e7eb',
        soft:       '#f9fafb',
        soft2:      '#f3f4f6',
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