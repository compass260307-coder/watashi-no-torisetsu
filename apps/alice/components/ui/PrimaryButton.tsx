import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius } from '@/constants/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ label, onPress, disabled = false, loading = false }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <View style={[styles.shadow, isDisabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.label}>{label}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: radius.pill,
    backgroundColor: palette.brandPressed,
    paddingBottom: 4,
  },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: palette.brand,
    paddingHorizontal: 24,
  },
  pressed: {
    transform: [{ translateY: 3 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
