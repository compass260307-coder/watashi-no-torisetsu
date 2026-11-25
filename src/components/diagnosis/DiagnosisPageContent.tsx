"use client";

import { isMotionReduced } from "@/lib/a11y-style";
import { DiagnosisHero } from "@/components/diagnosis/DiagnosisHero";
import { DiagnosisProgressBar } from "@/components/diagnosis/DiagnosisProgressBar";
import { DiagnosisShareBand } from "@/components/diagnosis/DiagnosisShareBand";
import { QuestionCard } from "@/components/diagnosis/QuestionCard";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { InAppBrowserModal } from "@/components/InAppBrowserModal";
import { hideAnalyzingVeil, showAnalyzingVeil } from "@/lib/analyzing-veil";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
import {
  type DiagnosisCopy,
  type DiagnosisLocaleSettings,
} from "@/i18n/diagnosis";
import { resolveAcquisitionForSave } from "@/lib/acquisition";
import { hashEmailSha256, readAdAttribution } from "@/lib/ad-attribution";
import { preloadResultImage } from "@/lib/result-image-preload";
import { prefetchFullAccessQuote } from "@/lib/use-full-access-quote";
import { preloadLocalizedPurchaseCopy } from "@/i18n/ui/purchase-copy-loader";
import type { PrefetchOptions } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { diagnose } from "@/lib/diagnosis";
import {
  LEGACY_QUESTION_SET_ID,
  QUESTION_SET_QUERY_KEY,
  type QuestionSetId,
} from "@/lib/question-sets";
import {
  clearPendingSourceCode,
  readPendingSourceCode,
  savePendingSourceCode,
} from "@/lib/me-attention";
import { isPreviewMode, track } from "@/lib/track";
import type { AnswerValue } from "@/lib/types";
import { markXDiagnosisSaved } from "@/lib/xPixel";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// feat/top-page: 診断ページをトップページのデザイン言語 (白 / ネイビー / Sora ブルー /
// Noto Sans) に統一。CTA も共通の sunYellow ではなくトップの sora-cta ピルを使う。
// 質問文・回答ロジック・自動送り・途中保存・計測は一切変更しない (見た目のみ)。
const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";

const soraPrimary =
  "sora-cta rounded-full px-10 py-4 min-w-[180px] font-bold text-center block transition-all duration-150 hover:translate-y-px active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed";

const QUESTIONS_PER_PAGE = 10;
const TOTAL_PAGES = 5;
const TOTAL_QUESTIONS = QUESTIONS_PER_PAGE * TOTAL_PAGES;

// localStorage 保存フォーマット (回答 + 現在ページ + バージョン)。
type SavedProgress = {
  v: string;
  answers: Record<number, AnswerValue>;
  page: number;
};
// Phase 1.5-α Day 12-Polish-B: ニックネームの localStorage 保存先 (再訪時の自動入力)
const NICKNAME_MAX = 20;
// 質問ごとに「選んだ値」と「回答時間」を計測するか。false にすれば従来どおり到達だけを送る。
const ANSWER_VALUE_TRACKING_ENABLED = true;
const ANSWER_MS_MAX = 600_000;

/** 直前の基準時刻からの経過ミリ秒を返し、基準時刻を今に進める。回答時 (イベントハンドラ) 専用。 */
function takeAnswerMs(lastAtRef: { current: number | null }): number | null {
  const now = performance.now();
  const last = lastAtRef.current;
  lastAtRef.current = now;
  if (last === null) return null;
  return Math.min(Math.max(Math.round(now - last), 0), ANSWER_MS_MAX);
}
const DEFAULT_MIN_LOADING_MS = 20000;
const DIAGNOSIS_COMPLETE_DATA_LAYER_STORAGE_PREFIX =
  "wt_diagnosis_complete_sent_v1:";

type DiagnosisCompleteDataLayerEvent = {
  event: "diagnosis_complete";
  diagnosis_id?: string;
  // TikTok広告CV計測 (Spark Ads): 着地時に保存した広告クリックIDと、
  // SHA-256ハッシュ済みメール (生値は乗せない)。無ければキー自体を省略。
  ttclid?: string;
  email_sha256?: string;
};

type WindowWithDiagnosisDataLayer = Window & {
  dataLayer?: DiagnosisCompleteDataLayerEvent[];
};

const diagnosisCompleteSentInMemory = new Set<string>();

function diagnosisCompleteStorageKey(dedupeId: string): string {
  return `${DIAGNOSIS_COMPLETE_DATA_LAYER_STORAGE_PREFIX}${dedupeId}`;
}

