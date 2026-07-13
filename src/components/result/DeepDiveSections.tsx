"use client";

// 自己分析「深掘り」セクション (/me/[token] 結果ページ)。
//
// 設計方針:
//   - 2026-07-14: タブ切替を廃止し、全カテゴリ (恋愛/キャリア/成長/相性) を縦積みで表示。
//     解放済みカテゴリは小見出し + 一文 + 挿絵 + 本文を順に並べる。未解放 (課金ゲート) の
//     カテゴリは「関係別の見られ方」(PartTwoSections RelationsLocked) と同じ体裁 ——
//     色付きの鍵円を横並び + 中央に解除カード —— に集約する (同一カードを何枚も積まない)。
//   - ★本文データ (TYPE_DEEP_DIVE / LOVE_BY_TYPE_32 / CAREER_BY_TYPE_32) は
//     ここで import しない。import するとバンドルに全本文が同梱され課金ゲートが無意味に
//     なるため、サーバ (/me) が resolveDeepDiveSections() で「許可されたぶんだけ」解決し、
//     props (sections) で渡す。未解放カテゴリは body=null / locked=true で来る。

import { SmoothImage } from "@/components/ui/SmoothImage";
import type {
  DeepDiveTabKey,
  ResolvedDeepDiveSection,
} from "@/lib/deep-dive-resolve";
import { PaywallScrollButton } from "@/components/result/PaywallScrollButton";

// ※「みんなの目」(他己) は /tako/[token] へ移設。ここは自己深掘りのみ。

// 鍵アイコン (関係別の見られ方 RelationsLocked と同一形状)。
function LockGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// ロック円の枠色 (関係別の見られ方と同系統: 水色 / 緑 / ピンク)。
const LOCK_COLORS: Record<string, string> = {
  career: "#56BFE8",
  growth: "#4CAF7D",
  aisho: "#F48BAE",
  love: "#F2C14E",
};

// ロック時に後ろへ透かすダミー本文 (デコイ)。★実際の payoff 本文ではない
// (本物はサーバでフェイルクローズ済み・payload に載っていない)。どのタイプでも成立する
// 汎用の恋愛アドバイス調。見出し+本文を多数並べ「裏にたくさん続いている」感を出す。
const LOVE_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "「与える」をひと休みする日",
    body: "たまには何もしないで、ただ隣にいる時間をつくってみて。それだけで伝わるものがある。",
  },
  {
    heading: "好かれようとしすぎない",
    body: "がんばって尽くさなくても、アナタの存在そのものに安心してくれる人はちゃんといる。",
  },
  {
    heading: "ほしいものを言葉にする",
    body: "察してもらうのを待つより、「こうしてくれると嬉しい」と先に伝えてみる練習を。",
  },
  {
    heading: "見返りを求める自分を責めない",
    body: "返してほしいと思うのは自然なこと。それはアナタが本気で向き合っている証拠。",
  },
  {
    heading: "相手の沈黙を怖がらない",
    body: "連絡が少ない日があっても、それはアナタへの気持ちが減ったわけじゃない。",
  },
  {
    heading: "素のアナタを見せる練習",
    body: "完璧じゃない部分を見せたとき、相手との距離はむしろぐっと近づく。",
  },
  {
    heading: "一人の時間も大切にする",
    body: "相手に尽くすのと同じくらい、自分を満たす時間を持つと、恋はもっと穏やかになる。",
  },
  {
    heading: "「ありがとう」を受け取る",
    body: "してあげるだけじゃなく、してもらったことを素直に喜べると、関係は循環しはじめる。",
  },
  {
    heading: "焦らないで大丈夫",
    body: "アナタのペースで心をひらけば、ちゃんと追いついてきてくれる人がいる。",
  },
];

// 恋愛 payoff ブロック (「アナタがもっと楽になる恋」) のロック表示。
// ぼかしたダミー本文の上に解除カードを重ねる (嫌われやすい性格ブロックと同じ構図)。
// ダミーはカードの上下に溢れる長さにして「裏にたくさんコンテンツがある」感を出す。
// 本物の本文はここに載っていない (サーバでフェイルクローズ済み)。
function LockedBlock() {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 後ろに透けるダミー本文 (高さの土台・デコイ)。多数の見出し+本文でボリュームを出し、
          カードの上下からはみ出させる。PC は2カラムで敷き詰め「量がある」見え方に。本文ではない。 */}
      <div
        aria-hidden="true"
        className="select-none grid grid-cols-1 gap-x-10 gap-y-5 px-1 py-8 blur-[3px] md:grid-cols-2"
      >
        {LOVE_DECOY_ITEMS.map((it, i) => (
          <div key={i}>
            <p className="mb-1 text-[16px] font-black text-[#2E2E5C]/55">
              {it.heading}
            </p>
            <p className="body-gothic text-[15px] leading-[1.55] text-[#1A1A1A]/45">
              {it.body}
            </p>
          </div>
        ))}
      </div>
      {/* 中央の解除カード (横長になりすぎないよう幅を絞り、縦の余白を厚めに) */}
      <div className="absolute inset-0 flex items-center justify-center p-3">
        <div className="relative w-full max-w-[380px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] bg-white/95 px-6 pb-9 pt-10 text-center shadow-[0_12px_36px_rgba(46,46,92,0.18)] backdrop-blur-sm md:max-w-[420px]">
          <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
            <LockGlyph size={14} />
          </span>
          <p className="mb-2 text-[19px] font-black text-[#2E2E5C]">
            今すぐロックを解除
          </p>
          <p className="mb-6 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
            完全版のレポートを入手して、これらの結果を見てみましょう。
            <br className="md:hidden" />
            恋愛傾向に関してもっと深掘れます。
          </p>
          <PaywallScrollButton
            source="love_payoff_card"
            className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
          >
            今すぐアクセス
          </PaywallScrollButton>
        </div>
      </div>
    </div>
  );
}

