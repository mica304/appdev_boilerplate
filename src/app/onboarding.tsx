import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Button } from '@/components/Button';
import { SmoothPressable } from '@/components/SmoothPressable';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { useSettings } from '@/settings/SettingsContext';
import { useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Intro slides. Edit, add or remove entries to change the onboarding. */
const SLIDES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'sparkles-outline',
    title: 'Welcome to Planova',
    body: 'Your daily planner app',
  },
  {
    icon: 'cloud-offline-outline',
    title: 'Works 100% Offline',
    body: 'No internet connection needed. Your plans, habits, and notes are saved directly to your device — accessible anytime, anywhere.',
  },
  {
    icon: 'heart-outline',
    title: 'Track your wellness',
    body: 'Maintain your daily habits checklist and organize your plans — all in one place.',
  },
];

const FLOATING_ICONS: { name: IconName; style: ViewStyle }[] = [
  { name: 'checkmark-circle-outline', style: { top: '11%', left: '12%' } },
  { name: 'heart-outline', style: { top: '34%', right: '12%' } },
  { name: 'calendar-outline', style: { top: '44%', left: '8%' } },
  { name: 'sparkles-outline', style: { top: '60%', right: '20%' } },
  { name: 'gift-outline', style: { top: '68%', left: '17%' } },
  { name: 'time-outline', style: { top: '79%', right: '27%' } },
];

