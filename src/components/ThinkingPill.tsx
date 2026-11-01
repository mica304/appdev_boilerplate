import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { useTheme } from '@/theme';

export function ThinkingPill() {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const [sweep] = useState(() => new Animated.Value(-44));

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: width + 44,
          duration: 1350,
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: -44,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, sweep, width]);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Thinking"
      style={[styles.pill, { backgroundColor: theme.buttonSecondary }]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {!reduceMotion && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            { transform: [{ translateX: sweep }, { rotate: '18deg' }] },
          ]}
        />
      )}
      <Ionicons name="sparkles" size={14} color={theme.tint} />
      <Text style={[styles.label, { color: theme.text }]}>Thinking</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 34,
    overflow: 'hidden',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  highlight: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 25,
    backgroundColor: 'rgba(128, 201, 138, 0.30)',
  },
  label: { fontSize: 12, fontWeight: '600' },
});
