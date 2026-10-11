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
export type BannerColorName = 'mint' | 'lilac' | 'peach' | 'butter' | 'sky' | 'rose' | 'rhythm' | 'quest';

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
  /** Neutral artwork for badges that have not been earned yet. */
  readonly lockedBadge: { readonly background: string; readonly paper: string; readonly ink: string };
  /** The "High Score" pill and number on banners. */
  readonly score: { readonly pill: string; readonly pillText: string; readonly value: string };
  /** Page dots under the game shelf. */
  readonly dot: string;
  readonly dotActive: string;
  /** Supplied Rewards artwork and its readable phone version. */
  readonly rewardsBanner: {
    readonly background: string;
    readonly text: string;
    readonly eyebrow: string;
    readonly bubble: string;
  };
  readonly banners: Readonly<Record<BannerColorName, BannerColors>>;
  /** Inner game headers, adapted from the supplied bubble banners. */
  readonly activityHeaders: {
    readonly timed: { readonly background: string; readonly text: string };
    readonly tapQuest: { readonly background: string; readonly text: string };
    readonly bubble: string;
    readonly face: string;
    readonly shadow: string;
  };
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
  coral: '#EF6B62', yellow: '#FFD844', mint: '#67D0B1', teal: '#18A999', navy: '#183153',
  berry: '#7A0B5A', purple: '#8E6BCD', pink: '#F1DCEB',
  softMint: '#E5F8F5', softCoral: '#FFEDEA', softPurple: '#F1EAF8',
  nav: { play: '#18A999', rewards: '#EF6B62', settings: '#FFD844' },
  bubbles: ['#EF6B62', '#FFD844', '#67D0B1'],
  bubbleOpacity: 1,
  lockedBadge: { background: '#E3E5E7', paper: '#F8F8F8', ink: '#62676D' },
  score: { pill: '#7A0B5A', pillText: '#FFFFFF', value: '#7A0B5A' },
  dot: '#EF6B62', dotActive: '#18A999',
  rewardsBanner: { background: '#EF6B62', text: '#FFFFFF', eyebrow: '#7A0B5A', bubble: '#FFFFFF' },
  activityHeaders: {
    timed: { background: '#FFD844', text: '#183153' },
    tapQuest: { background: '#18A999', text: '#000000' },
    bubble: '#FFFFFF', face: '#7A0B5A', shadow: '#DDE4E4',
  },
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
    butter: { background: '#FFF6DB', border: '#F8E4A8', accent: '#FFD844', shadow: '#F0B92E', chip: '#FFFFFF' },
    sky: { background: '#E7F3FD', border: '#CCE4F8', accent: '#6FB5EE', shadow: '#6FB5EE', chip: '#FFFFFF' },
    rose: { background: '#FCEAF3', border: '#F4CFE2', accent: '#E58BBE', shadow: '#E58BBE', chip: '#FFFFFF' },
    rhythm: { background: '#FFF0E9', border: '#F7D5C5', accent: '#F19266', shadow: '#DC7756', chip: '#FFFFFF' },
    quest: { background: '#EAF5EF', border: '#C5E4D2', accent: '#77C59B', shadow: '#50A77C', chip: '#FFFFFF' },
  },
};

const classicDark: Palette = {
  ...classicLight,
  lockedBadge: { background: '#383B40', paper: '#24272B', ink: '#C1C4C8' },
  page: '#0F1D33', surface: '#183153', raised: '#234068', canvas: '#234068',
  header: 'rgba(15, 29, 51, 0.88)', headerBorder: '#2E4A73', sheet: 'rgba(15, 29, 51, 0.86)', border: '#2E4A73', scrim: 'rgba(5, 10, 20, 0.75)',
  text: '#F7F7F7', secondary: '#B8C4D6', focus: '#FFD844', accentText: '#68D0B2', gold: '#FFD844',
  coral: '#F2786E', yellow: '#FFD844', mint: '#68D0B2', teal: '#2BB8A3',
  softMint: '#234C51', softCoral: '#553B4C', softPurple: '#393B60',
  berry: '#C455A6',
  nav: { play: '#2BB8A3', rewards: '#F2786E', settings: '#FFD844' },
  bubbles: ['#F2786E', '#FFD844', '#68D0B2'],
  dot: '#F2786E', dotActive: '#2BB8A3',
  activityHeaders: {
    timed: { background: '#FFD844', text: '#183153' },
    tapQuest: { background: '#2BB8A3', text: '#111111' },
    bubble: '#F7F7F7', face: '#183153', shadow: '#2E4A73',
  },
  art: {
    ...classicLight.art,
    guide: '#B8C4D6', panelBorder: '#2E4A73', titleBackground: '#2BB8A3', titleText: '#111111',
  },
  bubbleOpacity: 1,
  score: { pill: '#C455A6', pillText: '#111111', value: '#C455A6' },
  banners: {
    mint: { background: '#183153', border: '#2E4A73', accent: '#68D0B2', shadow: '#2BB8A3', chip: '#234068' },
    lilac: { background: '#183153', border: '#2E4A73', accent: '#C455A6', shadow: '#C455A6', chip: '#234068' },
    peach: { background: '#183153', border: '#2E4A73', accent: '#F2786E', shadow: '#F2786E', chip: '#234068' },
    butter: { background: '#183153', border: '#2E4A73', accent: '#FFD844', shadow: '#FFD844', chip: '#234068' },
    sky: { background: '#183153', border: '#2E4A73', accent: '#2BB8A3', shadow: '#2BB8A3', chip: '#234068' },
    rose: { background: '#183153', border: '#2E4A73', accent: '#C455A6', shadow: '#C455A6', chip: '#234068' },
    rhythm: { background: '#183153', border: '#2E4A73', accent: '#F0A17D', shadow: '#CE765C', chip: '#234068' },
    quest: { background: '#183153', border: '#2E4A73', accent: '#8AD2AA', shadow: '#53A879', chip: '#234068' },
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
  activityHeaders: {
    ...classicLight.activityHeaders,
    timed: { background: '#F3D88E', text: '#183153' },
    tapQuest: { background: '#7FCDBF', text: '#183153' },
  },
  score: { pill: '#8E5379', pillText: '#FFFFFF', value: '#8E5379' },
  banners: {
    ...classicLight.banners,
    mint: { ...classicLight.banners.mint, accent: '#7FCDBF' },
    lilac: { ...classicLight.banners.lilac, accent: '#C4B2F0' },
    peach: { ...classicLight.banners.peach, accent: '#F0A9A2' },
    butter: { ...classicLight.banners.butter, accent: '#F3D88E' },
    rhythm: { ...classicLight.banners.rhythm, accent: '#EDAF90' },
    quest: { ...classicLight.banners.quest, accent: '#9BD4AE' },
  },
};

const calmDark: Palette = {
  ...classicDark,
  nav: { play: '#4FB7AA', rewards: '#E0918A', settings: '#E5C976' },
  bubbles: ['#E0918A', '#E5C976', '#7FCDBF'],
  bubbleOpacity: 0.2,
  activityHeaders: calmLight.activityHeaders,
  dot: '#E0918A', dotActive: '#4FB7AA',
  banners: {
    ...classicDark.banners,
    rhythm: { ...classicDark.banners.rhythm, accent: '#EAB197' },
    quest: { ...classicDark.banners.quest, accent: '#A5D8B9' },
  },
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
