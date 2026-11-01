import { Ionicons } from '@expo/vector-icons';
import type { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { useTheme } from '@/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type QuickAddKind = 'priority' | 'schedule' | 'habit' | 'history';

const QUICK_ADD_OPTIONS: { kind: QuickAddKind; label: string; description: string; icon: IconName }[] = [
  { kind: 'priority', label: 'Priority', description: 'Top task with reward', icon: 'gift-outline' },
  { kind: 'schedule', label: 'Schedule', description: 'Timed event for today', icon: 'time-outline' },
  { kind: 'habit', label: 'Habit', description: 'Daily wellness routine', icon: 'heart-outline' },
  { kind: 'history', label: 'Search History', description: 'Find past plans and tasks', icon: 'search-outline' },
];

export const TAB_BAR_HEIGHT = 56;
export const TAB_BAR_GAP = 12;
const CENTER_SPACE_WIDTH = 54;

type TabItem = {
  route: string;
  prompt?: string;
  label: string;
  icon?: IconName;
  graphic?: 'nova';
};

const LEFT_TABS: TabItem[] = [
  { route: 'index', label: 'Home', icon: 'home-outline' },
  { route: 'plan', label: 'MyPlan', icon: 'calendar-outline' },
  { route: 'habits', label: 'Habits', icon: 'heart-outline' },
];

const RIGHT_TABS: TabItem[] = [
  { route: 'chat', label: 'Nova AI', graphic: 'nova' },
  { route: 'history', label: 'History', icon: 'bar-chart-outline' },
  { route: 'profile', label: 'Profile', icon: 'person-outline' },
];

const TAB_SLOTS = [0, 3, 1, 2, 4, 5];

function slotForRouteIndex(routeIndex: number) {
  return TAB_SLOTS[routeIndex] ?? 0;
}

/** Floating navigation bar with a centered action button. */
export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const [activeSlot] = useState(() => new Animated.Value(slotForRouteIndex(state.index)));
  const [iconBump] = useState(() => new Animated.Value(0));
  const [quickAddProgress] = useState(() => new Animated.Value(0));
  const previousIndex = useRef(state.index);
  const slotWidth = Math.max(0, (barWidth - 8 - CENTER_SPACE_WIDTH) / 6);
  const indicatorPositions = Array.from({ length: 6 }, (_, index) =>
    index * slotWidth + (index >= 3 ? CENTER_SPACE_WIDTH : 0)
  );
  const indicatorTranslateX = activeSlot.interpolate({
    inputRange: [0, 1, 2, 3, 4, 5],
    outputRange: indicatorPositions,
  });
  const bumpScale = iconBump.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 1.22, 1],
  });
  const bumpY = iconBump.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, -5, 0],
  });
  const plusRotation = quickAddProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });
  const arcOffset = Math.max(0, Math.min(132, (windowWidth - 96) / 2));
  const arcPositions = [
    { x: -arcOffset, rise: 116 },
    { x: -arcOffset * 0.4, rise: 154 },
    { x: arcOffset * 0.4, rise: 154 },
    { x: arcOffset, rise: 116 },
  ];

  const toggleQuickAdd = useCallback(() => {
    const opening = !quickAddVisible;
    setQuickAddVisible(opening);
    if (reduceMotion) {
      quickAddProgress.setValue(opening ? 1 : 0);
      return;
    }
    Animated.spring(quickAddProgress, {
      toValue: opening ? 1 : 0,
      speed: 20,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [quickAddProgress, quickAddVisible, reduceMotion]);

  const animateIconBump = useCallback(() => {
    if (reduceMotion) return;
    iconBump.stopAnimation();
    iconBump.setValue(0);
    Animated.sequence([
      Animated.timing(iconBump, {
        toValue: 0.45,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.spring(iconBump, {
        toValue: 0,
        speed: 24,
        bounciness: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, [iconBump, reduceMotion]);

  useEffect(() => {
    if (previousIndex.current === state.index) return;
    previousIndex.current = state.index;
    if (reduceMotion) {
      activeSlot.setValue(slotForRouteIndex(state.index));
      return;
    }
    Animated.spring(activeSlot, {
      toValue: slotForRouteIndex(state.index),
      speed: 18,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
    animateIconBump();
  }, [activeSlot, animateIconBump, reduceMotion, state.index]);

  const renderTab = (tab: TabItem, key: string) => {
    const route = state.routes.find((item) => item.name === tab.route);
    const focused = route ? state.routes[state.index]?.key === route.key : false;
    const iconColor = focused ? theme.tint : theme.textSecondary;
    const icon = tab.graphic
      ? <NavigationGraphic name={tab.graphic} color={iconColor} />
      : <Ionicons name={tab.icon ?? 'ellipse-outline'} size={19} color={iconColor} />;
    const content = (
      <>
        <Animated.View
          style={{
            alignItems: 'center',
            gap: 2,
            transform: [
              { translateY: focused ? bumpY : 0 },
              { scale: focused ? bumpScale : 1 },
            ],
          }}
          >
            {icon}
        </Animated.View>
        <Text style={[styles.label, { color: iconColor }]}>{tab.label}</Text>
      </>
    );

    if (!route) return null;

    return (
      <SmoothPressable
        key={key}
        onPressIn={() => {
          if (focused) animateIconBump();
        }}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            const params = tab.prompt ? { prompt: tab.prompt } : route.params;
            navigation.navigate(route.name, params);
          }
        }}
        accessibilityLabel={tab.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        style={styles.item}
      >
        {content}
      </SmoothPressable>
    );
  };

  const chooseQuickAdd = (kind: QuickAddKind) => {
    const targetName = kind === 'habit' ? 'habits' : kind === 'history' ? 'history' : 'plan';
    const target = state.routes.find((route) => route.name === targetName);
    if (!target) return;
    const navigate = () => {
      if (kind === 'history') {
        navigation.navigate(target.name);
      } else {
        const params = kind === 'habit' ? { quickAdd: 'habit' } : { quickAdd: kind };
        navigation.navigate(target.name, params);
      }
    };
    setQuickAddVisible(false);
    if (reduceMotion) {
      quickAddProgress.setValue(0);
      navigate();
      return;
    }
    Animated.spring(quickAddProgress, {
      toValue: 0,
      speed: 20,
      bounciness: 7,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) navigate();
    });
  };

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_GAP }]}
      >
        {QUICK_ADD_OPTIONS.map((option, index) => {
          const arcPosition = arcPositions[index];
          const translateX = quickAddProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, arcPosition.x],
          });
          const translateY = quickAddProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -arcPosition.rise],
          });
          const scale = quickAddProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.55, 1],
          });
          return (
            <Animated.View
              key={option.kind}
              pointerEvents={quickAddVisible ? 'auto' : 'none'}
              accessibilityElementsHidden={!quickAddVisible}
              importantForAccessibility={quickAddVisible ? 'auto' : 'no-hide-descendants'}
              style={[
                styles.arcActionWrap,
                {
                  opacity: quickAddProgress,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
            >
              <SmoothPressable
                accessibilityRole="button"
                accessibilityLabel={`${option.label}. ${option.description}`}
                disabled={!quickAddVisible}
                onPress={() => chooseQuickAdd(option.kind)}
                style={[styles.arcAction, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Ionicons name={option.icon} size={19} color={theme.tint} />
                <Text numberOfLines={1} style={[styles.arcActionLabel, { color: theme.text }]}>
                  {option.label}
                </Text>
              </SmoothPressable>
            </Animated.View>
          );
        })}
        <View
          onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
          style={[styles.pill, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          {barWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeIndicator,
                {
                  left: 4,
                  width: slotWidth,
                  backgroundColor: theme.buttonSecondary,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />
          )}
          {LEFT_TABS.map((tab, index) => renderTab(tab, `left-${index}`))}
          <View accessible={false} style={styles.centerSpace} />
          {RIGHT_TABS.map((tab, index) => renderTab(tab, `right-${index}`))}
        </View>
        <SmoothPressable
          onPress={toggleQuickAdd}
          accessibilityRole="button"
          accessibilityLabel={quickAddVisible ? 'Close Quick Add' : 'Quick Add'}
          accessibilityState={{ expanded: quickAddVisible }}
          style={[styles.circle, { backgroundColor: theme.buttonPrimary, borderColor: theme.border }]}
        >
          <Animated.View style={{ transform: [{ rotate: plusRotation }] }}>
            <Ionicons name="add" size={32} color={theme.userBubbleText} />
          </Animated.View>
        </SmoothPressable>
      </View>
    </>
  );
}

function NavigationGraphic({ name, color }: { name: 'nova'; color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d="M12 3V5M9 3h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Rect x={5} y={6} width={14} height={12} rx={3} stroke={color} strokeWidth={1.7} />
      <Circle cx={9.5} cy={11} r={1} fill={color} />
      <Circle cx={14.5} cy={11} r={1} fill={color} />
      <Path d="M9 15h6M3 10v4M21 10v4" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
  },
  pill: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(9, 29, 19, 0.88)',
    ...shadow('#000000'),
  },
  activeIndicator: {
    position: 'absolute',
    top: 6,
    height: TAB_BAR_HEIGHT - 12,
    borderRadius: (TAB_BAR_HEIGHT - 12) / 2,
  },
  circle: {
    position: 'absolute',
    left: '50%',
    bottom: 10,
    zIndex: 3,
    marginLeft: -29,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(177, 225, 175, 0.42)',
    backgroundColor: 'rgba(52, 122, 75, 0.94)',
    ...shadow('#000000'),
  },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  centerSpace: { width: CENTER_SPACE_WIDTH },
  label: { fontSize: 9, fontWeight: '500' },
  arcActionWrap: {
    position: 'absolute',
    left: '50%',
    bottom: 12,
    zIndex: 2,
    width: 88,
    marginLeft: -44,
  },
  arcAction: {
    minHeight: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(154, 207, 153, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(15, 39, 27, 0.94)',
    ...shadow('#000000'),
  },
  arcActionLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
});

function shadow(color: string) {
  return {
    shadowColor: color,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  };
}
