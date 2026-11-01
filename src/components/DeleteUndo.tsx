import { Ionicons } from '@expo/vector-icons';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/components/AccessibilityPreferences';
import { useTheme } from '@/theme';
import { showMessage } from '@/utils/confirm';

const COLLAPSE_DURATION_MS = 420;
const SNACKBAR_DURATION_MS = 5000;

type SnackbarRequest = {
  id: number;
  message: string;
  onUndo: () => void | Promise<void>;
};

type DeleteUndoContextValue = {
  showUndo: (message: string, onUndo: () => void | Promise<void>) => void;
};

const DeleteUndoContext = createContext<DeleteUndoContextValue | null>(null);

export function DeleteUndoProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<SnackbarRequest | null>(null);
  const nextId = useRef(0);
  const value = useMemo<DeleteUndoContextValue>(() => ({
    showUndo: (message, onUndo) => setRequest({ id: ++nextId.current, message, onUndo }),
  }), []);
  const dismiss = useCallback((id: number) => {
    setRequest((current) => current?.id === id ? null : current);
  }, []);

  return (
    <DeleteUndoContext.Provider value={value}>
      <View style={styles.flex}>
        {children}
        <UndoSnackbar request={request} onDismiss={dismiss} />
      </View>
    </DeleteUndoContext.Provider>
  );
}

export function useDeleteUndo() {
  const context = useContext(DeleteUndoContext);
  if (!context) throw new Error('useDeleteUndo must be used inside DeleteUndoProvider.');
  return context.showUndo;
}

export function CollapsibleDeleteRow({
  collapsing,
  onCollapsed,
  children,
}: {
  collapsing: boolean;
  onCollapsed: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const [height, setHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(1));
  const completed = useRef(false);
  const onCollapsedRef = useRef(onCollapsed);

  useEffect(() => {
    onCollapsedRef.current = onCollapsed;
  }, [onCollapsed]);

  useEffect(() => {
    if (!collapsing) {
      completed.current = false;
      progress.setValue(1);
      return;
    }
    if (height === 0 || completed.current) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: reduceMotion ? 0 : COLLAPSE_DURATION_MS,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !completed.current) {
        completed.current = true;
        onCollapsedRef.current();
      }
    });
  }, [collapsing, height, progress, reduceMotion]);

  const handleLayout = (event: LayoutChangeEvent) => {
    if (!collapsing) setHeight(event.nativeEvent.layout.height);
    else if (height === 0) setHeight(event.nativeEvent.layout.height);
  };

  return (
    <Animated.View
      pointerEvents={collapsing ? 'none' : 'auto'}
      onLayout={handleLayout}
      style={[
        styles.collapsible,
        {
          height: height > 0 ? progress.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) : undefined,
          opacity: progress,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function UndoSnackbar({
  request,
  onDismiss,
}: {
  request: SnackbarRequest | null;
  onDismiss: (id: number) => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [offset] = useState(() => new Animated.Value(80));
  const [drag] = useState(() => new Animated.ValueXY());
  const [dismissingId, setDismissingId] = useState<number | null>(null);
  const dismissing = request !== null && dismissingId === request.id;
  const undoStarted = useRef(false);

  useEffect(() => {
    undoStarted.current = false;
  }, [request?.id]);

  const dismiss = useCallback(() => {
    if (!request || dismissing) return;
    setDismissingId(request.id);
    if (reduceMotion) {
      onDismiss(request.id);
      return;
    }
    Animated.timing(offset, {
      toValue: 80,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onDismiss(request.id);
    });
  }, [dismissing, offset, onDismiss, reduceMotion, request]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderMove: Animated.event(
      [null, { dx: drag.x, dy: drag.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_event, gesture) => {
      if (Math.abs(gesture.dx) > 80 || gesture.dy > 45 || gesture.dy < -45) {
        dismiss();
        return;
      }
      Animated.spring(drag, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
    },
  }), [dismiss, drag]);

  useEffect(() => {
    if (!request) return;
    offset.stopAnimation();
    drag.setValue({ x: 0, y: 0 });
    offset.setValue(reduceMotion ? 0 : 80);
    if (!reduceMotion) {
      Animated.spring(offset, { toValue: 0, speed: 20, bounciness: 7, useNativeDriver: true }).start();
    }
    const timer = setTimeout(() => {
      if (reduceMotion) {
        onDismiss(request.id);
        return;
      }
      Animated.timing(offset, { toValue: 80, duration: 180, useNativeDriver: true })
        .start(({ finished }) => {
          if (finished) onDismiss(request.id);
        });
    }, SNACKBAR_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [drag, offset, onDismiss, reduceMotion, request]);

  const undo = async () => {
    if (!request || undoStarted.current) return;
    undoStarted.current = true;
    const current = request;
    dismiss();
    try {
      await current.onUndo();
    } catch (error) {
      showMessage('Unable to undo deletion', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  if (!request) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityLiveRegion="polite"
      style={[
        styles.snackbar,
        {
          bottom: insets.bottom + 82,
          backgroundColor: theme.card,
          opacity: offset.interpolate({ inputRange: [0, 80], outputRange: [1, 0] }),
          transform: [
            { translateY: offset },
            { translateX: drag.x },
            { translateY: drag.y },
          ],
        },
      ]}
    >
      <Ionicons name="trash-outline" size={17} color={theme.tint} />
      <Text numberOfLines={1} style={[styles.snackbarMessage, { color: theme.text }]}>{request.message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo deletion"
        hitSlop={10}
        onPress={() => void undo()}
        style={styles.undoButton}
      >
        <Text style={[styles.undoText, { color: theme.tint }]}>Undo</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={dismiss} hitSlop={10}>
        <Ionicons name="close" size={18} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  collapsible: { overflow: 'hidden' },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  snackbarMessage: { flex: 1, fontSize: 13, fontWeight: '500' },
  undoButton: { paddingVertical: 10, paddingHorizontal: 4 },
  undoText: { fontSize: 13, fontWeight: '700' },
});
