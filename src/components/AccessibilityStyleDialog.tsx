"use client";

// アクセシビリティスタイルの設定モーダル (ヘッダーのボタンから開く)。
// 言語モーダル (TopHeader) と同じ dialog 要素の作りにそろえ、背景の inert 化・
// Escape・フォーカスの戻しはブラウザ標準に任せる。
// チェックを入れた瞬間に画面へ反映する (保存ボタンは置かない): 効果をその場で
// 見比べられるようにするため。反映と保存は lib/a11y-style.ts が担う。
// 開いている間だけマウントされる前提 (TopHeader 側で出し分ける)。

import {
  A11Y_STYLE_KEYS,
  readA11yStyle,
  setA11yStyle,
  type A11yStyle,
  type A11yStyleKey,
} from "@/lib/a11y-style";
import type { HeaderContent } from "@/i18n/ui/types";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

const NAVY = "#2E2E5C";

export function AccessibilityStyleDialog({
  copy,
  onClose,
  style,
}: {
  copy: HeaderContent["accessibility"];
  onClose: () => void;
  style?: CSSProperties;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selected, setSelected] = useState<A11yStyle>(() => readA11yStyle());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // 閉じるときは dialog.close() を通す (ブラウザが開く前のボタンへフォーカスを戻す)。
  // close イベント → onClose で親がアンマウントする。
  const close = () => dialogRef.current?.close();

  const toggle = (key: A11yStyleKey) => {
    const next = { ...selected, [key]: !selected[key] };
    setSelected(next);
    setA11yStyle(next);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-xl bg-transparent p-0 text-left shadow-[0_24px_80px_rgba(20,30,50,0.3)] backdrop:bg-[#273247]/45 backdrop:backdrop-blur-[1px]"
      style={style}
    >
      <div className="max-h-[calc(100dvh-32px)] overflow-y-auto rounded-xl bg-white px-5 pb-6 pt-5 sm:px-10 sm:pb-10 sm:pt-8">
        <div className="flex items-start justify-between gap-4">
          <h2
            id={titleId}
            className="pt-1 text-[22px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[30px]"
            style={{ color: NAVY }}
          >
            {copy.title}
          </h2>
          <button
            type="button"
            aria-label={copy.ariaClose}
            onClick={close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D9DCE4] text-[#7D8493] transition-colors hover:border-[#BFC3CE] hover:bg-[#F4F5F7] hover:text-[#34394A]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </g>
            </svg>
          </button>
        </div>
        <p className="mt-3 text-[14px] leading-[1.8] text-[#34394A] sm:text-[16px]">
          {copy.lead}
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:mt-7">
          {A11Y_STYLE_KEYS.map((key) => {
            const option = copy.options[key];
            const checked = selected[key];
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-start gap-3.5 rounded-xl border px-4 py-4 transition-colors sm:gap-4 sm:px-6 sm:py-5 ${
                  checked
                    ? "border-[#5B5BEF] bg-[#F5F5FF]"
                    : "border-[#D9DCE4] bg-white hover:bg-[#F7F7F9]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(key)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#5B5BEF] ${
                    checked
                      ? "border-[#5B5BEF] bg-[#5B5BEF]"
                      : "border-[#A9AEBB] bg-white"
                  }`}
                >
                  {checked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="#FFFFFF"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-[16px] font-bold leading-snug sm:text-[18px]"
                    style={{ color: NAVY }}
                  >
                    {option.title}
                  </span>
                  <span className="mt-1 block text-[13px] leading-[1.7] text-[#5A6072] sm:text-[14px]">
                    {option.desc}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}

// ヘッダー用のマーク (輪の中に、手を広げた人)。currentColor で文字色に追従。
// 人の形は丸い線端の太線で描き、小さくても塗りつぶしたように見せる。
export function AccessibilityStyleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="7.5" r="1.7" fill="currentColor" />
      <path
        d="M7.9 10.5h8.2M12 10.5v3.6m0 0l-1.9 3.8m1.9-3.8l1.9 3.8"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
