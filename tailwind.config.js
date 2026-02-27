/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#2563eb',
        accentSoft: 'rgba(37,99,235,0.10)',
        sub: '#6b7280',
        line: '#e5e7eb',
        soft: '#f9fafb',
        soft2: '#f3f4f6',
      },
      borderRadius: {
        r: '16px',
        r2: '20px',
      },
      fontFamily: {
        sans: ['ui-sans-serif', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
