import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Theme } from '@/theme';
import { SmoothPressable } from './SmoothPressable';

/** A titled card used to group rows on settings screens. */
export function Section({
  title,
  children,
  theme,
  expanded,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  theme: Theme;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      {onToggle ? (
        <SmoothPressable
          accessibilityRole="button"
          accessibilityLabel={`${title} section`}
          accessibilityState={{ expanded: !!expanded }}
          onPress={onToggle}
          style={[styles.toggle, expanded && styles.expandedToggle]}
        >
          <Text style={[styles.title, styles.toggleTitle, { color: theme.textSecondary }]}>{title}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} accessible={false} />
        </SmoothPressable>
      ) : (
        <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
      )}
      {(!onToggle || expanded) && children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 12, padding: 14, marginBottom: 14 },
  toggle: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expandedToggle: { marginBottom: 10 },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  toggleTitle: { marginBottom: 0 },
});
