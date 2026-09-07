import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { LikertScale } from '@/components/daily/LikertScale';
import { AppScreen } from '@/components/ui/AppScreen';
import { MoodIcon, type MoodIconName } from '@/components/ui/MoodIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { palette, radius, spacing } from '@/constants/theme';
import { completeDaily, startDaily } from '@/lib/app-api';
import { getPublicConfig } from '@/lib/config';
import { getSupabaseClient } from '@/lib/supabase';
import { useBootstrap } from '@/providers/BootstrapProvider';
import type {
  AnswerValue,
  DailyStartResponse,
  Mood,
} from '@/types/app';

const moods = [
  { id: 'clear', label: 'すっきり' },
  { id: 'calm', label: '落ち着いている' },
  { id: 'mixed', label: '雨：少しモヤモヤ' },
  { id: 'hard', label: '雷：しんどい' },
] as const satisfies readonly { id: MoodIconName & Mood; label: string }[];

type Stage = 'mood' | 'questions' | 'journal' | 'complete';

type DailyDraft = {
  mood: Mood;
  answers: Record<string, AnswerValue>;
  journal: string;
};

const previewQuestions = [
  [1, 'E_assertiveness', 'E', 'グループで意見が割れたとき、自分の考えをはっきり伝える方だ。'],
  [6, 'E_warmth', 'E', '初対面の人とでも、わりとすぐ仲良くなれる。'],
  [11, 'A_cooperation', 'A', 'グループ作業では、自分の意見より全体の流れを優先する。'],
  [16, 'A_sympathy', 'A', '友達が泣いてると、つられて泣きそうになる。'],
  [21, 'O_adventurousness', 'O', '「行ったことない店」と聞くと、つい行きたくなる。'],
  [26, 'O_imagination', 'O', 'ぼーっとしてる時、頭の中で勝手にストーリーが浮かぶ。'],
  [31, 'C_achievement', 'C', '「これをやり遂げたい」という目標が、いつも頭にある。'],
  [36, 'C_orderliness', 'C', '机の上やカバンの中は、わりと整理されている。'],
  [41, 'N_volatility', 'N', 'イラっとしたら、つい顔や態度に出てしまう。'],
  [46, 'N_anxiety', 'N', '寝る前、つい今日のことを思い出して考え込む。'],
] as const;

const previewDaily: DailyStartResponse = {
  checkin: {
    id: '00000000-0000-4000-8000-000000000001',
    status: 'in_progress',
    mood: 'mixed',
    local_date: '2026-08-28',
    started_at: '2026-08-28T00:00:00.000Z',
    completed_at: null,
  },
  cycle: {
    id: '00000000-0000-4000-8000-000000000002',
    cycle_number: 1,
    day_number: 3,
    completed_days: 2,
    starts_at: '2026-08-26T00:00:00.000Z',
    ends_at: '2026-09-02T00:00:00.000Z',
    timezone: 'Asia/Tokyo',
  },
  questions: previewQuestions.map(([questionId, facetId, dimension, text]) => ({
    question_id: questionId,
    facet_id: facetId,
    dimension,
    text,
    logic_version: 'web-big-five-v1',
  })),
  result: null,
};