function wasDiagnosisCompleteDataLayerSent(key: string): boolean {
  if (diagnosisCompleteSentInMemory.has(key)) return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function rememberDiagnosisCompleteDataLayerSent(key: string): void {
  diagnosisCompleteSentInMemory.add(key);
  try {
    localStorage.setItem(key, "1");
  } catch {
    // In-memory dedupe still prevents double push during the current page lifetime.
  }
}

async function pushDiagnosisCompleteDataLayer({
  dedupeId,
  diagnosisId,
  email,
}: {
  dedupeId: string;
  diagnosisId?: string;
  // 本人セッションのメール (再診断ユーザーのみ /api/diagnosis が返す)。
  // SHA-256 化してから dataLayer に乗せる。生値はここ止まり。
  email?: string | null;
}): Promise<void> {
  const key = diagnosisCompleteStorageKey(dedupeId);
  if (wasDiagnosisCompleteDataLayerSent(key)) return;

  try {
    const target = window as WindowWithDiagnosisDataLayer;
    target.dataLayer = target.dataLayer ?? [];

    // React Strict Mode や二重クリックの再入でも重複 push しないよう、
    // dataLayer より先に送信済みフラグを立てる。
    rememberDiagnosisCompleteDataLayerSent(key);

    // TikTok広告CV計測: 着地時 (app/layout.tsx) に保存した ttclid と、
    // ハッシュ化メールを Lead イベントの突合キーとして添付する。
    const { ttclid } = readAdAttribution();
    const emailSha256 = email ? await hashEmailSha256(email) : null;

    const payload: DiagnosisCompleteDataLayerEvent = {
      event: "diagnosis_complete",
      ...(diagnosisId ? { diagnosis_id: diagnosisId } : {}),
      ...(ttclid ? { ttclid } : {}),
      ...(emailSha256 ? { email_sha256: emailSha256 } : {}),
    };
    if (process.env.NODE_ENV !== "production") {
      console.log("[diagnosis_complete] dataLayer.push", payload);
    }
    target.dataLayer.push(payload);
  } catch {
    // GTM 側の失敗で診断完了 UX を止めない。
  }
}

// prefers-reduced-motion 尊重: 有効時はスムーズスクロールを無効化 (auto = 瞬間)。
// サイト内の「動きを抑える」(アクセシビリティスタイル) も同じ扱いにする。
function prefersReducedMotion(): boolean {
  return isMotionReduced();
}

// 確認用の質問セット上書き (?qset=v1 / ?qset=v2)。
// useSearchParams は静的ページ全体をクライアント描画に落とすため使わない。
// サーバーと初回ハイドレーションは null (= 既定セット) で描画し、その直後に URL の値で
// 描き直す (上書き時だけ、既定セットが一瞬見えてから切り替わる)。
// URL はページ表示中に変わらない前提なので購読は不要。
const subscribeNothing = () => () => {};
const readQuestionSetParam = () =>
  new URLSearchParams(window.location.search).get(QUESTION_SET_QUERY_KEY);
const readQuestionSetParamOnServer = () => null;

export default function DiagnosisPageContent({
  settings, header, footer, consentNotice,
}: {
  settings: DiagnosisLocaleSettings;
  header: ReactNode;
  footer: ReactNode;
  consentNotice?: ReactNode;
}) {
  const router = useRouter();
  const locale = settings.locale;
  // ?qset で指定され、かつこの言語に用意されているセットだけを採用する。それ以外は既定。
  const requestedQuestionSet = useSyncExternalStore(
    subscribeNothing,
    readQuestionSetParam,
    readQuestionSetParamOnServer,
  );
  const overrideQuestions = requestedQuestionSet
    ? settings.questionSet?.sets[requestedQuestionSet as QuestionSetId]
    : undefined;
  const questionSetId: QuestionSetId = overrideQuestions
    ? (requestedQuestionSet as QuestionSetId)
    : (settings.questionSet?.id ?? LEGACY_QUESTION_SET_ID);
  const activeQuestions = overrideQuestions ?? settings.questions;
  // API と計測イベントへ送るセット id。セットを切り替えられない言語では undefined にして、
  // 従来の送信内容を変えない (undefined のキーは JSON 化で落ちる)。
  const trackedQuestionSet = settings.questionSet ? questionSetId : undefined;
  const copy = settings.copy;
  const isKorean = locale === "ko";
  const isEnglish = locale === "en";
  const isIndonesian = locale === "id";
  // 質問セットのバージョン。言語別保存キーと組み合わせ、日本語回答と混ざらないようにする。
  // 従来セットは従来の値のまま (保存済みの途中回答を無効にしない)。
  const questionSetVersion = questionSetId === LEGACY_QUESTION_SET_ID
    ? `q${activeQuestions.length}-1`
    : `q${activeQuestions.length}-${questionSetId}`;
  const [campaign, setCampaign] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  // ニックネームは 16P 同様、最終ページ (page 4) の質問の後・「結果を見る」の直前で取得する。
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  // 送信時に未入力なら、この入力欄へスクロール/フォーカスするための参照。
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  // ジェンダーは任意 (16P 参考)。未選択 = null のまま送信できる。
  // DB 保存は users にカラムが無いため未対応 (選択は localStorage に保持し、API へは送る)。
  const [gender, setGender] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(0); // 0-indexed (0..4)
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  // 途中保存の再開候補 (null = 保存なし / すでに選択済み)。選択UI表示中だけ非 null。
  const [pendingResume, setPendingResume] = useState<{
    answers: Record<number, AnswerValue>;
    page: number;
  } | null>(null);
  // D-4: 再診断確認モーダル
  const [showRediagnoseModal, setShowRediagnoseModal] = useState(false);

  const trackedStart = useRef(false);
  // 直前の回答 (ページの先頭の質問ではページ表示) の時刻。質問ごとの回答時間の計測用。
  const lastAnswerAtRef = useRef<number | null>(null);
  // 各質問要素への参照 (回答時の次質問オートスクロール用)。キー = question.id。
  const questionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // localStorage 復元 (初回マウント時のみ; SSR 後のハイドレーション正規パターン)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // useSearchParams による静的ページ全体のクライアント描画化を避けるため、
    // 計測用クエリだけをマウント後に取得する。回答完了時の API 送信値は従来と同じ。
    const params = new URLSearchParams(window.location.search);
    const campaignParam = params.get("campaign");
    const sourceParam = params.get("source");
    setCampaign(campaignParam);
    setSource(sourceParam);
    // バイラル帰属の invite_code は URL 一発だと 50問の中断→素の /diagnosis 復帰で
    // 失われるため、localStorage にも保存して完了時のフォールバックにする。
    // "line" は LINE 流入マーカー (D-4) で invite_code ではないため保存しない。
    if (sourceParam && sourceParam !== "line") {
      savePendingSourceCode(sourceParam);
    }

    try {
      // 日本語版・英語版は、サーバー側の診断状態と端末保存の食い違いを
      // 避けるため途中回答を永続化しない。旧データも再開候補に使わない。
      if (!settings.persistProgress) {
        localStorage.removeItem(settings.progressStorageKey);
      } else {
        const saved = localStorage.getItem(settings.progressStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<SavedProgress>;
          // #4 バージョン整合: 旧フォーマット / 構成不一致は破棄して最初から
          if (!parsed || parsed.v !== questionSetVersion) {
            localStorage.removeItem(settings.progressStorageKey);
          } else {
            // 不正な保存値は弾く
            const valid: Record<number, AnswerValue> = {};
            for (const [k, v] of Object.entries(parsed.answers ?? {})) {
              const id = Number(k);
              if (
                Number.isInteger(id) &&
                id >= 1 &&
                id <= TOTAL_QUESTIONS &&
                typeof v === "number" &&
                v >= 1 &&
                v <= 7
              ) {
                valid[id] = v as AnswerValue;
              }
            }
            if (Object.keys(valid).length > 0) {
              // 再開ページ: 保存ページが有効ならそれ、無効なら最初の未回答ページ
              let page = parsed.page;
              if (
                typeof page !== "number" ||
                !Number.isInteger(page) ||
                page < 0 ||
                page > TOTAL_PAGES - 1
              ) {
                const firstUnanswered = activeQuestions.find(
                  (q) => valid[q.id] === undefined,
                );
                page = firstUnanswered
                  ? Math.floor((firstUnanswered.id - 1) / QUESTIONS_PER_PAGE)
                  : TOTAL_PAGES - 1;
              }
              // #2 自動復元はせず、選択UI (続きから / 最初から) を出すため候補だけ保持
              setPendingResume({ answers: valid, page });
            } else {
              localStorage.removeItem(settings.progressStorageKey);
            }
          }
        }
      }
    } catch {
      // 破損データは無視 (通常どおり最初から)
    }
    // Phase 3-β D-4: ?source=line + 過去診断結果 (torisetsu_result) があれば再診断確認モーダル表示
    if (sourceParam === "line") {
      try {
        const previousResult = localStorage.getItem(settings.resultStorageKey);
        if (previousResult) setShowRediagnoseModal(true);
      } catch {
        // localStorage 不可なら表示しない (新規扱い)
      }
    }
    // Day 12-Polish-B: 既保存のニックネームを input にプリフィル (再訪時の自動入力)
    try {
      const savedNick = localStorage.getItem(settings.nicknameStorageKey);
      if (savedNick) setNickname(savedNick.slice(0, NICKNAME_MAX));
    } catch {
      // 無視
    }
    // ジェンダーの前回選択もプリフィル (任意項目)
    try {
      const savedGender = localStorage.getItem(settings.genderStorageKey);
      if (savedGender) setGender(savedGender);
    } catch {
      // 無視
    }
    setHydrated(true);
  }, [activeQuestions, questionSetVersion, settings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // #1 自動保存: 回答 or ページ変更のたびに、回答内容 + 現在ページ + バージョンを保存
  useEffect(() => {
    if (!settings.persistProgress) return;
    if (!hydrated) return;
    if (Object.keys(answers).length === 0) return;
    try {
      const payload: SavedProgress = {
        v: questionSetVersion,
        answers,
        page: currentPage,
      };
      localStorage.setItem(settings.progressStorageKey, JSON.stringify(payload));
    } catch {
      // quota など失敗してもクリティカルではない
    }
  }, [
    answers,
    currentPage,
    hydrated,
    questionSetVersion,
    settings.persistProgress,
    settings.progressStorageKey,
  ]);

  // ページ送り / 質問ステップ突入時: 先頭 (一番上の質問) へスクロールを戻す。
  // クリックハンドラ内の同期 scrollTo は再レンダー前に走り効かないことがあるため、
  // コミット後の effect で実行する。ページ切替は文脈が変わるので auto (瞬間移動)。
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
    // ページの先頭の質問は、ページが表示されてからの時間を回答時間とする。
    lastAnswerAtRef.current = performance.now();
  }, [currentPage, hydrated]);

  // 「結果を見る」は最終ページの最下部にあるため、解析待ち画面へ差し替わった直後は
  // スクロール位置が下に残る (モバイルは 100vh > 表示領域なので下端に寄って見える)。
  // 差し替えのコミット後に先頭へ戻す。
  useEffect(() => {
    if (!submitting) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [submitting]);

  // 送信失敗でローディングから質問ページへ戻ったとき、最下部のエラー文と
  // 再送信 CTA が視界に入るようスクロールする (回答は保持されている)。
  useEffect(() => {
    if (!submitError) return;
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "auto",
    });
  }, [submitError]);

  // 起動 track。ref だけだと再マウント (ページ再訪・再診断モーダル表示等) のたびに
  // 発火して分母が膨らむため、セッション (タブ) 単位で1回に dedup する (2026-07-13)。
  useEffect(() => {
    if (trackedStart.current) return;
    trackedStart.current = true;
    try {
      if (sessionStorage.getItem(settings.startedStorageKey) === "1") return;
      sessionStorage.setItem(settings.startedStorageKey, "1");
    } catch {
      // sessionStorage 不可でも計測は続行 (dedup なし)
    }
    // 開始時点の URL から直接読む (初回描画では ?qset の上書きがまだ反映されていないため)。
    const startedParam = readQuestionSetParam();
    const startedQuestionSet = settings.questionSet
      ? startedParam && startedParam in settings.questionSet.sets
        ? startedParam
        : settings.questionSet.id
      : undefined;
    track("diagnosis_started", {
      metadata: { locale, questionSet: startedQuestionSet },
    });
  }, [locale, settings.questionSet, settings.startedStorageKey]);

  const pageQuestions = activeQuestions.slice(
    currentPage * QUESTIONS_PER_PAGE,
    (currentPage + 1) * QUESTIONS_PER_PAGE,
  );
  const isPageComplete = pageQuestions.every(
    (q) => answers[q.id] !== undefined,
  );
  const isAllComplete = activeQuestions.every(
    (q) => answers[q.id] !== undefined,
  );
  const answeredCount = Object.keys(answers).length;
  const isLastPage = currentPage === TOTAL_PAGES - 1;
  // ニックネームは必須。最終ページの「結果を見る」は全問回答 + ニックネーム入力で活性化。
  const hasNickname = nickname.trim().length > 0;
  const canAdvance = isPageComplete;

  // ニックネーム必須ゲート: 最終ページの送信 (handleSubmit) の前に呼ぶ。
  // 未入力/超過なら error を出し入力欄へスクロール&フォーカスして false を返す。
  // OK なら localStorage に保存して true を返す。
  const ensureNickname = (): boolean => {
    const trimmed = nickname.trim();
    if (trimmed.length === 0) {
      setNicknameError(copy.nicknameEmptyError);
      nicknameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      nicknameInputRef.current?.focus({ preventScroll: true });
      return false;
    }
    if (trimmed.length > NICKNAME_MAX) {
      setNicknameError(copy.nicknameTooLongError(NICKNAME_MAX));
      return false;
    }
    setNicknameError(null);
    try {
      localStorage.setItem(settings.nicknameStorageKey, trimmed);
    } catch {
      // localStorage 不可でも進める
    }
    return true;
  };

  // ジェンダー選択 (任意): 選択のたびに localStorage へ保存 (再訪時のプリフィル用)
  const handleGenderSelect = (value: string) => {
    setGender(value);
    try {
      localStorage.setItem(settings.genderStorageKey, value);
    } catch {
      // 無視
    }
  };

  // #2 「続きから」: 保存した回答と進捗を復元し、質問ステップへ
  const handleResumeContinue = () => {
    if (!pendingResume) return;
    setAnswers(pendingResume.answers);
    setCurrentPage(pendingResume.page);
    setPendingResume(null);
    // 先頭へのスクロールは currentPage 変化を見る useEffect に集約。
  };

  // #2 「最初から」: 保存を削除して新規スタート (basic-info のまま)
  const handleResumeFresh = () => {
    try {
      localStorage.removeItem(settings.progressStorageKey);
    } catch {
      // 無視
    }
    setPendingResume(null);
  };

  const handleAnswer = (questionId: number, value: AnswerValue) => {
    // 到達計測は「その質問に初めて答えたとき」のみ (2026-07-13)。
    // 同値の再タップ・選び直しでも発火すると diagQuestionReach が水増しされ、
    // 離脱ポイント分析 (到達曲線) が歪むため。
    const isFirstAnswer = answers[questionId] === undefined;
    setAnswers((prev) => {
      if (prev[questionId] === value) return prev;
      return { ...prev, [questionId]: value }; // 別の選択肢なら上書き (選び直し可)
    });
    if (isFirstAnswer) {
      // 質問ごとの偏り・答えにくさを見るため、選んだ値と回答時間も送る (2026-11-21)。
      //   answer:   最初に選んだ値 (1〜7)。選び直しは送らない。
      //   answerMs: 直前の回答 (ページの先頭の質問ではページ表示) からのミリ秒。
      //             離席で極端に長くなるので、集計は中央値で見る。上限 10 分。
      // イベントの行数は増えない (既存の 1 回答 = 1 行に項目を足すだけ)。
      // やめるときは ANSWER_VALUE_TRACKING_ENABLED を false にする。
      const answerMs = takeAnswerMs(lastAnswerAtRef);
      track("diagnosis_question_answered", {
        metadata: ANSWER_VALUE_TRACKING_ENABLED
          ? {
              questionId,
              locale,
              questionSet: trackedQuestionSet,
              answer: value,
              answerMs,
            }
          : { questionId, locale, questionSet: trackedQuestionSet },
      });
    }

    // ページ送りは自動ではなく、質問の下の「次へ」CTA で明示的に行う (handleNext)。
    // ここでは同一ページ内の「次の質問」へのオートスクロールだけを担う。

    // === 自動送り: 「次の質問が未回答のときだけ」その質問へ進む ===
    // 判定基準は「初回かどうか」ではなく「進む先 (= 次の質問) が未回答か」。
    //  - 通常進行 (次が未回答) → 次の質問へオートスクロール。
    //  - 戻って答え直し等で次がすでに回答済み → 進まず留まる (答え済みの先へ飛ばさない)。
    const idx = pageQuestions.findIndex((q) => q.id === questionId);
    if (idx === -1) return;
    const target = pageQuestions[idx + 1]; // 同ページ内の「次の質問」
    if (!target) return; // ページ最後 (未完了 = どこかに未回答が残っている) → 留まる
    if (answers[target.id] !== undefined) return; // 次が回答済み → 留まる
    const el = questionRefs.current[target.id];
    if (!el) return;
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    // クリックのレンダリング後に実行 (1 フレーム遅延)。
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior, block: "center" });
      // a11y: フォーカスも次の質問へ移し、スクロール後の迷子を防ぐ
      // (スクロールは上で実施済みなので preventScroll で二重スクロールを避ける)。
      el.focus({ preventScroll: true });
    });
  };

  const handleNext = () => {
    if (!isPageComplete || isLastPage) return;
    setCurrentPage((p) => p + 1);
    // 先頭へのスクロールは currentPage 変化を見る useEffect に集約。
  };

  // 進捗バーの「前のページ」: 前ページへ戻す。page 0 (先頭) はトップへ抜ける。
  const handlePrev = () => {
    if (currentPage === 0) {
      router.push(settings.homePath);
      return;
    }
    setCurrentPage((p) => Math.max(0, p - 1));
    // 先頭へのスクロールは currentPage 変化を見る useEffect に集約。
  };

  const analyzingLoader = (
    <DiagnosisAnalyzingLoader
      messages={copy.analyzing.messages}
      steps={copy.analyzing.steps}
      messageDurationsMs={copy.analyzing.messageDurationsMs}
      totalMs={copy.analyzing.minLoadingMs}
      slides={copy.analyzing.slides}
      slideDurationsMs={copy.analyzing.slideDurationsMs}
      slidesLabel={copy.analyzing.slidesLabel}
      fontFamily={isKorean || isEnglish || isIndonesian ? "inherit" : undefined}
    />
  );
  // 解析待ち画面を「ページ移動をまたいで残る層」に出すか。日本語版だけ
  // (他の言語は文字の書体をページ側から受け継いでいるため、これまでどおりページ内に出す)。
  const veilsResult = locale === "ja";

  const handleSubmit = async () => {
    if (!isAllComplete || submitting) return;
    // ニックネーム必須 + localStorage 保存 (未入力なら入力欄へスクロールして中断)
    if (!ensureNickname()) return;
    setSubmitError(false);
    setSubmitting(true);
    // 日本語版は、解析待ち画面をページ移動をまたいで残る層に出す。結果ページへ移動したあと、
    // 層がふわっと消えて結果ページへつながる (AnalyzingVeilHost)。
    if (veilsResult) showAnalyzingVeil(analyzingLoader);

    const result = diagnose(answers, activeQuestions);
    // Speculation runs alongside the existing 20-second minimum. Never await it
    // or let a download failure affect saving, tracking, or result navigation.
    // Full route prefetch below warms the eager purchase UI too. Importing it
    // separately creates a duplicate bundle in the installed bundler.
    if (locale !== "ja") void preloadLocalizedPurchaseCopy(locale).catch(() => {});
    try { preloadResultImage(result.scores); } catch { /* Optional image warmup never blocks the result. */ }
    try {
      localStorage.setItem(settings.resultStorageKey, JSON.stringify(result));
    } catch {
      // 無視
    }
    const startedAt = Date.now();
    const waitMin = async () => {
      const minLoadingMs =
        copy.analyzing.minLoadingMs ?? DEFAULT_MIN_LOADING_MS;
      const remaining = minLoadingMs - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    };

    const clearProgress = () => {
      try {
        localStorage.removeItem(settings.progressStorageKey);
      } catch {
        // 無視
      }
    };

    if (isPreviewMode()) {
      try {
        localStorage.setItem("torisetsu_invite_code", "preview");
      } catch {
        // 無視
      }
      try { router.prefetch(settings.resultPath, { kind: "full" as PrefetchOptions["kind"] }); } catch { /* Optional warmup. */ }
      await waitMin();
      clearProgress();
      router.push(settings.resultPath);
      return;
    }

    // Day 12-C3: 流入元 (媒体/キャンペーン)。URL → first-touch (wt_acq_*) →
    // 広告クリック last-touch (wt_ad_utm_*) の順にフォールバック解決する。
    // 新規ユーザー作成時のみ users に書かれる (API 側で creation 分岐のみ採用)。
    const acq = resolveAcquisitionForSave(window.location.search);

    // バイラル帰属: URL の ?source= が最優先。無ければ評価送信後ページ等で
    // 保存した invite_code (下部ナビ赤バッジ経由・中断復帰はこちらに落ちる)。
    const sourceInviteCode = source || readPendingSourceCode();

    try {
      const res = await fetch("/api/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // API側で診断結果を再計算し、typeId / scores の改ざんを防ぐための原回答。
          answers,
          // 回答がどの質問セットのものか。API はこの id のセットで採点する。
          questionSet: trackedQuestionSet,
          // v2 の版 (日本語版だけ)。向きを変えた質問を、いま出している文の向きで採点してもらう。
          questionSetRevision: settings.questionSet?.revision,
          typeId: result.typeId,
          scores: result.scores,
          facetScores: result.facetScores,
          fullCode: result.fullCode,
          cModifier: result.cModifier,
          nModifier: result.nModifier,
          modifierLabel: result.modifierLabel,
          campaign: campaign || undefined,
          sourceInviteCode: sourceInviteCode || undefined,
          // Day 12-Polish-B: 基本情報ステップで取得したニックネーム
          displayName: nickname.trim() || undefined,
          // 任意のジェンダー (male/female/other)。API 側は未対応のため現状は無視される
          // (users にカラム追加後に保存を接続する)。
          gender: gender || undefined,
          // Day 12-C3: SNS媒体別＋キャンペーン別の流入元 (first-touch)
          acquisitionSource: acq.source || undefined,
          acquisitionCampaign: acq.campaign || undefined,
          acquisitionMedium: acq.medium || undefined,
          // 韓国版のイベント/保存導線を識別。DBの専用locale列は移行適用後に接続する。
          locale,
        }),
      });
      const data = await res.json();
      if (data.inviteCode) {
        localStorage.setItem("torisetsu_invite_code", data.inviteCode);
      }
      if (data.ownerToken) {
        if (res.ok && typeof data.userId === "string") {
          markXDiagnosisSaved(data.userId, locale);
        }
        // 保存APIが成功してからだけ完了イベントを送る。KPIの正本は
        // users.diagnosis_completed_at だが、イベントファネルも偽陽性にしない。
        track("diagnosis_completed", {
          ownerToken: data.ownerToken,
          metadata: {
            userId: data.userId,
            typeId: result.typeId,
            locale,
            sourceInviteCode: sourceInviteCode || null,
            questionSet: trackedQuestionSet,
          },
        });
        await pushDiagnosisCompleteDataLayer({
          // ownerToken は診断ごとに新規発行されるため、同じ診断の重複防止にだけ使う。
          // 結果閲覧権限を持つ秘密トークンなので dataLayer には送らない。
          dedupeId: data.ownerToken,
          email: data.email ?? null,
        });
        localStorage.setItem("torisetsu_owner_token", data.ownerToken);
        // 完全版価格の先読み。解析待ちの残り時間で市場判定(IP由来)を済ませ、
        // 結果ページ到着時から課金カード・モーダルに価格を表示する。
        // 失敗しても結果ページ側の通常取得にフォールバックする。
        prefetchFullAccessQuote(locale, data.ownerToken);
        // 帰属を使い切ったら消す (次回以降の無関係な診断を親に紐づけない)。
        clearPendingSourceCode();
        // 友達診断の赤バッジはここでは出さない。/me 側 (TakoAttentionOnResult) が
        // 初回表示時に全員へ付与する (2026-08-03 変更。旧: 課金完了後のみ)。
        const resultPath = (
          isKorean
            ? `/ko/me/${encodeURIComponent(data.ownerToken)}`
            : isEnglish
              ? `/en/me/${encodeURIComponent(data.ownerToken)}`
              : isIndonesian
                ? `/id/me/${encodeURIComponent(data.ownerToken)}`
                : locale === "ja"
                  ? `/me/${encodeURIComponent(data.ownerToken)}`
                  : `/result/${data.ownerToken}`
        );
        // Full prefetch includes this dynamic route's RSC, client JS and CSS.
        // The option is verified against the installed Next.js 16.2.6 router.
        try { router.prefetch(resultPath, { kind: "full" as PrefetchOptions["kind"] }); } catch { /* Optional warmup. */ }
        await waitMin();
        clearProgress();
        router.push(resultPath);
        return;
      }
    } catch {
      // 送信失敗 (ネットワークエラー・非JSONレスポンス等) では途中保存を消さない。
      // 進捗を残したまま質問ページに戻し、エラー表示 + 同じボタンで再送信できるようにする。
      hideAnalyzingVeil();
      setSubmitting(false);
      setSubmitError(true);
      return;
    }

    // ownerToken が返らない = API 側のエラーレスポンス。catch と同様に回答を保持する。
    hideAnalyzingVeil();
    setSubmitting(false);
    setSubmitError(true);
  };

  if (submitting) {
    // 層に出しているあいだ、このページ自体は同じ地色の空の画面にしておく。
    return veilsResult ? (
      <div className="min-h-screen flex-1 bg-[#FCFCFC]" aria-busy="true" />
    ) : (
      analyzingLoader
    );
  }

  // Phase 3-β D-4: 再診断確認モーダル
  const closeRediagnoseModal = () => setShowRediagnoseModal(false);
  const cancelRediagnose = () => {
    // キャンセル時はマイ図鑑へ戻る (Web ファースト: Cookie ベースで直接アクセス可)
    router.push(settings.homePath);
  };

  // Polish-D-A FINAL: 標準 CTA は components/StickyCtaFooter.tsx の
  //   ctaPrimary / ctaSecondary を import して使用する (ローカル定義は廃止)。
  //   disabled は CSS で opacity:50 + cursor-not-allowed のみ、形・枠は維持。

  // Phase 1.5-α Day 12-Polish-B: 基本情報ステップ (50 問の前にニックネームを取得)
  // 「最初の質問」として位置づける UX (ステップではなく Q0 相当)
  // 16P 方式: 前進は自動ページ送りが担い、「戻る」ボタンは置かない
  // (16P 同様、迷わず前へ進む一方通行の体験にする)。

  return (
    <>
    {/* サイト共通ヘッダー (16P 風スクロール連動) */}
    <ScrollHideHeader>
      {header}
    </ScrollHideHeader>
    <div
      // 下端はシェアバンドが受けるので pb は付けない (バンド〜フッター間の白帯を作らない)。
      className="flex flex-col flex-1 min-h-screen bg-white"
      style={{ fontFamily: isKorean || isEnglish || isIndonesian ? "inherit" : FONT_STACK }}
    >
      {/* SNS アプリ内ブラウザ (WebView) 対策: 検出時のみ Safari/Chrome 推奨モーダル */}
      <InAppBrowserModal copy={copy.inAppBrowser} />
      {showRediagnoseModal && (
        <RediagnoseConfirmModal
          onConfirm={closeRediagnoseModal}
          onCancel={cancelRediagnose}
          copy={copy.rediagnose}
        />
      )}
      {pendingResume && !showRediagnoseModal && (
        <ResumeChoiceModal
          answeredCount={Object.keys(pendingResume.answers).length}
          totalQuestions={TOTAL_QUESTIONS}
          onContinue={handleResumeContinue}
          onFresh={handleResumeFresh}
          copy={copy.resume}
        />
      )}
      {/* page 0 の最上部にだけ 16P 風ヒーロー (マスコット + 見出し)。 */}
      {currentPage === 0 && (
        <DiagnosisHero
          title={copy.heroTitle}
          subtitle={copy.heroSubtitle}
          imageAlt={copy.heroImageAlt}
          steps={copy.heroSteps}
        />
      )}
      {/* 最初のページ (page 0) には進捗バーを出さない (ヒーローに集中させる)。 */}
      {currentPage !== 0 && (
        <DiagnosisProgressBar
          currentQuestion={answeredCount}
          totalQuestions={TOTAL_QUESTIONS}
          onPrev={handlePrev}
          previousLabel={copy.previousPage}
          progressAriaLabel={copy.progressAriaLabel(
            answeredCount,
            TOTAL_QUESTIONS,
          )}
        />
      )}

      {/* 手順つきのヒーローを出す最初のページは、1 問目の回答の○を最初の画面に入れるため上の余白を取らない。 */}
      <main
        className={`flex flex-col flex-1 w-full pb-4 ${
          currentPage === 0 && copy.heroSteps ? "pt-0" : "pt-6"
        }`}
      >
        {pageQuestions.map((q) => (
          // ref + tabIndex(-1): 回答時に次の未回答質問へ scrollIntoView/focus するための受け皿。
          // 視覚は QuestionCard が担うので wrapper は無装飾 (outline は programmatic focus 用に消す)。
          <div
            key={q.id}
            ref={(el) => {
              questionRefs.current[q.id] = el;
            }}
            tabIndex={-1}
            className="outline-none"
          >
            <QuestionCard
              question={q}
              questionNumber={q.id}
              value={answers[q.id]}
              onChange={(v) => handleAnswer(q.id, v)}
              questionAriaLabel={copy.questionAriaLabel(q.id)}
              likertLeftLabel={copy.likertLeft}
              likertRightLabel={copy.likertRight}
              likertOptionLabels={copy.likertOptions}
            />
          </div>
        ))}

        {/* 16P 同様、最終ページの質問の後に基本情報カード (ニックネーム + 任意のジェンダー) を
            置き、カード内の「結果を見る」で送信する。左寄せの見出し + ヘルパー文の 16P の型。 */}
        {isLastPage && (
          <div className="mt-10 mx-auto w-full max-w-[1080px] px-4 md:px-8">
            <div className="rounded-2xl border border-[#2E2E5C]/10 bg-white p-6 shadow-[0_2px_10px_rgba(42,58,92,0.08)] md:p-8">
              {/* ニックネーム (必須) */}
              <label
                htmlFor="diagnosis-nickname"
                className="block text-[22px] font-bold text-[#2E2E5C]"
              >
                {copy.nicknameLabel}
              </label>
              <p className="mt-1.5 text-[17px] leading-relaxed text-[#8A8AA3]">
                {copy.nicknameHelper}
              </p>
              <div className="relative mt-3">
                {/* 入力欄内の人型アイコン (16P のメール欄の ✉ に相当する装飾) */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8A8AA3]"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5" />
                </svg>
                <input
                  ref={nicknameInputRef}
                  id="diagnosis-nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (nicknameError) setNicknameError(null);
                  }}
                  maxLength={NICKNAME_MAX}
                  placeholder=""
                  autoComplete="off"
                  className="w-full rounded-xl border border-[#2E2E5C]/25 bg-white py-3.5 pl-11 pr-4 text-[19px] font-bold text-[#2E2E5C] focus:outline-none focus:ring-2 focus:ring-[#5B5BEF] focus:border-[#5B5BEF] transition-colors"
                />
              </div>
              {nicknameError && (
                <p role="alert" className="mt-2 text-[15px] font-bold text-[#E86AA6]">
                  {nicknameError}
                </p>
              )}

              {/* ジェンダー (任意) */}
              <fieldset className="mt-8">
                <legend className="text-[22px] font-bold text-[#2E2E5C]">
                  {copy.genderLabel}
                </legend>
                <div className="mt-3 flex flex-col gap-1">
                  {copy.genderOptions.map((option) => (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 py-1.5"
                    >
                      <input
                        type="radio"
                        name="diagnosis-gender"
                        value={option.value}
                        checked={gender === option.value}
                        onChange={() => handleGenderSelect(option.value)}
                        className="h-6 w-6 accent-[#5B5BEF]"
                      />
                      <span className="text-lg text-[#2E2E5C]">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* 結果を見る: 16P 同様カード内に置く (SP は全幅 / PC は左寄せピル)。
                  全問回答 + ニックネーム入力で活性化。 */}
              <div className="mt-8 flex flex-col items-start gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isAllComplete || !hasNickname || submitting}
                  className={`${soraPrimary} w-full md:w-auto`}
                >
                  {submitting ? copy.submittingButton : copy.resultButton}
                </button>
                {/* 全問回答済みなのにニックネーム未入力なら、必須である旨を明示 */}
                {isPageComplete && !hasNickname && (
                  <p className="text-[15px] font-bold text-[#E86AA6]">
                    {copy.nicknameRequired}
                  </p>
                )}
                {submitError && (
                  <p className="text-[15px] font-bold text-[#E86AA6]">
                    {copy.submitError}
                  </p>
                )}
                {consentNotice}
              </div>
            </div>
          </div>
        )}

        {/* 質問の下の CTA: 押すと次ページへ (自動ページ送りは廃止)。ページ全問回答で活性化。
            最終ページの送信 CTA は上の基本情報カード内にある。 */}
        {!isLastPage && (
          <div className="mx-auto mt-10 flex w-full max-w-[1080px] flex-col items-center gap-2 px-4 md:px-8">
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvance}
              className={soraPrimary}
            >
              {copy.nextButton}
            </button>
          </div>
        )}
      </main>
      {/* フッター直上の 16P 風シェアバンド (実績数 + SNS ボタン) */}
      <div className="mt-10">
        <DiagnosisShareBand locale={locale} />
      </div>
    </div>
    {/* サイト共通フッター (直上のシェアバンドの波エッジが区切りになるため上端線は消す) */}
    {footer}
    </>
  );
}