interface DeepDiveSectionsProps {
  /** サーバ (resolveDeepDiveSections) で解決済みのカテゴリ。未解放は body=null。 */
  sections: ResolvedDeepDiveSection[];
  /** カテゴリ別の挿絵 (シーン別イラスト)。null/未指定なら非表示 (親が fs 走査して渡す)。 */
  sceneImages?: Partial<Record<DeepDiveTabKey, string | null>>;
  /** 章番号バッジ (①②③…)。既定 "4"。 */
  number?: string;
  className?: string;
}

export function DeepDiveSections({
  sections,
  sceneImages,
  number = "4",
  className = "",
}: DeepDiveSectionsProps) {
  if (sections.length === 0) return null;

  // 解放済み (本文あり) と 未解放 (ロック) に振り分け。
  const unlocked = sections.filter((s) => !s.locked && s.body !== null);
  const locked = sections.filter((s) => s.locked || s.body === null);
  const lockedLabels = locked.map((s) => s.tab).join("・");

  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* 見出し: ①②③と同じ 16P 風 (丸囲み数字 + 大きめタイトル)。 */}
      <div className="mb-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
        >
          {number}
        </span>
        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
          アナタの深掘り
        </h2>
      </div>

      {/* ===== 解放済みカテゴリ: 縦積みで本文表示 ===== */}
      {unlocked.map((sec) => (
        <div key={sec.key} className="mb-12">
          {/* 小見出し (カテゴリ名): 章 h2 より一段小さく */}
          <h3 className="mb-2 text-[21px] font-black text-[#2E2E5C] md:text-[24px]">
            {sec.tab}
          </h3>
          {/* スコア由来の一文 (パーソナライズ・無料メタ) */}
          <p className="mb-4 text-[#2E2E5C]/70 text-sm">{sec.note}</p>
          {/* 挿絵 (カテゴリ対応のシーン別イラスト) */}
          {sceneImages?.[sec.key] && (
            <SmoothImage
              src={sceneImages[sec.key]!}
              alt=""
              width={960}
              height={640}
              className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
            />
          )}
          {sec.blocks && sec.blocks.length > 0 ? (
            /* 見出し付きブロック (恋愛): 小見出し + 段落。
               payoff ブロック (locked) は本文を伏せ、ぼかし + 解除カードにする。 */
            sec.blocks.map((b, bi) => (
              <div key={bi} className={bi > 0 ? "mt-8" : ""}>
                <h4 className="mb-2.5 text-[18px] md:text-[20px] font-black text-[#2E2E5C]">
                  {b.heading}
                </h4>
                {b.locked ? (
                  <LockedBlock />
                ) : (
                  b.body.split("\n\n").map((para, i) => (
                    <p
                      key={i}
                      className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
                    >
                      {para}
                    </p>
                  ))
                )}
              </div>
            ))
          ) : (
            sec.body!.split("\n\n").map((para, i) => (
              <p
                key={i}
                className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
              >
                {para}
              </p>
            ))
          )}
        </div>
      ))}

      {/* ===== 未解放カテゴリ: 関係別の見られ方 と同じ体裁のロック =====
          色付きの鍵円を横並び + 中央に解除カード。課金導線は最下部カードへ。 */}
      {locked.length > 0 && (
        <div className="rounded-2xl border border-[#ECEDF6] bg-white px-4 py-8 shadow-[0_6px_20px_rgba(46,46,92,0.09)] md:px-10 md:py-10">
          {/* 鍵付きの円 (キャリア/成長/相性) */}
          <div className="mb-8 grid grid-cols-3 gap-x-2 gap-y-6">
            {locked.map((sec) => (
              <div
                key={sec.key}
                className="flex flex-col items-center gap-2.5"
              >
                <span
                  className="flex aspect-square w-full max-w-[104px] items-center justify-center rounded-full border-4 bg-white text-[#B9BCCF]"
                  style={{ borderColor: LOCK_COLORS[sec.key] ?? "#8A8AA3" }}
                >
                  <LockGlyph size={30} />
                </span>
                <span className="text-[13px] font-black text-[#2E2E5C]">
                  {sec.tab}
                </span>
              </div>
            ))}
          </div>

          {/* 解除カード (上辺アクセント線 + 鍵バッジ) */}
          <div className="relative mx-auto max-w-[480px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] px-5 pb-6 pt-7 text-center md:max-w-[640px]">
            <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
              <LockGlyph size={14} />
            </span>
            <p className="mb-1.5 text-[19px] font-black text-[#2E2E5C]">
              他の深掘りも解除
            </p>
            <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
              完全版で、{lockedLabels}のくわしい深掘りが
              <br className="md:hidden" />
              ぜんぶ読めるようになります。
            </p>
            {/* 挙動は他の解除カードと同一 (最下部の課金カードへスムーススクロール+パルス) */}
            <PaywallScrollButton
              source="deepdive_card"
              className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
            >
              今すぐアクセス
            </PaywallScrollButton>
          </div>
        </div>
      )}
    </section>
  );
}
