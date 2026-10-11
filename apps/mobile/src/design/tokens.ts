// Shape, size and type rules shared by every screen. Colors live in palettes.ts;
// motion lives in motion.ts. The rules behind these numbers are in DESIGN.md.

/** Font family names, as loaded in App.tsx. */
export const FONTS = {
  /** Rounded display face: titles, numbers, the JimmyIt wordmark. */
  display: 'Baloo',
  displayHeavy: 'BalooHeavy',
  /** Body face: sentences, labels, chips. */
  body: 'Poppins',
  bodyMedium: 'PoppinsMedium',
  bodyBold: 'PoppinsBold',
} as const;

/** 4-point spacing scale. Use these instead of one-off numbers. */
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/** Corner radii. Everything is rounded; nothing in the app has a sharp corner. */
export const RADIUS = {
  /** Chips and small buttons. */
  sm: 14,
  /** Buttons and header buttons. */
  md: 18,
  /** Cards and panels. */
  lg: 24,
  /** Game banners. */
  xl: 32,
  pill: 999,
} as const;

/** Minimum sizes. Players have motor differences: big targets everywhere. */
export const SIZE = {
  /** Smallest tappable thing, in both directions. */
  touchTarget: 56,
  headerButton: 64,
  headerButtonCompact: 56,
  /** Below this window width the app uses its phone layout. */
  compactWidth: 680,
  /** Widest a banner grows on big tablets and desktops. */
  bannerMaxWidth: 1040,
} as const;

/** Type sizes. Main copy is never smaller than `body`; `small` is for secondary labels only. */
export const TYPE = {
  hero: 56,
  title: 40,
  heading: 30,
  subheading: 23,
  body: 20,
  small: 16,
  caption: 14,
} as const;
