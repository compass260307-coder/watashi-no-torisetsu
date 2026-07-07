// Phase 1.5-α Day 12-C1: 友達評価結果ページ (軸2 のメイン画面)
//
// 役割: 友達 (B) が A に対して 30 問の評価を完了した後、A (owner) が見るための画面。
// Day 12-Polish-E で相互理解度を完全無料化し、課金ゲートを撤去。
// Day 12 コンテンツ再設計で 7 セクション → 4 セクションに圧縮 (バイラル特化):
//   ヒーロー → ①◯◯さんから見たアナタ → ②ギャップ(TOP2フル+3圧縮) →
//   ③◯◯さんが見つけたアナタ(強み3+あれっ?3) → ④ふたりの関係 → ブーストCTA
//
// Server Component:
//   - perception (friend_perceptions) 取得
//   - target user (= A) 取得して自己 Big Five と displayName を確保
//   - session で isOwner 判定 (非 owner は /evaluate/sent へリダイレクト)
//   - 相互理解度 % + 5 次元ギャップを派生して描画
//
// 旧⑤「4つの特性」/ 旧⑦「友達視点の取扱説明書」はページから削除 (Day 12 再設計)。
// コンポーネント・生成ロジック・文章データは Stripe コード同様、後日の
// 「有料深掘りレポート」用に温存 (参照だけ外した):
//   - 章レイアウト: src/components/result/EvaluationChapters.tsx
//   - 4特性: src/lib/mutual-result-content.ts (FOUR_TRAITS / fourTraitBody)
//   - 取説B視点: src/lib/mutual-result-content.ts (getOwnerManual / MANUAL_BY_TYPE)
//   - 関係性アドバイス部品: src/lib/mutual-result-content.ts (adviceFor / honneFor)
//   - 強み/あれっ? の残り3つずつ: src/lib/mutual-result-content.ts (PERCEIVED_BY_TYPE)
//
// 課金ゲート撤去メモ:
//   - このページの unlock 分岐 (UnlockCard / UnlockConfirming / isPerceptionUnlocked) を撤去。
//   - 旧・解除カードの位置は PerceptionBoostCta (バイラル導線) に置き換え。
//   - Stripe インフラ (lib/perception-unlock, create-perception-unlock-session,
//     webhook/stripe, payment_history) は後の有料機能流用のため温存 (このページから参照しないだけ)。
//
// 触らない:
//   - friend_perceptions / users / payment_history のスキーマ
//   - Stripe 決済インフラ (API ルート / webhook / perception-unlock lib)
//   - /api/friend-answer/v2 (既に perceived_scores を保存している、Day 12-B 調査済)
//   - /me/[token] の本体構造 (Day 11.x 完成、本 PR では perceptions リンク追加のみ)
//   - LP / /diagnosis / /friend-evaluation の構造

