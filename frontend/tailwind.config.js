/** @type {import('tailwindcss').Config} */
// Design-language renewal (SOT-1019). Token-driven theme (CSS vars live in
// src/index.css) so utilities like text-brand / bg-surface / shadow-card and the
// SVG diagram theme all swap together for light/dark.
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"Noto Sans JP"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        brand: 'var(--brand)',
        'brand-strong': 'var(--brand-strong)',
        surface: 'var(--surface)',
        'surface-muted': 'var(--surface-muted)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
    },
  },
  plugins: [],
}
