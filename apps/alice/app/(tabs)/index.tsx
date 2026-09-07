import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { GuideFigure } from '@/components/ui/GuideFigure';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { palette, radius, spacing } from '@/constants/theme';
import { useBootstrap } from '@/providers/BootstrapProvider';
import { useGuide } from '@/providers/GuideProvider';

const cycleDays = [1, 2, 3, 4, 5, 6, 7];

export default function HomeScreen() {
  const { guide } = useGuide();
  const { data: bootstrap } = useBootstrap();
  const guideName = guide === 'alice' ? 'Alice' : 'Harry';
  const dayNumber = bootstrap?.active_cycle?.day_number ?? 1;
  const completedDays = bootstrap?.active_cycle?.completed_days ?? 0;
  const completedDayNumbers = new Set(bootstrap?.active_cycle?.completed_day_numbers ?? []);
  const completedToday = bootstrap?.active_cycle?.completed_today ?? false;
  const dailyEnabled = __DEV__ || bootstrap?.feature_flags.daily_check_in === true;

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>おはよう</Text>
          <Text style={styles.title}>今日</Text>
        </View>
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>今回の7日間・{dayNumber}日目</Text>
        </View>
      </View>

      <SurfaceCard style={styles.guideCard}>
        <View style={styles.guideCopy}>
          <Text style={styles.guideName}>{guideName}</Text>
          <Text style={styles.guideMessage}>今日のあなたを、少しだけ教えて。</Text>
        </View>
        <GuideFigure guide={guide} style={styles.character} />
      </SurfaceCard>

      <SurfaceCard>
        <View style={styles.progressHeader}>
          <Text style={styles.sectionTitle}>この7日間</Text>
          <Text style={styles.progressText}>{completedDays} / 7日</Text>
        </View>
        <View style={styles.dots}>
          {cycleDays.map((day) => {
            const isDone = completedDayNumbers.has(day);
            const isToday = day === dayNumber;
            return (
              <View key={day} style={styles.day}>
                <View style={[styles.dot, isDone && styles.dotDone, isToday && styles.dotToday]}>
                  <Text style={[styles.dotText, isDone && styles.dotTextDone, isToday && styles.dotTextActive]}>{isDone ? '✓' : day}</Text>
                </View>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelActive]}>{isToday ? '今日' : `${day}日`}</Text>
              </View>
            );
          })}
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.dailyCard}>
        <View style={styles.dailyMeta}>
          <Text style={styles.dailyEyebrow}>今日の1歩</Text>
          <View style={styles.dailyTimeBadge}>
            <Text style={styles.dailyTimeText}>{completedToday ? '完了' : '約5分'}</Text>
          </View>
        </View>
        <View style={styles.dailyCopy}>
          <Text style={styles.dailyTitle}>
            {completedToday ? '今日のあなたを記録しました' : '今日のあなたを、見つけにいこう。'}
          </Text>
          <Text style={styles.dailyBody}>
            {completedToday ? '次の1歩は、また明日。' : '気持ち・10問・日記'}
          </Text>
        </View>
        <PrimaryButton
          disabled={completedToday || !dailyEnabled}
          label={completedToday ? '今日は記録済み' : dailyEnabled ? 'はじめる' : '準備中'}
          onPress={() => router.push('/daily')}
        />
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: palette.textSoft, fontSize: 12, fontWeight: '600' },
  title: { marginTop: 2, color: palette.navy, fontSize: 30, fontWeight: '800' },
  dayPill: { borderRadius: radius.pill, backgroundColor: palette.selected, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dayPillText: { color: palette.brand, fontSize: 11, fontWeight: '700' },
  guideCard: { minHeight: 196, overflow: 'hidden', backgroundColor: palette.selected },
  guideCopy: { width: '60%', gap: spacing.sm, paddingTop: spacing.md, zIndex: 1 },
  guideName: { color: palette.brand, fontSize: 14, fontWeight: '800' },
  guideMessage: { color: palette.navy, fontSize: 20, fontWeight: '800', lineHeight: 29 },
  character: { position: 'absolute', right: -10, bottom: -24, width: 142, height: 178 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: palette.navy, fontSize: 16, fontWeight: '800' },
  progressText: { color: palette.brand, fontSize: 13, fontWeight: '800' },
  dots: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  day: { alignItems: 'center', gap: spacing.xs },
  dot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.canvas },
  dotDone: { backgroundColor: palette.brand },
  dotToday: { borderWidth: 2, borderColor: palette.brand, backgroundColor: palette.white },
  dotText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  dotTextDone: { color: palette.white },
  dotTextActive: { color: palette.brand },
  dayLabel: { color: palette.muted, fontSize: 9 },
  dayLabelActive: { color: palette.brand, fontWeight: '800' },
  dailyCard: { gap: spacing.lg, backgroundColor: palette.selected, padding: spacing.xl },
  dailyMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dailyEyebrow: { color: palette.brand, fontSize: 13, fontWeight: '800' },
  dailyTimeBadge: { borderRadius: radius.pill, backgroundColor: palette.white, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  dailyTimeText: { color: palette.brand, fontSize: 11, fontWeight: '800' },
  dailyCopy: { gap: spacing.sm },
  dailyTitle: { color: palette.navy, fontSize: 24, fontWeight: '800', lineHeight: 34 },
  dailyBody: { color: palette.textSoft, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
});
