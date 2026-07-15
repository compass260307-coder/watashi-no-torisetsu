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

import type { ReactNode } from "react";
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
];

// 「失敗する恋愛の特徴」ロック用デコイ。★本文ではない (原稿未投入・未解放時のみ
// 表示するティザー)。どのタイプでも成立する「恋がつまずくパターン」の汎用調で、
// 本人を傷つけない「愛されるクセ」トーンに揃える。
const LOVE_FAILURE_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "尽くしすぎた先にあるもの",
    body: "がんばりが続かなくなった瞬間、関係がぐらつきやすい。アナタの場合は特に。",
  },
  {
    heading: "我慢が限界を超える瞬間",
    body: "ためこんだ気持ちがあふれるとき、アナタには決まったパターンがある。",
  },
  {
    heading: "不安なときのNG行動",
    body: "気持ちが揺れたとき、つい取ってしまう行動が、いちばん相手を遠ざけている。",
  },
  {
    heading: "ズレはじめの見逃しサイン",
    body: "うまくいかなくなる恋には、アナタが見落としがちな共通の前兆がある。",
  },
];

// 「あなたが活躍できる仕事・避けたほうがいい職場」ロック用デコイ
// (★本文ではない。本物はサーバでフェイルクローズ済み)。
const CAREER_FIT_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "ゼロから立ち上げる仕事",
    body: "決まった正解のない場所で、自分の判断で形にしていく働き方が向いている可能性。",
  },
  {
    heading: "チームの舵取り役",
    body: "前に立つか、支えるか。アナタの性格が活きるポジションには傾向がある。",
  },
  {
    heading: "深く潜る専門職",
    body: "ひとつの領域を極めていく働き方と、広く器用にこなす働き方、合うのはどっちか。",
  },
  {
    heading: "避けたほうがいい環境",
    body: "アナタのエネルギーをじわじわ削る職場には、はっきりした共通点がある。",
  },
];

// 「仕事で評価される意外な才能」ロック用デコイ (★本文ではない)。
const CAREER_TALENT_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "当たり前すぎて気づかない力",
    body: "アナタが「普通でしょ」と思ってやっていることが、実はいちばん希少な武器。",
  },
  {
    heading: "追い込まれたときに出る底力",
    body: "ピンチの場面でアナタが自然に取る動きには、他の人にない強さが隠れている。",
  },
  {
    heading: "周りが密かに頼っている部分",
    body: "アナタ本人は自覚していないけれど、チームはその力にずっと支えられている。",
  },
  {
    heading: "伸ばすと化ける素質",
    body: "少し意識を向けるだけで、キャリアの選択肢が大きく広がる眠った才能がある。",
  },
];

// 深掘りの課金ゲートブロックのロック表示 (恋愛 payoff /「失敗する恋愛の特徴」/
// キャリアの「活躍できる仕事」「評価される才能」で共用)。
// ぼかしたダミー本文の上に解除カードを重ねる (嫌われやすい性格ブロックと同じ構図)。
// ダミーはカードの上下に溢れる長さにして「裏にたくさんコンテンツがある」感を出す。
// 本物の本文はここに載っていない (サーバでフェイルクローズ済み)。
function LockedBlock({
  decoyItems,
  cardCopy,
  source,
}: {
  decoyItems: { heading: string; body: string }[];
  cardCopy: ReactNode;
  source: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* 後ろに透けるダミー本文 (高さの土台・デコイ)。多数の見出し+本文でボリュームを出し、
          カードの上下からはみ出させる。PC は2カラムで敷き詰め「量がある」見え方に。本文ではない。 */}
      <div
        aria-hidden="true"
        className="select-none grid grid-cols-1 gap-x-10 gap-y-4 px-1 py-2 blur-[3px] md:grid-cols-2"
      >
        {decoyItems.map((it, i) => (
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
            {cardCopy}
          </p>
          <PaywallScrollButton
            source={source}
            className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
          >
            今すぐアクセス
          </PaywallScrollButton>
        </div>
      </div>
    </div>
  );
}

// ロック中ブロックの見出し → デコイ/カード文言/計測 source。
// サーバ (deep-dive-resolve) が返す locked ブロックの heading をキーに表示を組む。
const LOCKED_BLOCK_CONFIG: Record<
  string,
  { decoyItems: { heading: string; body: string }[]; cardCopy: ReactNode; source: string }
> = {
  あなたを好きになった人が読むトリセツ: {
    decoyItems: LOVE_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、これらの結果を見てみましょう。
        <br className="md:hidden" />
        恋愛傾向に関してもっと深掘れます。
      </>
    ),
    source: "love_payoff_card",
  },
  失敗する恋愛の特徴: {
    decoyItems: LOVE_FAILURE_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、
        <br className="md:hidden" />
        アナタの恋がつまずきやすいパターンを知りましょう。
      </>
    ),
    source: "love_failure_card",
  },
  "あなたが活躍できる仕事・避けたほうがいい職場": {
    decoyItems: CAREER_FIT_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、
        <br className="md:hidden" />
        アナタが活躍できる仕事と、避けたほうがいい職場を知りましょう。
      </>
    ),
    source: "career_fit_card",
  },
  仕事で評価される意外な才能: {
    decoyItems: CAREER_TALENT_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、
        <br className="md:hidden" />
        仕事で評価される、アナタの意外な才能を見つけましょう。
      </>
    ),
    source: "career_talent_card",
  },
};

interface DeepDiveSectionsProps {
  /** サーバ (resolveDeepDiveSections) で解決済みのカテゴリ。未解放は body=null。 */
  sections: ResolvedDeepDiveSection[];
  /** カテゴリ別の挿絵 (シーン別イラスト)。null/未指定なら非表示 (親が fs 走査して渡す)。 */
  sceneImages?: Partial<Record<DeepDiveTabKey, string | null>>;
  /** 先頭カテゴリの章番号バッジ。以降のカテゴリは +1 ずつ振る (②恋愛傾向 ③キャリア傾向)。 */
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

  const baseNumber = parseInt(number, 10);

  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* ===== 各カテゴリ = 独立した章 (②恋愛傾向 ③キャリア傾向 / 2026-07-14 指示) =====
          「アナタの深掘り」の親見出しは廃止し、カテゴリ名を章 h2 (丸囲み数字) に昇格。 */}
      {unlocked.map((sec, si) => (
        <div key={sec.key} className={si > 0 ? "mb-12 mt-16" : "mb-12"}>
          {/* 章見出し: ①⑤と同じ 16P 風 (丸囲み数字 + 大きめタイトル) */}
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
            >
              {baseNumber + si}
            </span>
            <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
              {sec.tab}
            </h2>
          </div>
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
            <>
              {sec.blocks.map((b, bi) => (
                <div key={bi} className={bi > 0 ? "mt-8" : ""}>
                  <h4 className="mb-2.5 text-[18px] md:text-[20px] font-black text-[#2E2E5C]">
                    {b.heading}
                  </h4>
                  {b.locked ? (
                    <LockedBlock
                      {...(LOCKED_BLOCK_CONFIG[b.heading] ??
                        LOCKED_BLOCK_CONFIG["あなたを好きになった人が読むトリセツ"])}
                    />
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
              ))}
            </>
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
