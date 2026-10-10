// One game's banner on the play screen (design/Timed_Run_Banner.png, fixed up):
// title, illustration, high score, short description, option chips, and a
// Play button, with the longer "how to play" behind an info button.
// Layout rules are in DESIGN.md "Game banners".
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { APP_ARTWORK } from '../artwork';
import { ANIMATIONS, USE_NATIVE_DRIVER, useAnimation } from '../design/motion';
import { FONTS, RADIUS, SIZE } from '../design/tokens';
import type { ShelfGame } from '../games';
import type { Theme } from '../theme';
import { GameArt } from './GameArt';
import { Icon, type IconName } from './Icon';
import { Tappable } from './Tappable';

export interface BannerStat {
  readonly label: string;
  readonly value: string;
}

const USES: Readonly<Record<ShelfGame['uses'], { readonly icon: IconName; readonly label: string }>> = {
  jimmy: { icon: 'toy', label: 'Plays with Jimmy' },
  stylus: { icon: 'stylus', label: 'Uses the stylus' },
  touch: { icon: 'pencil', label: 'Finger or stylus' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function OptionChip({ theme, label, accessibilityLabel, selected, accent, chip, onPress, scale, focusable }: {
  readonly theme: Theme; readonly label: string; readonly accessibilityLabel: string; readonly selected: boolean;
  readonly accent: string; readonly chip: string; readonly onPress: () => void; readonly scale: number;
  readonly focusable: boolean;
}) {
  const pop = useRef(new Animated.Value(1)).current;
  const canPop = useAnimation('chipPop');
  const wasSelected = useRef(selected);
  // ANIMATION(chipPop): a quick grow-and-settle when this option becomes the chosen one.
  useEffect(() => {
    if (selected && !wasSelected.current && canPop) {
      const { scale: peak, ms } = ANIMATIONS.chipPop;
      Animated.sequence([
        Animated.timing(pop, { toValue: peak, duration: ms, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }
    wasSelected.current = selected;
  }, [selected, canPop, pop]);
  return <Animated.View style={{ transform: [{ scale: pop }] }}>
    <Tappable accessibilityRole="radio" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked: selected }}
      onPress={onPress} focusColor={theme.focus} focusable={focusable}
      style={[styles.chip, { backgroundColor: selected ? accent : chip, borderColor: selected ? theme.ink : theme.border,
        borderWidth: selected ? 2.5 : 1.5, paddingHorizontal: 16 * scale }]}>
      {selected && <Icon name="check" color={theme.ink} size={18} weight={3} />}
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: clamp(18 * scale, 16, 20),
        color: selected ? theme.ink : theme.text }}>{label}</Text>
    </Tappable>
  </Animated.View>;
}

export function GameBanner({ theme, game, stat, option, onOption, onPlay, width, height, active, toyConnected }: {
  readonly theme: Theme; readonly game: ShelfGame; readonly stat: BannerStat; readonly option: string | null;
  readonly onOption: (value: string) => void; readonly onPlay: () => void; readonly width: number;
  readonly height: number;
  /** Only the centered banner is interactive; the others are previews. */
  readonly active: boolean; readonly toyConnected: boolean;
}) {
  const colors = theme.banners[game.color];
  const tall = width < 560 || width / height < 1.15;
  // One scale for every size inside the banner, so it looks the same on a phone and a big tablet.
  const u = clamp(tall ? width / 420 : Math.min(width / 900, height / 480), 0.72, 1.2);
  const [tipOpen, setTipOpen] = useState(false);
  const tip = useRef(new Animated.Value(0)).current;
  const canRevealTip = useAnimation('tipReveal');
  useEffect(() => { if (!active) setTipOpen(false); }, [active]);
  // ANIMATION(tipReveal): the tip fades and grows from the info button.
  useEffect(() => {
    if (!canRevealTip) { tip.setValue(tipOpen ? 1 : 0); return; }
    Animated.timing(tip, { toValue: tipOpen ? 1 : 0, duration: ANIMATIONS.tipReveal.ms,
      useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [tipOpen, canRevealTip, tip]);

  const chosen = game.options.find(item => item.value === option);
  const tagline = chosen?.caption ?? game.tagline;
  const uses = USES[game.uses];
  const needsToy = game.uses === 'jimmy' && !toyConnected;
  const artSize = tall ? clamp(Math.min(height * 0.3, width * 0.42), 96, 260) : clamp(Math.min(width * 0.36, height * 0.62), 140, 330);

  const picture = APP_ARTWORK.bannerArt[game.id];
  const art = picture ? <Image source={picture} resizeMode="contain" accessible={false}
    style={{ width: artSize, height: artSize }} />
    : <GameArt name={game.art} size={artSize} ink={theme.text} accent={colors.accent} shadow={colors.shadow} />;

  const title = <Text accessibilityRole="header" aria-level={2} numberOfLines={1} adjustsFontSizeToFit
    style={{ fontFamily: FONTS.display, fontSize: (tall ? 40 : 54) * u, lineHeight: (tall ? 46 : 62) * u,
      color: theme.text, flexShrink: 1 }}>{game.title}</Text>;

  const score = <View style={{ alignItems: tall ? 'flex-start' : 'center', gap: 4 * u }}>
    <View style={[styles.pill, { backgroundColor: theme.score.pill, paddingHorizontal: 22 * u, minHeight: 40 * u }]}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 22 * u, lineHeight: 28 * u, color: theme.score.pillText }}>
        {stat.label}</Text>
    </View>
    <Text accessibilityLabel={`${stat.label}: ${stat.value}`} style={{ fontFamily: FONTS.displayHeavy,
      fontSize: 52 * u, lineHeight: 60 * u, color: theme.score.value }}>{stat.value}</Text>
  </View>;

  const usesChip = <View style={[styles.uses, { backgroundColor: needsToy ? theme.surface : 'transparent',
    borderColor: needsToy ? theme.coral : 'transparent' }]}>
    <Icon name={uses.icon} color={theme.text} size={20} />
    <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 15, color: theme.text }}>
      {needsToy ? 'Connect Jimmy to play' : uses.label}</Text>
  </View>;

  const options = game.options.length > 0 && <View accessibilityRole="radiogroup"
    accessibilityLabel={`${game.title} options`} style={[styles.options, { gap: 10 * u,
      justifyContent: tall ? 'flex-start' : 'center' }]}>
    {game.options.map(item => <OptionChip key={item.value} theme={theme} label={item.label}
      accessibilityLabel={item.accessibilityLabel} selected={item.value === option} accent={colors.accent}
      chip={colors.chip} scale={u} focusable={active} onPress={() => onOption(item.value)} />)}
  </View>;

  const play = <Tappable accessibilityLabel={`Play ${game.title}${chosen ? `, ${chosen.accessibilityLabel}` : ''}`}
    onPress={onPlay} focusColor={theme.focus} focusable={active}
    style={[styles.play, { backgroundColor: colors.accent, minHeight: clamp(66 * u, SIZE.touchTarget + 4, 76),
      alignSelf: tall ? 'stretch' : 'center', minWidth: tall ? undefined : 240 * u }]}>
    <Icon name="play" color={theme.ink} size={28 * u} weight={2.6} />
    <Text style={{ fontFamily: FONTS.display, fontSize: 30 * u, lineHeight: 36 * u, color: theme.ink }}>Play</Text>
  </Tappable>;

  const description = <Text style={{ fontFamily: FONTS.body, fontSize: clamp(18 * u, 16, 21), lineHeight: clamp(26 * u, 23, 30),
    color: theme.secondary, textAlign: tall ? 'left' : 'center', maxWidth: 420 * u }}>{tagline}</Text>;

  const infoButton = <Tappable accessibilityLabel={tipOpen ? 'Close how to play' : `How to play ${game.title}`}
    accessibilityState={{ expanded: tipOpen }} onPress={() => setTipOpen(open => !open)} focusColor={theme.focus} focusable={active}
    style={[styles.info, { backgroundColor: tipOpen ? theme.text : theme.surface, borderColor: colors.border }]}>
    <Icon name={tipOpen ? 'close' : 'info'} color={tipOpen ? theme.surface : theme.text} size={24} weight={2.2} />
  </Tappable>;

  return <View accessibilityLabel={active ? undefined : game.title} style={[styles.card, { width, height,
    backgroundColor: colors.background, borderColor: colors.border, padding: (tall ? 22 : 34) * u }]}>
    {tall ? <View style={{ flex: 1, gap: 14 * u }}>
      <View style={styles.titleRow}>{title}{infoButton}</View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 * u }}>
        {art}
        <View style={{ flexShrink: 1 }}>{score}</View>
      </View>
      {description}
      {options}
      {usesChip}
      {play}
    </View> : <View style={{ flex: 1, flexDirection: 'row', gap: 28 * u }}>
      <View style={{ flex: 1.1, justifyContent: 'space-between' }}>
        <View style={styles.titleRow}>{title}</View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {art}
        </View>
        {usesChip}
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 * u, paddingTop: 20 * u }}>
        {score}
        {description}
        {options}
        {play}
      </View>
      <View style={styles.infoCorner}>{infoButton}</View>
    </View>}

    {tipOpen && <Animated.View accessibilityLiveRegion="polite" style={[styles.tip, {
      backgroundColor: theme.surface, borderColor: colors.border, top: (tall ? 22 : 34) * u + 64,
      right: (tall ? 22 : 34) * u, width: Math.min(380, width - 44), opacity: tip,
      transform: [{ scale: tip.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
    }]}>
      <Text style={{ fontFamily: FONTS.display, fontSize: 24, lineHeight: 30, color: theme.text }}>How to play</Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 17, lineHeight: 26, color: theme.secondary }}>{game.howTo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={uses.icon} color={theme.text} size={20} />
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 15, color: theme.text }}>{uses.label}</Text>
      </View>
    </Animated.View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.xl, borderWidth: 2, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pill: { borderRadius: RADIUS.pill, justifyContent: 'center', alignItems: 'center' },
  options: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: SIZE.touchTarget, borderRadius: RADIUS.sm, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 6 },
  play: { borderRadius: RADIUS.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 32 },
  uses: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', borderWidth: 1.5,
    borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  info: { width: SIZE.touchTarget, height: SIZE.touchTarget, borderRadius: SIZE.touchTarget / 2, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center' },
  infoCorner: { position: 'absolute', top: -14, right: -14 },
  tip: { position: 'absolute', borderRadius: RADIUS.lg, borderWidth: 2, padding: 20, gap: 10,
    shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
