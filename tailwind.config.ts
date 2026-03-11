import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Delta360 Brand Colors — from Brand Guide v1.0
        delta: {
          orange: '#FF5C00',
          black: '#000000',
          white: '#FFFFFF',
          navy: '#0C2833',
          steel: '#8CAEC1',
          // Tints for UI surfaces
          'navy-light': '#122F3D',
          'navy-dark': '#081C24',
          'steel-light': '#B5CFD9',
          'steel-pale': '#DDE9EE',
          'orange-light': '#FF8A40',
          'orange-dark': '#E04D00',
        },
        // Semantic colors using brand palette
        surface: {
          primary: '#FFFFFF',
          secondary: '#F7F9FA',
          dark: '#0C2833',
          darker: '#081C24',
        },
        accent: {
          DEFAULT: '#FF5C00',
          light: '#FF8A40',
          dark: '#E04D00',
          muted: 'rgba(255, 92, 0, 0.1)',
        },
        // Status colors harmonized with brand
        status: {
          success: '#16A34A',
          'success-light': '#DCFCE7',
          warning: '#D97706',
          'warning-light': '#FEF3C7',
          error: '#DC2626',
          'error-light': '#FEE2E2',
          info: '#0C2833',
          'info-light': '#DDE9EE',
        },
      },
      fontFamily: {
        // Brand: Sequel Sans for headings (fallback to system heavy sans)
        heading: [
          '"Sequel Sans"',
          '"Inter"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'sans-serif',
        ],
        // Brand: Inter for body copy
        sans: [
          '"Inter"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Consolas',
          'monospace',
        ],
      },
      letterSpacing: {
        'tight-brand': '-0.02em',
        'tighter-brand': '-0.03em',
      },
      borderRadius: {
        sm: '0.25rem',
        base: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(12, 40, 51, 0.08), 0 1px 2px -1px rgba(12, 40, 51, 0.08)',
        'card-hover': '0 4px 12px -2px rgba(12, 40, 51, 0.12), 0 2px 4px -2px rgba(12, 40, 51, 0.06)',
        'elevated': '0 10px 25px -5px rgba(12, 40, 51, 0.1), 0 4px 6px -4px rgba(12, 40, 51, 0.06)',
        'nav': '1px 0 0 0 rgba(12, 40, 51, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-orange': 'pulseOrange 2s ease-in-out infinite',
        'count-up': 'countUp 1s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseOrange: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 92, 0, 0.2)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255, 92, 0, 0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
