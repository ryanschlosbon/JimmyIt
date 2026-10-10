// Development tool, not part of any design: a floating "virtual toy" with every
// control on the real toy. Input goes through the real protocol bytes, so games,
// scoring and sync behave exactly as they will with the hardware.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BasicModeId, HapticEffect, type ScoreEventKindName, type SwitchId } from '@jimmyit/core';
import type { FakeCelebration, FakeFidget } from '@jimmyit/fake-fidget';
import type { SimulatedToy } from './simulated-toy';

const EFFECT_NAMES = new Map<number, string>(Object.entries(HapticEffect).map(([name, id]) => [id, name]));

// How long the real toy shows each celebration (firmware src/celebration.cpp).
const CELEBRATION_MS: Readonly<Record<ScoreEventKindName, number>> = {
  gameStart: 700,
  points: 350,
  milestone: 2000,
  newBest: 2500,
  gameEnd: 0,
};

function celebrationText(c: FakeCelebration): string {
  switch (c.kind) {
    case 'gameStart':
      return 'GO!';
    case 'points':
      return `+${c.value}`;
    case 'milestone':
      return `* AMAZING JOB! *\n${c.value} POINTS!`;
    case 'newBest':
      return `NEW HIGH SCORE!\n${c.score}\nBEAT ${c.value}`;
    case 'gameEnd':
      return '';
  }
}

/** The celebration still playing on the toy's screen, re-rendering when it ends. */
function useActiveCelebration(toy: FakeFidget): FakeCelebration | null {
  const [, setTick] = useState(0);
  const celebration = toy.lastCelebration;
  const remainingMs = celebration ? celebration.atMs + CELEBRATION_MS[celebration.kind] - Date.now() : 0;
  useEffect(() => {
    if (remainingMs <= 0) return undefined;
    const timer = setTimeout(() => setTick((n) => n + 1), remainingMs + 10);
    return () => clearTimeout(timer);
  }, [celebration, remainingMs]);
  return celebration && remainingMs > 0 ? celebration : null;
}

function useToyVersion(toy: FakeFidget): number {
  const version = useRef(0);
  const subscribe = useCallback(
    (listener: () => void) =>
      toy.subscribe(() => {
        version.current++;
        listener();
      }),
    [toy],
  );
  const read = useCallback(() => version.current, []);
  return useSyncExternalStore(subscribe, read, read);
}

function Key(props: {
  readonly label: string;
  readonly onPress?: () => void;
  readonly onPressIn?: () => void;
  readonly onPressOut?: () => void;
  readonly active?: boolean;
  readonly wide?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: props.active ?? false }}
      onPress={props.onPress}
      onPressIn={props.onPressIn}
      onPressOut={props.onPressOut}
      style={({ pressed }) => [styles.key, props.wide && styles.keyWide, (pressed || props.active) && styles.keyActive]}
    >
      <Text style={styles.keyText}>{props.label}</Text>
    </Pressable>
  );
}

/**
 * Press-and-hold key for a momentary switch: held while the finger is down.
 * A click too quick for press-in (react-native-web skips it) still counts as a
 * full press and release.
 */
function HoldKey(props: { readonly toy: FakeFidget; readonly switchId: SwitchId; readonly label: string }) {
  const { toy, switchId } = props;
  const pressedIn = useRef(false);
  return (
    <Key
      label={props.label}
      active={toy.isClosed(switchId)}
      onPressIn={() => {
        pressedIn.current = true;
        toy.press(switchId);
      }}
      onPressOut={() => {
        if (pressedIn.current) toy.release(switchId);
      }}
      onPress={() => {
        if (!pressedIn.current) {
          toy.press(switchId);
          toy.release(switchId);
        }
        pressedIn.current = false;
      }}
    />
  );
}

/** Tap to flip a switch that stays where it is put (rocker, stylus). */
function ToggleKey(props: { readonly toy: FakeFidget; readonly switchId: SwitchId; readonly on: string; readonly off: string }) {
  const { toy, switchId } = props;
  const closed = toy.isClosed(switchId);
  return (
    <Key
      label={closed ? props.on : props.off}
      active={closed}
      onPress={() => (closed ? toy.release(switchId) : toy.press(switchId))}
    />
  );
}

function Section(props: { readonly title: string; readonly children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{props.title}</Text>
      <View style={styles.row}>{props.children}</View>
    </View>
  );
}

function ToyScreen({ toy }: { readonly toy: FakeFidget }) {
  const { lines, score, progress } = toy.display;
  const celebration = useActiveCelebration(toy);
  let content: ReactNode;
  if (toy.approvalRequest) {
    content = (
      <View style={styles.prompt}>
        <Text style={styles.oledText}>{`CONNECT TO\n${toy.approvalRequest.name.toUpperCase()}?`}</Text>
        <View style={styles.row}>
          <Key label="< No" onPress={() => toy.answerApproval(false)} />
          <Key label="Yes >" onPress={() => toy.answerApproval(true)} active />
        </View>
      </View>
    );
  } else if (celebration && celebration.kind !== 'points') {
    content = <Text style={[styles.oledText, styles.celebrationText]}>{celebrationText(celebration)}</Text>;
  } else if (toy.mode === 'standalone') {
    content = <Text style={styles.oledText}>{toy.linked ? 'Toy menu / Free Play' : 'Out of range: playing offline'}</Text>;
  } else if (score) {
    content = (
      <Text style={styles.oledText}>
        {`SCORE ${score.score}\nBEST ${score.best}  ${'*'.repeat(score.stars)}${'.'.repeat(3 - score.stars)}`}
      </Text>
    );
  } else {
    const text = lines.filter((line) => line !== '').join('\n');
    content = (
      <Text style={styles.oledText}>
        {text || 'CONNECTED TO APP'}
        {progress ? `\n${progress.label} ${'#'.repeat(Math.round(progress.percent / 10))}` : ''}
      </Text>
    );
  }
  return (
    <View accessibilityLabel="Toy screen" style={styles.oled}>
      {content}
      {celebration?.kind === 'points' && <Text style={styles.pop}>{celebrationText(celebration)}</Text>}
    </View>
  );
}