import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import {
  classifySixteenType,
  sixteenTypes,
  characterImagePath,
} from "@/lib/sixteen-types";
import { ResultHero } from "@/components/result/ResultHero";
import { heroColorsForGroup } from "@/lib/hero-colors";
import { preferCutImage } from "@/lib/character-image";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { TrisetsuNameTag } from "@/components/result/TrisetsuNameTag";
import {
  perceivedManualContent,
  PERCEIVED_TIPS_KEY,
} from "@/lib/perception-manual-content";
import { PERCEPTION_BODY_TEXT_CLASS } from "@/components/result/body-text";
import { MutualUnderstandingRadar } from "@/components/result/MutualUnderstandingRadar";
import { PerceptionFoundProse } from "@/components/result/PerceptionFoundProse";
import { PerceptionMessageCard } from "@/components/result/PerceptionMessageCard";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  topGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { gapDetail, gapDir3 } from "@/lib/perception-gap-detail";
import {
  relationGapNote,
  relationGapTip,
  relationGapFact,
  relationGapTipKey,
} from "@/lib/perception-relation-content";
import { getPerceivedContent } from "@/lib/mutual-result-content";
import { weaveFound, seedFromTypeId } from "@/lib/perception-found-text";
// 32タイプ (フラグ on 時。解釈B=本文・型名・画像・essence を32化)
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import {
  classifyThirtyTwoType,
  perceivedManualFor,
  perceivedContentFor,
  perceivedTipsKeyFor,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoOneLiner,
  thirtyTwoGroup,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { PerceptionRankingTeaser } from "@/components/result/PerceptionRankingTeaser";
// 末尾CTA: 紫枠の PerceptionBoostCta (友達評価リンクのコピー + X/LINE シェア) は撤去し、
// 「相性ランキング風ぼかしティーザー」(PerceptionRankingTeaser) に格上げ。
// メインボタンはハブ (/friend-evaluation = QR + 相互理解度ランキング) へ遷移。
// 旧 PerceptionBoostCta は温存方針に従い残置 (再利用用)。

// 課金ゲート撤去 (相互理解度を完全無料化): このページの unlock 分岐を外し、全章を無条件表示。
// Stripe インフラ (lib/perception-unlock, /api/checkout/create-perception-unlock-session,
// /api/webhook/stripe, payment_history) は後の有料機能流用のため温存し、ここでは参照しない。

export const metadata: Metadata = {
  title: "友達評価の結果",
  // perception id は推測困難だが、誤共有時の漏洩経路を絞るため noindex
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ perceptionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// 本番DBを介さずデザイン確認するための行の最小形 (実DB行 / プレビュー用モック 共通)。
type PerceptionRow = {
  id: string;
  target_user_id: string;
  perceiver_name: string | null;
  perceived_type_id: string | null;
  perceived_full_code: string | null;
  perceived_modifier_label: string | null;
  perceived_scores: unknown;
  perceived_facet_scores: unknown;
  qualitative_data: unknown;
  created_at: string | null;
};
type EvalUserRow = {
  id: string;
  type_id: string | null;
  scores: unknown;
  display_name: string | null;
  owner_token: string | null;
  invite_code: string | null;
};

// Day 12 ③④改修: 名前の「…」切り捨て (shortenName) を全廃。
// 友達名は見出しでフル表示し、長い場合は折り返す。本文中には名前を出さない。

// 相互理解度スコアの一言ラベル (出し分け)。温かいトーン。
function mutualLabel(pct: number): string {
  if (pct >= 80) return "かなり息ぴったり。お互いをよく分かり合えてる。";
  if (pct >= 60) return "いい線いってる。だいたい伝わってる相手。";
  if (pct >= 40) return "半分くらい。まだ知らない一面もありそう。";
  return "ギャップ大きめ。意外な発見がたくさんあるかも。";
}

// 丸数字バッジ + 見出し (①〜④ 共通。新フローの番号は上から連番で振る)
function SectionHead({ num, title }: { num: number; title: string }) {
  // 丸数字は /me・/tako と同一 (白抜き・ネイビー太リング)。見出しは友達名込みで長くなり得るため
  // /me のヒーロー級 (30-36px) ではなく可読性優先で text-2xl 前後に留める (トーンは同一)。
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
      >
        {num}
      </span>
      <h2 className="text-[#2E2E5C] font-black text-2xl leading-tight">
        {title}
      </h2>
    </div>
  );
}

// 本文中の行動キーフレーズ 1 箇所だけを vividPink 太字にする (④ の強調用)。
// key が無い / 本文に含まれない場合はそのまま plain 表示 (フェイルセーフ)。
function pinkify(text: string, key?: string) {
  if (!key) return text;
  const idx = text.indexOf(key);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="text-[#5B5BEF] font-black">{key}</strong>
      {text.slice(idx + key.length)}
    </>
  );
}

