import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { MoodIcon, type MoodIconName } from '@/components/ui/MoodIcon';
import { PrototypeNotice } from '@/components/ui/PrototypeNotice';
import { PrototypeUnavailable } from '@/components/ui/PrototypeUnavailable';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { palette, radius, spacing } from '@/constants/theme';
import { getPublicConfig } from '@/lib/config';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];
const sampleMoods: Record<string, MoodIconName> = {
  '2026-08-24': 'clear',
  '2026-08-25': 'calm',
  '2026-08-26': 'mixed',
  '2026-08-27': 'clear',
};
const sampleEntries = [
  { date: '2026-08-27', mood: 'clear', preview: '自分で納得して決めることを大切にしている、とあらためて感じた。' },
  { date: '2026-08-26', mood: 'mixed', preview: '少し迷うことがあったけれど、書くことで気持ちを整理できた。' },
  { date: '2026-08-25', mood: 'calm', preview: '落ち着いて、自分のペースで過ごせた一日だった。' },
  { date: '2026-08-24', mood: 'clear', preview: '新しいことを少し試してみた。' },
] satisfies readonly { date: string; mood: MoodIconName; preview: string }[];

export default function JournalScreen() {
  const enabled = __DEV__ || getPublicConfig().journalPrototypeEnabled;
  return enabled ? <JournalPrototype /> : <PrototypeUnavailable title="日記" />;
}

