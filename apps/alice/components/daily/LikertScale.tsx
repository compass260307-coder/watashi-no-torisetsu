import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/constants/theme';
import type { AnswerValue } from '@/types/app';

const options = [
  { value: 7, size: 42, color: '#5961F5' },
  { value: 6, size: 37, color: '#8589F4' },
  { value: 5, size: 32, color: '#B8BBF2' },
  { value: 4, size: 27, color: '#BCC0CC' },
  { value: 3, size: 32, color: '#F1BBD5' },
  { value: 2, size: 37, color: '#EC8ABA' },
  { value: 1, size: 42, color: '#EA5D9D' },
] as const satisfies readonly { value: AnswerValue; size: number; color: string }[];

type LikertScaleProps = {
  value?: AnswerValue;
  onChange: (value: AnswerValue) => void;
};

export function LikertScale({ value, onChange }: LikertScaleProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.labels}>
        <Text style={[styles.label, styles.agreeLabel]}>強くそう思う</Text>
        <Text style={[styles.label, styles.disagreeLabel]}>強くそう思わない</Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              accessibilityLabel={answerLabel(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.optionHitbox, pressed && styles.optionPressed]}>
              <View
                style={[
                  styles.optionCircle,
                  {
                    width: option.size,
                    height: option.size,
                    borderColor: option.color,
                    backgroundColor: selected ? option.color : palette.white,
                  },
                ]}>
                {selected ? <View style={styles.selectedDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function answerLabel(value: AnswerValue) {
  if (value === 1) return '強くそう思わない';
  if (value === 2) return 'そう思わない';
  if (value === 3) return 'あまりそう思わない';
  if (value === 4) return 'どちらでもない';
  if (value === 5) return 'ややそう思う';
  if (value === 6) return 'そう思う';
  return '強くそう思う';
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.lg },
  labels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  label: { width: '48%', fontSize: 12, fontWeight: '800' },
  agreeLabel: { color: '#5961F5' },
  disagreeLabel: { color: '#EA5D9D', textAlign: 'right' },
  options: { flexDirection: 'row', alignItems: 'center' },
  optionHitbox: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: radius.pill,
  },
  optionPressed: { opacity: 0.72 },
  selectedDot: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: palette.white },
});
