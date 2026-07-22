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
import type { ResultLocale } from "@/i18n/result";

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

// 「恋人が密かに我慢していること」ロック用デコイ。★本文ではない (未解放時のみ
// 表示するティザー)。どのタイプでも成立する「恋人が言えずにいること」の汎用調で、
// 本人を傷つけない「愛されるクセ」トーンに揃える。
const LOVE_ENDURE_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "「大丈夫だよ」の本当の意味",
    body: "恋人の口グセの裏には、アナタに言えずに飲み込んだ気持ちが隠れていることがある。",
  },
  {
    heading: "我慢が溜まりやすい場面",
    body: "アナタのタイプの恋人が、いちばん黙って耐えやすい瞬間には共通点がある。",
  },
  {
    heading: "言われる前に気づきたいサイン",
    body: "我慢が限界に近づいた恋人が出す、小さな前兆を見逃さないために。",
  },
  {
    heading: "我慢を信頼に変える一言",
    body: "先回りのひと言があるだけで、二人の関係は驚くほど軽くなる。",
  },
];

// 「あなたに合った働き方・避けたほうがいい職場」ロック用デコイ
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
    heading: "エネルギーを削る職場の共通点",
    body: "アナタのやる気をじわじわ削る環境には、はっきりした共通点がある。",
  },
];

// 「職場の人間関係」ロック用デコイ (★本文ではない)。
const CAREER_RELATIONS_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "アナタに合う距離感",
    body: "近づきすぎず、離れすぎず。アナタが一番ラクでいられる距離には型がある。",
  },
  {
    heading: "頼まれごとの線の引き方",
    body: "断れずに抱え込む前に、アナタの性格に合った断り方を知っておきたい。",
  },
  {
    heading: "合わない人との並走のコツ",
    body: "どうしても合わないあの人と、消耗せずに一緒に働くための距離のとり方。",
  },
  {
    heading: "周りが密かに助かっている部分",
    body: "アナタが思っているより、チームはアナタのあの動きに支えられている。",
  },
];

const KO_LOVE_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "애쓰지 않고 곁에 있는 날",
    body: "가끔은 무언가를 해 주려 하지 말고, 그저 옆에 있어 보세요. 그것만으로 전해지는 마음이 있어요.",
  },
  {
    heading: "사랑받으려고 너무 애쓰지 않기",
    body: "열심히 맞춰 주지 않아도, 당신의 존재 자체에서 편안함을 느끼는 사람은 분명 있어요.",
  },
  {
    heading: "바라는 것을 말로 전하기",
    body: "알아주기를 기다리기보다 ‘이렇게 해 주면 기쁠 것 같아’라고 먼저 말해 보는 연습을 해 보세요.",
  },
  {
    heading: "보답을 바라는 나를 탓하지 않기",
    body: "돌려받고 싶다는 마음은 자연스러워요. 관계에 진심으로 임하고 있다는 증거이기도 해요.",
  },
  {
    heading: "상대의 침묵을 두려워하지 않기",
    body: "연락이 적은 날이 있어도 당신을 향한 마음까지 줄었다는 뜻은 아니에요.",
  },
];

const KO_LOVE_FAILURE_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "너무 많이 맞춰 준 뒤에 생기는 일",
    body: "계속되던 노력이 멈추는 순간 관계가 흔들릴 수 있어요. 특히 당신에게 반복되기 쉬운 흐름이 있어요.",
  },
  {
    heading: "참아 온 마음이 넘치는 순간",
    body: "쌓아 둔 감정이 한꺼번에 나올 때, 당신에게는 일정한 패턴이 나타나요.",
  },
  {
    heading: "불안할 때 피해야 할 행동",
    body: "마음이 흔들릴 때 무심코 하는 행동이 오히려 상대를 멀어지게 할 수 있어요.",
  },
  {
    heading: "엇갈림이 시작되는 신호",
    body: "잘 풀리지 않는 관계에는 당신이 놓치기 쉬운 공통의 전조가 있어요.",
  },
];

const KO_CAREER_FIT_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "처음부터 만들어 가는 일",
    body: "정해진 답이 없는 곳에서 스스로 판단하며 형태를 만드는 방식이 잘 맞을 수 있어요.",
  },
  {
    heading: "팀에서 맡기 좋은 역할",
    body: "앞에서 이끄는지, 뒤에서 받쳐 주는지에 따라 당신의 강점이 살아나는 자리가 달라져요.",
  },
  {
    heading: "깊이 파고드는 전문 분야",
    body: "한 분야를 깊게 익히는 방식과 폭넓게 다루는 방식 중 더 잘 맞는 쪽이 있어요.",
  },
  {
    heading: "피하는 편이 좋은 환경",
    body: "당신의 에너지를 서서히 소모시키는 조직에는 분명한 공통점이 있어요.",
  },
];

const KO_CAREER_TALENT_DECOY_ITEMS: { heading: string; body: string }[] = [
  {
    heading: "너무 당연해서 놓친 능력",
    body: "당신이 평범하다고 여기는 행동이 사실은 가장 희소한 강점일 수 있어요.",
  },
  {
    heading: "막다른 순간에 드러나는 저력",
    body: "어려운 상황에서 자연스럽게 취하는 행동에 다른 사람에게 없는 힘이 숨어 있어요.",
  },
  {
    heading: "주변이 조용히 의지하는 부분",
    body: "스스로는 잘 모르지만 팀은 오래전부터 그 능력의 도움을 받고 있어요.",
  },
  {
    heading: "키우면 크게 달라지는 자질",
    body: "조금만 의식해도 커리어의 선택지를 넓혀 줄 잠재력이 있어요.",
  },
];

