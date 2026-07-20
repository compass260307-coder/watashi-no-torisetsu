// 友達診断 /tako 結果ページの「◯◯さんから見た恋愛傾向」のモテポイント。
// 2026-07-20: 「関係を深めるヒント」と同じチェックリスト組版 (緑チェック + 太字タイトル +
// 短文、PC 2カラム) に刷新。5軸ぶんのモテ理由 + 隠れた魅力の 6 項目を
// resolveFriendLoveChecklist (friend-love-content.ts) から受け取る。

import type { ReactNode } from "react";
import type { MoteCheckItem } from "@/lib/friend-love-content";

interface FriendLoveSectionProps {
  items: MoteCheckItem[];
  /** 「モテるための◯◯さんからのヒント」(resolveMoteHints・6項目のチェックリスト)。 */
  hints?: MoteCheckItem[];
  /** 「誰から見たか」の表示名 (例 "ゆかさん")。省略時は総称「友達」。 */
  viewer?: string;
  /**
   * tako_unlock 未購入時のロックブロック (TakoLockedBlock)。指定時は
   * モテポイント/ヒントの中身の代わりに表示する (見出しは残す)。
   * セクション別に文言を最適化するため 2 つ受け取る。
   * フェイルクローズ: ロック時は items/hints に実データを渡さないこと。
   */
  lockedBlocks?: { mote: ReactNode; hints: ReactNode };
}

// リスト行 (丸アイコン + 太字タイトル + 短文)。
//   icon="check" = 緑チェック (モテポイント) / icon="heart" = ピンクのハート (ヒント)。
function CheckRow({
  item,
  icon = "check",
}: {
  item: MoteCheckItem;
  icon?: "check" | "heart";
}) {
  const color = icon === "heart" ? "#FF6B9D" : "#4CAF7D";
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
          style={{ borderColor: color, color }}
        >
          {icon === "heart" ? (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20.5s-6.2-4-8.6-7.6C1.7 10.4 2.4 7.1 5.1 5.8c1.9-.9 4.1-.4 5.5 1.1L12 8.3l1.4-1.4c1.4-1.5 3.6-2 5.5-1.1 2.7 1.3 3.4 4.6 1.7 7.1C18.2 16.5 12 20.5 12 20.5z" />
            </svg>
          ) : (
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
        {item.title}
      </p>
      <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
        {item.body}
      </p>
    </div>
  );
}

export function FriendLoveSection({
  items,
  hints,
  viewer,
  lockedBlocks,
}: FriendLoveSectionProps) {
  if (!lockedBlocks && items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-5 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
        {viewer ?? "友達"}から見た隠れモテポイント
      </h3>
      {lockedBlocks?.mote ?? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          {items.map((it) => (
            <CheckRow key={it.title} item={it} />
          ))}
        </div>
      )}

      {/* モテるための◯◯さんからのヒント (同じチェックリスト組版・6項目) */}
      {(lockedBlocks || (hints && hints.length > 0)) && (
        <div className="mt-10">
          <h3 className="mb-5 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
            モテるための{viewer ?? "友達"}からのヒント
          </h3>
          {lockedBlocks?.hints ?? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              {(hints ?? []).map((it) => (
                <CheckRow key={it.title} item={it} icon="heart" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
