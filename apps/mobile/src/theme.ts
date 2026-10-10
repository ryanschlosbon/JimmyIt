export const COLORS = {
  navy: '#203858', coral: '#EF756D', mint: '#70D2B5', teal: '#15A99A', berry: '#9B287C',
  purple: '#8E6BCD', yellow: '#FFD844', pink: '#F1DCEB',
};

export function getTheme(dark: boolean) {
  return dark ? {
    dark, page: '#0F1D33', surface: '#183153', raised: '#234068', text: '#F7F7F7',
    secondary: '#B8C4D6', border: '#2E4A73', softMint: '#234C51', softCoral: '#553B4C',
    softPurple: '#393B60', canvas: '#183153', ...COLORS,
    mint: '#68D0B2', coral: '#F2786E', berry: '#C455A6', teal: '#2BB8A3',
  } : {
    dark, page: '#FFFCF7', surface: '#FFFFFF', raised: '#F3F5F5', text: '#203858',
    secondary: '#5F7085', border: '#E2E7E9', softMint: '#E5F7F1', softCoral: '#FFF0EB',
    softPurple: '#F1EAF8', canvas: '#FFFFFF', ...COLORS,
  };
}
export type Theme = ReturnType<typeof getTheme>;
