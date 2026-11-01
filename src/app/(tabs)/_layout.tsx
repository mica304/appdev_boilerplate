import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingTabBar, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/components/FloatingTabBar';
import { DeleteUndoProvider } from '@/components/DeleteUndo';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <DeleteUndoProvider>
      <Tabs
        // Floating navigation bar with a centered action; see
        // src/components/FloatingTabBar.tsx.
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          // No header, so keep content below the status bar; leave room at the
          // bottom so the floating bar doesn't cover the screen's content.
          sceneStyle: {
            backgroundColor: theme.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom + TAB_BAR_GAP * 2 + TAB_BAR_HEIGHT,
          },
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Nova AI',
          sceneStyle: {
            backgroundColor: theme.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom + TAB_BAR_GAP * 2 + TAB_BAR_HEIGHT,
          },
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'MyPlan',
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          title: 'Habits',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          sceneStyle: {
            backgroundColor: theme.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom + TAB_BAR_GAP * 2 + TAB_BAR_HEIGHT,
          },
        }}
      />
      </Tabs>
    </DeleteUndoProvider>
  );
}
