import { StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/constants/theme';

export function PrototypeNotice({ children }: { children: string }) {
  return (
    <View accessibilityRole="summary" style={styles.notice}>
      <Text style={styles.label}>プロトタイプ</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: palette.lightBlue,
    borderRadius: radius.md,
    backgroundColor: palette.selected,
    padding: spacing.md,
  },
  label: { color: palette.brand, fontSize: 11, fontWeight: '800' },
  body: { color: palette.navy, fontSize: 12, lineHeight: 18 },
});
