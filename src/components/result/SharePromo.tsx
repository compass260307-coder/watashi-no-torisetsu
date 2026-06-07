// Phase 1.5-α: ヒーロー直下シェアブロックの「相互理解度を促す文言」(Koi 風)。
//
// [花・左] [テキスト] [花・右] を中央寄せ1行。テキストは M PLUS Rounded / deepPurple、
// キーワード(リンク・相互理解度)を太字 vividPink で強調。text-wrap:balance + auto-phrase
// (.balance-jp) で2行を均等に折返し。スマホでは花を少し小さく。

interface SharePromoProps {
  className?: string;
}

export function SharePromo({ className = "" }: SharePromoProps) {
  return (
    <div
      className={`flex items-center justify-center gap-2 max-w-full ${className}`.trim()}
    >
      <FlowerBlue />
      <p className="balance-jp text-center text-[#3A2D6B] text-sm font-bold leading-relaxed max-w-[280px]">
        <span className="font-extrabold text-[#FE3C72]">リンク</span>
        をシェアして友達に答えてもらうと、“友達から見たアナタ”＝
        <span className="font-extrabold text-[#FE3C72]">相互理解度</span>
        がわかるよ
      </p>
      <FlowerBlue />
    </div>
  );
}

// Koi 風のふっくらブルー花 (指定 SVG)。スマホ 24px / sm+ 30px。
function FlowerBlue() {
  return (
    <svg
      viewBox="0 0 30 30"
      aria-hidden="true"
      className="w-6 h-6 sm:w-[30px] sm:h-[30px] flex-shrink-0"
    >
      <g fill="#8FCDEB">
        <circle cx="15" cy="6" r="5" />
        <circle cx="15" cy="24" r="5" />
        <circle cx="6.2" cy="10.5" r="5" />
        <circle cx="23.8" cy="10.5" r="5" />
        <circle cx="6.2" cy="19.5" r="5" />
        <circle cx="23.8" cy="19.5" r="5" />
      </g>
      <circle cx="15" cy="15" r="5" fill="#FFE07A" />
    </svg>
  );
}
