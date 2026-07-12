// 階段UI (三層モデル Step4): 友達回答数の「道中の報酬」を可視化する進捗レール。
//
//   1人 = 予兆 (動物メタファーの小出し) / 3人 = 第二部 / 5人 = 本物 (/tako 完成)
//
// サーバコンポーネント (状態なし)。しきい値は friend-stairs.ts を唯一の真実源として
// props で受ける (このコンポーネントに数字をベタ書きしない)。
// 予兆テキスト (teaseText) は /me がサーバで1人目の perceived_scores から導出して渡す。
// 個人が特定される自由記述は含めない (本人を傷つけない表示ルール)。

interface FriendStairsProps {
  friendCount: number;
  /** friend-stairs.ts の STAIR_TEASE / STAIR_PART_TWO / STAIR_COMPLETE。 */
  stairs: { tease: number; partTwo: number; complete: number };
  /** 1人目の回答から導出した予兆の一文。null = まだ0人 (非表示)。 */
  teaseText?: string | null;
}

export function FriendStairs({
  friendCount,
  stairs,
  teaseText,
}: FriendStairsProps) {
  const steps = [
    { at: stairs.tease, label: "予兆" },
    { at: stairs.partTwo, label: "予測が開く" },
    { at: stairs.complete, label: "本物が完成" },
  ];

  return (
    <div className="mb-8">
      {/* ── 進捗レール (1 → 3 → 5) ── */}
      <ol className="flex items-start justify-between gap-2" aria-label="友達回答の階段">
        {steps.map((step, i) => {
          const reached = friendCount >= step.at;
          return (
            <li key={step.at} className="flex flex-1 items-start">
              {/* 接続線 (2つ目以降の左側) */}
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={`mt-[18px] h-[3px] w-full rounded-full ${
                    reached ? "bg-[#5B5BEF]" : "bg-[#E3E6F5]"
                  }`}
                />
              )}
              <span className="flex min-w-[64px] flex-col items-center gap-1">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-[3px] text-sm font-black ${
                    reached
                      ? "border-[#5B5BEF] bg-[#5B5BEF] text-white"
                      : "border-[#E3E6F5] bg-white text-[#2E2E5C]/50"
                  }`}
                >
                  {step.at}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] font-black ${
                    reached ? "text-[#2E2E5C]" : "text-[#2E2E5C]/45"
                  }`}
                >
                  {step.label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-[12px] font-bold text-[#2E2E5C]/60">
        いま友達{friendCount}人が回答済み
      </p>

      {/* ── 予兆カード (1人目の報酬。第二部が開くまでの間だけ) ── */}
      {teaseText && friendCount >= stairs.tease && friendCount < stairs.partTwo && (
        <div className="mt-4 rounded-2xl border border-[#E3E6F5] bg-[#F7F7FE] px-5 py-4 text-center">
          <p className="mb-1 text-[12px] font-black tracking-wide text-[#5B5BEF]">
            予兆
          </p>
          <p className="text-[14px] font-bold leading-relaxed text-[#2E2E5C]">
            {teaseText}
          </p>
          <p className="mt-2 text-[12px] font-bold text-[#2E2E5C]/60">
            あと{stairs.partTwo - friendCount}人で、見られ方の予測がぜんぶ開く。
          </p>
        </div>
      )}
    </div>
  );
}
