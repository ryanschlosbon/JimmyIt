// Every color in the app comes from a Palette. Screens and components never
// hard-code hex values; they read `theme.<token>`. To make a new look, add a
// ColorStyle to COLOR_STYLES (copy `classic`, change the values). See DESIGN.md.

/** One game banner's colors. Banners stay pastel; `accent` marks what is selected. */
export interface BannerColors {
  /** The banner card's pastel fill. */
  readonly background: string;
  readonly border: string;
  /** Selected option chip and the Play button. Must read clearly with `ink` text. */
  readonly accent: string;
  /** The soft ground shadow under the game's illustration. */
  readonly shadow: string;
  /** Unselected option chips. */
  readonly chip: string;
}

/** Banner color names. A new game picks one, or adds one here and to every palette. */
export type BannerColorName = 'mint' | 'lilac' | 'peach' | 'butter' | 'sky' | 'rose';

export interface Palette {
  // Surfaces
  readonly page: string;
  readonly surface: string;
  readonly raised: string;
  readonly canvas: string;
  readonly header: string;
  readonly headerBorder: string;
  /** The frosted sheet under inner screens, so text never sits straight on the bubbles. */
  readonly sheet: string;
  readonly border: string;
  /** Dim layer behind dialogs. */
  readonly scrim: string;

  // Text and icons
  readonly text: string;
  readonly secondary: string;
  /** Icons and labels drawn on colored buttons (header buttons, chips, Play). */
  readonly ink: string;
  readonly focus: string;
  /** Small colored text and line icons on light surfaces (eyebrows, status icons). */
  readonly accentText: string;
  /** Stars and points. */
  readonly gold: string;

  // Brand colors (bubbles, header buttons, accents)
  readonly coral: string;
  readonly yellow: string;
  readonly mint: string;
  readonly teal: string;
  readonly navy: string;
  readonly berry: string;
  readonly purple: string;
  readonly pink: string;
  readonly softMint: string;
  readonly softCoral: string;
  readonly softPurple: string;

  /** Header buttons, in order: Play, Rewards, Settings. */
  readonly nav: { readonly play: string; readonly rewards: string; readonly settings: string };
  /** Background bubbles pick from these. */
  readonly bubbles: readonly string[];
  readonly bubbleOpacity: number;
  /** The "High Score" pill and number on banners. */
  readonly score: { readonly pill: string; readonly pillText: string; readonly value: string };
  /** Page dots under the game shelf. */
  readonly dot: string;
  readonly dotActive: string;
  readonly banners: Readonly<Record<BannerColorName, BannerColors>>;
  /** Paint stays true to its swatch in every appearance; editor surfaces follow the theme. */
  readonly art: {
    readonly colors: readonly { readonly name: string; readonly color: string }[];
    readonly paper: string;
    readonly guide: string;
    readonly panelBorder: string;
    readonly titleBackground: string;
    readonly titleText: string;
  };
}

export interface ColorStyle {
  readonly label: string;
  readonly description: string;
  readonly light: Palette;
  readonly dark: Palette;
}

// Classic: sampled from the design files in /design (Home_Play_Screen, Timed_Run_Banner, Jimmy_Face).
const classicLight: Palette = {
  page: '#FFFFFF', surface: '#FFFFFF', raised: '#F4F6F6', canvas: '#FFFFFF',
  header: 'rgba(254, 249, 237, 0.9)', headerBorder: '#ECE9E1', sheet: 'rgba(255, 255, 255, 0.88)', border: '#E3E7E8', scrim: 'rgba(15, 29, 51, 0.7)',
  text: '#183153', secondary: '#55657A', ink: '#111111', focus: '#9A6E00', accentText: '#087C71', gold: '#8A6500',
  coral: '#EF6B62', yellow: '#F5C84C', mint: '#67D0B1', teal: '#18A999', navy: '#183153',
  berry: '#7A0B5A', purple: '#8E6BCD', pink: '#F1DCEB',
  softMint: '#E5F8F5', softCoral: '#FFEDEA', softPurple: '#F1EAF8',
  nav: { play: '#18A999', rewards: '#EF6B62', settings: '#F5C84C' },
  bubbles: ['#EF6B62', '#F5C84C', '#67D0B1'],
  bubbleOpacity: 1,
  score: { pill: '#7A0B5A', pillText: '#FFFFFF', value: '#7A0B5A' },
  dot: '#EF6B62', dotActive: '#18A999',
  art: {
    colors: [
      { name: 'Forest green', color: '#257A0A' }, { name: 'Purple', color: '#8050BC' },
      { name: 'Leaf green', color: '#4DBF46' }, { name: 'Red', color: '#D50016' },
      { name: 'Black', color: '#000000' }, { name: 'Orange', color: '#FF6A00' },
      { name: 'Ocean blue', color: '#0076C2' }, { name: 'Yellow', color: '#FFE335' },
      { name: 'Sky blue', color: '#54C9F0' }, { name: 'Brown', color: '#96684D' },
      { name: 'Pink', color: '#DF54AD' }, { name: 'Gray', color: '#92918C' },
    ],
    paper: '#FFFFFF', guide: '#55657A', panelBorder: '#718096', titleBackground: '#087C71', titleText: '#FFFFFF',
  },
  banners: {
    mint: { background: '#E5F8F5', border: '#C9EEE6', accent: '#18A999', shadow: '#2BB8A3', chip: '#FFFFFF' },
    lilac: { background: '#F1ECFC', border: '#DDD2F6', accent: '#A88BEB', shadow: '#A88BEB', chip: '#FFFFFF' },
    peach: { background: '#FFEDEA', border: '#FAD4CE', accent: '#EF6B62', shadow: '#F29A8F', chip: '#FFFFFF' },
    butter: { background: '#FFF6DB', border: '#F8E4A8', accent: '#F5C84C', shadow: '#F0B92E', chip: '#FFFFFF' },
    sky: { background: '#E7F3FD', border: '#CCE4F8', accent: '#6FB5EE', shadow: '#6FB5EE', chip: '#FFFFFF' },
    rose: { background: '#FCEAF3', border: '#F4CFE2', accent: '#E58BBE', shadow: '#E58BBE', chip: '#FFFFFF' },
  },
};

