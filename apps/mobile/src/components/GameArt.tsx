// Game illustrations for the play-screen banners, in the style of
// design/Timed_Run_Banner.png: thick, round-capped ink lines on a 100-unit
// grid, one accent fill, and a soft colored ground shadow. A new game adds one
// entry here (and its name to GameArtName). To use a picture instead, see
// `bannerArt` in artwork.ts.
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from 'react-native-svg';

export type GameArtName = 'stopwatch' | 'target' | 'brush' | 'shapes' | 'rhythm' | 'dualKnobs';

export function GameArt({ name, size, ink, accent, shadow }: {
  readonly name: GameArtName; readonly size: number; readonly ink: string; readonly accent: string;
  readonly shadow: string;
}) {
  const line = { stroke: ink, strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;
  return <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
    {name === 'stopwatch' && <>
      <Ellipse cx="58" cy="90" rx="30" ry="3.2" fill={shadow} />
      <G transform="rotate(-8 45 58)">
        <Circle cx="45" cy="58" r="29" {...line} />
        <Line x1="52" y1="30" x2="55.5" y2="22" {...line} />
        <Line x1="47.5" y1="19.5" x2="63.5" y2="26" {...line} />
        <Line x1="70" y1="43" x2="77" y2="39.5" {...line} />
        <Line x1="74.5" y1="35" x2="79.5" y2="45.5" {...line} />
        <Line x1="45" y1="58" x2="51" y2="43" {...line} />
        <Line x1="45" y1="58" x2="57" y2="63" {...line} />
      </G>
    </>}
    {name === 'target' && <>
      <Ellipse cx="50" cy="90" rx="30" ry="3.2" fill={shadow} />
      <Circle cx="42" cy="56" r="27" {...line} />
      <Circle cx="42" cy="56" r="16" fill={accent} stroke={ink} strokeWidth={5} />
      <Circle cx="42" cy="56" r="5" fill={ink} />
      <G transform="rotate(40 66 30)">
        <Rect x="60" y="2" width="12" height="44" rx="6" {...line} />
        <Line x1="60" y1="14" x2="72" y2="14" {...line} />
        <Polygon points="60,46 72,46 66,58" {...line} />
      </G>
      <Path d="M80 54l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill={accent} stroke={ink} strokeWidth={2.5}
        strokeLinejoin="round" />
    </>}
    {name === 'brush' && <>
      <Ellipse cx="50" cy="90" rx="32" ry="3.2" fill={shadow} />
      <Path d="M12 70c10-12 18-12 24-4s14 8 24-6" stroke={accent} strokeWidth={9} strokeLinecap="round" fill="none" />
      <G transform="rotate(38 62 40)">
        <Rect x="56" y="4" width="12" height="40" rx="6" {...line} />
        <Rect x="54" y="44" width="16" height="9" rx="2" fill={ink} />
        <Path d="M54 53h16c0 12-3 20-8 24-5-4-8-12-8-24Z" fill={accent} stroke={ink} strokeWidth={5}
          strokeLinejoin="round" />
      </G>
    </>}
    {name === 'shapes' && <>
      <Ellipse cx="50" cy="90" rx="34" ry="3.2" fill={shadow} />
      <Circle cx="32" cy="58" r="20" stroke={ink} strokeWidth={5} strokeDasharray="7 7" strokeLinecap="round" fill="none" />
      <Rect x="56" y="14" width="30" height="30" rx="7" fill={accent} stroke={ink} strokeWidth={5}
        transform="rotate(12 71 29)" />
      <Polygon points="68,52 86,80 50,80" fill="none" stroke={ink} strokeWidth={5} strokeLinejoin="round" />
    </>}
    {name === 'rhythm' && <>
      <Ellipse cx="50" cy="90" rx="34" ry="3.2" fill={shadow} />
      <Line x1="10" y1="55" x2="90" y2="55" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      <Circle cx="32" cy="55" r="20" fill={accent} stroke={ink} strokeWidth={5} />
      <Circle cx="26" cy="51" r="2.5" fill={ink} /><Circle cx="38" cy="51" r="2.5" fill={ink} />
      <Path d="M25 61q7 8 14 0" {...line} strokeWidth={3} />
      <Circle cx="72" cy="55" r="12" fill="none" stroke={ink} strokeWidth={5} />
      <Line x1="70" y1="20" x2="70" y2="31" {...line} />
      <Line x1="77" y1="16" x2="77" y2="27" {...line} />
    </>}
    {name === 'dualKnobs' && <>
      <Ellipse cx="50" cy="90" rx="34" ry="3.2" fill={shadow} />
      <Path d="M14 72h21V59h28V47h23" {...line} />
      <Circle cx="30" cy="33" r="15" fill={accent} stroke={ink} strokeWidth={5} />
      <Circle cx="72" cy="31" r="15" fill="none" stroke={ink} strokeWidth={5} />
      <Line x1="30" y1="33" x2="30" y2="23" {...line} />
      <Line x1="72" y1="31" x2="81" y2="27" {...line} />
      <Path d="M46 58l4-7 4 7Z" fill={accent} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
    </>}
  </Svg>;
}
