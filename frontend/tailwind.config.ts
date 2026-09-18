import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Brand Palette - Forest / Emerald Green
        brand: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E16',
        },
        forest: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E16',
        },
        // Secondary Palette - Teal / Mint
        teal: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        // Accent Palette - Amber
        amber: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        // Warm Neutral Surfaces & Borders
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F7F8F5',
          subtle: '#F4F6F4',
        },
        sage: {
          50: '#F7F8F5',
          100: '#F2F5F2',
          200: '#E3E8E4',
          300: '#CBD5CF',
          400: '#94A59B',
          500: '#64736A',
          600: '#47534D',
          700: '#333C37',
          800: '#1E2521',
          900: '#17211B',
          950: '#0E1410',
        },
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      boxShadow: {
        'soft-xs': '0 1px 2px 0 rgba(23, 33, 27, 0.04)',
        'soft-sm': '0 1px 3px 0 rgba(23, 33, 27, 0.05), 0 1px 2px -1px rgba(23, 33, 27, 0.05)',
        'soft-md': '0 4px 8px -1px rgba(23, 33, 27, 0.06), 0 2px 4px -2px rgba(23, 33, 27, 0.04)',
        'soft-lg': '0 10px 18px -3px rgba(23, 33, 27, 0.08), 0 4px 6px -4px rgba(23, 33, 27, 0.04)',
        'forest-sm': '0 2px 6px -1px rgba(22, 101, 52, 0.25)',
        'forest-md': '0 4px 12px -2px rgba(22, 101, 52, 0.35)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
