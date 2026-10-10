import { COLOR_STYLES, DEFAULT_COLOR_STYLE, type ColorStyleId, type Palette } from './design/palettes';

/** The colors every screen draws with: one palette from one color style, light or dark. */
export interface Theme extends Palette {
  readonly dark: boolean;
  readonly styleId: ColorStyleId;
}

export function getTheme(dark: boolean, styleId: ColorStyleId = DEFAULT_COLOR_STYLE): Theme {
  const style = COLOR_STYLES[styleId];
  return { ...(dark ? style.dark : style.light), dark, styleId };
}