function JournalPrototype() {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedEntry, setSelectedEntry] = useState<(typeof sampleEntries)[number] | null>(null);
  const calendarDays = useMemo(
    () => monthCells(visibleMonth.year, visibleMonth.month),
    [visibleMonth],
  );
  const visibleEntries = useMemo(() => {
    const prefix = `${visibleMonth.year}-${String(visibleMonth.month + 1).padStart(2, '0')}`;
    return sampleEntries.filter((entry) => entry.date.startsWith(prefix));
  }, [visibleMonth]);

  function moveMonth(amount: number) {
    setVisibleMonth((current) => {
      const next = new Date(current.year, current.month + amount, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>日記</Text>
        </View>
      </View>

      <PrototypeNotice>
        カレンダーと日記本文は画面確認用のサンプルです。実際の保存データとは接続していません。
      </PrototypeNotice>

      <SurfaceCard style={styles.calendarCard}>
        <View style={styles.monthHeader}>
          <Pressable
            accessibilityLabel="前の月"
            accessibilityRole="button"
            onPress={() => moveMonth(-1)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={20} tintColor={palette.brand} />
          </Pressable>
          <Text style={styles.monthTitle}>{visibleMonth.year}年{visibleMonth.month + 1}月</Text>
          <Pressable
            accessibilityLabel="次の月"
            accessibilityRole="button"
            onPress={() => moveMonth(1)}
            style={({ pressed }) => [styles.monthButton, pressed && styles.monthButtonPressed]}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor={palette.brand} />
          </Pressable>
        </View>

        <View style={styles.calendarGrid}>
          {weekdayLabels.map((label, index) => (
            <View key={label} style={styles.calendarColumn}>
              <Text style={[styles.weekday, index === 0 && styles.sunday, index === 6 && styles.saturday]}>{label}</Text>
            </View>
          ))}
          {calendarDays.map((day, index) => {
            if (!day) return <View key={`empty-${index}`} style={[styles.calendarColumn, styles.dayCell]} />;
            const key = dateKey(visibleMonth.year, visibleMonth.month, day);
            const mood = sampleMoods[key];
            const isToday =
              visibleMonth.year === today.getFullYear() &&
              visibleMonth.month === today.getMonth() &&
              day === today.getDate();
            return (
              <View key={key} style={[styles.calendarColumn, styles.dayCell, isToday && styles.todayCell]}>
                <View style={[styles.dayNumberBadge, isToday && styles.todayBadge]}>
                  <Text style={[styles.dayNumber, isToday && styles.todayNumber]}>{day}</Text>
                </View>
                {mood ? <MoodIcon mood={mood} size={22} /> : null}
              </View>
            );
          })}
        </View>
      </SurfaceCard>

      <View style={styles.journalSection}>
        <View style={styles.journalSectionHeader}>
          <Text style={styles.journalSectionTitle}>{visibleMonth.month + 1}月の日記</Text>
          {visibleEntries.length > 0 ? <Text style={styles.journalCount}>{visibleEntries.length}件</Text> : null}
        </View>

        {visibleEntries.length > 0 ? (
          <View style={styles.journalList}>
            {visibleEntries.map((entry) => {
              const day = Number(entry.date.slice(-2));
              const weekday = weekdayLabels[new Date(visibleMonth.year, visibleMonth.month, day).getDay()];
              return (
                <Pressable
                  accessibilityLabel={`${visibleMonth.month + 1}月${day}日の日記を開く`}
                  accessibilityRole="button"
                  key={entry.date}
                  onPress={() => setSelectedEntry(entry)}
                  style={({ pressed }) => [styles.journalBar, pressed && styles.journalBarPressed]}>
                  <View style={styles.journalMood}>
                    <MoodIcon mood={entry.mood} size={28} />
                  </View>
                  <View style={styles.journalCopy}>
                    <Text style={styles.journalDate}>{visibleMonth.month + 1}月{day}日（{weekday}）</Text>
                    <Text numberOfLines={1} style={styles.journalPreview}>{entry.preview}</Text>
                  </View>
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={18} tintColor={palette.muted} />
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.noJournalBar}>
            <Text style={styles.noJournalText}>この月の日記はまだありません。</Text>
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setSelectedEntry(null)}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={selectedEntry !== null}>
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="日記を閉じる"
            accessibilityRole="button"
            onPress={() => setSelectedEntry(null)}
            style={styles.modalBackdrop}
          />
          {selectedEntry ? (
            <View accessibilityViewIsModal style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeading}>
                  <View style={styles.modalMood}>
                    <MoodIcon mood={selectedEntry.mood} />
                  </View>
                  <View style={styles.modalTitleCopy}>
                    <Text style={styles.modalEyebrow}>日記</Text>
                    <Text style={styles.modalTitle}>{journalDateLabel(selectedEntry.date)}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityLabel="閉じる"
                  accessibilityRole="button"
                  onPress={() => setSelectedEntry(null)}
                  style={({ pressed }) => [styles.modalClose, pressed && styles.modalClosePressed]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor={palette.navy} />
                </Pressable>
              </View>
              <View style={styles.modalDivider} />
              <Text style={styles.modalBody}>{selectedEntry.preview}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedEntry(null)}
                style={({ pressed }) => [styles.modalAction, pressed && styles.modalActionPressed]}>
                <Text style={styles.modalActionText}>閉じる</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.navy, fontSize: 30, fontWeight: '800' },
  calendarCard: { padding: spacing.md },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.selected },
  monthButtonPressed: { backgroundColor: '#DFE8FF' },
  monthTitle: { color: palette.navy, fontSize: 16, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarColumn: { width: '14.2857%', alignItems: 'center' },
  weekday: { paddingVertical: spacing.xs, color: palette.muted, fontSize: 10, fontWeight: '800' },
  sunday: { color: '#E56B7F' },
  saturday: { color: palette.brand },
  dayCell: { minHeight: 52, justifyContent: 'flex-start', gap: 1, paddingTop: 3, borderRadius: radius.sm },
  todayCell: { backgroundColor: palette.selected },
  dayNumberBadge: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  todayBadge: { backgroundColor: palette.brand },
  dayNumber: { color: palette.navy, fontSize: 11, fontWeight: '700' },
  todayNumber: { color: palette.white },
  journalSection: { gap: spacing.md },
  journalSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  journalSectionTitle: { color: palette.navy, fontSize: 18, fontWeight: '800' },
  journalCount: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  journalList: { gap: spacing.sm },
  journalBar: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    backgroundColor: palette.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  journalBarPressed: { borderColor: palette.brand, backgroundColor: palette.selected },
  journalMood: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.canvas },
  journalCopy: { flex: 1, gap: 3 },
  journalDate: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  journalPreview: { color: palette.textSoft, fontSize: 11, lineHeight: 17 },
  noJournalBar: { minHeight: 62, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.canvas },
  noJournalText: { color: palette.textSoft, fontSize: 12 },
  modalRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  modalBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23, 42, 99, 0.34)' },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    padding: spacing.xl,
    boxShadow: '0px 18px 40px rgba(23, 42, 99, 0.20)',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  modalHeading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  modalMood: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.canvas },
  modalTitleCopy: { flex: 1, gap: 2 },
  modalEyebrow: { color: palette.brand, fontSize: 11, fontWeight: '800' },
  modalTitle: { color: palette.navy, fontSize: 18, fontWeight: '800' },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.canvas },
  modalClosePressed: { backgroundColor: palette.selected },
  modalDivider: { height: 1, marginVertical: spacing.lg, backgroundColor: palette.border },
  modalBody: { color: palette.navy, fontSize: 15, lineHeight: 25 },
  modalAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, borderRadius: radius.pill, backgroundColor: palette.brand },
  modalActionPressed: { backgroundColor: palette.brandPressed },
  modalActionText: { color: palette.white, fontSize: 14, fontWeight: '800' },
});

function monthCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function journalDateLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = weekdayLabels[new Date(year, month - 1, day).getDay()];
  return `${month}月${day}日（${weekday}）`;
}
