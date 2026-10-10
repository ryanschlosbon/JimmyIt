import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions, type ImageSourcePropType } from 'react-native';
import { Body, Button, Eyebrow, Heading } from '../components/Controls';
import { Icon, type IconName } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import type { Theme } from '../theme';
import type { Activity } from '../progress';
import { APP_ARTWORK } from '../artwork';

export function HomeScreen({ theme, start, rewards, timed }: {
  readonly theme: Theme; readonly start: (activity: Activity) => void; readonly rewards: () => void;
  readonly timed: () => void;
}) {
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const medium = width < 900;
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const activities: readonly { title: string; caption: string; eyebrow: string; icon: IconName;
    color: string; background: string; artwork: ImageSourcePropType | null; onPress: () => void }[] = [
    { title: 'Drawing with Jimmy', caption: 'Big ideas. Little brushstrokes.', eyebrow: 'CREATE & EXPLORE',
      icon: 'pencil', color: theme.coral, background: theme.softCoral, artwork: APP_ARTWORK.drawingCard,
      onPress: () => start('drawing') },
    { title: 'Shape challenge', caption: 'A little practice, a little magic.', eyebrow: 'PLAY & PRACTICE',
      icon: 'shapes', color: theme.mint, background: theme.softMint, artwork: APP_ARTWORK.shapesCard,
      onPress: () => start('shapes') },
    { title: 'Timed toy practice', caption: 'Press, spin, squeeze. Your pace.', eyebrow: 'MOVE & DISCOVER',
      icon: 'timer', color: theme.yellow, background: theme.dark ? theme.raised : '#FFF8D9',
      artwork: APP_ARTWORK.timedCard, onPress: timed },
    { title: 'My rewards', caption: 'Look how much you’ve grown!', eyebrow: 'COLLECT & CELEBRATE',
      icon: 'star', color: theme.purple, background: theme.softPurple, artwork: APP_ARTWORK.rewardsCard, onPress: rewards },
  ];
  return <View style={{ gap: compact ? 24 : 32 }}>
    <View style={styles.greeting}>
      <View><Eyebrow theme={theme}>A little play, a lot of possibility</Eyebrow>
        <Heading theme={theme} size={compact ? 32 : 38}>Hey, friend! <Text>☀</Text></Heading></View>
      {!compact && <Body theme={theme} small>Your next little adventure awaits.</Body>}
    </View>
    <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.yellow,
      flexDirection: compact ? 'column' : 'row', padding: medium ? 28 : 48 }]}>
      <View style={[styles.blob, { backgroundColor: theme.yellow, width: 170, height: 170,
        top: -116, left: compact ? 130 : 220 }]} />
      <View style={[styles.blob, { backgroundColor: theme.mint, width: 78, height: 78, top: -37, left: 70 }]} />
      <View style={{ flex: 1, gap: 16, alignItems: 'flex-start', zIndex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <Icon name="sparkle" color={theme.dark ? theme.mint : '#087C71'} size={18} />
          <Eyebrow theme={theme}>Good afternoon, explorer</Eyebrow>
        </View>
        <Heading theme={theme} level={1} size={medium ? 48 : 66}>Ready to play?</Heading>
        <Body theme={theme}>Make something wonderful.{compact ? '\n' : ' '}One little move at a time.</Body>
        <Button theme={theme} label="Start drawing" icon="arrow" color={theme.coral}
          onPress={() => start('drawing')} style={{ marginTop: 8, minHeight: 64, paddingHorizontal: 30 }} />
      </View>
      <View style={{ width: compact ? '100%' : medium ? 200 : 300, alignItems: 'center', marginBottom: medium ? -28 : -48,
        marginTop: compact ? 8 : 0 }}><Jimmy size={medium ? 200 : 300} /></View>
      {!medium && <View style={[styles.blob, { backgroundColor: theme.coral, width: 46, height: 46, right: 300, top: 42 }]} />}
    </View>
    <View style={styles.sectionTitle}>
      <Heading theme={theme} size={30}>What shall we do today?</Heading>
      {!compact && <Body theme={theme} small>Pick your kind of fun</Body>}
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 22 }}>
      {activities.map(activity => <Pressable key={activity.title} accessibilityRole="button"
        accessibilityLabel={activity.title} onPress={activity.onPress}
        onFocus={() => setFocusedCard(activity.title)} onBlur={() => setFocusedCard(null)}
        style={({ pressed }) => [{ flexGrow: 1, flexBasis: compact ? '100%' : width >= 1100 ? '22%' : '46%',
          minWidth: compact ? undefined : 220, borderRadius: 24, overflow: 'hidden',
          backgroundColor: theme.surface, borderWidth: focusedCard === activity.title ? 3 : 1.5,
          borderColor: focusedCard === activity.title ? (theme.dark ? theme.yellow : '#9A6E00') : theme.border,
          opacity: pressed ? .8 : 1,
          transform: [{ translateY: pressed ? 2 : 0 }] }]}>
        <View style={{ height: compact ? 120 : 165, backgroundColor: activity.background,
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <View style={[styles.blob, { backgroundColor: activity.color, opacity: .22,
            width: 110, height: 110, top: -55, right: -22 }]} />
          {activity.artwork ? <Image source={activity.artwork} resizeMode="contain" accessible={false}
            style={{ width: '100%', height: '100%' }} /> : <View style={{ width: 86, height: 86, borderRadius: 25, backgroundColor: activity.color,
            borderWidth: 2, borderColor: theme.navy, alignItems: 'center', justifyContent: 'center',
            transform: [{ rotate: activity.icon === 'pencil' ? '-8deg' : '8deg' }] }}>
            <Icon name={activity.icon} color={theme.navy} size={43} />
          </View>}
          <View style={[styles.blob, { backgroundColor: activity.color, opacity: .15,
            width: 75, height: 75, bottom: -45, left: 15 }]} />
        </View>
        <View style={{ padding: 23, gap: 10 }}>
          <Eyebrow theme={theme}>{activity.eyebrow}</Eyebrow>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 5 }}>
            <Heading theme={theme} size={25}>{activity.title}</Heading>
            <Icon name="arrow" size={24} color={theme.text} />
          </View>
          <Body theme={theme} small>{activity.caption}</Body>
        </View>
      </Pressable>)}
    </View>
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', paddingTop: 2 }}>
      <Jimmy face size={25} color={theme.mint} />
      <Body theme={theme} small>Every little try is a big little win.</Body>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  greeting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  hero: { borderWidth: 2, borderRadius: 32, overflow: 'hidden', minHeight: 340, alignItems: 'center' },
  blob: { position: 'absolute', borderRadius: 500 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
});
