import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_ARTWORK, INTRO_BACKGROUNDS } from '../artwork';

export function IntroScreen({ ready, onDone }: { readonly ready: boolean; readonly onDone: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState({ start: false, end: false });

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); })
      .catch(() => { if (active) setReduceMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!ready || reduceMotion === null || !loaded.start || !loaded.end) return;
    fade.setValue(reduceMotion ? 1 : 0);
    const animation = reduceMotion ? Animated.delay(600) : Animated.sequence([
      Animated.delay(350),
      Animated.timing(fade, { toValue: 1, duration: 1100, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(650),
    ]);
    animation.start(({ finished }) => { if (finished) onDone(); });
    return () => animation.stop();
  }, [fade, loaded.end, loaded.start, onDone, ready, reduceMotion]);

  return <View style={{ flex: 1, backgroundColor: INTRO_BACKGROUNDS.start }}>
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      <Image source={APP_ARTWORK.introStart} resizeMode="contain" accessibilityLabel="JimmyIt smiling character"
        onLoad={() => setLoaded(current => ({ ...current, start: true }))}
        onError={() => setLoaded(current => ({ ...current, start: true }))}
        style={{ width: '100%', height: '100%', maxWidth: 1280 }} />
    </View>
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: INTRO_BACKGROUNDS.end,
        justifyContent: 'center', alignItems: 'center' }]}>
      <Animated.Image source={APP_ARTWORK.introEnd} resizeMode="contain"
        onLoad={() => setLoaded(current => ({ ...current, end: true }))}
        onError={() => setLoaded(current => ({ ...current, end: true }))}
        style={{ width: '100%', height: '100%', maxWidth: 1280,
          transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [.97, 1] }) }] }} />
    </Animated.View>
    <SafeAreaView style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 28, gap: 18 }}>
      <Text style={{ fontSize: 24, fontWeight: '600', color: '#203858', textAlign: 'center' }}>Little moves. Big smiles.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={onDone}
        style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 25, paddingVertical: 15,
          borderRadius: 18, backgroundColor: '#FFFCF7', opacity: pressed ? .75 : 1 })}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#203858' }}>{ready ? 'Let’s play' : 'Skip intro'}</Text>
      </Pressable>
    </SafeAreaView>
  </View>;
}