const classicDark: Palette = {
  ...classicLight,
  page: '#0F1D33', surface: '#183153', raised: '#234068', canvas: '#183153',
  header: 'rgba(15, 29, 51, 0.88)', headerBorder: '#2E4A73', sheet: 'rgba(15, 29, 51, 0.86)', border: '#2E4A73', scrim: 'rgba(5, 10, 20, 0.75)',
  text: '#F7F7F7', secondary: '#B8C4D6', focus: '#F5C84C', accentText: '#67D0B1', gold: '#F5C84C',
  softMint: '#234C51', softCoral: '#553B4C', softPurple: '#393B60',
  berry: '#C455A6',
  art: { ...classicLight.art, panelBorder: '#8798B0' },
  bubbleOpacity: 0.32,
  score: { pill: '#C455A6', pillText: '#FFFFFF', value: '#F2A8DC' },
  banners: {
    mint: { background: '#1D4249', border: '#2A5A60', accent: '#4FCBB4', shadow: '#2BB8A3', chip: '#183153' },
    lilac: { background: '#2E2F55', border: '#43457A', accent: '#B9A1F2', shadow: '#8E6BCD', chip: '#183153' },
    peach: { background: '#4A3045', border: '#64405B', accent: '#F58C84', shadow: '#EF6B62', chip: '#183153' },
    butter: { background: '#43402F', border: '#5C573D', accent: '#F5C84C', shadow: '#C99B21', chip: '#183153' },
    sky: { background: '#1F3A5C', border: '#2E5280', accent: '#8CC6F2', shadow: '#4C93D0', chip: '#183153' },
    rose: { background: '#45304A', border: '#5E4166', accent: '#EDA3CC', shadow: '#D16EA6', chip: '#183153' },
  },
};

// Calm: the same layout with softer, lower-contrast colors for children who prefer a quieter screen.
const calmLight: Palette = {
  ...classicLight,
  page: '#FBFAF7', header: 'rgba(251, 250, 247, 0.92)', sheet: 'rgba(251, 250, 247, 0.9)',
  coral: '#EE9A92', yellow: '#F3D88E', mint: '#9FDCCA', teal: '#4FB7AA',
  nav: { play: '#7FCDBF', rewards: '#F0A9A2', settings: '#F3D88E' },
  bubbles: ['#F6C7C1', '#F7E3AE', '#BFE8DB'],
  dot: '#F0A9A2', dotActive: '#4FB7AA',
  score: { pill: '#8E5379', pillText: '#FFFFFF', value: '#8E5379' },
  banners: {
    ...classicLight.banners,
    mint: { ...classicLight.banners.mint, accent: '#7FCDBF' },
    lilac: { ...classicLight.banners.lilac, accent: '#C4B2F0' },
    peach: { ...classicLight.banners.peach, accent: '#F0A9A2' },
    butter: { ...classicLight.banners.butter, accent: '#F3D88E' },
  },
};

const calmDark: Palette = {
  ...classicDark,
  nav: { play: '#4FB7AA', rewards: '#E0918A', settings: '#E5C976' },
  bubbles: ['#E0918A', '#E5C976', '#7FCDBF'],
  bubbleOpacity: 0.2,
  dot: '#E0918A', dotActive: '#4FB7AA',
};

/** Every look the app can wear. The first one is the default. */
export const COLOR_STYLES = {
  classic: { label: 'Classic', description: 'Bright and cheerful', light: classicLight, dark: classicDark },
  calm: { label: 'Calm', description: 'Softer, quieter colors', light: calmLight, dark: calmDark },
} as const satisfies Record<string, ColorStyle>;

export type ColorStyleId = keyof typeof COLOR_STYLES;
export const COLOR_STYLE_IDS = Object.keys(COLOR_STYLES) as readonly ColorStyleId[];
export const DEFAULT_COLOR_STYLE: ColorStyleId = 'classic';

export function isColorStyleId(value: unknown): value is ColorStyleId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(COLOR_STYLES, value);
}
