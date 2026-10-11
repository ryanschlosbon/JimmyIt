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

/** Art fills the available screen; short windows use an extra tool column. */
export const ART = {
  canvasMinHeight: 320, phoneCanvasHeight: 360, titleHeight: 48,
  viewportChromeHeight: 128,
  actionHeight: 56, actionIcon: 28, faceSize: 40,
  swatchRadius: 10,
  borderWidth: 2, selectedBorderWidth: 3, titleFont: 36,
  maxWidth: 1600,
} as const;

/** Presets, in drawing-coordinate units, from a fine point to a broad brush. */
export const ART_BRUSH_SIZES = [4, 8, 12, 18, 24, 30, 40, 48] as const;

/** Settings proportions follow the grown-ups' area reference. */
export const SETTINGS = {
  maxWidth: 1440, columnBreakpoint: 850,
  heroHeight: 160, heroPhoneHeight: 148, heroArtSize: 180,
  grownUpsWidth: 224, grownUpsPhoneWidth: 200, grownUpsAspectRatio: 388 / 108,
  heroBubbleSize: 240, smallBubbleSize: 112, bottomBubbleSize: 260,
  faceSize: 120, phoneFaceSize: 72,
  cardArtHeight: 144, cardBodyHeight: 184, cardIconSize: 80,
  controlMinWidth: 240,
  borderWidth: 2, frameBorderWidth: 3, shadowOffset: 8,
  switchWidth: 56, switchHeight: 34, switchThumbSize: 26,
} as const;
