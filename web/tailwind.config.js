/*
 * Charli3 Hackathon settlement demo. MIT License.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0c10',
        panel: '#15171c',
        edge: '#22252d',
        accent: '#7cf2c2',
        muted: '#8b8f99',
        warn: '#f5a524',
        bad: '#f25f5c',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
