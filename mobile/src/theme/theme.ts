/**
 * TheHoneyBee Design System — Color palette & spacing tokens.
 * Primary teal (#127d8e) from the web app's Login.jsx and branding.
 */

export const COLORS = {
  // Primary brand
  primary: '#127d8e',
  primaryDark: '#0e6575',
  primaryLight: '#e0f4f7',
  primaryFaded: 'rgba(18, 125, 142, 0.08)',

  // Backgrounds
  background: '#f9fafb',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Text
  text: '#1f2937',
  textSecondary: '#6b7280',
  textTertiary: '#9ca3af',
  textInverse: '#FFFFFF',

  // Borders
  border: '#e5e7eb',
  borderLight: '#f3f4f6',

  // Status / Feedback
  error: '#ef4444',
  errorLight: '#fef2f2',
  success: '#059669',
  successLight: '#ecfdf5',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  info: '#3b82f6',

  // Chat bubbles
  sentBubble: '#127d8e',
  sentBubbleText: '#FFFFFF',
  receivedBubble: '#f3f4f6',
  receivedBubbleText: '#1f2937',

  // Misc
  overlay: 'rgba(0, 0, 0, 0.5)',
  skeleton: '#e5e7eb',
  badge: '#ef4444',
  online: '#22c55e',
  offline: '#d1d5db',

  // Tab bar
  tabActive: '#127d8e',
  tabInactive: '#9ca3af',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
  hero: 34,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
