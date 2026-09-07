import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { palette, spacing } from '@/constants/theme';

export function PrototypeUnavailable({ title }: { title: string }) {
  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>プロトタイプ</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>この機能は現在テスト中です。正式公開までは利用できません。</Text>
      </View>
      <PrimaryButton label="ホームへ戻る" onPress={() => router.replace('/(tabs)')} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', gap: spacing.xl },
  copy: { gap: spacing.sm },
  eyebrow: { color: palette.brand, fontSize: 12, fontWeight: '800' },
  title: { color: palette.navy, fontSize: 28, fontWeight: '800' },
  body: { color: palette.textSoft, fontSize: 14, lineHeight: 22 },
});
