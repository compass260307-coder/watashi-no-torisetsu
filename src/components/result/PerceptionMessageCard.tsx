// Day 12 ③④改修: ◇「◯◯さんからのメッセージ」(おまけ3問) の吹き出しカード。
//
// このページで唯一の「生成ではない本物の友達の言葉」。
// 原則: 生成文は文章カード、本物の言葉だけが吹き出しに入る。
// 質問ごとに「質問ラベル (小・グレー) + 友達側の吹き出し (シッポ付き・skyBlue系薄地)」。
// 未回答の質問は呼び出し側でフィルタ済み (entries が空ならカード自体を出さない)。
// 見出しにのみ友達名を表示 (フル表示・切り捨てなし)。Server Component。

interface MessageEntry {
  label: string;
  value: string;
}

export function PerceptionMessageCard({
  entries,
  perceiverName,
}: {
  entries: MessageEntry[];
  perceiverName: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-8">
      <p className="text-[#FE3C72] font-bold text-sm mb-4 text-center">
        {perceiverName}さんからのメッセージ
      </p>
      <ul className="flex flex-col gap-4">
        {entries.map((e) => (
          <li key={e.label}>
            <p className="text-[#3A2D6B]/60 font-bold text-xs mb-1.5">
              {e.label}
            </p>
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="flex-shrink-0 w-9 h-9 rounded-full bg-[#BCDEF8] border-2 border-[#3A2D6B]/15 flex items-center justify-center"
              >
                <FriendFaceIcon className="w-5 h-5 text-[#3A2D6B]" />
              </span>
              <div className="relative flex-1">
                {/* 吹き出しのシッポ (アバター側に向ける) */}
                <span
                  aria-hidden="true"
                  className="absolute -left-1 top-3 w-3 h-3 bg-[#EFF7FD] rotate-45"
                />
                <div className="relative bg-[#EFF7FD] rounded-2xl px-4 py-3">
                  {/* 回答そのまま: deepPurple・やや大きめ・太字 */}
                  <p className="text-[#3A2D6B] font-bold text-base leading-relaxed">
                    {e.value}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 汎用の友達アバター顔 SVG (T3-5 ブランド方針: 絵文字を使わず自前 SVG)
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
