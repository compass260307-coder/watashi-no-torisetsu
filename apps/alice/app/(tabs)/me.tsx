import { SymbolView } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { CharacterFigure } from '@/components/ui/CharacterFigure';
import { PrototypeNotice } from '@/components/ui/PrototypeNotice';
import { PrototypeUnavailable } from '@/components/ui/PrototypeUnavailable';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { palette, radius, spacing } from '@/constants/theme';
import { getPublicConfig } from '@/lib/config';
import { useGuide } from '@/providers/GuideProvider';
import type { Guide } from '@/types/app';

const profileItems = [
  { title: '性格診断結果', subtitle: 'Big Fiveと10の側面', symbol: 'chart.bar.fill' },
  { title: 'キャラクタータイプ', subtitle: 'あなたの基本タイプ', symbol: 'person.crop.circle.fill' },
  { title: '自己分析レポート', subtitle: 'Web診断から引き継いだ内容', symbol: 'doc.text.fill' },
  { title: '友達から見た自分', subtitle: 'みんなから見た傾向', symbol: 'person.2.fill' },
] as const;

export default function MeScreen() {
  const enabled = __DEV__ || getPublicConfig().profilePrototypeEnabled;
  return enabled ? <ProfilePrototype /> : <PrototypeUnavailable title="マイページ" />;
}

function ProfilePrototype() {
  const { guide } = useGuide();

  return (
    <AppScreen contentStyle={styles.content}>
      <View>
        <Text style={styles.title}>マイページ</Text>
        <Text style={styles.subtitle}>あなたの基本情報とAliceの記憶</Text>
      </View>

      <PrototypeNotice>
        現在は画面構成の確認用です。設定変更や各レポート画面への遷移はまだ保存・接続されません。
      </PrototypeNotice>

      <Text style={styles.sectionTitle}>一緒に歩く相手</Text>
      <View style={styles.guideRow}>
        <GuideOption active={guide === 'alice'} guide="alice" name="Alice" />
        <GuideOption active={guide === 'harry'} guide="harry" name="Harry" />
      </View>
      <Text style={styles.guideNote}>違いは外見と性別表現だけ。あなたについて覚えている内容は共通です。</Text>

      <Text style={styles.sectionTitle}>わたし</Text>
      <SurfaceCard style={styles.profileCard}>
        {profileItems.map((item, index) => (
          <View key={item.title} style={[styles.profileItem, index > 0 && styles.profileDivider]}>
            <View style={styles.profileIcon}>
              <SymbolView name={{ ios: item.symbol, android: 'person', web: 'person' }} size={20} tintColor={palette.brand} />
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.profileTitle}>{item.title}</Text>
              <Text style={styles.profileSubtitle}>{item.subtitle}</Text>
            </View>
            <Text style={styles.comingSoon}>準備中</Text>
          </View>
        ))}
      </SurfaceCard>

      <SurfaceCard style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Text style={styles.settingText}>Aliceが覚えていること</Text>
          <Text style={styles.comingSoon}>準備中</Text>
        </View>
        <View style={[styles.settingRow, styles.profileDivider]}>
          <Text style={styles.settingText}>通知・言語・タイムゾーン</Text>
          <Text style={styles.comingSoon}>準備中</Text>
        </View>
      </SurfaceCard>
    </AppScreen>
  );
}

function GuideOption({ active, guide, name }: { active: boolean; guide: Guide; name: string }) {
  return (
    <View
      accessibilityLabel={`${name}${active ? '、現在選択中' : ''}`}
      style={[styles.guideOption, active && styles.guideOptionActive]}>
      <CharacterFigure guide={guide} style={styles.guideImage} />
      <Text style={[styles.guideOptionName, active && styles.guideOptionNameActive]}>{name}</Text>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioInner} /> : null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.md },
  title: { color: palette.navy, fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: spacing.xs, color: palette.textSoft, fontSize: 12 },
  sectionTitle: { marginTop: spacing.sm, color: palette.navy, fontSize: 17, fontWeight: '800' },
  guideRow: { flexDirection: 'row', gap: spacing.md },
  guideOption: { flex: 1, alignItems: 'center', minHeight: 180, borderWidth: 1.5, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.white, padding: spacing.sm },
  guideOptionActive: { borderColor: palette.brand, backgroundColor: palette.selected },
  guideImage: { width: 92, height: 116 },
  guideOptionName: { color: palette.textSoft, fontSize: 15, fontWeight: '800' },
  guideOptionNameActive: { color: palette.brand },
  radio: { position: 'absolute', right: spacing.md, top: spacing.md, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: palette.border, borderRadius: radius.pill, backgroundColor: palette.white },
  radioActive: { borderColor: palette.brand },
  radioInner: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: palette.brand },
  guideNote: { color: palette.textSoft, fontSize: 11, lineHeight: 18 },
  profileCard: { paddingVertical: 0 },
  profileItem: { flexDirection: 'row', alignItems: 'center', minHeight: 72, gap: spacing.md },
  profileDivider: { borderTopWidth: 1, borderTopColor: palette.border },
  profileIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.selected },
  profileCopy: { flex: 1, gap: 2 },
  profileTitle: { color: palette.navy, fontSize: 14, fontWeight: '800' },
  profileSubtitle: { color: palette.textSoft, fontSize: 10 },
  settingsCard: { paddingVertical: 0 },
  settingRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingText: { color: palette.navy, fontSize: 13, fontWeight: '700' },
  comingSoon: { color: palette.muted, fontSize: 10, fontWeight: '700' },
});
