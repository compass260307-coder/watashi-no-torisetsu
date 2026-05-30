// Phase 1.5-α Day 12-C1: 友達評価結果ページの 6 章レイアウト + プレースホルダー
//
// 章構成 (Day 12 指示書):
//   ① ギャップの全体像 (gaps を渡して動的、最下部に「友達が感じてること」スニペットを
//       ロック表示)
//   ② B から見たアナタの強み (全無料、6 個プレースホルダー)
//   ③ B から見たアナタの「あれっ?」(全無料、6 個プレースホルダー)
//   ④ B 視点での 4 特性 (全ロック、円アイコン × 4)
//   ⑤ 関係性アドバイス (リードのみ無料、本体ロック)
//   ⑥ 取扱説明書・B 視点 (リードのみ無料、本体ロック)
//
// すべて Server Component (純粋 JSX、useState 等なし)。
// 章本文は当面プレースホルダー、Day 12-D で 32 タイプ × ギャップパターンの実データに置き換える前提で
// CHAPTER_CONTENT 配列に集約。
//
// 触らない: prop interface はそのまま保つ (Day 12-D で本文だけ差し替え)。

import type { DimensionGap } from "@/lib/perception-analysis";

interface ChaptersProps {
  gaps: DimensionGap[];
  topGapList: DimensionGap[];
  displayName: string;
  perceiverShort: string;
  unlocked: boolean;
}

