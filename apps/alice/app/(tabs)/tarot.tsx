import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { CharacterAvatar } from '@/components/ui/CharacterFigure';
import { PrototypeNotice } from '@/components/ui/PrototypeNotice';
import { PrototypeUnavailable } from '@/components/ui/PrototypeUnavailable';
import { palette, radius, spacing } from '@/constants/theme';
import { getPublicConfig } from '@/lib/config';
import { useGuide } from '@/providers/GuideProvider';

const tarotModes = [
  { id: 'one', title: '今日の1枚', body: '今日の流れと、意識したいこと', icon: 'sparkles' },
  { id: 'three', title: '3枚引き', body: '過去・現在・これからを総合鑑定', icon: 'rectangle.stack.fill' },
  { id: 'yes-no', title: 'YES / NO', body: '迷っていることをカードに聞く', icon: 'arrow.left.arrow.right' },
] as const;

const previewCards = [
  { source: require('@/assets/tarot/the-moon-v1.webp'), rotation: -8, x: -66, y: 8 },
  { source: require('@/assets/tarot/the-star-v1.webp'), rotation: 0, x: 0, y: -4 },
  { source: require('@/assets/tarot/the-sun-v1.webp'), rotation: 8, x: 66, y: 8 },
] as const;

export default function TarotScreen() {
  const enabled = __DEV__ || getPublicConfig().tarotPrototypeEnabled;
  return enabled ? <TarotPrototype /> : <PrototypeUnavailable title="タロット" />;
}

function TarotPrototype() {
  const { guide } = useGuide();
  const guideName = guide === 'alice' ? 'Alice' : 'Harry';

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>タロット占い</Text>
        <Text style={styles.subtitle}>{guideName}が、今のあなたのためにカードを読みます。</Text>
      </View>

      <PrototypeNotice>
        カード選択と読み解きは操作検証用です。表示されるカードと結果は固定サンプルで、正式な鑑定機能ではありません。
      </PrototypeNotice>

      <View style={styles.guideRow}>
        <View style={styles.avatarFrame}>
          <CharacterAvatar guide={guide} style={styles.avatar} />
        </View>
        <View style={styles.speechBubble}>
          <Text style={styles.speechName}>{guideName}</Text>
          <Text style={styles.speechText}>静かに気持ちを整えて、知りたいことをカードに預けてみて。</Text>
        </View>
      </View>

      <View accessibilityLabel="月、星、太陽のタロットカード" style={styles.cardFan}>
        {previewCards.map((card, index) => (
          <Image
            key={index}
            resizeMode="cover"
            source={card.source}
            style={[
              styles.previewCard,
              { transform: [{ translateX: card.x }, { translateY: card.y }, { rotate: `${card.rotation}deg` }] },
            ]}
          />
        ))}
      </View>

      <View style={styles.modeList}>
        {tarotModes.map((mode) => (
          <Pressable
            accessibilityLabel={`${mode.title}を開く`}
            accessibilityRole="button"
            key={mode.id}
            onPress={() => router.push({ pathname: '/tarot/[mode]', params: { mode: mode.id } })}
            style={({ pressed }) => [styles.mode, pressed && styles.modePressed]}>
            <View style={styles.modeIcon}>
              <SymbolView
                name={{
                  ios: mode.icon,
                  android: mode.id === 'one' ? 'crop_portrait' : mode.id === 'three' ? 'style' : 'compare_arrows',
                  web: mode.id === 'one' ? 'crop_portrait' : mode.id === 'three' ? 'style' : 'compare_arrows',
                }}
                size={24}
                tintColor={palette.brand}
              />
            </View>
            <View style={styles.modeCopy}>
              <Text style={styles.modeTitle}>{mode.title}</Text>
              <Text style={styles.modeBody}>{mode.body}</Text>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor={palette.muted} />
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.md },
  header: { gap: spacing.sm },
  title: { color: palette.navy, fontSize: 30, fontWeight: '800' },
  subtitle: { color: palette.textSoft, fontSize: 13, lineHeight: 20 },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarFrame: { width: 64, height: 64, overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: radius.pill, backgroundColor: palette.selected },
  avatar: { width: 64, height: 64, transform: [{ translateX: -3 }] },
  speechBubble: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.white, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  speechName: { marginBottom: spacing.xs, color: palette.brand, fontSize: 11, fontWeight: '800' },
  speechText: { color: palette.navy, fontSize: 13, lineHeight: 20 },
  cardFan: { height: 214, alignItems: 'center', justifyContent: 'center' },
  previewCard: { position: 'absolute', width: 112, height: 168, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.white, boxShadow: '0px 10px 20px rgba(23, 42, 99, 0.16)' },
  modeList: { gap: spacing.md },
  mode: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 82, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.white, padding: spacing.md },
  modePressed: { backgroundColor: palette.selected, borderColor: palette.brand },
  modeIcon: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: palette.selected },
  modeCopy: { flex: 1, gap: spacing.xs },
  modeTitle: { color: palette.navy, fontSize: 16, fontWeight: '800' },
  modeBody: { color: palette.textSoft, fontSize: 11, lineHeight: 17 },
});
