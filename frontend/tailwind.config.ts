import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: 'var(--brand-red)',
          orange: 'var(--brand-orange)',
          ember: 'var(--brand-ember)',
        },
        surface: {
          base: 'var(--surface-base)',
          elevated: 'var(--surface-elevated)',
          panel: 'var(--surface-panel)',
        },
        ink: {
          primary: 'var(--ink-primary)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
        },
        line: 'var(--line)',
        status: 'var(--status-online)',
      },
      fontFamily: {
        display: ['Manrope', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 2.5rem -0.625rem var(--glow-primary)',
        'glow-strong': '0 0 5rem -1.25rem var(--glow-strong)',
        panel: 'inset 0 0 0 1px var(--panel-highlight)',
      },
      backgroundImage: {
        'hero-grid': 'linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)',
        'brand-gradient': 'linear-gradient(100deg, var(--brand-red), var(--brand-orange), var(--brand-red))',
        'hero-radial': 'radial-gradient(circle at 64% 46%, var(--hero-ember), transparent 24%), radial-gradient(circle at 42% 38%, var(--hero-blue), transparent 28%)',
      },
      borderRadius: {
        panel: 'var(--radius-panel)',
      },
      keyframes: {
        'orb-breathe': {
          '0%, 100%': { transform: 'scale(0.98)', opacity: '0.88' },
          '50%': { transform: 'scale(1.02)', opacity: '1' },
        },
        'data-flow': {
          to: { strokeDashoffset: '-3rem' },
        },
      },
      animation: {
        'orb-breathe': 'orb-breathe 5s ease-in-out infinite',
        'data-flow': 'data-flow 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