// =========================================================================
// 途中保存の再開選択モーダル (前回の続きから / 最初から)
// 保存があるときだけ表示。続きから = 復元、最初から = 保存削除して新規。
// =========================================================================
function ResumeChoiceModal({
  answeredCount,
  totalQuestions,
  onContinue,
  onFresh,
  copy,
}: {
  answeredCount: number;
  totalQuestions: number;
  onContinue: () => void;
  onFresh: () => void;
  copy: DiagnosisCopy["resume"];
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-title"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-modal-slide-up">
        <h2
          id="resume-title"
          className="text-lg font-bold text-center text-[#2E2E5C] mb-3"
        >
          {copy.title}
        </h2>
        <p className="text-sm text-[#2E2E5C] leading-relaxed text-center mb-6">
          {copy.lead} (
          <span className="font-bold text-[#5B5BEF]">
            {answeredCount} / {totalQuestions} {copy.unit}
          </span>
          {copy.countSuffix}
          <br />
          {copy.tail}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="sora-cta w-full rounded-full px-6 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98]"
          >
            {copy.continueButton}
          </button>
          <button
            type="button"
            onClick={onFresh}
            className="text-xs text-[#8A8AA3] hover:text-[#2E2E5C] underline transition-colors"
          >
            {copy.freshButton}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Phase 3-β D-4: 再診断確認モーダル
// LINE 経由 (?source=line) + 過去診断結果 (localStorage.torisetsu_result) 存在時に
// 診断 50 問の前にだけ表示。OK で診断スタート、キャンセルでマイ図鑑に戻る。
// =========================================================================
function RediagnoseConfirmModal({
  onConfirm,
  onCancel,
  copy,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  copy: DiagnosisCopy["rediagnose"];
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rediagnose-title"
    >
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-modal-slide-up">
        <h2
          id="rediagnose-title"
          className="text-lg font-bold text-center text-[#2E2E5C] mb-3"
        >
          {copy.title}
        </h2>
        <p className="text-sm text-[#2E2E5C] leading-relaxed mb-2">
          {copy.lead}
          <span className="font-bold text-[#5B5BEF]">{copy.emphasis}</span>
          {copy.emphasisSuffix}
        </p>
        <p className="text-sm text-[#8A8AA3] leading-relaxed mb-6">
          {copy.tail}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="sora-cta w-full rounded-full px-6 py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98]"
          >
            {copy.confirmButton}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[#8A8AA3] hover:text-[#2E2E5C] underline transition-colors"
          >
            {copy.cancelButton}
          </button>
        </div>
      </div>
    </div>
  );
}
