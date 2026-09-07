import { SymbolView } from 'expo-symbols';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppScreen } from '@/components/ui/AppScreen';
import { CharacterAvatar } from '@/components/ui/CharacterFigure';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { PrototypeNotice } from '@/components/ui/PrototypeNotice';
import { PrototypeUnavailable } from '@/components/ui/PrototypeUnavailable';
import { palette, radius, spacing } from '@/constants/theme';
import { getPublicConfig } from '@/lib/config';
import { useGuide } from '@/providers/GuideProvider';

type TarotMode = 'one' | 'three' | 'yes-no';
type ReadingPhase = 'ready' | 'shuffling' | 'cutting' | 'selecting' | 'revealed';
type CardName = 'moon' | 'star' | 'sun';

const modeConfig = {
  one: {
    title: '今日の1枚',
    lead: '今日の流れと、意識したいことを1枚から読み解きます。',
    selectionCount: 1,
  },
  three: {
    title: '3枚引き',
    lead: '過去・現在・これからのつながりを、3枚から総合的に読み解きます。',
    selectionCount: 3,
  },
  'yes-no': {
    title: 'YES / NO',
    lead: '迷っていることを思い浮かべ、答えと注意点をカードから受け取ります。',
    selectionCount: 1,
  },
} as const;

const tarotArt = {
  moon: require('@/assets/tarot/the-moon-v1.webp'),
  star: require('@/assets/tarot/the-star-v1.webp'),
  sun: require('@/assets/tarot/the-sun-v1.webp'),
  back: require('@/assets/tarot/card-back-v1.webp'),
  cloth: require('@/assets/tarot/reading-cloth-v1.webp'),
} as const;

const selectionCards = [
  { rotation: -8, y: 10 },
  { rotation: -4, y: 3 },
  { rotation: 0, y: 0 },
  { rotation: 4, y: 3 },
  { rotation: 8, y: 10 },
] as const;

const readingCopy = {
  one: {
    summary: '星は、希望を取り戻しながら自分の感覚を信じ直すカードです。今日は、すぐに答えを出すより、心が少し明るくなる方向を選ぶことが流れを整えます。',
    details: [
      { title: 'カードが示すこと', text: '焦りを手放したときに、本当に望んでいる方向が見えてきます。' },
      { title: '今日の注意', text: '周りの正解に合わせるために、自分の小さな違和感を無視しないこと。' },
      { title: '今日の行動', text: '気になっていたことを、結果を求めず10分だけ始めてみて。' },
    ],
  },
  three: {
    summary: '月から星、そして太陽へ。迷いの中で感覚を研ぎ澄ませてきた時間が、希望を経て、はっきりした前進へ向かう並びです。',
    details: [
      { title: '3枚のつながり', text: '不安を消そうとするより、曖昧さの中で見つけた本音を信じることが転換点になります。' },
      { title: 'これから起こる変化', text: '自分で納得して選んだ方向ほど、周囲との関係や状況が明るく開けていきます。' },
      { title: '今できること', text: '結論を急がず、いちばん避けていた選択肢を一度だけ言葉にしてみて。' },
    ],
  },
  'yes-no': {
    summary: '太陽の正位置は、前へ進む力と状況が明らかになる流れを示します。答えはYES。ただし、曖昧なまま進めず条件を言葉にすることが必要です。',
    details: [
      { title: 'なぜYESなのか', text: '隠れていた情報が見えやすく、率直な行動が良い結果につながる時期だからです。' },
      { title: '注意すること', text: '勢いだけで約束を増やさず、自分が譲れない条件を先に確認してください。' },
      { title: '判断のタイミング', text: '最初の一歩を小さく試せるなら、今から動き始めて大丈夫です。' },
    ],
  },
} as const;

export default function TarotDrawScreen() {
  const enabled = __DEV__ || getPublicConfig().tarotPrototypeEnabled;
  return enabled ? <TarotDrawPrototype /> : <PrototypeUnavailable title="タロット" />;
}

