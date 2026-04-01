/**
 * DataOS Design Tokens — spec §6
 * CSS custom property names and values for the DataOS shell.
 * Use these constants wherever tokens are referenced in TypeScript.
 */

export const COLOR_TOKENS = {
  // Brand
  deltaOrange: { name: '--delta-orange', value: '#FE5000' },
  deltaBlack:  { name: '--delta-black',  value: '#000000' },

  // Backgrounds
  bgPrimary:   { name: '--bg-primary',   value: '#0a0a0a' },
  bgSecondary: { name: '--bg-secondary', value: '#0f0f11' },
  bgSurface:   { name: '--bg-surface',   value: '#18181b' },
  bgElevated:  { name: '--bg-elevated',  value: '#27272a' },
  bgInput:     { name: '--bg-input',     value: 'rgba(255,255,255,0.05)' },

  // Borders
  borderDefault: { name: '--border-default', value: '#27272a' },
  borderActive:  { name: '--border-active',  value: '#FE5000' },

  // Text
  textPrimary:   { name: '--text-primary',   value: '#e4e4e7' },
  textSecondary: { name: '--text-secondary', value: '#a1a1aa' },
  textMuted:     { name: '--text-muted',     value: '#71717a' },
  textDisabled:  { name: '--text-disabled',  value: '#52525b' },

  // Status
  statusGreen:  { name: '--status-green',  value: '#22c55e' },
  statusYellow: { name: '--status-yellow', value: '#eab308' },
  statusRed:    { name: '--status-red',    value: '#ef4444' },
  statusBlue:   { name: '--status-blue',   value: '#3b82f6' },
  statusPurple: { name: '--status-purple', value: '#a855f7' },
} as const;

export const TYPOGRAPHY_TOKENS = {
  fontSans:    { name: '--font-sans',    value: "Inter, system-ui, sans-serif" },
  fontHeading: { name: '--font-heading', value: "Georgia, serif" },
  fontMono:    { name: '--font-mono',    value: "'SF Mono', 'Fira Code', monospace" },

  textXs:  { name: '--text-xs',  value: '10px' },
  textSm:  { name: '--text-sm',  value: '12px' },
  textBase:{ name: '--text-base',value: '14px' },
  textLg:  { name: '--text-lg',  value: '16px' },
  textXl:  { name: '--text-xl',  value: '20px' },
  text2xl: { name: '--text-2xl', value: '24px' },
  text3xl: { name: '--text-3xl', value: '32px' },
} as const;

/**
 * Density-aware spacing tokens.
 * executive: default (1.5× multiplier)
 * operator:  compact (0.75× multiplier)
 */
export const SPACING_TOKENS = {
  executive: {
    spaceXs: { name: '--space-xs', value: '6px' },
    spaceSm: { name: '--space-sm', value: '12px' },
    spaceMd: { name: '--space-md', value: '24px' },
    spaceLg: { name: '--space-lg', value: '32px' },
    spaceXl: { name: '--space-xl', value: '48px' },
  },
  operator: {
    spaceXs: { name: '--space-xs', value: '3px' },
    spaceSm: { name: '--space-sm', value: '6px' },
    spaceMd: { name: '--space-md', value: '12px' },
    spaceLg: { name: '--space-lg', value: '20px' },
    spaceXl: { name: '--space-xl', value: '28px' },
  },
} as const;

/**
 * Density-aware component tokens.
 */
export const COMPONENT_TOKENS = {
  executive: {
    cardRadius:      { name: '--card-radius',       value: '12px' },
    cardPadding:     { name: '--card-padding',      value: '20px' },
    tableRowHeight:  { name: '--table-row-height',  value: '48px' },
    kpiValueSize:    { name: '--kpi-value-size',    value: '28px' },
  },
  operator: {
    cardRadius:      { name: '--card-radius',       value: '6px' },
    cardPadding:     { name: '--card-padding',      value: '12px' },
    tableRowHeight:  { name: '--table-row-height',  value: '28px' },
    kpiValueSize:    { name: '--kpi-value-size',    value: '14px' },
  },
} as const;

/** Flat map of all token names → values (useful for SSR injection or testing). */
export const ALL_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(Object.values(COLOR_TOKENS).map(t => [t.name, t.value])),
  ...Object.fromEntries(Object.values(TYPOGRAPHY_TOKENS).map(t => [t.name, t.value])),
  // Executive defaults for flat map
  ...Object.fromEntries(Object.values(SPACING_TOKENS.executive).map(t => [t.name, t.value])),
  ...Object.fromEntries(Object.values(COMPONENT_TOKENS.executive).map(t => [t.name, t.value])),
});
