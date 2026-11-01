import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDb } from '@/db/client';
import { refreshModelStatus } from '@/ai/local';
import { DownloadStatusIndicator } from '@/components/DownloadStatusIndicator';
import { PopupProvider } from '@/components/Popup';
import { AccessibilityPreferences, useReduceMotion } from '@/components/AccessibilityPreferences';
import { SettingsProvider, useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

export default function RootLayout() {
  const theme = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Open + migrate the database and read the local model's on-disk
    // state before rendering any screen.
    Promise.all([getDb(), refreshModelStatus()])
      .catch((e) => console.warn('Init failed:', e))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <SettingsProvider>
      <AccessibilityPreferences><PopupProvider><RootNavigator /></PopupProvider></AccessibilityPreferences>
    </SettingsProvider>
  );
}

/** Shows onboarding until it's completed, then the main app. */
function RootNavigator() {
  const theme = useTheme();
  const { settings, ready } = useSettings();
  const reduceMotion = useReduceMotion();
  const [showWelcomeIntro, setShowWelcomeIntro] = useState(false);
  const [welcomeOpacity] = useState(() => new Animated.Value(0));
  const [welcomeDotAnimations] = useState(() =>
    Array.from({ length: 3 }, () => new Animated.Value(0))
  );
  const previousOnboarded = useRef<boolean | null>(null);

  // Keep the OS background colour (keyboard area, splash fade) in sync.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(theme.background);
  }, [theme.background]);

  useEffect(() => {
    if (!showWelcomeIntro || reduceMotion) {
      welcomeDotAnimations.forEach((value) => value.setValue(0));
      return;
    }

    const loops = welcomeDotAnimations.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 130),
          Animated.timing(value, {
            toValue: 1,
            duration: 230,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 310,
            useNativeDriver: true,
          }),
          Animated.delay(180),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduceMotion, showWelcomeIntro, welcomeDotAnimations]);

  useLayoutEffect(() => {
    if (!ready) return;

    const justCompletedOnboarding =
      previousOnboarded.current === false && settings.onboarded;
    previousOnboarded.current = settings.onboarded;
    if (!justCompletedOnboarding) return;

    setShowWelcomeIntro(true);
    welcomeOpacity.setValue(0);
    Animated.timing(welcomeOpacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : 450,
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(() => {
      Animated.timing(welcomeOpacity, {
        toValue: 0,
        duration: reduceMotion ? 0 : 500,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowWelcomeIntro(false);
      });
    }, reduceMotion ? 1200 : 2300);

    return () => clearTimeout(timeout);
  }, [ready, reduceMotion, settings.onboarded, welcomeOpacity]);

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={settings.theme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.card },
          headerTintColor: theme.text,
          contentStyle: { backgroundColor: theme.background },
          animation: reduceMotion ? 'none' : 'slide_from_right',
        }}
      >
        <Stack.Protected guard={!settings.onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={settings.onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="chat-settings" options={{ title: 'Chat settings' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
          <Stack.Screen name="terms" options={{ title: 'Terms & Conditions' }} />
        </Stack.Protected>
      </Stack>
      <DownloadStatusIndicator />
      {showWelcomeIntro && (
        <Animated.View
          accessibilityRole="progressbar"
          accessibilityLabel="Loading Planova"
          style={[styles.welcomeIntroOverlay, { opacity: welcomeOpacity }]}
        >
          <View style={styles.welcomeIntroContent}>
            <Ionicons name="sparkles-outline" size={66} color="#80C98A" />
            <Text style={styles.welcomeIntroTitle}>Planova</Text>
            <Text style={styles.welcomeIntroSubtitle}>Shine through your schedule.</Text>
            <View
              style={styles.welcomeIntroDots}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {welcomeDotAnimations.map((value, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.welcomeIntroDot,
                    index === 1 && styles.welcomeIntroActiveDot,
                    {
                      opacity: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.58, 1],
                      }),
                      transform: [
                        {
                          translateY: value.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -8],
                          }),
                        },
                        {
                          scale: value.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.16],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  welcomeIntroOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 26, 18, 0.92)',
  },
  welcomeIntroContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  welcomeIntroTitle: {
    color: '#EDF5EC',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 24,
  },
  welcomeIntroSubtitle: {
    color: '#A4BAA8',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  welcomeIntroDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 32,
  },
  welcomeIntroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#78917E',
    opacity: 0.72,
  },
  welcomeIntroActiveDot: {
    width: 8,
    height: 8,
    backgroundColor: '#80C98A',
    opacity: 1,
  },
});
