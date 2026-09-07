import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { GuideFigure } from '@/components/ui/GuideFigure';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { palette, spacing } from '@/constants/theme';
import { useGuide } from '@/providers/GuideProvider';

export default function TransferCompleteScreen() {
  const { guide } = useGuide();

  return (
    <AppScreen contentStyle={styles.content}>
      <GuideFigure guide={guide} style={styles.character} />
      <SurfaceCard style={styles.card}>
        <View style={styles.copy}>
          <Text style={styles.title}>引き継ぎが完了しました</Text>
          <Text style={styles.body}>
            Webで診断したあなたの情報を、安全にAliceへ引き継ぎました。
          </Text>
          <Text style={styles.note}>今日の記録や対話は、アプリのホームから利用できます。</Text>
        </View>
        <PrimaryButton label="Aliceをはじめる" onPress={() => router.replace('/(tabs)')} />
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  character: { width: 144, height: 180 },
  card: { width: '100%', gap: spacing.xl },
  copy: { gap: spacing.sm },
  title: { color: palette.navy, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  body: { color: palette.textSoft, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  note: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