export default async function EvaluationResultPage({
  params,
  searchParams,
}: PageProps) {
  const { perceptionId } = await params;
  const sp = await searchParams;
  // 相互理解度は完全無料 (課金ゲートなし。Stripe インフラは温存・ここでは参照しない)

  // ===== プレビュー (実DB/session を介さずモックでデザイン確認) =====
  // ?previewType=<32タイプID> 指定時、そのタイプの High/Low モックで描画 (実ユーザーデータ不参照)。
  // 許可条件は dev または /preview 経由 (fromPreview=1)。owner ゲートもスキップ。
  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  let perception: PerceptionRow | null;
  let user: EvalUserRow | null;

  if (previewType) {
    const code = sixteenTypes[baseIdOf(previewType)].code;
    const hi = (ax: string) => (code.includes(`${ax}＋`) ? 8 : 2);
    const clamp = (v: number) => Math.max(0, Math.min(10, v));
    const perceivedScores = {
      O: hi("O"),
      C: hi("C"),
      E: hi("E"),
      A: hi("A"),
      N: nAxisOf(previewType) === "N" ? 8 : 2,
    };
    // 自己スコアは少しずらしてギャップが見えるように。
    const selfMock = {
      O: clamp(perceivedScores.O - 3),
      C: perceivedScores.C,
      E: clamp(perceivedScores.E + 3),
      A: clamp(perceivedScores.A - 2),
      N: perceivedScores.N,
    };
    perception = {
      id: "preview",
      target_user_id: "preview",
      perceiver_name: "たっきん",
      perceived_type_id: null,
      perceived_full_code: null,
      perceived_modifier_label: null,
      perceived_scores: perceivedScores,
      perceived_facet_scores: null,
      qualitative_data: {
        favorite_point: "いつも落ち着いてて頼れるところ",
        animal: "ふくろう",
        impression_scene: "みんなが慌ててる時に一人だけ冷静だった",
      },
      created_at: null,
    };
    user = {
      id: "preview",
      type_id: null,
      scores: selfMock,
      display_name: "ゆうわインド",
      owner_token: "preview",
      invite_code: "preview",
    };
  } else {
    // ===== 1. perception 取得 (owner 自己診断スコアは含まない) =====
    const { data: pRow, error: pErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select(
        "id, target_user_id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, perceived_scores, perceived_facet_scores, qualitative_data, created_at",
      )
      .eq("id", perceptionId)
      .maybeSingle();
    if (pErr) {
      console.error("[/evaluate/result] perception lookup error:", pErr);
    }
    if (!pRow) {
      notFound();
    }
    perception = pRow as PerceptionRow;

    // ===== 2. owner ゲート (Polish-H: プライバシー穴塞ぎ) =====
    // このページは owner (= 評価された本人 A) の自己診断スコア (レーダー/バー) を
    // 表示するため、owner 本人だけに見せる。owner 識別は cookie ベース session
    // (wn_session, httpOnly, server-readable) で判定する。
    //
    // フェイルクローズ: session 不在 / session.id が perception.target_user_id と
    // 一致しない (= 評価した友達や第三者、判定不可) 場合はすべて非 owner 扱いとし、
    // owner の自己スコアを「取得する前に」/evaluate/sent (友達セーフ版) へリダイレクト。
    // これにより非 owner の端末へ自己診断スコアが一切送信されない。
    const session = await getSession();
    const isOwner =
      !!session && session.id === (perception.target_user_id as string);
    if (!isOwner) {
      redirect(`/evaluate/sent/${perceptionId}`);
    }

    // ===== 3. target user (= 評価された A) 取得 (owner 確定後にのみ self scores を取得) =====
    const { data: uRow } = await supabaseAdmin
      .from("users")
      .select("id, type_id, scores, display_name, owner_token, invite_code")
      .eq("id", perception.target_user_id)
      .maybeSingle();
    if (!uRow) {
      notFound();
    }
    user = uRow as EvalUserRow;
  }

  // 型ナローイング (プレビュー/実データ双方で以降 non-null が保証される)。
  if (!perception || !user) {
    notFound();
  }

  // ===== 4. 派生計算 =====
  const selfScores = (user.scores ?? {}) as BigFiveScores;
  const otherScores = (perception.perceived_scores ?? {}) as BigFiveScores;
  const gaps = buildDimensionGaps(selfScores, otherScores);
  const mutual = calcMutualUnderstanding(gaps);
  // ② は差 (pt) の大きい順に全 5 特性を表示 (先頭2つ=フル形式、残り3つ=圧縮形式)
  const sortedGaps = topGaps(gaps, 5);

  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  // 友達名はフル表示 (切り捨てなし)。見出しでのみ使い、本文には出さない。
  const perceiverFull = (perception.perceiver_name as string) ?? "友達";
  const myTrisetsuUrl = `/me/${user.owner_token as string}`;

  // Day 12-D: 知覚16タイプを perceived_scores から派生。
  // 既存の 8 タイプ (perceived_type_id) は温存し、表示・本文の出し分けは 16 タイプで行う。
  // (owner16タイプは旧⑦撤去で未使用になったが、生成ロジックは mutual-result-content.ts に温存)
  const perceivedTypeId = classifySixteenType(otherScores);
  const perceivedType16 = sixteenTypes[perceivedTypeId];
  // 解釈B: フラグ on で本文・型名・essence・画像を32化。off=従来16で挙動不変。
  const flag32 = isThirtyTwoEnabled();
  const perceived32Id = classifyThirtyTwoType(otherScores);
  // ヒーロー表示用 (型名/essence/画像/説明)。off=16, on=32キャラ。
  const perceivedTypeName = flag32
    ? thirtyTwoName(perceived32Id)
    : perceivedType16.name;
  const dispEssence = flag32
    ? thirtyTwoEssence(perceived32Id)
    : perceivedType16.essence;
  const dispImage = flag32
    ? thirtyTwoImagePath(perceived32Id)
    : characterImagePath(perceivedTypeId);
  const dispDesc = flag32
    ? thirtyTwoOneLiner(perceived32Id)
    : perceivedType16.oneLiner;
  // 統一ヒーロー (/me・/tako と共通): グループ別の帯トーン + 透過キャラ (v3 の四角背景を消して帯に溶け込ませる)。
  const evalHero = heroColorsForGroup(
    flag32 ? thirtyTwoGroup(perceived32Id) : "unknown",
  );
  const dispImageCut = preferCutImage(dispImage);
  // 本文 2 段落 (perception-manual-content.ts は名前なし・主語省略で生成済み):
  //   1 段落目 = ① 「どう見えているか」の描写
  //   2 段落目 = ④ ふたりの関係の「付き合い方のコツ」(ふたり視点・3〜4文)
  const [perceivedLookBody, perceivedTipsBody] = (
    flag32
      ? perceivedManualFor(perceived32Id)
      : perceivedManualContent[perceivedTypeId]
  ).split("\n\n");

  // ③ ◯◯さんが見つけたアナタ: 知覚16タイプの強み/あれっ? 各6つから先頭3つ。
  // 各項目 = 独立した段落 (先頭ワードのみ vividPink)。強み=3文 (見え方+型固有の具体描写+締め)、
  // あれっ?=2文 (見え方+締め)。weaveFound が段落セグメントを生成
  // (あれっ?ワードは SOFT_WORD 辞書で言い換え済み)。
  // 残り3つずつは有料深掘りレポート用にデータとして温存 (PERCEIVED_BY_TYPE)。
  // ③データ本体のみ32化。weaveFound の typeId 引数 (STRENGTH_SCENES=16キー) と
  // seed は perceivedTypeId(16)のまま=ベース性格の場面描写は共通。
  const foundContent = flag32
    ? perceivedContentFor(perceived32Id)
    : getPerceivedContent(perceivedTypeId);
  const foundSeed = seedFromTypeId(perceivedTypeId);
  const strengthParas = foundContent
    ? weaveFound(foundContent.strengths, "strengths", foundSeed, perceivedTypeId)
    : [];
  const surpriseParas = foundContent
    ? weaveFound(foundContent.surprises, "surprises", foundSeed + 1)
    : [];

  // ④ ふたりの関係 (4 段落): 差が最大の特性 × 方向で「この二人ならでは」感を出す。
  //   1 段落目 = この二人の事実 (② データ起点: 自己評価 vs 相手評価のズレ + 解釈) relationGapFact
  //   2 段落目 = 相性がいい時 (差の解釈→伸びしろ) relationGapNote
  //   3 段落目 = 注意点/コツ (① 由来の付き合い方) perceivedTipsBody
  //   4 段落目 = 未来の締め (これからの具体コツ) relationGapTip
  // いずれも名前なし。強調 (pink) は行動フレーズのみ・3/4 段落目に各 1 箇所 (計 2 箇所 ≤ 上限 4)。
  const maxGap = sortedGaps[0];
  const maxGapDir = gapDir3(maxGap.selfPercent, maxGap.otherPercent);
  const relationFactBody = relationGapFact[maxGap.key][maxGapDir];
  const relationGapBody = relationGapNote[maxGap.key][maxGapDir];
  const relationTipBody = relationGapTip[maxGap.key][maxGapDir];
  const relationTipKey = relationGapTipKey[maxGap.key][maxGapDir];
  const tipsKey = flag32
    ? perceivedTipsKeyFor(perceived32Id)
    : PERCEIVED_TIPS_KEY[perceivedTypeId];

  // おまけ3問 (好きなところ / 動物にたとえると / 印象的なシーン)。
  // /me から表示を移設 (詳細ページに集約)。無回答キーは除外。
  const qualitative =
    (perception.qualitative_data as Record<string, string> | null) ?? null;
  const qualEntries = (
    [
      { label: "好きなところ", value: qualitative?.favorite_point },
      { label: "動物にたとえると", value: qualitative?.animal },
      { label: "印象的なシーン", value: qualitative?.impression_scene },
    ] as { label: string; value: string | undefined }[]
  ).filter(
    (e): e is { label: string; value: string } =>
      typeof e.value === "string" && e.value.trim().length > 0,
  );

  return (
    <main
      className="relative min-h-dvh overflow-x-clip px-4 pb-10 md:px-8"
      style={{ background: "#FFFFFF" }}
    >
      <div className="relative z-10 mx-auto max-w-[560px] pt-6">
        {/* ===== ヘッダー (ロゴ) ===== */}
        <div className="flex justify-between items-center mb-5">
          <Link href="/" aria-label="トップへ">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[120px] h-auto"
            />
          </Link>
        </div>

        {/* ===== ヒーロー = /me・/tako と同一の ResultHero (色帯 + 透過キャラ) =====
            帯上に「◯◯のトリセツ」を控えめキャプション、帯内 label=「◯◯さんから見た」、
            称号=友達が割り当てた型の essence、OCEAN=友達評価スコア。装飾袋文字は廃止。 */}
        <div className="mb-2 flex justify-center">
          <TrisetsuNameTag name={displayName} />
        </div>
        <ResultHero
          label={`${perceiverFull}さんから見た`}
          essence={dispEssence}
          scores={otherScores}
          heroBg={evalHero.heroBg}
          codeTint={evalHero.codeTint}
          imageSrc={dispImageCut}
          alt={dispEssence}
          name={perceivedTypeName}
          description={dispDesc}
          imageAspectClassName="aspect-square max-h-[44vh] md:max-h-[360px]"
          contentMaxWidthClass="max-w-[560px]"
          twoColumn={false}
        />

        {/* ===== ① ◯◯さんから見たアナタ (最初のコンテンツ・GAP の上) =====
            友達が割り当てた型 (ヒーローの型) の取扱説明書を友達視点に言い換えた文章。
            /me の「取扱説明書」セクションと同一スタイル (丸数字見出し + クリーンな文章カード)。 */}
        <section className="mb-8">
          <SectionHead num={1} title={`${perceiverFull}さんから見たアナタ`} />
          {/* 1 枚の白カード: 相互理解度パート → 区切り → 本文パート (くっついて見せる) */}
          <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
            {/* 相互理解度パート */}
            <div className="text-center">
              <p className="text-[#5B5BEF] font-bold text-sm mb-1">相互理解度</p>
              <p className="text-[#2E2E5C] font-black text-6xl leading-none drop-shadow-[0_2px_0_rgba(255,233,147,0.6)]">
                {mutual}
                <span className="text-3xl">%</span>
              </p>
              {/* vividPink 進捗バー */}
              <div
                className="mt-3 h-3 rounded-full bg-[#E4E0F5] overflow-hidden"
                role="progressbar"
                aria-label={`相互理解度 ${mutual}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={mutual}
              >
                <div
                  className="h-full rounded-full bg-[#5B5BEF]"
                  style={{ width: `${mutual}%` }}
                />
              </div>
              {/* 一言ラベル (スコア出し分け) */}
              <p className="text-[#2E2E5C]/75 text-xs font-bold mt-2 leading-relaxed">
                {mutualLabel(mutual)}
              </p>
            </div>

            {/* 軽い区切り (別カードに見せない) */}
            <div className="border-t border-dashed border-[#2E2E5C]/15 my-5" />

            {/* 本文パート (◯◯さんから見たアナタは…)。描写の 1 段落のみ。
                「うまく付き合うコツ」段落は ④ ふたりの関係 に移設 (Day 12 再設計) */}
            <p className={PERCEPTION_BODY_TEXT_CLASS}>{perceivedLookBody}</p>
          </div>
        </section>

        {/* ===== ② 内訳/ギャップ = 1 枚の白カード (レーダー + 5特性を薄線で区切る) =====
            Day 12 再設計: 差TOP2深掘り型に圧縮。差 (pt) の大きい順に並べ、
            上位 2 特性はフル形式 (full=2文)、残り 3 特性は圧縮 (short=1文・40〜55字)。
            量ばらつき解消で文数を固定し、TOP2と圧縮組の間に小見出しで段差を設計に見せる。 */}
        <section className="mb-8">
          <SectionHead num={2} title={`${perceiverFull}さんとのギャップ`} />

          {/* 1 枚のカード: レーダー → 5特性 (差の大きい順) を薄線で区切る */}
          <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
            {/* レーダー (5特性の全体像: 自分 vs 友達)。
                ラベルに友達名は出さない (名前は見出しのみ・切り捨て全廃のため) */}
            <MutualUnderstandingRadar
              gaps={gaps}
              selfLabel={`${displayName}自身`}
              otherLabel="友達から"
            />

            {/* 発散バー (/me・/tako と共通の BigFiveDivergingBars。自分 × 友達から の差分)。
                軸ごとの 2 本 TraitBar はここに一本化し、下は解説文のみ残す。 */}
            <div className="mt-2">
              <BigFiveDivergingBars
                scores={selfScores}
                friendScores={otherScores}
                friendLabel="友達から"
              />
            </div>

            {/* 5特性ブロック (sortedGaps = 差の大きい順。先頭2つ=full・残り3つ=short) */}
            {sortedGaps.map((g, idx) => {
              const dir = gapDir3(g.selfPercent, g.otherPercent);
              const d = gapDetail[g.key][dir];
              const detail = idx < 2 ? d.full : d.short;
              return (
                <div key={g.key}>
                  {/* TOP2 と圧縮組の間に小見出しで段差を作る (圧縮組の先頭=idx 2 の前) */}
                  {idx === 2 && (
                    <div className="border-t border-dashed border-[#2E2E5C]/25 mt-6 pt-5">
                      <p className="text-[#2E2E5C]/55 font-bold text-xs mb-1">
                        そのほかの3つ
                      </p>
                    </div>
                  )}
                  {/* 薄線で区切り (レーダーと各特性の間)。圧縮組の先頭だけは小見出しが区切るので省く */}
                  {idx !== 2 && (
                    <div className="border-t border-[#2E2E5C]/10 my-5" />
                  )}
                  {/* 特性名 + 差pt */}
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-[#2E2E5C] font-black text-base">
                      {g.label}
                    </h3>
                    <span className="text-[#5B5BEF] font-black text-xs">
                      差 {g.diffPoints}pt
                    </span>
                  </div>
                  {/* 軸ごとの 2 本バーは発散バーへ一本化。ここは解説文のみ残す。 */}
                  {/* アドバイス/気づき (TOP2=full2文 / 圧縮=short1文)。本文スタイルは ① と共通 */}
                  <p className={PERCEPTION_BODY_TEXT_CLASS}>{detail}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ===== ◇ ◯◯さんからのメッセージ (おまけ3問 → 吹き出しカードに改装、③の直前) =====
            このページで唯一の「生成ではない本物の友達の言葉」。生成文は文章カード、
            本物の言葉だけが吹き出しに入る、という原則 (Day 12 ③④改修)。
            未回答は qualEntries で除外済み。3問すべて未回答ならカードごと非表示。 */}
        <PerceptionMessageCard
          entries={qualEntries}
          perceiverName={perceiverFull}
        />

        {/* ===== ③ ◯◯さんが見つけたアナタ (強み3段落 + あれっ?3段落の文章カード) =====
            Day 12 ③④改修: バッジ/吹き出し UI (PerceptionFoundYou、温存) を撤去し、
            ①④と同じ質感の文章カードに全面改装。vividPink 太字は各段落先頭のワードのみ。
            旧⑤「4つの特性」/ 旧⑦「友達視点の取扱説明書」と旧6章レイアウト (EvaluationChapters)
            のコード・文章データは有料深掘りレポート用に温存 (温存場所はファイル冒頭コメント参照)。 */}
        {foundContent && (
          <section className="mb-8">
            <SectionHead
              num={3}
              title={`${perceiverFull}さんが見つけたアナタ`}
            />
            <PerceptionFoundProse
              perceiverName={perceiverFull}
              strengthParas={strengthParas}
              surpriseParas={surpriseParas}
            />
          </section>
        )}

        {/* ===== ④ ふたりの関係 (旧⑥関係性アドバイスの移設・改装 / ページの締め) =====
            ① と同じ質感の文章カード。4 段落構成 (事実→相性→注意点/コツ→未来):
            1 段落目 = この二人の事実 (② データ起点・差最大の特性のズレ+解釈)、
            2 段落目 = 相性がいい時、
            3 段落目 = 注意点/コツ (① 由来。行動フレーズを pink で 1 箇所)、
            4 段落目 = 未来の締め (これからの具体コツ。行動フレーズを pink で 1 箇所)。 */}
        <section className="mb-8">
          <SectionHead num={4} title="ふたりの関係" />
          <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
            <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4`}>
              {relationFactBody}
            </p>
            <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4`}>
              {relationGapBody}
            </p>
            {perceivedTipsBody && (
              <p className={`${PERCEPTION_BODY_TEXT_CLASS} mb-4`}>
                {pinkify(perceivedTipsBody, tipsKey)}
              </p>
            )}
            <p className={PERCEPTION_BODY_TEXT_CLASS}>
              {pinkify(relationTipBody, relationTipKey)}
            </p>
          </div>
        </section>

        {/* ===== 末尾CTA: 相性ランキング風ぼかしティーザー =====
            旧・紫枠シェアCTAを格上げ。ぼかし3枠 (完全ダミー) で未来を見せ、
            メインボタンでハブ (/friend-evaluation = QR + 相互理解度ランキング) へ送る。 */}
        <PerceptionRankingTeaser hubHref="/friend-evaluation" />

        {/* ===== Footer: 自分のトリセツへの戻りリンク (既存・据え置き) ===== */}
        <div className="text-center pt-2 pb-2">
          <Link
            href={myTrisetsuUrl}
            className="text-[#2E2E5C]/60 font-bold text-sm underline hover:text-[#5B5BEF] transition-colors"
          >
            {displayName}のトリセツに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
