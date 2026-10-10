import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Image } from 'react-native';
import { APP_ARTWORK } from '../artwork';

export function Jimmy({ size = 220, face = false, color = '#67D0B1' }: {
  readonly size?: number; readonly face?: boolean; readonly color?: string;
}) {
  const artwork = face ? APP_ARTWORK.jimmyFace : APP_ARTWORK.jimmyHero;
  if (artwork) return <Image source={artwork} resizeMode="contain" accessible={false}
    style={{ width: size, height: face ? size : size * 1.07 }} />;
  // Traced from design/Jimmy_Face.png: crescent eyes looking right, a smile with a cheeky tongue.
  if (face) return <Svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
    <Circle cx="50" cy="50" r="50" fill={color} />
    <G stroke="#7A0B5A" strokeWidth="1.3" fill="none">
      <Circle cx="28.8" cy="45.6" r="13.3" /><Circle cx="71.4" cy="45.6" r="13.3" />
    </G>
    <Ellipse cx="32" cy="45.6" rx="10.4" ry="12.1" fill="#7A0B5A" />
    <Ellipse cx="74.6" cy="45.6" rx="10.4" ry="12.1" fill="#7A0B5A" />
    <Path d="M32.6 68.2Q41 78.6 52 75.2Q58.4 72.6 61.6 64.4" fill="none" stroke="#7A0B5A" strokeWidth="1.4" />
    <Path d="M61.6 64.4Q72.4 68.4 73.2 74.4Q73.6 80.6 64.4 80.6Q57.4 80.4 50.8 75.6" fill="none"
      stroke="#7A0B5A" strokeWidth="1.4" strokeLinejoin="round" />
  </Svg>;
  return <Svg width={size} height={size * 1.07} viewBox="0 0 280 300" aria-hidden>
    <Ellipse cx="145" cy="281" rx="80" ry="11" fill="#203858" opacity=".1" />
    <Circle cx="147" cy="158" r="110" fill="#FFD844" />
    <G transform="rotate(9 140 160)">
      <Path d="M85 182q-40-11-50 14M198 180q37-16 43-43" fill="none" stroke="#96216E" strokeWidth="9" strokeLinecap="round" />
      <Path d="M105 249 94 275M175 249l15 26" fill="none" stroke="#96216E" strokeWidth="12" strokeLinecap="round" />
      <Rect x="80" y="75" width="129" height="181" rx="38" fill="#96216E" />
      <Rect x="74" y="65" width="125" height="180" rx="36" fill={color} stroke="#96216E" strokeWidth="3" />
      <Ellipse cx="112" cy="124" rx="15" ry="19" fill="#96216E" />
      <Ellipse cx="161" cy="124" rx="15" ry="19" fill="#96216E" />
      <Path d="M121 151q18 19 34-2" fill="none" stroke="#203858" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="99" cy="152" r="9" fill="#F7A48B" /><Circle cx="174" cy="152" r="9" fill="#F7A48B" />
      <Circle cx="111" cy="194" r="9" fill="#FFD844" /><Circle cx="162" cy="194" r="9" fill="#8E6BCD" />
      <Rect x="121" y="213" width="34" height="7" rx="3.5" fill="#96216E" opacity=".35" />
    </G>
    <Path d="m26 70 3-10 3 10 10 3-10 3-3 10-3-10-10-3Z" fill="#8E6BCD" />
    <Path d="m242 215 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#15A99A" />
    <G transform="rotate(-6 200 38)">
      <Rect x="158" y="14" width="109" height="43" rx="12" fill="#FFFCF7" stroke="#96216E" strokeWidth="2" />
      <Path d="m184 57-10 13 26-13" fill="#FFFCF7" stroke="#96216E" strokeWidth="2" />
      <SvgText x="212" y="42" textAnchor="middle" fill="#96216E" fontSize="18" fontWeight="bold">Let's play!</SvgText>
    </G>
  </Svg>;
}
