import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { Body, Button } from '../components/Controls';
import { Icon } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import { Tappable } from '../components/Tappable';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { ART, ART_BRUSH_SIZES, FONTS, RADIUS, SIZE, SPACE, TYPE } from '../design/tokens';
import { getArtLayout } from '../art-layout';
import type { Theme } from '../theme';
import type { Activity } from '../games';
import type { DrawingAction, Stroke } from '@jimmyit/game-drawing';
import type { TargetShape } from '@jimmyit/game-shape-recognition';

export function DrawingScreen({ theme, activity, strokes, dispatch, finish, saving, onAllGames, onCanvasSize,
  shapeFeedback, shapeTarget = 'circle', shapeIndex = 0, shapeCount = 4 }: {
  readonly theme: Theme; readonly activity: Activity; readonly strokes: readonly Stroke[];
  readonly dispatch: (action: DrawingAction) => void; readonly finish: () => void; readonly saving: boolean;
  readonly onAllGames: () => void;
  readonly onCanvasSize?: (size: { readonly width: number; readonly height: number }) => void;
  readonly shapeFeedback?: 'shapeMatched' | 'keepTrying' | 'drawMore';
  readonly shapeTarget?: TargetShape; readonly shapeIndex?: number; readonly shapeCount?: number;
}) {
  const { width, height } = useWindowDimensions();
  const compact = width < SIZE.compactWidth;
  const { canvasHeight, sidebarWidth } = getArtLayout(height, compact, theme.art.colors.length, ART_BRUSH_SIZES.length);
  const [colorName, setColorName] = useState('Ocean blue');
  const [brushSize, setBrushSize] = useState<number>(12);
  const color = theme.art.colors.find(swatch => swatch.name === colorName)?.color ?? theme.ink;
  const shapes = activity === 'shapes';
  const panelStyle = {
    backgroundColor: theme.dark ? theme.surface : theme.raised,
    borderColor: theme.art.panelBorder, borderWidth: ART.borderWidth,
    borderRadius: RADIUS.lg, padding: SPACE.sm,
  } as const;
  const tools = <View accessibilityLabel="Art colors and brush sizes"
    style={{ width: compact ? '100%' : sidebarWidth, gap: SPACE.sm }}>
    <Button theme={theme} label="All games" icon="chevronLeft" compact onPress={onAllGames}
      style={{ width: '100%', paddingHorizontal: SPACE.xs }} />
    <View style={{ height: compact ? undefined : canvasHeight, gap: SPACE.sm }}>
    <View style={[panelStyle, { flexGrow: 1, justifyContent: 'center' }]}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Drawing color"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, justifyContent: 'center' }}>
        {theme.art.colors.map(swatch => {
          const selected = colorName === swatch.name;
          return <Tappable key={swatch.name} accessibilityRole="radio"
            accessibilityLabel={`${swatch.name} drawing color`} accessibilityState={{ checked: selected }}
            onPress={() => setColorName(swatch.name)} focusColor={theme.focus} disabled={saving}
            style={{ width: SIZE.touchTarget, height: SIZE.touchTarget, borderRadius: ART.swatchRadius,
              backgroundColor: swatch.color, alignItems: 'center', justifyContent: 'center',
              borderWidth: ART.selectedBorderWidth, borderColor: selected ? theme.ink : theme.art.panelBorder }}>
            {selected && <View style={{ backgroundColor: theme.yellow, borderRadius: RADIUS.pill, padding: SPACE.xs }}>
              <Icon name="check" color={theme.ink} size={TYPE.body} weight={3} />
            </View>}
          </Tappable>;
        })}
      </View>
    </View>
    <View style={[panelStyle, { flexGrow: 1, justifyContent: 'center' }]}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Brush size"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, justifyContent: 'center' }}>
        {ART_BRUSH_SIZES.map(size => <Tappable key={size} accessibilityRole="radio"
          accessibilityLabel={`${size} pixel brush`} accessibilityState={{ checked: brushSize === size }}
          onPress={() => setBrushSize(size)} focusColor={theme.focus} disabled={saving}
          style={{ width: SIZE.touchTarget, height: SIZE.touchTarget, borderRadius: ART.swatchRadius,
            backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center',
            borderWidth: ART.selectedBorderWidth,
            borderColor: brushSize === size ? theme.focus : theme.art.panelBorder }}>
          <View style={{ width: size, height: size,
            borderRadius: RADIUS.pill, backgroundColor: theme.text }} />
          {brushSize === size && <View style={{ position: 'absolute', top: SPACE.xs, right: SPACE.xs,
            backgroundColor: theme.yellow, borderRadius: RADIUS.pill }}>
            <Icon name="check" color={theme.ink} size={TYPE.caption} weight={3} />
          </View>}
        </Tappable>)}
      </View>
    </View>
    </View>
  </View>;

  return <View style={{ flexDirection: compact ? 'column' : 'row', gap: SPACE.sm, alignItems: 'flex-start' }}>
    {!compact && tools}
    <View style={{ flex: compact ? undefined : 1, width: compact ? '100%' : undefined, minWidth: 0, gap: SPACE.sm }}>
      <View style={{ alignSelf: 'center', minHeight: ART.titleHeight, justifyContent: 'center',
        paddingHorizontal: SPACE.xl, paddingVertical: SPACE.xs, borderRadius: RADIUS.lg,
        backgroundColor: theme.art.titleBackground }}>
        <Text accessibilityRole="header" aria-level={1} style={{ fontFamily: FONTS.display,
          fontSize: TYPE.heading, lineHeight: TYPE.heading * 1.2,
          color: theme.art.titleText, textAlign: 'center' }}>
          {shapes ? 'SHAPE CHALLENGE' : 'YOUR MASTERPIECE'}
        </Text>
      </View>
      <View>
        <DrawingCanvas strokes={strokes} dispatch={dispatch} color={color} brushSize={brushSize}
          shapes={shapes} shapeTarget={shapeTarget} theme={theme} disabled={saving}
          height={compact ? ART.phoneCanvasHeight : canvasHeight} onSize={onCanvasSize} />
        {shapes && <View pointerEvents="none" style={{ position: 'absolute', top: SPACE.md, left: SPACE.md,
          right: SPACE.md, borderRadius: RADIUS.sm, padding: SPACE.sm, backgroundColor: theme.sheet }}>
          <Body theme={theme} small>{`Shape ${Math.min(shapeIndex + 1, shapeCount)} of ${shapeCount} · `}
            {shapeFeedback === 'shapeMatched' ? `Lovely ${shapeTarget}!`
              : shapeFeedback === 'drawMore' ? `Add a little more to your ${shapeTarget} and try again.`
              : shapeFeedback === 'keepTrying' ? `Nice try! Give the ${shapeTarget} another go.`
              : `Follow the ${shapeTarget} at your own pace.`}</Body>
        </View>}
      </View>
      <View style={{ flexDirection: 'row', gap: SPACE.md, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <Tappable accessibilityLabel="Undo last stroke" onPress={() => dispatch({ type: 'undo' })}
          disabled={strokes.length === 0 || saving} focusColor={theme.focus}
          style={{ width: compact ? SIZE.touchTarget : ART.actionHeight,
            minHeight: compact ? SIZE.touchTarget : ART.actionHeight, borderRadius: RADIUS.lg,
            backgroundColor: theme.mint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="undo" color={theme.ink} size={ART.actionIcon} weight={3} />
        </Tappable>
        <Tappable accessibilityLabel="Clear drawing" onPress={() => dispatch({ type: 'clear' })}
          disabled={strokes.length === 0 || saving} focusColor={theme.focus}
          style={{ minHeight: compact ? SIZE.touchTarget : ART.actionHeight, paddingHorizontal: SPACE.lg,
            borderRadius: RADIUS.lg, backgroundColor: theme.mint, flexDirection: 'row', gap: SPACE.sm,
            alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: TYPE.subheading,
            color: theme.ink }}>Clear</Text>
          <Icon name="trash" color={theme.ink} size={ART.actionIcon} weight={2.5} />
        </Tappable>
        <Tappable accessibilityLabel={saving ? 'Saving drawing' : 'Submit drawing'} onPress={finish}
          disabled={saving} focusColor={theme.focus}
          style={{ minHeight: compact ? SIZE.touchTarget : ART.actionHeight, paddingHorizontal: SPACE.xl,
            borderRadius: RADIUS.lg, backgroundColor: theme.yellow, flexDirection: 'row', gap: SPACE.lg,
            alignItems: 'center', justifyContent: 'center', flexGrow: compact ? 1 : 0 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: TYPE.subheading,
            color: theme.ink }}>{saving ? 'Saving…' : 'SUBMIT'}</Text>
          <Jimmy face size={ART.faceSize} color={theme.yellow} />
        </Tappable>
      </View>
      {compact && <View style={{ backgroundColor: theme.sheet, padding: SPACE.md, borderRadius: RADIUS.sm }}>
        <Body theme={theme} small>Pick a color and make your mark. Your finger, pen, or mouse can all join in.</Body>
      </View>}
    </View>
    {compact && tools}
  </View>;
}
