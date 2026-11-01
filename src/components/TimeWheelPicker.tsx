import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 5;
const VERTICAL_PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

type TimeValue = {
  hour: number;
  minute: number;
  period: 'AM' | 'PM';
};

type TimeWheelPickerProps = {
  value: TimeValue;
  onChange: (value: TimeValue) => void;
  colors: {
    text: string;
    secondary: string;
    raised: string;
    surface: string;
    border: string;
  };
};

function WheelColumn({
  label,
  values,
  selectedIndex,
  onSelect,
  colors,
}: {
  label: string;
  values: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  colors: TimeWheelPickerProps['colors'];
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [scrollY] = useState(() => new Animated.Value(selectedIndex * ROW_HEIGHT));

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: selectedIndex * ROW_HEIGHT, animated: false });
    scrollY.setValue(selectedIndex * ROW_HEIGHT);
  }, [scrollY, selectedIndex]);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(
      0,
      Math.min(values.length - 1, Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT))
    );
    onSelect(index);
  };

  return (
    <View style={styles.column}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <View style={[styles.viewport, { backgroundColor: colors.raised }]}>
        <View
          pointerEvents="none"
          style={[
            styles.selection,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />
        <Animated.ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          bounces={false}
          snapToInterval={ROW_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {values.map((item, index) => {
            const inputRange = [
              (index - 2) * ROW_HEIGHT,
              (index - 1) * ROW_HEIGHT,
              index * ROW_HEIGHT,
              (index + 1) * ROW_HEIGHT,
              (index + 2) * ROW_HEIGHT,
            ];
            const rotateX = scrollY.interpolate({
              inputRange,
              outputRange: ['-58deg', '-30deg', '0deg', '30deg', '58deg'],
              extrapolate: 'clamp',
            });
            const opacity = scrollY.interpolate({
              inputRange,
              outputRange: [0.18, 0.52, 1, 0.52, 0.18],
              extrapolate: 'clamp',
            });
            const scale = scrollY.interpolate({
              inputRange,
              outputRange: [0.78, 0.9, 1, 0.9, 0.78],
              extrapolate: 'clamp',
            });

            return (
              <View key={`${label}-${item}`} style={styles.item}>
                <Animated.Text
                  accessibilityLabel={`${label} ${item}`}
                  style={[
                    styles.itemText,
                    { color: colors.secondary },
                    index === selectedIndex && { color: colors.text },
                    {
                      opacity,
                      transform: [{ perspective: 320 }, { rotateX }, { scale }],
                    },
                  ]}
                >
                  {item}
                </Animated.Text>
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>
    </View>
  );
}

export function TimeWheelPicker({ value, onChange, colors }: TimeWheelPickerProps) {
  return (
    <View style={[styles.picker, { backgroundColor: colors.raised }]}>
      <View style={styles.columns}>
        <WheelColumn
          label="HOUR"
          values={Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))}
          selectedIndex={value.hour - 1}
          onSelect={(index) => onChange({ ...value, hour: index + 1 })}
          colors={colors}
        />
        <Text style={[styles.colon, { color: colors.text }]}>:</Text>
        <WheelColumn
          label="MINUTE"
          values={Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))}
          selectedIndex={value.minute}
          onSelect={(index) => onChange({ ...value, minute: index })}
          colors={colors}
        />
        <WheelColumn
          label="AM/PM"
          values={['AM', 'PM']}
          selectedIndex={value.period === 'AM' ? 0 : 1}
          onSelect={(index) => onChange({ ...value, period: index === 0 ? 'AM' : 'PM' })}
          colors={colors}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 16 },
  columns: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  column: { flex: 1, minWidth: 0, alignItems: 'center' },
  label: { fontSize: 8, fontWeight: '700', letterSpacing: 0.7, marginBottom: 5 },
  viewport: { width: '100%', height: ROW_HEIGHT * VISIBLE_ROWS, overflow: 'hidden', borderRadius: 12 },
  content: { paddingVertical: VERTICAL_PADDING },
  item: { height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  selection: {
    position: 'absolute',
    top: VERTICAL_PADDING,
    left: 3,
    right: 3,
    height: ROW_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
  },
  colon: { fontSize: 15, fontWeight: '700', marginBottom: 9, marginHorizontal: -2 },
});