export default function DailyScreen() {
  const params = useLocalSearchParams<{ preview?: string; demo?: string }>();
  const isDemo = params.demo === '1';
  const initialPreview = __DEV__ ? previewStage(params.preview) : null;
  const { refresh } = useBootstrap();
  const [stage, setStage] = useState<Stage>(initialPreview ?? 'mood');
  const [mood, setMood] = useState<Mood | null>(initialPreview ? 'mixed' : null);
  const [daily, setDaily] = useState<DailyStartResponse | null>(initialPreview ? previewDaily : null);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>(() => (
    initialPreview === 'journal' || initialPreview === 'complete'
      ? Object.fromEntries(previewDaily.questions.map((question) => [question.question_id, 4 as AnswerValue]))
      : {}
  ));
  const [journal, setJournal] = useState(
    initialPreview === 'journal'
      ? '今日は新しいことをひとつ試せた。少し緊張したけど、やってみてよかった。'
      : '',
  );
  const [completedDays, setCompletedDays] = useState(initialPreview === 'complete' ? 3 : initialPreview ? 2 : 0);
  const [draftReady, setDraftReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answeredCount = Object.keys(answers).length;
  const stageNumber = stage === 'mood' ? 1 : stage === 'questions' ? 2 : 3;
  const progressStep = stage === 'complete' ? 3 : stageNumber;
  const draftKey = daily ? `alice.daily-draft.${daily.checkin.id}` : null;

  useEffect(() => {
    if (isDemo || !draftReady || !draftKey || !mood || stage === 'complete') return;
    const draft: DailyDraft = {
      mood,
      answers: Object.fromEntries(
        Object.entries(answers).map(([questionId, value]) => [String(questionId), value]),
      ),
      journal,
    };
    void AsyncStorage.setItem(draftKey, JSON.stringify(draft));
  }, [answers, draftKey, draftReady, isDemo, journal, mood, stage]);

  const title = titleFor(stage);

  async function beginQuestions() {
    if (!mood) return;

    if (isDemo) {
      setDaily({
        ...previewDaily,
        checkin: { ...previewDaily.checkin, mood },
      });
      setCompletedDays(2);
      setError(null);
      setStage('questions');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const next = await startDaily(token);
      setDaily(next);
      setCompletedDays(next.cycle.completed_days);

      if (next.checkin.status === 'completed') {
        setStage('complete');
        return;
      }
      if (next.questions.length !== 10) {
        throw new Error('今日の10問を読み込めませんでした。もう一度お試しください。');
      }

      const stored = await AsyncStorage.getItem(`alice.daily-draft.${next.checkin.id}`);
      if (stored) {
        try {
          const draft = JSON.parse(stored) as Partial<DailyDraft>;
          if (draft.mood && moods.some((item) => item.id === draft.mood)) setMood(draft.mood);
          if (draft.answers && typeof draft.answers === 'object') {
            setAnswers(readDraftAnswers(draft.answers, next));
          }
          if (typeof draft.journal === 'string') setJournal(draft.journal.slice(0, 5000));
        } catch {
          await AsyncStorage.removeItem(`alice.daily-draft.${next.checkin.id}`);
        }
      }
      setDraftReady(true);
      setStage('questions');
      void saveMoodDraft(next, mood);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '今日の診断を開始できませんでした。');
    } finally {
      setIsLoading(false);
    }
  }

  function answerQuestion(questionId: number, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    if (daily && !isDemo) void saveAnswerDraft(daily, questionId, value);
  }

  function previousStep() {
    setError(null);
    if (stage === 'journal') {
      setStage('questions');
      return;
    }
    if (stage === 'questions') {
      setStage('mood');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  async function saveDaily() {
    if (!daily || !mood || answeredCount !== 10) return;

    if (isDemo) {
      setCompletedDays(3);
      setError(null);
      setStage('complete');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const token = await accessToken();
      const completed = await completeDaily(token, {
        checkinId: daily.checkin.id,
        mood,
        answers: daily.questions.map((question) => ({
          questionId: question.question_id,
          value: answers[question.question_id],
        })),
        journal,
      });
      setCompletedDays(completed.completed_days);
      setStage('complete');
      setDraftReady(false);
      if (draftKey) await AsyncStorage.removeItem(draftKey);
      await refresh(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '今日の記録を保存できませんでした。');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppScreen contentStyle={styles.content}>
      {stage !== 'complete' ? (
        <Pressable accessibilityRole="button" onPress={previousStep} style={styles.backButton}>
          <Text style={styles.backText}>‹ 戻る</Text>
        </Pressable>
      ) : null}

      {isDemo ? (
        <View style={styles.demoBadge}>
          <Text style={styles.demoBadgeText}>操作デモ</Text>
        </View>
      ) : null}

      <View style={styles.progress}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={[styles.progressSegment, step <= progressStep && styles.progressActive]}
          />
        ))}
      </View>

      {stage === 'complete' ? (
        <CompleteStage
          completedDays={completedDays}
          onHome={() => router.replace('/(tabs)')}
        />
      ) : (
        <>
          <View>
            <Text style={styles.step}>{stageNumber} / 3</Text>
            <Text style={styles.title}>{title}</Text>
            {stage === 'journal' ? (
              <Text style={styles.journalSubtitle}>
                きれいにまとめなくても大丈夫。今日のことを、メモする感覚で自由に書いてみてね。
              </Text>
            ) : null}
          </View>

          {stage === 'mood' ? (
            <MoodStage mood={mood} onChange={setMood} />
          ) : stage === 'questions' && daily ? (
            <QuestionsStage
              answers={answers}
              onAnswer={answerQuestion}
              questions={daily.questions}
            />
          ) : stage === 'journal' ? (
            <JournalStage
              journal={journal}
              onBlur={() => (daily && !isDemo ? void saveJournalDraft(daily, journal) : undefined)}
              onChange={setJournal}
            />
          ) : null}

          {error ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {stage === 'mood' ? (
            <PrimaryButton
              disabled={!mood}
              label="次へ進む"
              loading={isLoading}
              onPress={() => void beginQuestions()}
            />
          ) : stage === 'questions' ? (
            <View style={styles.questionActions}>
              <PrimaryButton
                disabled={answeredCount !== 10}
                label="次へ進む"
                onPress={() => setStage('journal')}
              />
            </View>
          ) : stage === 'journal' ? (
            <PrimaryButton
              disabled={answeredCount !== 10}
              label="今日の日記を追加する"
              loading={isLoading}
              onPress={() => void saveDaily()}
            />
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

function MoodStage({ mood, onChange }: { mood: Mood | null; onChange: (mood: Mood) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={styles.moodList}>
      {moods.map((item) => {
        const selected = mood === item.id;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={item.id}
            onPress={() => onChange(item.id)}
            style={[styles.moodOption, selected && styles.moodOptionSelected]}>
            <View style={styles.moodIconScale}>
              <MoodIcon mood={item.id} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuestionsStage({
  answers,
  onAnswer,
  questions,
}: {
  answers: Record<number, AnswerValue>;
  onAnswer: (questionId: number, value: AnswerValue) => void;
  questions: DailyStartResponse['questions'];
}) {
  return (
    <View style={styles.questionList}>
      {questions.map((question) => {
        const answer = answers[question.question_id];
        return (
          <SurfaceCard key={question.question_id} style={styles.questionCard}>
            <Text style={styles.questionText}>{question.text}</Text>
            <LikertScale
              onChange={(value) => onAnswer(question.question_id, value)}
              value={answer}
            />
          </SurfaceCard>
        );
      })}
    </View>
  );
}

function JournalStage({
  journal,
  onBlur,
  onChange,
}: {
  journal: string;
  onBlur: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.journalBlock}>
      <TextInput
        accessibilityLabel="今日の日記"
        maxLength={5000}
        multiline
        onBlur={onBlur}
        onChangeText={onChange}
        style={styles.journalInput}
        textAlignVertical="top"
        value={journal}
      />
      <Text style={styles.characterCount}>{journal.length} / 5000</Text>
    </View>
  );
}

function CompleteStage({
  completedDays,
  onHome,
}: {
  completedDays: number;
  onHome: () => void;
}) {
  return (
    <View style={styles.completeBlock}>
      <View style={styles.completeIcon}>
        <Text style={styles.completeCheck}>✓</Text>
      </View>
      <View style={styles.completeCopy}>
        <Text style={styles.completeTitle}>今日の記録が完了しました</Text>
        <Text style={styles.completeBody}>今日の回答と日記を記録しました。</Text>
      </View>
      <View style={styles.completeSummary}>
        <Text style={styles.completeSummaryLabel}>今回の7日間</Text>
        <Text style={styles.completeSummaryValue}>{Math.min(completedDays, 7)} / 7日</Text>
      </View>
      <View style={styles.completeAction}>
        <PrimaryButton label="ホームへ戻る" onPress={onHome} />
      </View>
    </View>
  );
}

function titleFor(stage: Stage) {
  if (stage === 'questions') return '今日の性格診断';
  if (stage === 'journal') return '今日の日記';
  if (stage === 'complete') return '今日の1歩、完了';
  return '今日の気持ちは？';
}

function previewStage(value: string | undefined): Stage | null {
  return value === 'questions' || value === 'journal' || value === 'complete'
    ? value
    : null;
}

async function accessToken() {
  const session = (await getSupabaseClient().auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('ログインの有効期限が切れました。もう一度ログインしてください。');
  return session.access_token;
}

async function saveMoodDraft(daily: DailyStartResponse, mood: Mood) {
  if (!hasSupabaseConfig()) return;
  const { error } = await getSupabaseClient()
    .from('daily_checkins')
    .update({ mood })
    .eq('id', daily.checkin.id)
    .eq('status', 'in_progress');
  if (error) console.warn('[alice/daily] mood draft was not synced', error.message);
}

async function saveAnswerDraft(
  daily: DailyStartResponse,
  questionId: number,
  answer: AnswerValue,
) {
  if (!hasSupabaseConfig()) return;
  const { error } = await getSupabaseClient()
    .from('daily_answers')
    .upsert(
      { checkin_id: daily.checkin.id, question_id: questionId, answer },
      { onConflict: 'checkin_id,question_id' },
    );
  if (error) console.warn('[alice/daily] answer draft was not synced', error.message);
}

async function saveJournalDraft(daily: DailyStartResponse, journal: string) {
  if (!hasSupabaseConfig()) return;
  const body = journal.trim();
  const client = getSupabaseClient();
  if (!body) {
    const { error } = await client.from('journal_entries').delete().eq('checkin_id', daily.checkin.id);
    if (error) console.warn('[alice/daily] journal draft was not cleared', error.message);
    return;
  }

  const user = (await client.auth.getUser()).data.user;
  if (!user) return;
  const { error } = await client.from('journal_entries').upsert(
    {
      account_id: user.id,
      cycle_id: daily.cycle.id,
      checkin_id: daily.checkin.id,
      local_date: daily.checkin.local_date,
      body,
    },
    { onConflict: 'checkin_id' },
  );
  if (error) console.warn('[alice/daily] journal draft was not synced', error.message);
}

function hasSupabaseConfig() {
  const config = getPublicConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function readDraftAnswers(raw: Record<string, AnswerValue>, daily: DailyStartResponse) {
  const allowed = new Set(daily.questions.map((question) => question.question_id));
  const next: Record<number, AnswerValue> = {};
  for (const [questionId, value] of Object.entries(raw)) {
    const id = Number(questionId);
    if (allowed.has(id) && Number.isInteger(value) && value >= 1 && value <= 7) next[id] = value;
  }
  return next;
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.sm },
  backButton: { alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingRight: spacing.lg },
  backText: { color: palette.brand, fontSize: 15, fontWeight: '700' },
  demoBadge: { alignSelf: 'flex-start', borderRadius: radius.pill, backgroundColor: palette.selected, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  demoBadgeText: { color: palette.brand, fontSize: 11, fontWeight: '800' },
  progress: { flexDirection: 'row', gap: spacing.sm },
  progressSegment: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: palette.border },
  progressActive: { backgroundColor: palette.brand },
  step: { marginBottom: spacing.sm, color: palette.brand, fontSize: 12, fontWeight: '800' },
  title: { color: palette.navy, fontSize: 28, fontWeight: '800' },
  journalSubtitle: { marginTop: spacing.sm, color: palette.textSoft, fontSize: 13, lineHeight: 20 },
  moodList: { flexDirection: 'row', gap: spacing.sm },
  moodOption: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
  },
  moodOptionSelected: { borderColor: palette.brand, backgroundColor: palette.selected },
  moodIconScale: { transform: [{ scale: 1.25 }] },
  questionList: { gap: spacing.lg },
  questionCard: { gap: spacing.xxl, paddingVertical: spacing.xl },
  questionText: { color: palette.navy, fontSize: 20, fontWeight: '800', lineHeight: 31, textAlign: 'center' },
  questionActions: { marginTop: 'auto' },
  journalBlock: { gap: spacing.md },
  journalInput: {
    minHeight: 220,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.lg,
    backgroundColor: palette.white,
    padding: spacing.lg,
    color: palette.navy,
    fontSize: 16,
    lineHeight: 25,
  },
  characterCount: { color: palette.muted, fontSize: 10, textAlign: 'right' },
  errorBox: { borderRadius: radius.md, backgroundColor: '#FFF1F3', padding: spacing.md },
  errorText: { color: palette.danger, fontSize: 12, lineHeight: 18 },
  completeBlock: { flex: 1, alignItems: 'center', gap: spacing.xxl, paddingTop: 48 },
  completeIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: palette.selected },
  completeCheck: { color: palette.brand, fontSize: 30, fontWeight: '800', lineHeight: 36 },
  completeCopy: { alignItems: 'center', gap: spacing.sm },
  completeTitle: { color: palette.navy, fontSize: 24, fontWeight: '800', lineHeight: 34, textAlign: 'center' },
  completeBody: { color: palette.textSoft, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  completeSummary: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, paddingVertical: spacing.lg },
  completeSummaryLabel: { color: palette.textSoft, fontSize: 13, fontWeight: '700' },
  completeSummaryValue: { color: palette.brand, fontSize: 18, fontWeight: '800' },
  completeAction: { width: '100%' },
});
