import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View, type LayoutRectangle } from 'react-native';
import { Body, Button } from '../components/Controls';
import { Icon } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import { Tappable } from '../components/Tappable';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { ART, ART_BRUSH_SIZES, FONTS, RADIUS, SIZE, SPACE, TYPE } from '../design/tokens';
import { getArtSidebar, prefersArtSidebar } from '../art-layout';
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
  // Everything is sized from the space this screen gets, so the canvas always fits without scrolling.
  const [area, setArea] = useState<LayoutRectangle | null>(null);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const sidebar = area !== null && prefersArtSidebar(area.width, area.height);
  const compact = (area?.width ?? 0) < SIZE.compactWidth;
  const { sidebarWidth } = getArtSidebar((area?.height ?? 0) - SIZE.touchTarget - SPACE.sm,
    theme.art.colors.length, ART_BRUSH_SIZES.length);
  const [colorName, setColorName] = useState('Ocean blue');
  const [brushSize, setBrushSize] = useState<number>(12);
  const color = theme.art.colors.find(swatch => swatch.name === colorName)?.color ?? theme.ink;
  const shapes = activity === 'shapes';
  const panelStyle = {
    backgroundColor: theme.dark ? theme.surface : theme.raised,
    borderColor: theme.art.panelBorder, borderWidth: ART.borderWidth,
    borderRadius: RADIUS.lg, padding: SPACE.sm,
  } as const;
  const swatches = theme.art.colors.map(swatch => {
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
  });
  const brushes = ART_BRUSH_SIZES.map(size => <Tappable key={size} accessibilityRole="radio"
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
  </Tappable>);
  const group = (label: string, children: ReactNode) => <View accessibilityRole="radiogroup" accessibilityLabel={label}
    style={{ flexDirection: 'row', flexWrap: sidebar ? 'wrap' : 'nowrap', gap: SPACE.sm, justifyContent: 'center' }}>
    {children}
  </View>;
  // Tall windows: each set of tools is one strip under the canvas that slides sideways if it doesn't fit.
  const strip = (label: string, children: ReactNode) => <View style={[panelStyle, { paddingHorizontal: 0 }]}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.sm }}>
      {group(label, children)}
    </ScrollView>
  </View>;
  const allGames = <Button theme={theme} label="All games" icon="chevronLeft" compact onPress={onAllGames}
    style={sidebar ? { width: '100%', paddingHorizontal: SPACE.xs } : undefined} />;
  const title = <View style={{ alignSelf: 'center', maxWidth: '100%', minHeight: ART.titleHeight, justifyContent: 'center',
    paddingHorizontal: compact ? SPACE.lg : SPACE.xl, paddingVertical: SPACE.xs, borderRadius: RADIUS.lg,
    backgroundColor: theme.art.titleBackground }}>
    <Text accessibilityRole="header" aria-level={1} numberOfLines={1} adjustsFontSizeToFit style={{
      fontFamily: FONTS.display, fontSize: compact ? TYPE.subheading : TYPE.heading,
      lineHeight: (compact ? TYPE.subheading : TYPE.heading) * 1.2, color: theme.art.titleText, textAlign: 'center' }}>
      {shapes ? 'SHAPE CHALLENGE' : 'YOUR MASTERPIECE'}
    </Text>
  </View>;

  const canvas = <View style={{ flex: 1, minHeight: 0 }}
    onLayout={event => setCanvasHeight(Math.floor(event.nativeEvent.layout.height))}>
    {canvasHeight > 0 && <DrawingCanvas strokes={strokes} dispatch={dispatch} color={color} brushSize={brushSize}
      shapes={shapes} shapeTarget={shapeTarget} theme={theme} disabled={saving}
      height={canvasHeight} onSize={onCanvasSize} />}
    {shapes && <View pointerEvents="none" style={{ position: 'absolute', top: SPACE.md, left: SPACE.md,
      right: SPACE.md, borderRadius: RADIUS.sm, padding: SPACE.sm, backgroundColor: theme.sheet }}>
      <Body theme={theme} small>{`Shape ${Math.min(shapeIndex + 1, shapeCount)} of ${shapeCount} · `}
        {shapeFeedback === 'shapeMatched' ? `Lovely ${shapeTarget}!`
          : shapeFeedback === 'drawMore' ? `Add a little more to your ${shapeTarget} and try again.`
          : shapeFeedback === 'keepTrying' ? `Nice try! Give the ${shapeTarget} another go.`
          : `Follow the ${shapeTarget} at your own pace.`}</Body>
    </View>}
  </View>;

  const actions = <View style={{ flexDirection: 'row', gap: SPACE.md, justifyContent: 'flex-end' }}>
    <Tappable accessibilityLabel="Undo last stroke" onPress={() => dispatch({ type: 'undo' })}
      disabled={strokes.length === 0 || saving} focusColor={theme.focus}
      style={{ width: ART.actionHeight, minHeight: ART.actionHeight, borderRadius: RADIUS.lg,
        backgroundColor: theme.mint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="undo" color={theme.ink} size={ART.actionIcon} weight={3} />
    </Tappable>
    <Tappable accessibilityLabel="Clear drawing" onPress={() => dispatch({ type: 'clear' })}
      disabled={strokes.length === 0 || saving} focusColor={theme.focus}
      style={{ minHeight: ART.actionHeight, minWidth: ART.actionHeight, paddingHorizontal: compact ? 0 : SPACE.lg,
        borderRadius: RADIUS.lg, backgroundColor: theme.mint, flexDirection: 'row', gap: SPACE.sm,
        alignItems: 'center', justifyContent: 'center' }}>
      {!compact && <Text style={{ fontFamily: FONTS.display, fontSize: TYPE.subheading,
        color: theme.ink }}>Clear</Text>}
      <Icon name="trash" color={theme.ink} size={ART.actionIcon} weight={2.5} />
    </Tappable>
    <Tappable accessibilityLabel={saving ? 'Saving drawing' : 'Submit drawing'} onPress={finish}
      disabled={saving} focusColor={theme.focus}
      style={{ minHeight: ART.actionHeight, paddingHorizontal: SPACE.xl,
        borderRadius: RADIUS.lg, backgroundColor: theme.yellow, flexDirection: 'row', gap: SPACE.lg,
        alignItems: 'center', justifyContent: 'center', flexGrow: compact ? 1 : 0 }}>
      <Text style={{ fontFamily: FONTS.display, fontSize: TYPE.subheading,
        color: theme.ink }}>{saving ? 'Saving…' : 'SUBMIT'}</Text>
      <Jimmy face size={ART.faceSize} color={theme.yellow} />
    </Tappable>
  </View>;

  return <View style={{ flex: 1 }} onLayout={event => setArea(event.nativeEvent.layout)}>
    {area && (sidebar ? <View style={{ flex: 1, flexDirection: 'row', gap: SPACE.sm }}>
      <View accessibilityLabel="Art colors and brush sizes" style={{ width: sidebarWidth, gap: SPACE.sm }}>
        {allGames}
        <View style={[panelStyle, { flexGrow: 1, justifyContent: 'center' }]}>{group('Drawing color', swatches)}</View>
        <View style={[panelStyle, { flexGrow: 1, justifyContent: 'center' }]}>{group('Brush size', brushes)}</View>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: SPACE.sm }}>
        {title}
        {canvas}
        {actions}
      </View>
    </View> : <View style={{ flex: 1, gap: SPACE.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
        {allGames}
        <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>{title}</View>
      </View>
      {canvas}
      {actions}
      <View accessibilityLabel="Art colors and brush sizes" style={{ gap: SPACE.sm }}>
        {strip('Drawing color', swatches)}
        {strip('Brush size', brushes)}
      </View>
    </View>)}
  </View>;
}
