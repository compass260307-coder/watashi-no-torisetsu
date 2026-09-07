import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, radius, spacing } from '@/constants/theme';

export function SurfaceCard({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    padding: spacing.lg,
    boxShadow: '0px 6px 16px rgba(23, 42, 99, 0.06)',
  },
});