function TarotDrawPrototype() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = tarotMode(params.mode);
  const config = modeConfig[mode];
  const { guide } = useGuide();
  const guideName = guide === 'alice' ? 'Alice' : 'Harry';
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<ReadingPhase>('ready');
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [shuffleMotion] = useState(() => new Animated.Value(0));
  const [guideMotion] = useState(() => new Animated.Value(0));
  const needsQuestion = mode === 'yes-no';
  const canStart = !needsQuestion || question.trim().length > 0;
  const selectionComplete = selectedCards.length === config.selectionCount;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(guideMotion, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(guideMotion, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [guideMotion]);

  function startShuffle() {
    if (!canStart || phase === 'shuffling') return;
    setSelectedCards([]);
    setPhase('shuffling');
    shuffleMotion.setValue(0);
    Animated.sequence([
      Animated.timing(shuffleMotion, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shuffleMotion, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shuffleMotion, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(shuffleMotion, { toValue: 0, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setPhase('cutting');
    });
  }

  function toggleCard(index: number) {
    if (phase !== 'selecting') return;
    setSelectedCards((current) => {
      if (current.includes(index)) return current.filter((value) => value !== index);
      if (current.length >= config.selectionCount) return current;
      return [...current, index];
    });
  }

  function reset() {
    setSelectedCards([]);
    setPhase('ready');
    if (needsQuestion) setQuestion('');
  }

  function openChat() {
    router.push({
      pathname: '/(tabs)/chat',
      params: {
        prefill: readingPrefill(mode, question.trim()),
      },
    });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      <AppScreen contentStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="占いの選択へ戻る"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={21} tintColor={palette.navy} />
          </Pressable>
          <Text style={styles.title}>{config.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.lead}>{config.lead}</Text>

        <PrototypeNotice>
          この画面のカードと読み解きは固定サンプルです。正式な鑑定結果として保存・提供されません。
        </PrototypeNotice>

        <View style={styles.guideStage}>
          <Animated.View
            style={[
              styles.guideAvatarFrame,
              { transform: [{ translateY: guideMotion.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] },
            ]}>
            <CharacterAvatar guide={guide} style={styles.guideAvatar} />
          </Animated.View>
          <View style={styles.guideBubble}>
            <Text style={styles.guideName}>{guideName}</Text>
            <Text style={styles.guideText}>{guideMessage(phase, guideName)}</Text>
          </View>
        </View>

        {needsQuestion && phase === 'ready' ? (
          <View style={styles.questionArea}>
            <Text style={styles.inputLabel}>占いたいこと</Text>
            <TextInput
              accessibilityLabel="カードで占いたいこと"
              maxLength={200}
              multiline
              onChangeText={setQuestion}
              placeholder="迷っていることを書く"
              placeholderTextColor={palette.muted}
              style={styles.input}
              value={question}
            />
          </View>
        ) : null}

        {phase === 'revealed' ? (
          <View style={styles.resultStage}>
            <Text style={styles.sampleResultLabel}>固定サンプル結果</Text>
            <TarotResult guide={guide} guideName={guideName} mode={mode} question={question.trim()} />
          </View>
        ) : (
          <ImageBackground imageStyle={styles.ritualCloth} resizeMode="cover" source={tarotArt.cloth} style={styles.ritualStage}>
            {phase === 'selecting' ? (
              <CardSelection
                maxSelected={config.selectionCount}
                onToggle={toggleCard}
                selectedCards={selectedCards}
              />
            ) : phase === 'cutting' ? (
              <DeckCut onSelect={() => setPhase('selecting')} />
            ) : (
              <Animated.View
                accessibilityLabel="伏せられたタロットカード"
                style={[
                  styles.singleDeck,
                  { transform: [{ translateX: shuffleMotion.interpolate({ inputRange: [-1, 0, 1], outputRange: [-18, 0, 18] }) }, { rotate: shuffleMotion.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-5deg', '0deg', '5deg'] }) }] },
                ]}>
                <View style={styles.cardFocus} />
                <View style={[styles.deckShadow, styles.deckShadowBack]} />
                <View style={[styles.deckShadow, styles.deckShadowMiddle]} />
                <TarotBack />
              </Animated.View>
            )}
          </ImageBackground>
        )}

        <View style={styles.actionArea}>
          {phase === 'ready' ? (
            <PrimaryButton disabled={!canStart} label="カードを混ぜる" onPress={startShuffle} />
          ) : phase === 'shuffling' ? (
            <PrimaryButton disabled label={`${guideName}がカードを混ぜています`} onPress={() => undefined} />
          ) : phase === 'cutting' ? (
            <Text style={styles.cutInstruction}>直感でカードの山をひとつ選んでください</Text>
          ) : phase === 'selecting' ? (
            <PrimaryButton
              disabled={!selectionComplete}
              label={selectionComplete ? `${guideName}に読み解いてもらう` : selectionLabel(config.selectionCount, selectedCards.length)}
              onPress={() => setPhase('revealed')}
            />
          ) : (
            <View style={styles.resultActions}>
              <PrimaryButton label={`この結果について${guideName}と話す`} onPress={openChat} />
              <Pressable accessibilityRole="button" onPress={reset} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
                <Text style={styles.secondaryLabel}>もう一度占う</Text>
              </Pressable>
            </View>
          )}
        </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function CardSelection({
  maxSelected,
  onToggle,
  selectedCards,
}: {
  maxSelected: number;
  onToggle: (index: number) => void;
  selectedCards: number[];
}) {
  return (
    <View style={styles.selectionGroup}>
      <Text style={styles.selectionLead}>{maxSelected === 1 ? '心が引かれる1枚を選んでください。' : '心が引かれる3枚を選んでください。'}</Text>
      <View style={styles.selectionRow}>
        {selectionCards.map((card, index) => {
          const selected = selectedCards.includes(index);
          return (
            <Pressable
              accessibilityLabel={`${index + 1}枚目のカード${selected ? '、選択済み' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={index}
              onPress={() => onToggle(index)}
              style={[
                styles.selectableCard,
                selected && styles.selectableCardSelected,
                { transform: [{ translateY: selected ? -12 : card.y }, { rotate: `${card.rotation}deg` }] },
              ]}>
              <TarotBack small />
              {selected ? (
                <View style={styles.selectedMark}>
                  <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor={palette.white} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DeckCut({ onSelect }: { onSelect: () => void }) {
  return (
    <View style={styles.cutGroup}>
      <Text style={styles.ritualPrompt}>デッキを3つの山に分けました</Text>
      <Text style={styles.ritualSubtext}>ひとつ選んで、カードを切ってください。</Text>
      <View style={styles.cutRow}>
        {[0, 1, 2].map((index) => (
          <Pressable
            accessibilityLabel={`${index + 1}番目のカードの山を選ぶ`}
            accessibilityRole="button"
            key={index}
            onPress={onSelect}
            style={({ pressed }) => [styles.cutPile, pressed && styles.cutPilePressed]}>
            <View style={[styles.cutPileLayer, styles.cutPileLayerBack]} />
            <View style={[styles.cutPileLayer, styles.cutPileLayerMiddle]} />
            <TarotBack small />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TarotBack({ small = false }: { small?: boolean }) {
  return <Image resizeMode="cover" source={tarotArt.back} style={[styles.cardBack, small && styles.cardBackSmall]} />;
}

function TarotResult({ guide, guideName, mode, question }: { guide: 'alice' | 'harry'; guideName: string; mode: TarotMode; question: string }) {
  if (mode === 'three') {
    return (
      <View style={styles.resultGroup}>
        <View style={styles.threeResults}>
          <ArtCard card="moon" label="過去" title="XVIII 月" />
          <ArtCard card="star" label="現在" title="XVII 星" />
          <ArtCard card="sun" label="これから" title="XIX 太陽" />
        </View>
        <GuideReading guide={guide} guideName={guideName} reading={readingCopy.three} />
      </View>
    );
  }

  if (mode === 'yes-no') {
    return (
      <View style={styles.resultGroup}>
        <Text numberOfLines={3} style={styles.questionPreview}>{question}</Text>
        <View style={styles.yesNoResult}>
          <Image resizeMode="cover" source={tarotArt.sun} style={styles.answerArt} />
          <View style={styles.answerCopy}>
            <Text style={styles.answer}>YES</Text>
            <Text style={styles.answerCondition}>条件を整えて進む</Text>
            <Text style={styles.orientation}>XIX 太陽・正位置</Text>
          </View>
        </View>
        <GuideReading guide={guide} guideName={guideName} reading={readingCopy['yes-no']} />
      </View>
    );
  }

  return (
    <View style={styles.resultGroup}>
      <ArtCard card="star" large label="今日のカード" title="XVII 星" />
      <GuideReading guide={guide} guideName={guideName} reading={readingCopy.one} />
    </View>
  );
}

function ArtCard({ card, label, large = false, title }: { card: CardName; label: string; large?: boolean; title: string }) {
  return (
    <View style={[styles.artCardWrap, large && styles.artCardWrapLarge]}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Image resizeMode="cover" source={tarotArt[card]} style={[styles.artCard, large && styles.artCardLarge]} />
      <Text style={[styles.cardTitle, large && styles.cardTitleLarge]}>{title}</Text>
      <Text style={styles.orientation}>正位置</Text>
    </View>
  );
}

function GuideReading({
  guide,
  guideName,
  reading,
}: {
  guide: 'alice' | 'harry';
  guideName: string;
  reading: { summary: string; details: readonly { title: string; text: string }[] };
}) {
  return (
    <View style={styles.messageCard}>
      <View style={styles.messageHeader}>
        <View style={styles.resultAvatarFrame}>
          <CharacterAvatar guide={guide} style={styles.resultAvatar} />
        </View>
        <Text style={styles.messageEyebrow}>{guideName}の読み解き</Text>
      </View>
      <Text style={styles.messageText}>{reading.summary}</Text>
      <View style={styles.readingDetails}>
        {reading.details.map((detail) => (
          <View key={detail.title} style={styles.readingDetail}>
            <Text style={styles.readingDetailTitle}>{detail.title}</Text>
            <Text style={styles.readingDetailText}>{detail.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function guideMessage(phase: ReadingPhase, guideName: string) {
  if (phase === 'shuffling') return 'あなたの今を思い浮かべながら、カードを混ぜています。';
  if (phase === 'cutting') return 'カードを3つの山に分けました。直感でひとつ選んで、デッキを切って。';
  if (phase === 'selecting') return '考えすぎなくて大丈夫。最初に気になったカードを選んで。';
  if (phase === 'revealed') return '出たカードを、あなたの今と重ねて読んでみたよ。';
  return `今日は${guideName}が、あなたのために丁寧に占います。`;
}

function selectionLabel(maxSelected: number, selectedCount: number) {
  return maxSelected === 1 ? 'カードを1枚選んでください' : `カードを3枚選んでください  ${selectedCount}/3`;
}

function readingPrefill(mode: TarotMode, question: string) {
  if (mode === 'three') return '3枚引きで出た「月・星・太陽」のつながりを、今の私に重ねてもう少し詳しく聞きたい。';
  if (mode === 'yes-no') {
    const safeQuestion = question.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 200);
    return `「${safeQuestion}」について太陽の正位置が出た固定サンプルを、会話のきっかけとして使いたい。`;
  }
  return '今日の1枚で出た「星」の正位置について、今の私に重ねてもう少し詳しく聞きたい。';
}

function tarotMode(value: string | undefined): TarotMode {
  return value === 'three' || value === 'yes-no' ? value : 'one';
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.white },
  content: { gap: spacing.lg, paddingTop: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.canvas },
  backButtonPressed: { backgroundColor: palette.selected },
  title: { color: palette.navy, fontSize: 23, fontWeight: '800' },
  headerSpacer: { width: 42 },
  lead: { alignSelf: 'center', maxWidth: 330, color: palette.textSoft, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  guideStage: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  guideAvatarFrame: { width: 64, height: 64, overflow: 'hidden', borderWidth: 1, borderColor: palette.border, borderRadius: radius.pill, backgroundColor: palette.selected },
  guideAvatar: { width: 64, height: 64, transform: [{ translateX: -3 }] },
  guideBubble: { flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.white, padding: spacing.md },
  guideName: { marginBottom: spacing.xs, color: palette.brand, fontSize: 11, fontWeight: '800' },
  guideText: { color: palette.navy, fontSize: 13, lineHeight: 20 },
  questionArea: { gap: spacing.sm },
  inputLabel: { color: palette.navy, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 94, maxHeight: 150, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, backgroundColor: palette.canvas, padding: spacing.md, color: palette.navy, fontSize: 14, lineHeight: 21, textAlignVertical: 'top' },
  ritualStage: { minHeight: 342, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2458B8', borderRadius: radius.lg, backgroundColor: '#071B45', paddingHorizontal: spacing.md, paddingVertical: spacing.xl, boxShadow: '0px 12px 24px rgba(7, 27, 69, 0.20)' },
  ritualCloth: { borderRadius: radius.lg, opacity: 0.16 },
  resultStage: { minHeight: 348, alignItems: 'center', justifyContent: 'center' },
  sampleResultLabel: { marginBottom: spacing.md, color: palette.brand, fontSize: 11, fontWeight: '800' },
  singleDeck: { width: 170, height: 244, alignItems: 'center', justifyContent: 'center' },
  cardFocus: { position: 'absolute', width: 184, height: 258, borderWidth: 1, borderColor: '#8FC9FF', borderRadius: radius.lg, backgroundColor: '#173C7E', opacity: 0.42 },
  deckShadow: { position: 'absolute', width: 148, height: 218, borderRadius: radius.md, backgroundColor: '#173C7E' },
  deckShadowBack: { transform: [{ translateX: 10 }, { translateY: -8 }, { rotate: '5deg' }] },
  deckShadowMiddle: { transform: [{ translateX: 5 }, { translateY: -4 }, { rotate: '2.5deg' }], backgroundColor: '#2458B8' },
  cardBack: { width: 148, height: 222, borderWidth: 1, borderColor: '#8FC9FF', borderRadius: radius.md, backgroundColor: '#071B45', boxShadow: '0px 12px 24px rgba(7, 27, 69, 0.48)' },
  cardBackSmall: { width: 54, height: 81, borderRadius: radius.sm, boxShadow: 'none' },
  selectionGroup: { width: '100%', alignItems: 'center', gap: spacing.xxl },
  selectionLead: { color: palette.white, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  selectionRow: { minHeight: 118, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  selectableCard: { width: 58, height: 88, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  selectableCardSelected: { boxShadow: '0px 10px 18px rgba(143, 201, 255, 0.48)' },
  selectedMark: { position: 'absolute', right: -2, bottom: -4, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.white, borderRadius: radius.pill, backgroundColor: palette.brand },
  cutGroup: { width: '100%', alignItems: 'center', gap: spacing.sm },
  ritualPrompt: { color: palette.white, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  ritualSubtext: { marginBottom: spacing.xl, color: '#BFD0FF', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  cutRow: { minHeight: 126, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  cutPile: { width: 62, height: 94, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  cutPilePressed: { transform: [{ translateY: -7 }] },
  cutPileLayer: { position: 'absolute', width: 54, height: 81, borderWidth: 1, borderColor: '#8FC9FF', borderRadius: radius.sm, backgroundColor: '#173C7E' },
  cutPileLayerBack: { transform: [{ translateX: 5 }, { translateY: -5 }, { rotate: '4deg' }] },
  cutPileLayerMiddle: { transform: [{ translateX: 2 }, { translateY: -2 }, { rotate: '2deg' }], backgroundColor: '#2458B8' },
  cutInstruction: { color: palette.textSoft, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  resultGroup: { width: '100%', alignItems: 'center', gap: spacing.xl },
  threeResults: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.sm },
  artCardWrap: { width: 98, alignItems: 'center', gap: spacing.xs },
  artCardWrapLarge: { width: 176 },
  artCard: { width: 96, height: 144, borderWidth: 1, borderColor: palette.border, borderRadius: radius.sm, backgroundColor: palette.white },
  artCardLarge: { width: 176, height: 264, borderRadius: radius.md },
  cardLabel: { color: palette.textSoft, fontSize: 10, fontWeight: '700' },
  cardTitle: { color: palette.navy, fontSize: 14, fontWeight: '800' },
  cardTitleLarge: { fontSize: 18 },
  orientation: { color: palette.textSoft, fontSize: 10, fontWeight: '700' },
  messageCard: { width: '100%', borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.white, padding: spacing.lg },
  messageHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  resultAvatarFrame: { width: 40, height: 40, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: palette.white },
  resultAvatar: { width: 40, height: 40, transform: [{ translateX: -2 }] },
  messageEyebrow: { color: palette.brand, fontSize: 12, fontWeight: '800' },
  messageText: { color: palette.navy, fontSize: 14, fontWeight: '600', lineHeight: 23 },
  readingDetails: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: palette.border },
  readingDetail: { gap: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.border, paddingVertical: spacing.md },
  readingDetailTitle: { color: palette.brand, fontSize: 11, fontWeight: '800' },
  readingDetailText: { color: palette.navy, fontSize: 13, lineHeight: 21 },
  questionPreview: { maxWidth: 320, color: palette.textSoft, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  yesNoResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderWidth: 1, borderColor: palette.border, borderRadius: radius.lg, backgroundColor: palette.white, padding: spacing.md },
  answerArt: { width: 96, height: 144, borderRadius: radius.sm },
  answerCopy: { alignItems: 'center', gap: spacing.sm },
  answer: { color: palette.brand, fontSize: 30, fontWeight: '800', letterSpacing: 2 },
  answerCondition: { maxWidth: 130, color: palette.navy, fontSize: 12, fontWeight: '800', lineHeight: 18, textAlign: 'center' },
  actionArea: { paddingBottom: spacing.xl },
  resultActions: { gap: spacing.md },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: radius.pill, backgroundColor: palette.white },
  secondaryButtonPressed: { backgroundColor: palette.selected },
  secondaryLabel: { color: palette.brand, fontSize: 14, fontWeight: '800' },
});
