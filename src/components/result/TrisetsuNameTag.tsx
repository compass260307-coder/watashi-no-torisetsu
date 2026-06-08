// Phase 1.5-α: ロゴ風タグ (Koi 参考)。
//
// [花] 「{name}のトリセツ」 [ハート] を中央寄せ 1 行。
// 文字はヘッダーロゴ wordmark に寄せた .wtr-logo-text (logoBlue 塗り + 太い白フチ + にじみ)。
// 花/ハートは指定 SVG をそのまま使用。
//
// text を渡すと「のトリセツ」を付けず text をそのまま表示 (例: 相互理解度ページの
// 「◯◯さんから見た△△」)。スタイル/装飾/レスポンシブは /me と完全に同一。

interface TrisetsuNameTagProps {
  /** 「{name}のトリセツ」として表示する名前 (text 未指定時)。 */
  name?: string;
  /** 任意のラベル全文。指定時は「のトリセツ」を付けず、これをそのまま表示する。 */
  text?: string;
  className?: string;
}

export function TrisetsuNameTag({
  name,
  text,
  className = "",
}: TrisetsuNameTagProps) {
  const label = text ?? `${name ?? ""}のトリセツ`;
  return (
    // 花［テキスト］ハートを必ず横一列に: flex-nowrap + 中央寄せ。max-w-full でコンテナ幅に収める。
    <div
      className={`flex flex-nowrap items-center justify-center gap-2 max-w-full ${className}`.trim()}
    >
      <FlowerIcon />
      {/* 1行固定 (nowrap) + フォントを clamp でレスポンシブ (スマホは画面幅に合わせ縮小)。
          min-w-0 で長い名前でも flex がコンテナ幅を超えないように。 */}
      <span
        className="wtr-logo-text leading-none min-w-0"
        style={{ fontSize: "clamp(18px, 5.5vw, 30px)", whiteSpace: "nowrap" }}
      >
        {label}
      </span>
      <HeartIcon />
    </div>
  );
}

function FlowerIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <g fill="#B7A8EC">
        <ellipse cx="12" cy="5" rx="3.2" ry="4.6" />
        <ellipse cx="12" cy="19" rx="3.2" ry="4.6" />
        <ellipse cx="5" cy="12" rx="4.6" ry="3.2" />
        <ellipse cx="19" cy="12" rx="4.6" ry="3.2" />
      </g>
      <circle cx="12" cy="12" r="3.6" fill="#FFE07A" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M12 21C12 21 3 14 3 8.5 3 5.5 5.2 3.5 7.8 3.5 9.6 3.5 11.1 4.6 12 6 12.9 4.6 14.4 3.5 16.2 3.5 18.8 3.5 21 5.5 21 8.5 21 14 12 21 12 21Z"
        fill="#FE8FB0"
      />
    </svg>
  );
}
