import type { Config } from 'tailwindcss'

/**
 * MuleRadar theme — minimalist dark.
 * - Background: pure black (#000000), with a subtle variant (#0A0A0A)
 * - Text: white (#FFFFFF) and a muted gray for secondary copy
 * - Borders/accents: solid white only — no shadows, no gradients
 * - Type: Inter with system sans-serif fallback
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#000000',
          subtle: '#0A0A0A',
        },
        foreground: {
          DEFAULT: '#FFFFFF',
          muted: '#A3A3A3',
        },
        border: {
          DEFAULT: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#FFFFFF',
        },
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
      },
    },
  },
  plugins: [],
}

export default config
