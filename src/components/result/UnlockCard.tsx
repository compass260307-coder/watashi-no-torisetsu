// Phase 1.5-α Day 12-Polish-G: メイン解除カード (16personalities 構造の移植)
//
// 共通コンポーネント。構造・スタイルは固定し、コピー (見出し・箇条書き・安心文) は
// ページ別に props で差し込む。¥500 維持。
//
// 16P から借りる 4 点:
//   ① 価値先行 (「何が読めるか」を先に言う)
//   ② 解放項目を箇条書きで明示
//   ③ 強い 1 ボタンに集約
//   ④ リスクリバーサル / 社会的証明は意図的に入れない
//      (返金保証・満足度評価は ¥500 の impulse 購入には不安を煽るため不採用)
//
// 構造: eyebrow「UNLOCK」+ 価値先行見出し + 解放項目 3 点 + ¥500 + 1 ボタン + 安心文。
// 決済は UnlockButton (既存フロー、不変) に接続。

import { UnlockButton } from "./UnlockButton";

/** 解放項目: 太字リード + 具体説明 (16P の「太字リード＋具体」フォーマット) */
export interface UnlockBullet {
  lead: string;
  detail: string;
}

interface UnlockCardProps {
  perceptionId: string;
  /** 価値先行の見出し (ページ別) */
  heading: string;
  /** 続編フレーミングの本文 (ページ別、任意) */
  body?: string;
  /** 解放項目の箇条書き (実際に解除される中身に合わせる) */
  bullets: UnlockBullet[];
  /** 安心の一文 (ページ別) */
  reassurance: string;
  eyebrow?: string;
  priceLabel?: string;
  ctaLabel?: string;
}

export function UnlockCard({
  perceptionId,
  heading,
  body,
  bullets,
  reassurance,
  eyebrow = "UNLOCK",
  priceLabel = "¥500",
  ctaLabel = "¥500 で全部読む →",
}: UnlockCardProps) {
  return (
    // id: Polish-G 追加でロック本文タップ時のスクロール先 + pulse 対象 (LockedBlur が参照)
    <div
      id="unlock-card"
      className="bg-[#FFF9F0] border-[3px] border-[#3A2D6B] rounded-[24px] p-5 mb-8">
      {/* eyebrow */}
      <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-2">
        {eyebrow}
      </p>

      {/* 価値先行の見出し */}
      <h2 className="text-[#3A2D6B] font-black text-xl leading-tight mb-3">
        {heading}
      </h2>

      {/* 続編フレーミングの本文 */}
      {body && (
        <p className="text-[#3A2D6B]/80 text-sm leading-relaxed mb-4">{body}</p>
      )}

      {/* 解放項目の箇条書き (check SVG + 太字リード＋具体) */}
      <ul className="flex flex-col gap-2.5 mb-5">
        {bullets.map((b) => (
          <li key={b.lead} className="flex gap-2 items-start">
            <CheckIcon className="w-4 h-4 text-[#FE3C72] flex-shrink-0 mt-1" />
            <span className="text-[#3A2D6B] text-sm leading-snug">
              <span className="font-black">{b.lead}</span>
              <span className="font-medium">：{b.detail}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* 価格 (大) */}
      <p className="text-center text-[#3A2D6B] font-black text-4xl leading-none mb-4">
        {priceLabel}
      </p>

      {/* 強い 1 ボタン (既存 ¥500 決済フローに接続) */}
      <div className="flex justify-center">
        <UnlockButton
          perceptionId={perceptionId}
          label={ctaLabel}
          variant="main"
        />
      </div>

      {/* 安心の一文 (返金保証・満足度評価は入れない) */}
      <p className="text-center text-[#3A2D6B]/55 text-[11px] font-bold mt-4 leading-relaxed">
        {reassurance}
      </p>
    </div>
  );
}

// インライン SVG チェックアイコン (T3-5 ブランド方針: 絵文字を使わず自前 SVG)
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
