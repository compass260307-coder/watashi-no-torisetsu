"use client";

// 他己診断 (タコ診断) ページ /tako/[token] のロック空状態。
// 友達の回答が解除条件 (3人) に満たないとき表示する。
//   - 背景: 本来の他己コンテンツの代わりに軽量ダミー (キャラ影+ダミーバー+解説行) を
//     blur(7px)+opacity 低下+pointer-events無効 で「この先に結果がある」チラ見せ。
//   - オーバーレイ: ページ地色グラデで覆い、中央に 鍵 / 見出し / 進捗 / QR / 誘導。
//   - 触れるのは QR・友達誘導・シェアのみ (LockedInviteShare が担う)。配色は全ネイビー基調。

import { LockedInviteShare } from "./LockedInviteShare";

interface TakoLockedStateProps {
  friendCount: number;
  threshold: number;
  inviteUrl: string;
}

export function TakoLockedState({
  friendCount,
  threshold,
  inviteUrl,
}: TakoLockedStateProps) {
  const remaining = Math.max(0, threshold - friendCount);

  return (
    <div className="relative min-h-[560px] overflow-hidden rounded-3xl">
      {/* ===== ぼかしダミー背景 (チラ見せ) =====
          absolute 背景に敷き、高さは下の中身 (通常フロー) が決める。
          以前は中身が absolute で親高さに寄与せず、min-h を超えた QR が
          overflow-hidden で下端見切れしていたため、レイヤーを入れ替えた。 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 select-none px-6 pt-10"
        style={{ filter: "blur(7px)", opacity: 0.4, pointerEvents: "none" }}
      >
        <div className="mx-auto mb-8 h-40 w-40 rounded-full bg-[#2A3A5C]/20" />
        <div className="mx-auto mb-8 h-6 w-40 rounded-full bg-[#2A3A5C]/15" />
        <div className="space-y-3">
          {[72, 48, 84, 56, 64].map((w, i) => (
            <div
              key={i}
              className="h-4 rounded-full bg-[#2A3A5C]/12"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="mt-8 space-y-2">
          <div className="h-3 w-5/6 rounded bg-[#2A3A5C]/10" />
          <div className="h-3 w-4/6 rounded bg-[#2A3A5C]/10" />
          <div className="h-3 w-3/5 rounded bg-[#2A3A5C]/10" />
        </div>
      </div>

      {/* ===== オーバーレイ (地色グラデ + 中央カード) =====
          通常フロー (relative) にして高さを中身が決める → QR 全体が
          親に収まり見切れない。下端に余白 (pb-10) を確保。 */}
      <div
        className="relative flex flex-col items-center px-5 pt-10 pb-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(228,224,245,0.35) 0%, rgba(228,224,245,0.94) 42%, #E4E0F5 100%)",
        }}
      >
        {/* 鍵アイコン (ネイビー丸) */}
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#2A3A5C]">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" stroke="#fff" strokeWidth="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="15" r="1.5" fill="#fff" />
          </svg>
        </div>

        <h2 className="text-[#2A3A5C] font-black text-xl text-center leading-snug mb-2">
          友達の目が、まだ届いていません
        </h2>
        <p className="text-[#2A3A5C]/75 text-sm text-center leading-relaxed mb-6 max-w-[320px]">
          {threshold}人が診断してくれると、
          <br />
          「みんなから見たあなた」が解けます。
        </p>

        {/* 進捗ドット + 「N / 3 人」 */}
        <div
          className="flex items-center justify-center gap-2.5 mb-1"
          role="progressbar"
          aria-valuenow={friendCount}
          aria-valuemin={0}
          aria-valuemax={threshold}
        >
          {Array.from({ length: threshold }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full ${
                i < friendCount ? "bg-[#2A3A5C]" : "bg-[#2A3A5C]/20"
              }`}
            />
          ))}
        </div>
        <p className="text-[#2A3A5C] font-black text-sm mb-1">
          {friendCount} / {threshold} 人
        </p>
        {remaining > 0 && (
          <p className="text-[#2A3A5C]/60 font-bold text-xs mb-6">
            あと {remaining} 人で解けます
          </p>
        )}

        {/* QR + 友達誘導 + シェア (触れるのはここだけ) */}
        <div className="w-full max-w-[360px]">
          <p className="text-center text-[#2A3A5C] font-black text-sm mb-3">
            友達に読み取ってもらおう
          </p>
          <LockedInviteShare inviteUrl={inviteUrl} />
        </div>
      </div>
    </div>
  );
}
