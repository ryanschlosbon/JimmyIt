import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { ACTIVITY_HEADER, FONTS, RADIUS, SIZE, SPACE, TYPE } from '../design/tokens';
import type { Theme } from '../theme';

/** One live-text title banner per activity, with the bubbles and Jimmy face from the reference. */
export function ActivityHeader({ theme, activity, title, eyebrow, description, slim = false }: {
  readonly theme: Theme; readonly activity: 'timed' | 'tapQuest'; readonly title: string;
  readonly eyebrow?: string; readonly description?: string;
  /** One short row (title and face only), for game screens that must leave room to play. */
  readonly slim?: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = width < SIZE.compactWidth || slim;
  const colors = theme.activityHeaders[activity];
  const faceSize = slim ? ACTIVITY_HEADER.slimFaceSize : compact ? ACTIVITY_HEADER.phoneFaceSize : ACTIVITY_HEADER.faceSize;
  const titleSize = slim ? TYPE.heading : compact ? TYPE.title : TYPE.hero;
  return <View style={{ backgroundColor: theme.activityHeaders.shadow, borderRadius: RADIUS.xl,
    paddingBottom: ACTIVITY_HEADER.shadowHeight }}>
    <View style={{ backgroundColor: colors.background, borderRadius: RADIUS.xl, overflow: 'hidden',
      minHeight: slim ? undefined : compact ? ACTIVITY_HEADER.phoneMinHeight : ACTIVITY_HEADER.minHeight,
      paddingHorizontal: compact ? SPACE.xl : SPACE.xxl, paddingVertical: slim ? SPACE.xs : compact ? SPACE.xl : SPACE.xxl,
      justifyContent: 'center' }}>
      <View pointerEvents="none" accessible={false} aria-hidden style={{ position: 'absolute', inset: 0 }}>
        <View style={{ position: 'absolute', top: -SPACE.xxxl, right: '20%',
          width: ACTIVITY_HEADER.smallBubbleSize, height: ACTIVITY_HEADER.smallBubbleSize,
          borderRadius: RADIUS.pill, backgroundColor: theme.activityHeaders.bubble, opacity: 0.3 }} />
        <View style={{ position: 'absolute', bottom: -SPACE.xxxl, left: '44%',
          width: ACTIVITY_HEADER.bubbleSize, height: ACTIVITY_HEADER.bubbleSize,
          borderRadius: RADIUS.pill, backgroundColor: theme.activityHeaders.bubble, opacity: 0.3 }} />
        <View style={{ position: 'absolute', bottom: -SPACE.xxxl, right: -SPACE.xxxl,
          width: ACTIVITY_HEADER.bubbleSize, height: ACTIVITY_HEADER.bubbleSize,
          borderRadius: RADIUS.pill, backgroundColor: theme.activityHeaders.bubble, opacity: 0.3 }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg }}>
        <View style={{ flex: 1, minWidth: 0, gap: SPACE.sm }}>
          {eyebrow && !slim && <Text style={{ fontFamily: FONTS.bodyBold, fontSize: TYPE.caption,
            letterSpacing: 2, color: colors.text }}>{eyebrow.toUpperCase()}</Text>}
          <Text accessibilityRole="header" aria-level={1} style={{ fontFamily: FONTS.display,
            fontSize: titleSize, lineHeight: titleSize * 1.12,
            color: colors.text }}>{title}</Text>
          {description && !slim && <Text style={{ fontFamily: FONTS.body, fontSize: TYPE.small,
            lineHeight: TYPE.small * 1.6, color: colors.text }}>{description}</Text>}
        </View>
        <View pointerEvents="none" accessible={false} aria-hidden>
          <Svg width={faceSize} height={faceSize} viewBox="0 0 100 100">
            <Circle cx="27" cy="35" r="16" fill="none" stroke={theme.activityHeaders.face} strokeWidth="2" />
            <Circle cx="73" cy="35" r="16" fill="none" stroke={theme.activityHeaders.face} strokeWidth="2" />
            <Ellipse cx="31" cy="35" rx="14" ry="16" fill={theme.activityHeaders.face} />
            <Ellipse cx="77" cy="35" rx="14" ry="16" fill={theme.activityHeaders.face} />
            <Path d="M33 65Q52 85 68 62" fill="none" stroke={theme.activityHeaders.face}
              strokeWidth="3" strokeLinecap="round" />
          </Svg>
        </View>
      </View>
    </View>
  </View>;
}
