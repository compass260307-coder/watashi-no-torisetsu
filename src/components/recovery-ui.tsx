// 購入まわりの「うまくいかなかったとき」の画面で共通に使う部品 (色・線のアイコン・アイコンの台)。
// 使う画面: 購入を確認できなかった画面 (PurchaseUnverifiedRecovery)、購入後の反映待ち (PaidUnlockWatcher)。
// 見た目は診断ページ冒頭 (DiagnosisHero) の型にそろえている。

import type { ReactNode } from "react";

export const FONT_STACK =
  "var(--font-noto-sans), 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif";
export const NAVY = "#2E2E5C";
export const ACCENT = "#5B5BEF";
export const AMBER = "#E0A544";
export const PALT = '"palt"';
export const BAND_CURVE = "50% 28px";
export const CARD_SHADOW =
  "shadow-[0_1px_1px_rgba(46,46,92,0.03),0_6px_14px_-6px_rgba(46,46,92,0.1),0_22px_40px_-22px_rgba(46,46,92,0.22)]";
export const SUPPORT_MAILTO =
  "mailto:support@watashi-torisetsu.com?subject=%E8%B3%BC%E5%85%A5%E3%81%97%E3%81%9F%E5%86%85%E5%AE%B9%E3%81%8C%E4%BD%BF%E3%81%88%E3%81%BE%E3%81%9B%E3%82%93";

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function MailIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 8 8 5.5L20 8" />
    </svg>
  );
}

export function TapIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M9.5 13.5 7.8 12a1.6 1.6 0 0 0-2.3 2.2l3.7 4.6A4 4 0 0 0 12.3 20H15a4 4 0 0 0 4-4v-3.2a1.5 1.5 0 0 0-3 0" />
      <path d="M16 12.6v-1a1.5 1.5 0 0 0-3 0" />
      <path d="M13 11.8V6a1.75 1.75 0 0 0-3.5 0v7.5" />
      <path d="M6 5.2 5 4.2M13.6 3.4l.6-1.2M9.3 3 9 1.7" />
    </svg>
  );
}

export function UnlockIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.6" />
      <path d="M8 10.5V7.4a4 4 0 0 1 7.6-1.7" />
      <path d="M12 14.6v2" />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg {...ICON_PROPS} aria-hidden="true">
      <path d="M12 3.2 5 5.8v5.4c0 4.3 2.9 7.6 7 9.6 4.1-2 7-5.3 7-9.6V5.8z" />
      <path d="m9.2 12 2 2 3.7-4" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconTile({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "amber" }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)]"
      style={{
        background:
          tone === "amber"
            ? "linear-gradient(160deg,#FFF8E6 0%,#FBECC6 100%)"
            : "linear-gradient(160deg,#F7F5FE 0%,#E9E6F9 100%)",
        color: tone === "amber" ? "#A8741A" : ACCENT,
      }}
    >
      {children}
    </span>
  );
}


// 見出しの上の絵の土台: レシートと奥のカード。右下の印 (虫めがね・時計など) は children で重ねる。
// 黄色は「確認が必要」の印だけに使う。
export function ReceiptArt({ children }: { children?: ReactNode }) {
  return (
    <svg
      width="132"
      height="112"
      viewBox="0 0 132 112"
      fill="none"
      aria-hidden="true"
      className="mx-auto"
    >
      <ellipse cx="66" cy="102" rx="44" ry="6" fill="#DAD5F2" />
      {/* 奥のカード */}
      <rect
        x="50"
        y="14"
        width="58"
        height="74"
        rx="10"
        transform="rotate(8 79 51)"
        fill="#E3DFF8"
      />
      {/* レシート */}
      <path
        d="M30 16a9 9 0 0 1 9-9h42a9 9 0 0 1 9 9v72.5l-7.5-4.6-7.5 4.6-7.5-4.6-7.5 4.6-7.5-4.6-7.5 4.6-7.5-4.6-7.5 4.6z"
        fill="#FFFFFF"
        stroke="#D5D0EE"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="27" r="7" fill="#EEEDFC" />
      <path
        d="m43 27 2.2 2.2 4-4.4"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="58" y="22" width="22" height="4" rx="2" fill="#C9C5E0" />
      <rect x="58" y="29" width="14" height="4" rx="2" fill="#E3E0F2" />
      <path d="M38 44h44" stroke="#E3E0F2" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
      <rect x="38" y="53" width="30" height="4" rx="2" fill="#E3E0F2" />
      <rect x="38" y="62" width="22" height="4" rx="2" fill="#E3E0F2" />
      <rect x="70" y="62" width="12" height="4" rx="2" fill="#C9C5E0" />
      {children}
      {/* きらめき */}
      <path d="M17 40v8M13 44h8" stroke="#C9C5E0" strokeWidth="2" strokeLinecap="round" />
      <path d="M116 22v6M113 25h6" stroke={AMBER} strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="70" r="2.5" fill="#DAD5F2" />
    </svg>
  );
}
