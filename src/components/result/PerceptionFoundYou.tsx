// Day 12 コンテンツ再設計: ③「◯◯さんが見つけたアナタ」の 1 枚カード。
//
// 旧③「強み6つ」+ 旧④「あれっ?6つ」(EvaluationChapters) を統合し、各先頭 3 つに
// 絞って 1 枚の白カードにしたもの。箇条書き 2 連続の単調さを解消するため、
//   - 強み = 勲章バッジ風ミニカード (SVGメダル + 強みワード + 補足一言、sunYellow)
//   - あれっ? = 友達の吹き出し (汎用アバターSVG + チャット風バブル)
// と形式を変えている。title/body は呼び出し側で {A}/{B} 置換済みのものを渡す。
// Server Component (純粋 JSX)。

interface FoundItem {
  title: string;
  body: string;
}

export function PerceptionFoundYou({
  strengths,
  surprises,
  perceiverShort,
}: {
  strengths: FoundItem[];
  surprises: FoundItem[];
  perceiverShort: string;
}) {
  return (
    <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
      {/* 強みパート: 友達に認定された勲章 (バッジ風ミニカード、モバイルは縦積み) */}
      <p className="text-[#FE3C72] font-bold text-sm mb-3 text-center">
        {perceiverShort}さん認定の強み
      </p>
      <ul className="flex flex-col gap-2">
        {strengths.map((s) => (
          <li
            key={s.title}
            className="flex items-center gap-3 rounded-2xl border-2 border-[#FFE993] bg-[#FFE993]/25 p-3"
          >
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFE993] flex items-center justify-center"
            >
              <MedalIcon className="w-6 h-6 text-[#3A2D6B]" />
            </span>
            <div>
              <p className="text-[#3A2D6B] font-black text-base leading-snug">
                {s.title}
              </p>
              <p className="text-[#3A2D6B]/75 text-xs leading-relaxed mt-0.5">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* 薄い区切り (①②のカード内区切りと同じ) */}
      <div className="border-t border-[#3A2D6B]/10 my-5" />

      {/* あれっ?パート: 友達の生の声 (チャット風吹き出し) */}
      <p className="text-[#FE3C72] font-bold text-sm mb-3 text-center">
        {perceiverShort}さんの「あれっ?」
      </p>
      <ul className="flex flex-col gap-3">
        {surprises.map((s) => (
          <li key={s.title} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#BCDEF8] border-2 border-[#3A2D6B]/15 flex items-center justify-center"
            >
              <FriendFaceIcon className="w-5 h-5 text-[#3A2D6B]" />
            </span>
            <div className="flex-1 bg-[#EFF7FD] rounded-2xl rounded-tl-md px-4 py-3">
              <p className="text-[#3A2D6B] font-black text-xs mb-0.5">
                {s.title}
              </p>
              <p className="text-[#3A2D6B]/85 text-xs leading-relaxed">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// インライン SVG メダル (T3-5 ブランド方針: 絵文字を使わず自前 SVG)
function MedalIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="9" r="5" />
      <path d="M8.8 13.2 7 21l5-2.5L17 21l-1.8-7.8" />
    </svg>
  );
}

// 汎用の友達アバター顔 SVG (吹き出しの話者)
function FriendFaceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.5" fill="currentColor" />
      <circle cx="15" cy="10" r="0.5" fill="currentColor" />
      <path d="M9 14.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" />
    </svg>
  );
}
