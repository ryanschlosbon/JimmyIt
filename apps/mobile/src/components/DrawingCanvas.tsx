import { useRef, useState } from 'react';
import { Platform, View, type GestureResponderEvent, type LayoutRectangle } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { strokeToPath, type DrawingAction, type Stroke } from '@jimmyit/game-drawing';
import { ART, RADIUS } from '../design/tokens';
import type { Theme } from '../theme';

export function DrawingCanvas({ strokes, dispatch, color, brushSize, shapes, theme, disabled, height }: {
  readonly strokes: readonly Stroke[]; readonly dispatch: (action: DrawingAction) => void;
  readonly color: string; readonly brushSize: number; readonly shapes: boolean; readonly theme: Theme;
  readonly disabled: boolean; readonly height: number;
}) {
  const [layout, setLayout] = useState<LayoutRectangle>({ x: 0, y: 0, width: 1, height: 1 });
  const drawing = useRef(false);
  // Keep the guide circular in a responsive viewport.
  const scaleX = layout.width / 1000;
  const scaleY = layout.height / 650;
  const guideScale = Math.min(scaleX, scaleY);
  const pointFromEvent = (event: GestureResponderEvent) => ({
    x: Math.max(0, Math.min(1000, event.nativeEvent.locationX / layout.width * 1000)),
    y: Math.max(0, Math.min(650, event.nativeEvent.locationY / layout.height * 650)),
  });
  return <View nativeID="drawing-canvas" accessible accessibilityLabel={shapes ? 'Drawing canvas. Follow the dotted circle with your finger or pen.'
    : 'Drawing canvas. Draw with your finger, pen, or mouse.'}
    onLayout={event => setLayout(event.nativeEvent.layout)}
    onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled && drawing.current}
    onResponderGrant={event => {
      drawing.current = true;
      dispatch({ type: 'begin', point: pointFromEvent(event), color, width: brushSize });
    }}
    onResponderMove={event => { if (drawing.current) dispatch({ type: 'move', point: pointFromEvent(event) }); }}
    onResponderRelease={() => { drawing.current = false; }}
    onResponderTerminate={() => { drawing.current = false; }} onResponderTerminationRequest={() => false}
    style={{ width: '100%', height,
      backgroundColor: theme.art.paper, borderRadius: RADIUS.lg, overflow: 'hidden',
      borderWidth: ART.borderWidth, borderColor: theme.teal,
      ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}) }}>
    <Svg width="100%" height="100%" viewBox="0 0 1000 650" preserveAspectRatio="none" pointerEvents="none">
      {shapes && <Ellipse cx="500" cy="325" rx={210 * guideScale / scaleX} ry={210 * guideScale / scaleY}
        stroke={theme.art.guide}
        strokeWidth="4" strokeDasharray="10 14" fill="none" />}
      {strokes.map((stroke, index) => <Path key={index} d={strokeToPath(stroke)} stroke={stroke.color}
        strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    </Svg>
  </View>;
}