export function EvaluationChapters({
  gaps,
  topGapList,
  displayName,
  perceiverShort,
  unlocked,
}: ChaptersProps) {
  void gaps; // 現状は topGapList のみ使用、Day 12-D で全 gap を本文に活かす想定
  return (
    <>
      {/* 章 ① ギャップの全体像 */}
      <section className="mb-8">
        <ChapterHeader num={1} title="ギャップの全体像" />
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-3">
          <p className="text-[#3A2D6B]/85 text-sm leading-relaxed">
            {displayName}が「こう」と思っている自分と、{perceiverShort}から
            見える{displayName}には、いくつかのズレがあります。特に大きいズレが
            <span className="font-black text-[#FE3C72]">
              {" "}
              {topGapList.length} 個
            </span>
            。
          </p>
        </div>
        {topGapList.map((g) => (
          <GapCard
            key={g.key}
            gap={g}
            displayName={displayName}
            perceiverShort={perceiverShort}
            unlocked={unlocked}
          />
        ))}
      </section>

      {/* 章 ② 強み (全無料) */}
      <section className="mb-8">
        <ChapterHeader
          num={2}
          title={`${perceiverShort}から見たアナタの強み`}
        />
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
          <p className="text-[#3A2D6B]/75 text-xs font-bold mb-4 leading-relaxed">
            {displayName}が自覚していない、{perceiverShort}から見える 6 つの長所。
          </p>
          <ul className="flex flex-col gap-3">
            {STRENGTHS_PLACEHOLDER.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="text-[#FE3C72] font-black text-base flex-shrink-0 leading-snug"
                >
                  ✓
                </span>
                <div>
                  <p className="text-[#3A2D6B] font-black text-sm">
                    {s.title}
                  </p>
                  <p className="text-[#3A2D6B]/75 text-xs leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 章 ③ あれっ? (全無料) */}
      <section className="mb-8">
        <ChapterHeader
          num={3}
          title={`${perceiverShort}から見たアナタの「あれっ?」`}
        />
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
          <p className="text-[#3A2D6B]/75 text-xs font-bold mb-4 leading-relaxed">
            {displayName}が思ってる以上に、{perceiverShort}にはこう見えてる 6 つのポイント。
          </p>
          <ul className="flex flex-col gap-3">
            {SURPRISES_PLACEHOLDER.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span
                  aria-hidden="true"
                  className="text-[#0094D8] font-black text-base flex-shrink-0 leading-snug"
                >
                  !
                </span>
                <div>
                  <p className="text-[#3A2D6B] font-black text-sm">
                    {s.title}
                  </p>
                  <p className="text-[#3A2D6B]/75 text-xs leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 章 ④ B 視点の 4 特性 (全ロック) */}
      <section className="mb-8">
        <ChapterHeader
          num={4}
          title={`${perceiverShort}視点での 4 つの特性`}
        />
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
          <p className="text-[#3A2D6B]/75 text-xs font-bold mb-5 leading-relaxed">
            {perceiverShort}は、{displayName}のこんな側面を見てるかも。
          </p>
          <div className="grid grid-cols-2 gap-4">
            {FOUR_TRAITS_PLACEHOLDER.map((t, i) => (
              <FourTraitCircle key={i} trait={t} unlocked={unlocked} />
            ))}
          </div>
        </div>
      </section>

      {/* 章 ⑤ 関係性アドバイス */}
      <section className="mb-8">
        <ChapterHeader num={5} title="2 人の関係性アドバイス" />
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
          <p className="text-[#3A2D6B]/75 text-xs font-bold mb-3 leading-relaxed">
            {displayName}と{perceiverShort}さんが、もっと理解し合うためのヒント。
          </p>
          <LockedBody
            unlocked={unlocked}
            body={renderTemplate(RELATIONSHIP_BODY_TEMPLATE, {
              A: displayName,
              B: perceiverShort,
            })}
          />
        </div>
      </section>

      {/* 章 ⑥ 取扱説明書・B 視点 */}
      <section className="mb-8">
        <ChapterHeader
          num={6}
          title={`${displayName}の取扱説明書・${perceiverShort}視点`}
        />
        <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
          <p className="text-[#3A2D6B]/75 text-xs font-bold mb-3 leading-relaxed">
            {perceiverShort}さんが{displayName}とうまく付き合うには。
          </p>
          <LockedBody
            unlocked={unlocked}
            body={renderTemplate(MANUAL_BODY_TEMPLATE, {
              A: displayName,
              B: perceiverShort,
            })}
          />
        </div>
      </section>
    </>
  );
}

// =========================================================================
// 補助コンポーネント
// =========================================================================

function ChapterHeader({ num, title }: { num: number; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white font-black text-lg flex items-center justify-center">
        {num}
      </span>
      <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
        {title}
      </h2>
    </div>
  );
}

function GapCard({
  gap,
  displayName,
  perceiverShort,
  unlocked,
}: {
  gap: DimensionGap;
  displayName: string;
  perceiverShort: string;
  unlocked: boolean;
}) {
  const direction =
    gap.selfPercent > gap.otherPercent
      ? `${displayName}は自覚以上に控えめに見られているかも。`
      : gap.selfPercent < gap.otherPercent
        ? `${displayName}は思っている以上に外に出ているかも。`
        : `${displayName}の自己認識と${perceiverShort}の見方がぴったり一致しています。`;

  return (
    <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#3A2D6B] font-black text-base">{gap.label}</span>
        <span className="text-[#FE3C72] font-black text-sm">
          差 {gap.diffPoints}pt
        </span>
      </div>
      <div className="space-y-1.5 mb-3">
        <ScoreRow
          label={displayName}
          percent={gap.selfPercent}
          color="#FE3C72"
        />
        <ScoreRow
          label={`${perceiverShort}から`}
          percent={gap.otherPercent}
          color="#0094D8"
        />
      </div>
      <p className="text-[#3A2D6B]/85 text-xs leading-relaxed mb-3">
        {direction}
      </p>
      <div className="border-t border-dashed border-[#3A2D6B]/20 my-3" />
      <LockedSnippet unlocked={unlocked} perceiverShort={perceiverShort} />
    </div>
  );
}

function ScoreRow({
  label,
  percent,
  color,
}: {
  label: string;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-[#3A2D6B] mb-0.5">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#E4E0F5] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function LockedSnippet({
  unlocked,
  perceiverShort,
}: {
  unlocked: boolean;
  perceiverShort: string;
}) {
  if (unlocked) {
    return (
      <p className="text-[#3A2D6B] text-xs leading-relaxed">
        {perceiverShort}が感じている細かいニュアンスと、関係性アドバイスがここに入ります。
        (32 タイプ × ギャップパターンの実データは Day 12-D で接続)
      </p>
    );
  }
  return (
    <div className="relative">
      <p
        className="text-[#3A2D6B] text-xs leading-relaxed select-none"
        style={{ filter: "blur(3px)" }}
        aria-hidden="true"
      >
        友達が感じている細かいニュアンスと、2 人の関係性に活かすためのアドバイスがここに書かれています。
      </p>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="bg-[#3A2D6B] text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
          <LockIcon className="w-3 h-3" />
          ¥500 で解除
        </span>
      </div>
    </div>
  );
}

function FourTraitCircle({
  trait,
  unlocked,
}: {
  trait: { label: string; color: string };
  unlocked: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-[#3A2D6B]/25"
        style={{ backgroundColor: `${trait.color}40` }}
      >
        {unlocked ? (
          <span className="text-[#3A2D6B] font-black text-2xl" aria-hidden="true">
            ?
          </span>
        ) : (
          <LockIcon className="w-6 h-6 text-[#3A2D6B]/70" />
        )}
      </div>
      <p className="text-[#3A2D6B] font-bold text-xs mt-2 text-center">
        {trait.label}
      </p>
      {unlocked && (
        <p className="text-[#3A2D6B]/55 text-[10px] mt-0.5 text-center">
          (Day 12-D で本文)
        </p>
      )}
    </div>
  );
}

function LockedBody({ unlocked, body }: { unlocked: boolean; body: string }) {
  if (unlocked) {
    return (
      <p className="text-[#3A2D6B] text-sm leading-relaxed whitespace-pre-line">
        {body}
      </p>
    );
  }
  return (
    <div className="relative">
      <p
        className="text-[#3A2D6B] text-sm leading-relaxed select-none whitespace-pre-line"
        style={{ filter: "blur(4px)" }}
        aria-hidden="true"
      >
        {body}
      </p>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-[#3A2D6B] text-white px-4 py-2 rounded-full flex items-center gap-2">
          <LockIcon className="w-4 h-4" />
          <span className="text-xs font-bold">¥500 で解除</span>
        </div>
      </div>
    </div>
  );
}

// インライン SVG 鍵アイコン (T3-5 ブランド方針: 絵文字 🔒 を使わず自前 SVG で代替)
function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

// テンプレ文字列の {A} / {B} を渡された名前で差し替え (素朴な実装、外部入力なしのため安全)
function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(A|B)\}/g, (_, k) => vars[k] ?? "");
}

// =========================================================================
// プレースホルダーデータ (Day 12-D で 32 タイプ別データに置き換え)
// 「お祭りムードメーカー」想定の汎用文体。一般的すぎず、特定タイプに偏らないトーン。
// =========================================================================

const STRENGTHS_PLACEHOLDER: { title: string; body: string }[] = [
  {
    title: "場を一瞬で明るくする",
    body: "アナタが入った瞬間、空気が軽くなる、そう感じることが何度もあるはず。",
  },
  {
    title: "弱音を言いやすい雰囲気がある",
    body: "強がりや見栄を相手に押しつけないから、自然と本音が出てくる。",
  },
  {
    title: "段取りを淡々と進められる",
    body: "細かい段取りを引き受けてくれる、その背中に安心している人がいる。",
  },
  {
    title: "細かい変化に気づく",
    body: "髪型、声のトーン、些細な変化を見逃さない繊細さ。気にしてくれていることが伝わっている。",
  },
  {
    title: "意見を真ん中で言える",
    body: "極端に肩入れせず、結論を整える役割を引き受けている自覚はあまりないかも。",
  },
  {
    title: "失敗を笑いに変える",
    body: "自分のしくじりを楽しい話に変えるユーモアが、周りの肩の力を抜いてくれる。",
  },
];

const SURPRISES_PLACEHOLDER: { title: string; body: string }[] = [
  {
    title: "意外と疲れている時がある",
    body: "気を遣う場が続くと、後でどっと落ちている。本人が思うよりずっと回復に時間がかかっている。",
  },
  {
    title: "本音を見せる相手は少ない",
    body: "明るく見えて、本当に弱さを出せる人を厳選している。線引きはわりとはっきりしている。",
  },
  {
    title: "決断は意外と慎重",
    body: "ぱっと動いて見えても、頭の中では何度も巻き戻している。",
  },
  {
    title: "甘えるのが苦手",
    body: "面倒見が良い分、自分が頼る側に回るのに時間がかかる。",
  },
  {
    title: "理屈っぽくなる瞬間がある",
    body: "感情が動いた時ほど、急に整理した言葉で話そうとする癖。",
  },
  {
    title: "他人の感情に巻き込まれやすい",
    body: "周りが沈むと、自分まで本気で重くなる。境界線の引き方を探している。",
  },
];

const FOUR_TRAITS_PLACEHOLDER: { label: string; color: string }[] = [
  { label: "頼れる度", color: "#0094D8" },
  { label: "ノリの良さ", color: "#FFE993" },
  { label: "本音の見せ方", color: "#FFD6E0" },
  { label: "距離の取り方", color: "#BCDEF8" },
];

const RELATIONSHIP_BODY_TEMPLATE = `{A}と{B}さんの距離感は、お互いの「言い切らない」を尊重するところから始まる気がします。
{B}さんは{A}に対して、結論を急がない時間を求めているかも。
3 段落分のアドバイスがここに入ります (Day 12-D で 32 タイプ別データに置き換え)。
このプレースホルダーは Day 12-C1 の UI 確認用です。`;

const MANUAL_BODY_TEMPLATE = `{B}さんが{A}とうまく付き合うには、まず「テンションの落差」を理解しておく。
明るく見えるトーンと、急に深くなる切り替えがあることを知っていると、距離が近すぎる失敗を避けられる。
本格的な取扱説明書 (3-4 段落) がここに展開されます (Day 12-D で接続)。`;