// 深掘りの課金ゲートブロックのロック表示 (恋愛 payoff /「恋人が密かに我慢していること」/
// キャリアの「合った働き方・避けたほうがいい職場」「職場の人間関係」で共用)。
// ぼかしたダミー本文の上に解除カードを重ねる (嫌われやすい性格ブロックと同じ構図)。
// ダミーはカードの上下に溢れる長さにして「裏にたくさんコンテンツがある」感を出す。
// 本物の本文はここに載っていない (サーバでフェイルクローズ済み)。
function LockedBlock({
  decoyItems,
  cardCopy,
  source,
  locale,
}: {
  decoyItems: { heading: string; body: string }[];
  cardCopy: ReactNode;
  source: string;
  locale: ResultLocale;
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
            {locale === "ko" ? "지금 잠금 해제" : "今すぐロックを解除"}
          </p>
          <p className="mb-6 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
            {cardCopy}
          </p>
          <PaywallScrollButton
            source={source}
            className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
          >
            {locale === "ko" ? "지금 확인하기" : "今すぐアクセス"}
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
  恋人が密かに我慢していること: {
    decoyItems: LOVE_ENDURE_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、
        <br className="md:hidden" />
        アナタの恋人が言えずにいる気持ちを知りましょう。
      </>
    ),
    source: "love_failure_card",
  },
  "あなたに合った働き方・避けたほうがいい職場": {
    decoyItems: CAREER_FIT_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、
        <br className="md:hidden" />
        アナタに合った働き方と、避けたほうがいい職場を知りましょう。
      </>
    ),
    source: "career_fit_card",
  },
  職場の人間関係: {
    decoyItems: CAREER_RELATIONS_DECOY_ITEMS,
    cardCopy: (
      <>
        完全版のレポートを入手して、
        <br className="md:hidden" />
        アナタに合った職場の人間関係のつくり方を知りましょう。
      </>
    ),
    source: "career_relations_card",
  },
};

const KO_LOCKED_BLOCK_CONFIG: typeof LOCKED_BLOCK_CONFIG = {
  "나를 좋아하게 된 사람이 읽는 사용설명서": {
    decoyItems: KO_LOVE_DECOY_ITEMS,
    cardCopy: (
      <>
        완전판 리포트에서 이 결과를 확인해 보세요.
        <br className="md:hidden" />
        나의 연애 성향을 더 깊이 이해할 수 있어요.
      </>
    ),
    source: "love_payoff_card",
  },
  "연애가 잘 풀리지 않을 때의 패턴": {
    decoyItems: KO_LOVE_FAILURE_DECOY_ITEMS,
    cardCopy: (
      <>
        완전판 리포트에서,
        <br className="md:hidden" />
        연애가 자주 막히는 나만의 패턴을 확인해 보세요.
      </>
    ),
    source: "love_failure_card",
  },
  "잘 맞는 일과 피하고 싶은 환경": {
    decoyItems: KO_CAREER_FIT_DECOY_ITEMS,
    cardCopy: (
      <>
        완전판 리포트에서,
        <br className="md:hidden" />
        잘 맞는 일과 피하는 편이 좋은 환경을 확인해 보세요.
      </>
    ),
    source: "career_fit_card",
  },
  "일에서 인정받는 뜻밖의 재능": {
    decoyItems: KO_CAREER_TALENT_DECOY_ITEMS,
    cardCopy: (
      <>
        완전판 리포트에서,
        <br className="md:hidden" />
        일할 때 인정받는 나의 뜻밖의 재능을 발견해 보세요.
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
  loveFooter?: ReactNode;
  locale?: ResultLocale;
}

export function DeepDiveSections({
  sections,
  sceneImages,
  number = "4",
  className = "",
  loveFooter,
  locale = "ja",
}: DeepDiveSectionsProps) {
  if (sections.length === 0) return null;

  // 解放済み (本文あり) と 未解放 (ロック) に振り分け。
  const unlocked = sections.filter((s) => !s.locked && s.body !== null);
  const locked = sections.filter((s) => s.locked || s.body === null);
  const lockedLabels = locked.map((s) => s.tab).join("・");

  const baseNumber = parseInt(number, 10);
  const lockedBlockConfig =
    locale === "ko" ? KO_LOCKED_BLOCK_CONFIG : LOCKED_BLOCK_CONFIG;
  const fallbackLockedHeading =
    locale === "ko"
      ? "나를 좋아하게 된 사람이 읽는 사용설명서"
      : "あなたを好きになった人が読むトリセツ";

  return (
    <section className={`mb-8 ${className}`.trim()}>
      {/* ===== 各カテゴリ = 独立した章 (②恋愛傾向 ③キャリア傾向 / 2026-07-22 指示の章順) =====
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
                      {...(lockedBlockConfig[b.heading] ??
                        lockedBlockConfig[fallbackLockedHeading])}
                      locale={locale}
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
          {sec.key === "love" && loveFooter && (
            <div className="mt-10">{loveFooter}</div>
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
              {locale === "ko" ? "다른 심층 결과도 해제" : "他の深掘りも解除"}
            </p>
            <p className="mb-4 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
              {locale === "ko" ? (
                <>완전판에서 {lockedLabels}의 자세한 내용을 모두 읽을 수 있어요.</>
              ) : (
                <>
                  完全版で、{lockedLabels}のくわしい深掘りが
                  <br className="md:hidden" />
                  ぜんぶ読めるようになります。
                </>
              )}
            </p>
            {/* 挙動は他の解除カードと同一 (最下部の課金カードへスムーススクロール+パルス) */}
            <PaywallScrollButton
              source="deepdive_card"
              className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
            >
              {locale === "ko" ? "지금 확인하기" : "今すぐアクセス"}
            </PaywallScrollButton>
          </div>
        </div>
      )}
    </section>
  );
}
