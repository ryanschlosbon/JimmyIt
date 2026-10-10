import { useRef, useState } from 'react';
import { View, type GestureResponderEvent, type LayoutRectangle } from 'react-native';
import Svg, { Circle, Path, Rect, Pattern, Defs } from 'react-native-svg';
import { strokeToPath, type DrawingAction, type Stroke } from '@jimmyit/game-drawing';

export function DrawingCanvas({ strokes, dispatch, color, brushSize, shapes, dark, disabled }: {
  readonly strokes: readonly Stroke[]; readonly dispatch: (action: DrawingAction) => void;
  readonly color: string; readonly brushSize: number; readonly shapes: boolean; readonly dark: boolean;
  readonly disabled: boolean;
}) {
  const [layout, setLayout] = useState<LayoutRectangle>({ x: 0, y: 0, width: 1, height: 1 });
  const drawing = useRef(false);
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
    style={{ width: '100%', aspectRatio: 1000 / 650,
      backgroundColor: dark ? '#183153' : '#FFFFFF', borderRadius: 22, overflow: 'hidden',
      borderWidth: 2, borderColor: dark ? '#2E4A73' : '#E1E8E8' }}>
    <Svg width="100%" height="100%" viewBox="0 0 1000 650" preserveAspectRatio="none" pointerEvents="none">
      <Defs><Pattern id="dots" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
        <Circle cx="18" cy="18" r="1.4" fill={dark ? '#2E4A73' : '#E9EEEE'} />
      </Pattern></Defs>
      <Rect width="1000" height="650" fill="url(#dots)" />
      {shapes && <Circle cx="500" cy="325" r="210" stroke={dark ? '#B8C4D6' : '#8798A8'}
        strokeWidth="4" strokeDasharray="10 14" fill="none" />}
      {strokes.map((stroke, index) => <Path key={index} d={strokeToPath(stroke)} stroke={stroke.color}
        strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    </Svg>
  </View>;
}
