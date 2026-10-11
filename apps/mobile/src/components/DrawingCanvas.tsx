import { useRef, useState } from 'react';
import { Platform, View, type GestureResponderEvent, type LayoutRectangle } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { strokeToPath, type DrawingAction, type Stroke } from '@jimmyit/game-drawing';
import { ART, RADIUS } from '../design/tokens';
import type { TargetShape } from '@jimmyit/game-shape-recognition';
import type { Theme } from '../theme';

// Corners of each polygon guide, in drawing coordinates as laid out on an unstretched 1000×650 canvas.
const GUIDE_POINTS: Readonly<Record<Exclude<TargetShape, 'circle'>, readonly (readonly [number, number])[]>> = {
  triangle: [[500, 100], [760, 540], [240, 540]],
  square: [[290, 115], [710, 115], [710, 535], [290, 535]],
  rectangle: [[200, 180], [800, 180], [800, 480], [200, 480]],
};

export function DrawingCanvas({ strokes, dispatch, color, brushSize, shapes, shapeTarget = 'circle', theme, disabled,
  height, onSize }: {
  readonly strokes: readonly Stroke[]; readonly dispatch: (action: DrawingAction) => void;
  readonly color: string; readonly brushSize: number; readonly shapes: boolean; readonly shapeTarget?: TargetShape;
  readonly theme: Theme; readonly disabled: boolean; readonly height: number;
  readonly onSize?: (size: { readonly width: number; readonly height: number }) => void;
}) {
  const [layout, setLayout] = useState<LayoutRectangle>({ x: 0, y: 0, width: 1, height: 1 });
  const drawing = useRef(false);
  // Keep the guide's true proportions in a responsive viewport.
  const scaleX = layout.width / 1000;
  const scaleY = layout.height / 650;
  const guideScale = Math.min(scaleX, scaleY);
  const guidePath = (points: readonly (readonly [number, number])[]) => points.map(([x, y], index) =>
    `${index === 0 ? 'M' : 'L'} ${500 + (x - 500) * guideScale / scaleX} ${325 + (y - 325) * guideScale / scaleY}`)
    .join(' ') + ' Z';
  const pointFromEvent = (event: GestureResponderEvent) => ({
    x: Math.max(0, Math.min(1000, event.nativeEvent.locationX / layout.width * 1000)),
    y: Math.max(0, Math.min(650, event.nativeEvent.locationY / layout.height * 650)),
  });
  return <View nativeID="drawing-canvas" accessible accessibilityLabel={shapes
    ? `Drawing canvas. Follow the dotted ${shapeTarget} with your finger or pen.`
    : 'Drawing canvas. Draw with your finger, pen, or mouse.'}
    onLayout={event => {
      const next = event.nativeEvent.layout;
      setLayout(next);
      onSize?.({ width: next.width, height: next.height });
    }}
    onStartShouldSetResponder={() => !disabled} onMoveShouldSetResponder={() => !disabled && drawing.current}
    onResponderGrant={event => {
      drawing.current = true;
      dispatch({ type: 'begin', point: pointFromEvent(event), color, width: brushSize });
    }}
    onResponderMove={event => { if (drawing.current) dispatch({ type: 'move', point: pointFromEvent(event) }); }}
    onResponderRelease={() => { drawing.current = false; }}
    onResponderTerminate={() => { drawing.current = false; }} onResponderTerminationRequest={() => false}
    style={{ width: '100%', height,
      backgroundColor: theme.canvas, borderRadius: RADIUS.lg, overflow: 'hidden',
      borderWidth: ART.borderWidth, borderColor: theme.teal,
      ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}) }}>
    <Svg width="100%" height="100%" viewBox="0 0 1000 650" preserveAspectRatio="none" pointerEvents="none">
      {shapes && shapeTarget === 'circle' && <Ellipse cx="500" cy="325" rx={210 * guideScale / scaleX}
        ry={210 * guideScale / scaleY} stroke={theme.art.guide}
        strokeWidth="4" strokeDasharray="10 14" fill="none" />}
      {shapes && shapeTarget !== 'circle' && <Path d={guidePath(GUIDE_POINTS[shapeTarget])}
        stroke={theme.art.guide} strokeWidth="4" strokeDasharray="10 14" strokeLinejoin="round" fill="none" />}
      {strokes.map((stroke, index) => <Path key={index} d={strokeToPath(stroke)} stroke={stroke.color}
        strokeWidth={stroke.width} strokeLinecap="round" strokeLinejoin="round" fill="none" />)}
    </Svg>
  </View>;
}