function FloatingIcon({
  name,
  style,
  index,
  size = 20,
}: {
  name: IconName;
  style: ViewStyle;
  index: number;
  size?: number;
}) {
  const reduceMotion = useReduceMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const [glow] = useState(() => new Animated.Value(0.78));

  useEffect(() => {
    if (reduceMotion) {
      offset.setValue(0);
      glow.setValue(0.78);
      return;
    }

    const float = Animated.loop(Animated.sequence([
      Animated.delay(index * 170),
      Animated.parallel([
        Animated.sequence([
          Animated.timing(offset, {
            toValue: -8,
            duration: 1500 + (index % 3) * 180,
            useNativeDriver: true,
          }),
          Animated.timing(offset, {
            toValue: 0,
            duration: 1700 + (index % 2) * 220,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.72,
            duration: 1700,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]));
    float.start();
    return () => float.stop();
  }, [glow, index, offset, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.floatingIconContainer,
        style,
        { opacity: glow, transform: [{ translateY: offset }] },
      ]}
    >
      <Ionicons name={name} size={size} color="#80C98A" style={styles.floatingIconGlyph} />
    </Animated.View>
  );
}

const STARS: ViewStyle[] = [
  { top: '8%', left: '35%' }, { top: '18%', right: '22%' },
  { top: '26%', left: '72%' }, { top: '40%', left: '7%' },
  { top: '48%', right: '8%' }, { top: '55%', left: '22%' },
  { top: '72%', right: '10%' }, { top: '84%', left: '10%' },
  { top: '15%', left: '88%' }, { top: '31%', left: '55%' },
];

function AmbientGlow() {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs>
        <RadialGradient id="onboardingAmbientGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#80C98A" stopOpacity={0.18} />
          <Stop offset="38%" stopColor="#347A4B" stopOpacity={0.08} />
          <Stop offset="100%" stopColor="#347A4B" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="67" cy="650" rx="155" ry="175" fill="url(#onboardingAmbientGlow)" />
      <Ellipse cx="345" cy="715" rx="112" ry="125" fill="url(#onboardingAmbientGlow)" />
      <Ellipse cx="195" cy="105" rx="220" ry="180" fill="url(#onboardingAmbientGlow)" />
    </Svg>
  );
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { settings, update } = useSettings();
  const reduceMotion = useReduceMotion();
  const [step, setStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionOpacity] = useState(() => new Animated.Value(1));
  const [transitionY] = useState(() => new Animated.Value(0));
  const transitionAnimation = React.useRef<Animated.CompositeAnimation | null>(null);
  const swipeAction = React.useRef<(direction: -1 | 1) => void>(() => {});
  const [nickname, setNickname] = useState(settings.nickname);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);

  const isNicknameStep = step === SLIDES.length;
  const trimmed = nickname.trim();

  useEffect(() => () => transitionAnimation.current?.stop(), []);

  const navigateToStep = useCallback((nextStep: number) => {
    if (isTransitioning) return;
    if (reduceMotion) {
      setStep(nextStep);
      return;
    }

    setIsTransitioning(true);
    const direction = nextStep > step ? 1 : -1;
    transitionAnimation.current = Animated.parallel([
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(transitionY, {
        toValue: direction * -32,
        duration: 240,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    transitionAnimation.current.start(({ finished }) => {
      if (!finished) {
        setIsTransitioning(false);
        return;
      }

      setStep(nextStep);
      transitionY.setValue(direction * 32);
      requestAnimationFrame(() => {
        transitionAnimation.current = Animated.parallel([
          Animated.timing(transitionOpacity, {
            toValue: 1,
            duration: 460,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(transitionY, {
            toValue: 0,
            duration: 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]);
        transitionAnimation.current.start(() => setIsTransitioning(false));
      });
    });
  }, [isTransitioning, reduceMotion, step, transitionOpacity, transitionY]);

  const transitionStyle = {
    opacity: transitionOpacity,
    transform: [{ translateY: transitionY }],
  };

  useEffect(() => {
    swipeAction.current = (direction) => {
      const nextStep = step + direction;
      if (nextStep >= 0 && nextStep <= SLIDES.length) navigateToStep(nextStep);
    };
  }, [navigateToStep, step]);

  const [swipeResponder, setSwipeResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  useEffect(() => {
    setSwipeResponder(PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dy) > 18 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy < -50) swipeAction.current(1);
        else if (gesture.dy > 50) swipeAction.current(-1);
      },
    }));
  }, []);

  const finish = () => {
    update('nickname', trimmed);
    // Flipping this flag makes the root layout switch to the main app.
    update('onboarded', true);
  };

  const isWellnessStep = step === 2;
  const isOfflineStep = step === 1;

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access to add a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) setPhotoUri(result.assets[0].uri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to open the photo library.';
      Alert.alert('Unable to add photo', message);
    }
  };

  if (step === 0 || isOfflineStep || isWellnessStep) {
    return (
      <View style={styles.screenTransition}>
        <SafeAreaView style={styles.welcomeContainer}>
          <StatusBar style="light" />
          <View style={styles.welcomePage} {...swipeResponder?.panHandlers}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <AmbientGlow />
            {FLOATING_ICONS.map((item, index) => (
              <FloatingIcon
                key={item.name}
                name={item.name}
                style={item.style}
                index={index}
              />
            ))}
            {STARS.map((position, index) => (
              <View key={index} style={[styles.star, position]} />
            ))}
          </View>

          <Animated.View style={[styles.foregroundTransition, transitionStyle]}>
            <View style={[
              styles.welcomeArt,
              (isWellnessStep || isOfflineStep) && styles.wellnessArt,
            ]}>
              {isWellnessStep || isOfflineStep ? (
                <>
                  <View style={[styles.artHalo, styles.wellnessHalo]} />
                  <View style={styles.wellnessCircle}>
                    {isWellnessStep ? (
                      <Ionicons name="heart-outline" size={48} color="#80C98A" />
                    ) : (
                      <>
                        <Ionicons name="wifi-outline" size={47} color="#80C98A" />
                        <View style={styles.wifiSlash} />
                      </>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.artHalo} />
                  <View style={styles.artRing} />
                  <View style={styles.calendarTile}>
                    <Ionicons name="calendar" size={31} color="#80C98A" />
                    <View style={styles.calendarSparkle}>
                      <Ionicons name="sparkles" size={13} color="#80C98A" />
                    </View>
                  </View>
                </>
              )}
            </View>

            <View style={[
              styles.welcomeCopy,
              (isWellnessStep || isOfflineStep) && styles.wellnessCopy,
            ]}>
              <Text style={[
                styles.welcomeTitle,
                (isWellnessStep || isOfflineStep) && styles.wellnessTitle,
              ]}>
                {SLIDES[step].title}
              </Text>
              <Text style={[
                styles.welcomeSubtitle,
                (isWellnessStep || isOfflineStep) && styles.wellnessSubtitle,
              ]}>
                {SLIDES[step].body}
              </Text>
            </View>
          </Animated.View>

          <View
            style={styles.welcomeDots}
            accessibilityLabel={`Page ${step + 1} of 3`}
          >
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.welcomeDot, index === step && styles.activeWelcomeDot]}
              />
            ))}
          </View>

          <View style={styles.welcomeFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={step > 0 ? 'Back' : 'Skip onboarding'}
              onPress={() => navigateToStep(step > 0 ? step - 1 : SLIDES.length)}
              disabled={isTransitioning}
              hitSlop={12}
            >
              <Text style={styles.skipLabel}>{step > 0 ? 'Back' : 'Skip'}</Text>
            </Pressable>
            <SmoothPressable
              accessibilityLabel="Next"
              onPress={() => navigateToStep(step + 1)}
              disabled={isTransitioning}
              style={({ pressed }) => [
                styles.nextButton,
                pressed && styles.nextButtonPressed,
              ]}
            >
              <Text style={styles.nextLabel}>Next</Text>
            </SmoothPressable>
          </View>
            </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isNicknameStep) {
    return (
      <View style={styles.screenTransition}>
        <SafeAreaView style={styles.profileContainer}>
            <StatusBar style="light" />
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <AmbientGlow />
              <FloatingIcon name="sparkles-outline" style={styles.profileSparkle} index={7} />
              <FloatingIcon name="heart-outline" size={17} style={styles.profileHeart} index={8} />
            </View>
            <KeyboardAvoidingView style={styles.flex} behavior="padding">
            <ScrollView
              style={styles.profileScrollView}
              contentContainerStyle={styles.profileScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={[styles.profileForeground, transitionStyle]}>

            <View style={styles.profileHeader}>
              <View style={styles.profileBadge}>
                <Ionicons name="person-outline" size={21} color="#80C98A" />
              </View>
              <Text style={styles.profileTitle}>Set up your profile</Text>
              <Text style={styles.profileSubtitle}>Personalize your Planova experience</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoUri ? 'Change profile photo' : 'Add profile photo'}
              onPress={() => void choosePhoto()}
              style={styles.photoPicker}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.profilePhoto} />
              ) : (
                <>
                  <Ionicons name="person-outline" size={31} color="#80C98A" />
                  <Text style={styles.addPhotoLabel}>ADD PHOTO</Text>
                </>
              )}
            </Pressable>

            <View style={styles.profileForm}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>YOUR NAME *</Text>
                <TextInput
                  accessibilityLabel="Your name"
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="e.g. Mica"
                  placeholderTextColor="#A4BAA8"
                  maxLength={30}
                  returnKeyType="next"
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  selectionColor="#80C98A"
                  style={[
                    styles.profileInput,
                    nameFocused && styles.profileInputFocused,
                    Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                  ]}
                />
              </View>
            </View>
            <SmoothPressable
              accessibilityLabel="Continue"
              disabled={!trimmed || isTransitioning}
              onPress={finish}
              style={({ pressed }) => [
                styles.continueButton,
                !trimmed && styles.continueButtonDisabled,
                pressed && trimmed && styles.nextButtonPressed,
              ]}
            >
              <Text style={styles.continueLabel}>Continue</Text>
            </SmoothPressable>
              </Animated.View>
            </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screenTransition}>
      <Animated.View style={[styles.animatedContent, transitionStyle]}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
          <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.content}>
          {isNicknameStep ? (
            <>
              <Ionicons name="person-circle-outline" size={88} color={theme.tint} />
              <Text style={[styles.title, { color: theme.text }]}>
                What should we call you?
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                Pick a nickname. You can change it later in Settings.
              </Text>
              <TextInput
                accessibilityLabel="Nickname"
                value={nickname}
                onChangeText={setNickname}
                placeholder="Your nickname"
                placeholderTextColor={theme.textSecondary}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={() => trimmed && finish()}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.inputBackground,
                    borderColor: theme.border,
                  },
                ]}
              />
            </>
          ) : (
            <>
              <Ionicons name={SLIDES[step].icon} size={88} color={theme.tint} />
              <Text style={[styles.title, { color: theme.text }]}>
                {SLIDES[step].title}
              </Text>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                {SLIDES[step].body}
              </Text>
            </>
          )}
        </View>

        <View style={styles.dots}>
          {[...SLIDES, null].map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === step ? theme.tint : theme.border },
              ]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <Button label={step > 0 ? 'Back' : 'Skip'} variant="secondary" disabled={isTransitioning} onPress={() => navigateToStep(step > 0 ? step - 1 : SLIDES.length)} />
          <Button label="Next" disabled={isTransitioning || (isNicknameStep && !trimmed)} onPress={() => isNicknameStep ? finish() : navigateToStep(step + 1)} />
        </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenTransition: { flex: 1, backgroundColor: '#050806' },
  animatedContent: { flex: 1 },
  foregroundTransition: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  profileForeground: { flexGrow: 1, justifyContent: 'center' },
  profileContainer: { flex: 1, backgroundColor: '#050806' },
  profileScrollView: { flex: 1 },
  profileScroll: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  profileSparkle: {
    position: 'absolute',
    top: 24,
    left: 10,
  },
  profileHeart: {
    position: 'absolute',
    top: 48,
    right: 12,
  },
  profileHeader: { alignItems: 'center' },
  profileBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(137, 183, 143, 0.22)',
    backgroundColor: 'rgba(17, 43, 30, 0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileTitle: {
    color: '#EDF5EC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  profileSubtitle: {
    color: '#A4BAA8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
    textAlign: 'center',
  },
  photoPicker: {
    alignSelf: 'center',
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 1,
    borderColor: '#4F9464',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  profilePhoto: { width: '100%', height: '100%', borderRadius: 47 },
  addPhotoLabel: {
    color: '#80C98A',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  profileForm: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(137, 183, 143, 0.22)',
    backgroundColor: 'rgba(17, 43, 30, 0.82)',
    padding: 16,
    gap: 0,
  },
  fieldGroup: { gap: 7 },
  fieldLabel: {
    color: '#D7E5D8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  profileInput: {
    minHeight: 40,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(137, 183, 143, 0.22)',
    backgroundColor: 'rgba(7, 26, 18, 0.72)',
    color: '#EDF5EC',
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '500',
  },
  profileInputFocused: {
    borderColor: '#80C98A',
    shadowColor: '#80C98A',
    shadowOpacity: 0.42,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  continueButton: {
    alignSelf: 'stretch',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#347A4B',
    paddingHorizontal: 20,
    marginTop: 28,
  },
  continueButtonDisabled: { opacity: 0.5 },
  continueLabel: { color: '#F2FFF2', fontSize: 13, fontWeight: '700' },
  welcomeContainer: { flex: 1, backgroundColor: '#050806' },
  welcomePage: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#050806',
  },
  floatingIconContainer: {
    position: 'absolute',
  },
  floatingIconGlyph: {
    textShadowColor: '#80C98A',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 9,
  },
  star: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#78917E',
    opacity: 0.38,
  },
  welcomeArt: {
    position: 'absolute',
    top: '34%',
    left: 0,
    right: 0,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wellnessArt: { top: '31%', height: 126 },
  artHalo: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#347A4B',
    opacity: 0.11,
  },
  wellnessHalo: {
    width: 142,
    height: 142,
    borderRadius: 71,
    opacity: 0.12,
  },
  wellnessCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: 'rgba(137, 183, 143, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#80C98A',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 3,
  },
  wifiSlash: {
    position: 'absolute',
    width: 58,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#80C98A',
    transform: [{ rotate: '43deg' }],
  },
  artRing: {
    position: 'absolute',
    left: '44%',
    width: 57,
    height: 57,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: '#4F9464',
    opacity: 0.85,
    shadowColor: '#80C98A',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 5,
  },
  calendarTile: {
    position: 'absolute',
    left: '53%',
    width: 39,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#4F9464',
    backgroundColor: 'rgba(35, 72, 48, 0.82)',
    shadowColor: '#80C98A',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarSparkle: { position: 'absolute', right: 2, bottom: 1 },
  welcomeDots: {
    position: 'absolute',
    bottom: '13%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  welcomeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#78917E',
  },
  activeWelcomeDot: { width: 14, backgroundColor: '#80C98A' },
  welcomeCopy: {
    position: 'absolute',
    top: '60%',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  wellnessCopy: { top: '54%' },
  welcomeTitle: {
    color: '#EDF5EC',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  wellnessTitle: { fontSize: 20 },
  welcomeSubtitle: {
    color: '#A4BAA8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  wellnessSubtitle: {
    maxWidth: 290,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 15,
  },
  welcomeFooter: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipLabel: {
    color: '#A4BAA8',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 12,
  },
  nextButton: {
    minWidth: 83,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#347A4B',
    paddingHorizontal: 24,
  },
  nextButtonPressed: { opacity: 0.85 },
  nextLabel: { color: '#F2FFF2', fontSize: 14, fontWeight: '700' },
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    marginTop: 8,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
