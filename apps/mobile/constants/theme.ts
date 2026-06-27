/**
 * Shared design tokens for the delivery agent app.
 * Brand palette mirrors the web admin dashboard (deep purple + gold).
 */
export const colors = {
  primary: '#4A0E8F',
  primaryDark: '#3d0b78',
  primaryLight: '#7B2FBE',
  gold: '#D4A853',

  bg: '#F5F6FA',
  surface: '#FFFFFF',
  border: '#E2E8F0',

  text: '#0F172A',
  textMuted: '#64748B',
  textFaint: '#94A3B8',

  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',

  white: '#FFFFFF',
} as const;

/** Status → colour mapping for delivery badges. */
export const statusColors: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: '#FEF3C7', fg: '#B45309' },
  ASSIGNED: { bg: '#DBEAFE', fg: '#1D4ED8' },
  PICKED_UP: { bg: '#E0E7FF', fg: '#4338CA' },
  IN_TRANSIT: { bg: '#EDE9FE', fg: '#6D28D9' },
  OUT_FOR_DELIVERY: { bg: '#FFEDD5', fg: '#C2410C' },
  DELIVERED: { bg: '#D1FAE5', fg: '#047857' },
  FAILED: { bg: '#FEE2E2', fg: '#B91C1C' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Human-friendly label for a delivery status. */
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
