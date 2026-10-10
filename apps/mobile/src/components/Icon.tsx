import Svg, { Circle, Path, Rect, Polygon, Line, G } from 'react-native-svg';

export type IconName = 'home' | 'pencil' | 'star' | 'settings' | 'arrow' | 'check' | 'lock' | 'undo'
  | 'trash' | 'plus' | 'minus' | 'bluetooth' | 'battery' | 'moon' | 'sun' | 'shapes' | 'toy'
  | 'spin' | 'sparkle' | 'flame' | 'close' | 'timer';

export function Icon({ name, color = '#203858', size = 28 }: {
  readonly name: IconName; readonly color?: string; readonly size?: number;
}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <G stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {name === 'home' && <><Path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>}
      {name === 'pencil' && <><Path d="m4 16 12-12a2.8 2.8 0 0 1 4 4L8 20l-5 1Z" /><Path d="m14 6 4 4M4 16l4 4" /></>}
      {(name === 'star' || name === 'sparkle') && <Polygon points="12,2 15,8.2 22,9.2 17,14 18.2,21 12,17.7 5.8,21 7,14 2,9.2 9,8.2" />}
      {name === 'settings' && <><Path d="m10 3-1 3-3-1-2 3 2 3-2 3 2 3 3-1 1 3h4l1-3 3 1 2-3-2-3 2-3-2-3-3 1-1-3Z" /><Circle cx="12" cy="11" r="3" /></>}
      {name === 'arrow' && <Path d="M4 12h15m-6-6 6 6-6 6" />}
      {name === 'check' && <Path d="m5 12 4 4L19 6" />}
      {name === 'lock' && <><Rect x="5" y="10" width="14" height="11" rx="3" /><Path d="M8 10V7a4 4 0 0 1 8 0v3" /><Line x1="12" y1="14" x2="12" y2="17" /></>}
      {name === 'undo' && <><Path d="m8 3-5 5 5 5M3 8h10a7 7 0 0 1 0 14h-3" /></>}
      {name === 'trash' && <><Path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}
      {name === 'plus' && <Path d="M12 4v16M4 12h16" />}
      {name === 'minus' && <Path d="M4 12h16" />}
      {name === 'bluetooth' && <Path d="m7 6 10 12-5 4V2l5 4L7 18" />}
      {name === 'battery' && <><Rect x="2" y="6" width="18" height="12" rx="3" /><Path d="M23 10v4M6 10v4M10 10v4M14 10v4" /></>}
      {name === 'moon' && <Path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z" />}
      {name === 'sun' && <><Circle cx="12" cy="12" r="4" /><Path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" /></>}
      {name === 'shapes' && <><Circle cx="6" cy="7" r="4" /><Rect x="13" y="3" width="9" height="9" rx="2" /><Path d="m5 21 5-9 5 9Z" /></>}
      {name === 'toy' && <><Rect x="5" y="2" width="14" height="20" rx="5" /><Circle cx="10" cy="8" r="2" /><Circle cx="15" cy="8" r="2" /><Path d="M9 14c2 2 4 2 6 0M9 18h.1M15 18h.1" /></>}
      {name === 'spin' && <><Path d="M20 9a8 8 0 1 0 0 6M20 3v6h-6" /></>}
      {name === 'flame' && <Path d="M12 2c3 5 1 6 3 9 1-2 2-3 3-4 5 7 3 15-6 15-7 0-10-6-6-12 0 4 2 4 2 4C7 9 12 8 12 2Z" />}
      {name === 'close' && <Path d="m5 5 14 14M19 5 5 19" />}
      {name === 'timer' && <><Circle cx="12" cy="14" r="8" /><Path d="M9 2h6M12 2v4M18 5l2 2M12 10v5l3 2" /></>}
    </G>
  </Svg>;
}
