// Packwalk Design System
// Aesthetic: Luxury Minimalism meets Organic Warmth
// Inspired by: Aesop, Glossier, high-end pet boutiques

export const colors = {
  // Primary - Warm charcoal with depth
  ink: '#1A1614',
  inkLight: '#2D2926',
  inkMuted: '#6B6560',

  // Accent - Refined terracotta with sophistication
  ember: '#C4754A',
  emberDark: '#A65D36',
  emberLight: '#E8B094',
  emberGlow: '#FFF5EE',

  // Secondary - Eucalyptus sage
  sage: '#6B8F71',
  sageDark: '#4A6B50',
  sageLight: '#E8F0E9',
  sageMuted: '#A4BFA8',

  // Neutrals - Warm paper tones
  paper: '#FAF8F5',
  paperDark: '#F2EDE6',
  stone: '#E5DED4',

  // Accent metallics
  gold: '#C9A962',
  goldLight: '#F5EFD6',

  // Legacy aliases - use canonical names above instead
  // Kept for backwards compatibility, will be removed in future
  golden: '#C9A962',      // → use gold
  bark: '#1A1614',        // → use ink
  barkLight: '#6B6560',   // → use inkMuted
  terracotta: '#C4754A',  // → use ember
  terracottaLight: '#E8B094', // → use emberLight
  cream: '#FAF8F5',       // → use paper
  creamDark: '#F2EDE6',   // → use paperDark

  // Semantic
  success: '#5A8F5E',
  error: '#C45C5C',
  warning: '#D4A84A',

  // Utilities
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Gradients (for LinearGradient usage)
  gradients: {
    warmFade: ['#FAF8F5', '#F2EDE6'],
    emberGlow: ['#FFF5EE', '#E8B094'],
    paperDepth: ['#FFFFFF', '#FAF8F5'],
  },
};

export const spacing = {
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
  '4xl': 96,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subtle: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  soft: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  elevated: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  glow: {
    shadowColor: colors.ember,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  inner: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 0,
  },
};

export const typography = {
  // Using system fonts (San Francisco on iOS, Roboto on Android)
  // No custom font families - system defaults provide optimal readability

  sizes: {
    '2xs': 10,
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 30,
    '3xl': 38,
    '4xl': 48,
    '5xl': 60,
  },

  weights: {
    light: '300' as const,
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  // Letter spacing for premium feel
  tracking: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
  },

  // Line heights
  leading: {
    none: 1,
    tight: 1.2,
    snug: 1.35,
    normal: 1.5,
    relaxed: 1.65,
    loose: 1.8,
  },
};

// Premium icon sizes
export const iconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
};

// Animation durations
export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,

  // Spring configs for reanimated
  spring: {
    gentle: { damping: 20, stiffness: 200 },
    snappy: { damping: 15, stiffness: 400 },
    bouncy: { damping: 10, stiffness: 300 },
    smooth: { damping: 25, stiffness: 150 },
  },
};

// Tab bar configuration - floating pill design
export const tabBar = {
  height: 72,
  iconSize: 22,
  activeColor: colors.ember,
  inactiveColor: colors.inkMuted,
  backgroundColor: colors.white,
  pillPadding: 12,
};

// Consistent spacing for content above tab bar
export const TAB_BAR_HEIGHT = 120; // tabBar.height + safe area + margin

// Glass morphism effect values
export const glass = {
  background: 'rgba(255, 255, 255, 0.85)',
  backgroundDark: 'rgba(26, 22, 20, 0.85)',
  blur: 20,
  border: 'rgba(255, 255, 255, 0.2)',
};

export default {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  iconSizes,
  animation,
  tabBar,
  glass,
};
