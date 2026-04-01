/**
 * Delta360 Brand & Theme Colors
 *
 * Centralized color constants. Import these instead of hardcoding hex values.
 * Brand guide: Orange #FF5C00, Black #000000, Inter font, zinc scale.
 */

export const BRAND = {
  orange: '#FF5C00',
  orangeHover: '#E54800',
  orangeLight: '#FF5C00/10',  // For Tailwind arbitrary values
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const ZINC = {
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  950: '#09090B',
} as const;

// Chart color palette (for Recharts, InlineChart, etc.)
export const CHART_COLORS = [
  '#FF5C00', // brand orange
  '#3B82F6', // blue
  '#22C55E', // green
  '#EAB308', // yellow
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // amber
] as const;

// Severity/status colors
export const STATUS_COLORS = {
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  info: '#3B82F6',
  critical: '#DC2626',
} as const;

// Compliance colors (matching scorecard)
export const COMPLIANCE_COLORS = {
  meeting: '#1B8C3A',
  closeTo: '#C9A500',
  below: '#D46A17',
  critical: '#C62828',
} as const;

// Dark mode background scale
export const DARK_BG = {
  base: ZINC[950],          // #09090B — main background
  surface: ZINC[900],       // #18181B — cards, panels
  elevated: ZINC[800],      // #27272A — dropdowns, tooltips
  border: ZINC[800],        // #27272A — borders
  borderSubtle: ZINC[700],  // #3F3F46 — subtle borders
} as const;

// Light mode background scale
export const LIGHT_BG = {
  base: BRAND.white,
  surface: BRAND.white,
  elevated: ZINC[50],
  border: ZINC[200],
  borderSubtle: ZINC[100],
} as const;
