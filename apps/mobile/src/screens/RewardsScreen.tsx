import { Text, View, useWindowDimensions } from 'react-native';
import { Body, Eyebrow, Heading, ProgressBar } from '../components/Controls';
import { Icon } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import type { Theme } from '../theme';
import type { JimmyState } from '../use-jimmy';

export function RewardsScreen({ theme, progress }: {
  readonly theme: Theme; readonly progress: JimmyState['progress'];
}) {
  const { width } = useWindowDimensions();
  const compact = width < 680;
  const columns = width < 500 ? 2 : 3;
  const earned = progress.badges.filter(badge => badge.count >= badge.goal).length;
  return <View style={{ gap: 28 }}>
    <View style={{ backgroundColor: theme.coral, borderRadius: 28, padding: compact ? 24 : 38,
      gap: 24, flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'flex-start' : 'center',
      justifyContent: 'space-between', overflow: 'hidden' }}>
      <View style={{ flex: 1, gap: 12 }}>
        <Text style={{ fontFamily: 'PoppinsBold', fontSize: 14, letterSpacing: 2, color: '#6D1B53' }}>YOUR LITTLE BIG WINS</Text>
        <Heading theme={{ ...theme, text: theme.navy }} level={1} size={compact ? 38 : 47}>Look what you’ve{compact ? ' ' : '\n'}achieved!</Heading>
        <Body theme={theme} small color="#203858">Every try is something to celebrate.</Body>
      </View>
      {!compact && <Jimmy face size={108} color="#F48B7C" />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, borderRadius: 20,
        padding: 23, backgroundColor: theme.berry }}>
        <Icon name="star" color="#FFD844" size={35} />
        <View><Text style={{ fontFamily: 'Baloo', fontSize: 38, color: '#FFFFFF' }}>{progress.points.toLocaleString()}</Text>
          <Text style={{ color: '#FFFFFF', fontFamily: 'Poppins', fontSize: 16 }}>total points</Text></View>
      </View>
    </View>
    <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 25, gap: 18,
      borderWidth: 1.5, borderColor: theme.border, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.purple,
        justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Baloo', color: '#FFFFFF', fontSize: 32 }}>{progress.level}</Text>
      </View>
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <Eyebrow theme={theme}>Level {progress.level} · Creative explorer</Eyebrow>
          <Body theme={theme} small>{progress.levelPoints} / 250 points</Body>
        </View>
        <ProgressBar theme={theme} value={progress.levelPoints} max={250} color={theme.purple} label="Progress to next level" />
        <Body theme={theme} small>{250 - progress.levelPoints} points to your next level. You’ve got this!</Body>
      </View>
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ gap: 4 }}><Eyebrow theme={theme}>Your collection</Eyebrow><Heading theme={theme}>Badges</Heading></View>
      <Body theme={theme} small>{earned} / 6 earned</Body>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {progress.badges.map(badge => {
        const isEarned = badge.count >= badge.goal;
        const background = badge.color === 'pink' ? theme.pink : theme[badge.color];
        return <View key={badge.id} accessible
          accessibilityLabel={`${badge.label}. ${isEarned ? 'Earned' : `${badge.count} of ${badge.goal}, locked`}`}
          style={{ width: `${100 / columns - (columns === 2 ? 2.6 : 1.15)}%`, flexGrow: 1,
            borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: theme.border,
            backgroundColor: theme.surface, minWidth: columns === 2 ? 130 : 180 }}>
          <View style={{ height: compact ? 110 : 145, backgroundColor: background,
            alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ borderRadius: 20, borderWidth: 2, borderColor: theme.navy, padding: 16,
              transform: [{ rotate: '-7deg' }], backgroundColor: '#FFFFFF45' }}>
              <Icon name={badge.icon} size={38} color="#203858" />
            </View>
            <View style={{ position: 'absolute', right: 12, top: 12, borderRadius: 16,
              padding: 6, backgroundColor: isEarned ? theme.accentText : theme.surface }}>
              <Icon name={isEarned ? 'check' : 'lock'} size={18} color={isEarned ? '#FFFFFF' : '#5F7085'} />
            </View>
          </View>
          <View style={{ padding: compact ? 14 : 20, gap: 10 }}>
            <Heading theme={theme} size={compact ? 22 : 27}>{badge.label}</Heading>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body theme={theme} small color={isEarned ? (theme.accentText) : theme.secondary}>
                {isEarned ? '✓ Earned' : badge.count > 0 ? 'Keep going!' : 'Locked'}
              </Body>
              {!isEarned && <Body theme={theme} small>{Math.min(badge.count, badge.goal)} / {badge.goal}</Body>}
            </View>
            {!isEarned && badge.count > 0 && <ProgressBar theme={theme} value={badge.count} max={badge.goal}
              color={theme.teal} label={`${badge.label} progress`} />}
          </View>
        </View>;
      })}
    </View>
    <Body theme={theme} small>Drawing, shapes, and timed practice all grow your collection. Every little move counts.</Body>
  </View>;
}
