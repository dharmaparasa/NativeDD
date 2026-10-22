/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FFFBF3',
        paper: '#FFFFFF',
        ink: { DEFAULT: '#2B2A33', soft: '#55545F', faint: '#747380' },
        line: '#EFE6D6',
        sun: { DEFAULT: '#FFD166', deep: '#FFC233' },
        sky: '#E4F3FE',
        coral: '#EE6F69',
      },
      fontFamily: { sans: ['"Nunito Variable"', 'ui-rounded', 'system-ui', 'sans-serif'] },
      boxShadow: {
        soft: '0 6px 22px rgba(90,65,20,.10)',
        card: '0 2px 8px rgba(90,65,20,.08)',
      },
    },
  },
  plugins: [],
}
