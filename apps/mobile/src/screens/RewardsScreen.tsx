import { Image, Text, View, useWindowDimensions } from 'react-native';
import { APP_ARTWORK } from '../artwork';
import { BADGE_VISUALS } from '../badge-visuals';
import { FONTS, RADIUS, REWARDS, SIZE, SPACE, TYPE } from '../design/tokens';
import { Body, Eyebrow, Heading, ProgressBar } from '../components/Controls';
import { Icon } from '../components/Icon';
import { Jimmy } from '../components/Jimmy';
import type { Theme } from '../theme';
import type { JimmyState } from '../use-jimmy';

export function RewardsScreen({ theme, progress }: {
  readonly theme: Theme; readonly progress: JimmyState['progress'];
}) {
  const { width } = useWindowDimensions();
  const compact = width < SIZE.compactWidth;
  const columns = width < 500 ? 2 : 3;
  const earned = progress.badges.filter(badge => badge.count >= badge.goal).length;
  return <View style={{ gap: 28 }}>
    {compact ? <View style={{ backgroundColor: theme.rewardsBanner.background, borderRadius: RADIUS.xl,
      minHeight: REWARDS.phoneBannerHeight, padding: SPACE.xl, gap: SPACE.md, overflow: 'hidden' }}>
      <View pointerEvents="none" accessible={false} aria-hidden style={{ position: 'absolute',
        width: REWARDS.phoneBannerHeight, height: REWARDS.phoneBannerHeight, borderRadius: RADIUS.pill,
        top: -REWARDS.phoneBannerHeight / 2, right: -SPACE.xxxl,
        backgroundColor: theme.rewardsBanner.bubble, opacity: 0.3 }} />
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: TYPE.caption, letterSpacing: 2,
        color: theme.rewardsBanner.eyebrow }}>ADVENTURER’S REWARDS</Text>
      <Heading theme={{ ...theme, text: theme.rewardsBanner.text }} level={1} size={TYPE.title}>
        Look what you’ve achieved!</Heading>
      <View pointerEvents="none" accessible={false} aria-hidden
        style={{ position: 'absolute', bottom: SPACE.lg, right: SPACE.lg }}>
        <Jimmy face size={REWARDS.phoneFaceSize} color={theme.rewardsBanner.background} />
      </View>
    </View> : <View accessibilityRole="header" aria-level={1}
      accessibilityLabel="Adventurer’s rewards. Look what you’ve achieved!"
      style={{ width: '100%', aspectRatio: REWARDS.bannerAspectRatio }}>
      <Image source={APP_ARTWORK.rewardsBanner} resizeMode="contain" accessible={false}
        style={{ width: '100%', height: '100%' }} />
    </View>}
    <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 25, gap: 18,
      borderWidth: 1.5, borderColor: theme.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.purple,
        justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Baloo', color: theme.art.paper, fontSize: 32 }}>{progress.level}</Text>
      </View>
      <View style={{ flex: 1, minWidth: REWARDS.phoneBannerHeight / 2, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <Eyebrow theme={theme}>Level {progress.level} · Creative explorer</Eyebrow>
          <Body theme={theme} small>{progress.levelPoints} / 250 points</Body>
        </View>
        <ProgressBar theme={theme} value={progress.levelPoints} max={250} color={theme.purple} label="Progress to next level" />
        <Body theme={theme} small>{250 - progress.levelPoints} points to your next level. You’ve got this!</Body>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md,
        borderRadius: RADIUS.md, padding: SPACE.lg, backgroundColor: theme.score.pill }}>
        <Icon name="star" color={theme.score.pillText} size={TYPE.heading} />
        <View><Text style={{ fontFamily: FONTS.display, fontSize: TYPE.heading,
          color: theme.score.pillText }}>{progress.points.toLocaleString()}</Text>
          <Text style={{ color: theme.score.pillText, fontFamily: FONTS.body, fontSize: TYPE.small }}>
            total points</Text></View>
      </View>
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ gap: 4 }}><Eyebrow theme={theme}>Your collection</Eyebrow><Heading theme={theme}>Badges</Heading></View>
      <Body theme={theme} small>{earned} / {progress.badges.length} earned</Body>
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {progress.badges.map(badge => {
        const isEarned = badge.count >= badge.goal;
        const background = isEarned ? theme[badge.color] : theme.lockedBadge.background;
        const badgeInk = isEarned ? theme.navy : theme.lockedBadge.ink;
        const unlockHint = BADGE_VISUALS[badge.id].unlockHint(badge.goal);
        return <View key={badge.id} accessible
          accessibilityLabel={`${badge.label}. ${isEarned ? 'Earned' :
            `Locked. ${unlockHint} ${badge.count} of ${badge.goal}.`}`}
          style={{ width: `${100 / columns - (columns === 2 ? 2.6 : 1.15)}%`, flexGrow: 1,
            borderRadius: 22, overflow: 'hidden', borderWidth: 1.5, borderColor: theme.border,
            backgroundColor: theme.surface, minWidth: columns === 2 ? 130 : 180 }}>
          <View style={{ height: compact ? 110 : 145, backgroundColor: background,
            alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ borderRadius: RADIUS.md, borderWidth: 2, borderColor: badgeInk, padding: SPACE.lg,
              transform: [{ rotate: '-7deg' }],
              backgroundColor: isEarned ? theme.art.paper : theme.lockedBadge.paper }}>
              <Icon name={badge.icon} size={38} color={badgeInk} />
            </View>
            <View style={{ position: 'absolute', right: 12, top: 12, borderRadius: 16,
              padding: 6, backgroundColor: isEarned ? theme.accentText : theme.lockedBadge.paper }}>
              <Icon name={isEarned ? 'check' : 'lock'} size={18}
                color={isEarned ? (theme.dark ? theme.ink : theme.art.paper) : badgeInk} />
            </View>
          </View>
          <View style={{ padding: compact ? 14 : 20, gap: 10 }}>
            <Heading theme={theme} size={compact ? 22 : 27}>{badge.label}</Heading>
            {!isEarned && <Body theme={theme} small>{unlockHint}</Body>}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Body theme={theme} small color={isEarned ? (theme.accentText) : theme.secondary}>
                {isEarned ? '✓ Earned' : 'Locked'}
              </Body>
              {!isEarned && <Body theme={theme} small>{Math.min(badge.count, badge.goal)} / {badge.goal}</Body>}
            </View>
            {!isEarned && badge.count > 0 && <ProgressBar theme={theme} value={badge.count} max={badge.goal}
              color={theme.lockedBadge.ink} label={`${badge.label} progress`} />}
          </View>
        </View>;
      })}
    </View>
    <Body theme={theme} small>Drawing, shapes, and timed practice all grow your collection. Every little move counts.</Body>
  </View>;
}