export interface DevToyPanelProps {
  readonly simulator: SimulatedToy;
  readonly defaultOpen?: boolean;
}

/** Mount once, above everything else, in development builds only. */
export function DevToyPanel({ simulator, defaultOpen = false }: DevToyPanelProps) {
  const { toy } = simulator;
  useToyVersion(toy);
  const [open, setOpen] = useState(defaultOpen);
  const { width, height } = useWindowDimensions();

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open virtual toy"
        onPress={() => setOpen(true)}
        style={styles.fab}
      >
        <Text style={styles.fabText}>Toy</Text>
      </Pressable>
    );
  }

  const lastHaptics = toy.haptics.slice(-3).reverse();
  // A whole Free Play game on the toy: live score events if the app is connected, then the record.
  const playOnToy = () => {
    const moves = 3 + Math.floor(Math.random() * 18);
    toy.playStandaloneGame({ modeId: BasicModeId.freePlay, moves, durationS: 20 + moves * 2 });
  };

  return (
    <View style={[styles.panel, { width: Math.min(380, width - 24), maxHeight: height * 0.8 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Virtual toy · dev only</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close virtual toy" onPress={() => setOpen(false)} style={styles.close}>
          <Text style={styles.keyText}>Close</Text>
        </Pressable>
      </View>
      <Text style={styles.status}>
        {toy.linked ? 'in range' : 'out of range'} · {toy.approved ? 'phone approved' : 'no phone approved'} · {toy.mode} mode ·
        battery {toy.batteryPercent ?? '?'}% · {toy.storedRecordCount} stored game(s)
      </Text>
      <ScrollView contentContainerStyle={styles.body}>
        <ToyScreen toy={toy} />
        <Section title="Buttons (hold)">
          <HoldKey toy={toy} switchId="clicker" label="Clicker" />
          <HoldKey toy={toy} switchId="navLeft" label="< Menu left" />
          <HoldKey toy={toy} switchId="navRight" label="Menu right >" />
        </Section>
        <Section title="Switches (tap to flip)">
          <ToggleKey toy={toy} switchId="rocker" on="Rocker on" off="Rocker off" />
          <ToggleKey toy={toy} switchId="stylusStowed" on="Stylus in" off="Stylus out" />
        </Section>
        <Section title="Slider (hold an end)">
          <HoldKey toy={toy} switchId="sliderLow" label="Slide down" />
          <HoldKey toy={toy} switchId="sliderHigh" label="Slide up" />
        </Section>
        <Section title="Spinner and screw">
          <Key label="Spin back 45°" onPress={() => toy.spin(-45)} />
          <Key label="Spin 45°" onPress={() => toy.spin(45)} />
          <Key label="Spin 1 turn" onPress={() => toy.spin(360)} />
          <Key label="Loosen" onPress={() => toy.turnScrew(-1)} />
          <Key label="Tighten" onPress={() => toy.turnScrew(1)} />
        </Section>
        <Section title="Toy on its own">
          <Key label="Toy plays Free Play" onPress={playOnToy} wide />
          <Key label={toy.linked ? 'Go out of range' : 'Back in range'} onPress={() => (toy.linked ? toy.dropConnection() : toy.reconnect())} wide />
          <Key label="Battery -10%" onPress={() => toy.setBattery(Math.max(0, (toy.batteryPercent ?? 50) - 10))} />
          <Key label="Charge" onPress={() => toy.setBattery(100, true)} />
        </Section>
        <Text style={styles.sectionTitle}>Haptics the app played</Text>
        <Text style={styles.status}>
          {lastHaptics.length === 0
            ? 'none yet'
            : lastHaptics.map((effects) => effects.map((id) => EFFECT_NAMES.get(id) ?? `#${id}`).join(' + ')).join('\n')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    minWidth: 64,
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: '#111827',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { color: '#F59E0B', fontWeight: '700', fontSize: 16 },
  panel: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#F59E0B', fontWeight: '700', fontSize: 16 },
  close: { paddingHorizontal: 12, paddingVertical: 8 },
  status: { color: '#D1D5DB', fontSize: 12, marginVertical: 4 },
  body: { gap: 10, paddingBottom: 8 },
  oled: { backgroundColor: '#000000', borderRadius: 6, padding: 10, minHeight: 72, justifyContent: 'center' },
  oledText: { color: '#E5F2FF', fontFamily: 'monospace', fontSize: 13 },
  celebrationText: { textAlign: 'center', fontWeight: '700', fontSize: 15 },
  prompt: { gap: 8 },
  pop: {
    position: 'absolute',
    right: 8,
    top: 6,
    color: '#000000',
    backgroundColor: '#E5F2FF',
    paddingHorizontal: 4,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  section: { gap: 6 },
  sectionTitle: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  key: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { minWidth: 150 },
  keyActive: { backgroundColor: '#065F46', borderColor: '#10B981' },
  keyText: { color: '#F9FAFB', fontSize: 13, fontWeight: '600' },
});
