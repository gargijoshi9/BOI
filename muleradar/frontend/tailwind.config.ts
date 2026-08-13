import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // BioCatch-inspired dark navy theme
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#102a43',
          950: '#0a1e3a',
        },
        teal: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        background: {
          DEFAULT: '#0a1628',
          subtle: '#0f1f3a',
          card: '#112240',
          cardHover: '#1a2d4a',
        },
        foreground: {
          DEFAULT: '#ffffff',
          muted: '#8892a6',
          subtle: '#6a7a99',
        },
        border: {
          DEFAULT: '#1e3a5f',
          light: '#2d4a6b',
        },
        accent: {
          DEFAULT: '#00d4aa',
          hover: '#00e8bb',
          muted: '#00d4aa20',
        },
        risk: {
          critical: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
        },
      },
      backgroundColor: {
        'background-card': '#112240',
        'background-card-hover': '#1a2d4a',
        'background-subtle': '#0f1f3a',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'display-xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-md': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25' }],
        'heading-xl': ['1.5rem', { lineHeight: '1.3' }],
        'heading-lg': ['1.25rem', { lineHeight: '1.35' }],
        'heading-md': ['1.125rem', { lineHeight: '1.4' }],
        'heading-sm': ['1rem', { lineHeight: '1.45' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6' }],
        'body-md': ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.55' }],
        'caption': ['0.75rem', { lineHeight: '1.5' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      boxShadow: {
        'card': '0 4px 20px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 12px 40px rgba(0, 0, 0, 0.4), 0 4px 12px rgba(0, 0, 0, 0.3)',
        'glow-teal': '0 0 30px rgba(0, 212, 170, 0.15), 0 0 60px rgba(0, 212, 170, 0.05)',
        'glow-teal-strong': '0 0 40px rgba(0, 212, 170, 0.25), 0 0 80px rgba(0, 212, 170, 0.1)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      borderRadius: {
        'card': '12px',
        'card-lg': '16px',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'linear-gradient(135deg, #0a1628 0%, #112240 50%, #0f1f3a 100%)',
      },
    },
  },
  plugins: [],
}

export default config