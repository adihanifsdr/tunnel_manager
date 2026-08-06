/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        chassis: 'hsl(var(--chassis))',
        surface: 'hsl(var(--surface))',
        surface2: 'hsl(var(--surface-2))',
        line: 'hsl(var(--line))',
        'line-strong': 'hsl(var(--line-strong))',
        ink: 'hsl(var(--ink))',
        'ink-muted': 'hsl(var(--ink-muted))',
        'ink-dim': 'hsl(var(--ink-dim))',
        accent: 'hsl(var(--accent))',
        steel: 'hsl(var(--steel))',
        lamp: {
          run: 'hsl(var(--lamp-run))',
          warn: 'hsl(var(--lamp-warn))',
          error: 'hsl(var(--lamp-error))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' }
        }
      },
      animation: {
        breathe: 'breathe 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
