// Phase 1.5-α Day 12-Polish-G: インライン・ロックカード (価値先行)
//
// ブラー処理された有料セクションの上に重ねるオーバーレイ。
// 旧「¥500 で解除」の素ピル連打を置き換える。
//
// 構成 (16P 価値先行):
//   - lock アイコン (deepPurple 円 + sunYellow lock SVG)
//   - 価値先行の 1 行 (そのセクションで読めるものを言う)
//   - 「解除する」小ボタン (owner かつ未 unlock のときのみ。既存 ¥500 決済に接続)
//
// 購入導線は owner 限定 (create-perception-unlock-session が target_user_id 一致を要求)。
// 非 owner の閲覧者には価値先行メッセージのみ見せ、ボタンは出さない。

import { UnlockButton } from "./UnlockButton";

interface InlineLockCardProps {
  perceptionId: string;
  /** そのセクションで読めるものを言う価値先行の 1 行 */
  value: string;
  /** owner かつ未 unlock のとき true。true のときのみ「解除する」ボタンを出す */
  canPurchase: boolean;
}

export function InlineLockCard({
  perceptionId,
  value,
  canPurchase,
}: InlineLockCardProps) {
  return (
    <div className="flex flex-col items-center text-center gap-2.5">
      {/* lock アイコン: deepPurple 円 + sunYellow lock SVG */}
      <span className="w-10 h-10 rounded-full bg-[#2E2E5C] flex items-center justify-center shadow-md">
        <LockIcon className="w-5 h-5 text-[#5B5BEF]" />
      </span>

      {/* 価値先行の 1 行 */}
      <p className="text-[#2E2E5C] font-black text-sm leading-snug">{value}</p>

      {/* 「解除する」ボタン (owner かつ未 unlock のみ) */}
      {canPurchase && (
        <UnlockButton
          perceptionId={perceptionId}
          label="解除する"
          variant="inline"
        />
      )}
    </div>
  );
}

// インライン SVG 鍵アイコン (T3-5 ブランド方針: 絵文字 🔒 を使わず自前 SVG)
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
