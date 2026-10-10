import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Body, Button, Eyebrow, Heading } from '../components/Controls';
import { Icon } from '../components/Icon';
import { DrawingCanvas } from '../components/DrawingCanvas';
import type { Theme } from '../theme';
import type { Activity } from '../games';
import type { DrawingAction, Stroke } from '@jimmyit/game-drawing';

const PALETTE = [
  { name: 'Ocean blue', color: '#3387D6' }, { name: 'Coral', color: '#D85E57' },
  { name: 'Berry', color: '#BF4CA0' }, { name: 'Purple', color: '#9470E0' },
  { name: 'Teal', color: '#14A798' }, { name: 'Golden yellow', color: '#BA8B00' },
  { name: 'Mint green', color: '#348F6B' }, { name: 'Slate', color: '#8095AB' },
] as const;

export function DrawingScreen({ theme, activity, strokes, dispatch, finish, saving }: {
  readonly theme: Theme; readonly activity: Activity; readonly strokes: readonly Stroke[];
  readonly dispatch: (action: DrawingAction) => void; readonly finish: () => void; readonly saving: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 750;
  const [color, setColor] = useState<string>(PALETTE[0].color);
  const [brushSize, setBrushSize] = useState(10);
  const [focusedColor, setFocusedColor] = useState<string | null>(null);
  const shapes = activity === 'shapes';
  return <View style={{ gap: 24 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
      <View style={{ gap: 7 }}><Eyebrow theme={theme}>{shapes ? 'Play & practice' : 'Your imagination lives here'}</Eyebrow>
        <Heading theme={theme} level={1} size={compact ? 36 : 44}>{shapes ? 'Shape Challenge' : 'Drawing with Jimmy'}</Heading></View>
      {!compact && <View style={{ backgroundColor: theme.softMint, padding: 14, borderRadius: 15,
        flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="star" color={theme.accentText} size={20} />
        <Body theme={theme} small>Every try earns points</Body>
      </View>}
    </View>
    <View style={{ backgroundColor: theme.softMint, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 15,
      flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <Icon name={shapes ? 'shapes' : 'sparkle'} color={theme.accentText} />
      <View style={{ flex: 1 }}><Body theme={theme} small color={theme.text}>
        {shapes ? 'Can you follow the circle? Take your time — every little try counts.'
          : 'Pick a color. Make your mark. There’s no wrong way to create!'}
      </Body></View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderRadius: 28, padding: compact ? 14 : 24,
      borderWidth: 1.5, borderColor: theme.border, gap: 20 }}>
      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 20 }}>
        <View style={{ width: compact ? '100%' : 86, backgroundColor: theme.raised, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 12,
          flexDirection: compact ? 'row' : 'column', flexWrap: compact ? 'wrap' : 'nowrap' }}>
          {PALETTE.map(swatch => <Pressable key={swatch.name} accessibilityRole="button"
            accessibilityLabel={`${swatch.name} drawing color`} accessibilityState={{ selected: color === swatch.color }}
            onPress={() => setColor(swatch.color)} onFocus={() => setFocusedColor(swatch.color)}
            onBlur={() => setFocusedColor(null)} style={({ pressed }) => [{
              width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
              borderWidth: color === swatch.color || focusedColor === swatch.color ? 3 : 1.5,
              borderColor: focusedColor === swatch.color ? theme.focus
                : color === swatch.color ? theme.text : theme.border,
              backgroundColor: swatch.color, opacity: pressed ? .7 : 1,
            }]}>
            {color === swatch.color && <View style={{ backgroundColor: theme.navy, padding: 3, borderRadius: 12 }}>
              <Icon name="check" color="#FFFFFF" size={19} />
            </View>}
          </Pressable>)}
        </View>
        <View style={{ flex: 1, gap: 15 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 5 }}>
            <Eyebrow theme={theme}>Your masterpiece</Eyebrow>
            <Body theme={theme} small>{strokes.length === 0 ? 'A fresh start' : `${strokes.length} little marks`}</Body>
          </View>
          <DrawingCanvas strokes={strokes} dispatch={dispatch} color={color} brushSize={brushSize}
            shapes={shapes} dark={theme.dark} disabled={saving} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Text style={{ color: theme.text, fontFamily: 'PoppinsBold', fontSize: 18 }}>Brush size</Text>
          <Button theme={theme} icon="minus" accessibilityLabel="Smaller brush" compact
            onPress={() => setBrushSize(size => Math.max(4, size - 4))} disabled={brushSize <= 4} />
          <View style={{ width: 38, alignItems: 'center', gap: 5 }}>
            <View style={{ width: brushSize, height: brushSize, borderRadius: 30, backgroundColor: color }} />
            <Text style={{ color: theme.secondary, fontFamily: 'Poppins', fontSize: 14 }}>{brushSize}</Text>
          </View>
          <Button theme={theme} icon="plus" accessibilityLabel="Larger brush" compact
            onPress={() => setBrushSize(size => Math.min(30, size + 4))} disabled={brushSize >= 30} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button theme={theme} label="Undo" icon="undo" compact disabled={strokes.length === 0 || saving}
            onPress={() => dispatch({ type: 'undo' })} />
          <Button theme={theme} label="Clear" icon="trash" compact disabled={strokes.length === 0 || saving}
            onPress={() => dispatch({ type: 'clear' })} />
          <Button theme={theme} label={saving ? 'Saving…' : 'All done!'} icon="check" color={theme.yellow}
            onPress={finish} disabled={saving} />
        </View>
      </View>
    </View>
    <Body theme={theme} small>Your finger, a pen, or a mouse — they all make something wonderful.</Body>
  </View>;
}
