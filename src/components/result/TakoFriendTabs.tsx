"use client";

// /tako 友達タブ (2026-07-18 1人完結モデル):
//   友達1人ごとに独立した結果シートができ、名前タブで切り替える。
//   平均 (みんなの目) は廃止。パネル本体はサーバで全員ぶん描画済みを props で受け取り、
//   ここでは表示切替だけを行う (本文の再計算・データ取得をクライアントでしない)。
//   末尾の「＋」タブ (invitePanel 指定時のみ) は、タブの下に吹き出し (ポップオーバー) で
//   招待パネルを開く (2026-07-20 指示)。背景は暗くしない。外側タップ / Esc / ＋再タップで閉じる。

import { useEffect, useRef, useState, type ReactNode } from "react";

const NAVY = "#2E2E5C";
const INDIGO = "#5B5BEF";

// タブ表示用: 自由入力の名前が長いときの折返し崩れを防ぐ (表示のみ切り詰め)。
function tabLabel(name: string): string {
  const trimmed = name.trim() || "ともだち";
  return trimmed.length > 8 ? `${trimmed.slice(0, 8)}…` : trimmed;
}

export function TakoFriendTabs({
  names,
  panels,
  invitePanel,
}: {
  /** 友達の表示名 (panels と同順)。 */
  names: string[];
  /** 友達ごとの結果シート (サーバ描画済み・names と同順)。 */
  panels: ReactNode[];
  /** 「＋」タブの吹き出しで開く招待パネル (さらに友達診断してもらう導線)。省略時はタブを出さない。 */
  invitePanel?: ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  // 吹き出しの矢印位置 (＋ボタン中央)。タブ行ラッパー基準の px。
  const [arrowX, setArrowX] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const toggleInvite = () => {
    if (!inviteOpen && barRef.current && plusRef.current) {
      const bar = barRef.current.getBoundingClientRect();
      const btn = plusRef.current.getBoundingClientRect();
      setArrowX(btn.left - bar.left + btn.width / 2);
    }
    setInviteOpen((v) => !v);
  };

  // 外側タップ / Esc で閉じる (暗幕オーバーレイは使わない: 下の要素の操作を殺さない)。
  useEffect(() => {
    if (!inviteOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInviteOpen(false);
    };
    const handleOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        bubbleRef.current &&
        !bubbleRef.current.contains(t) &&
        plusRef.current &&
        !plusRef.current.contains(t)
      ) {
        setInviteOpen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [inviteOpen]);

  return (
    <div>
      {/* ── 名前タブ (横スクロール可)。吹き出しの基準にするため relative ── */}
      <div ref={barRef} className="relative">
        <div
          role="tablist"
          aria-label="友達ごとの結果"
          className="scrollbar-none -mx-4 mb-6 flex items-center gap-2 overflow-x-auto px-4 pt-4 md:mx-0 md:px-0"
        >
          {names.map((name, i) => {
            const selected = i === idx;
            return (
              <button
                key={i}
                role="tab"
                aria-selected={selected}
                onClick={() => setIdx(i)}
                className="flex-shrink-0 rounded-full border-[3px] px-5 py-2 text-[14px] font-black transition-colors"
                style={
                  selected
                    ? { background: INDIGO, borderColor: INDIGO, color: "#fff" }
                    : { background: "#fff", borderColor: "#E3E6F5", color: NAVY }
                }
              >
                {tabLabel(name)}
              </button>
            );
          })}
          {/* ＋: 招待の吹き出しを開閉 */}
          {invitePanel && (
            <button
              ref={plusRef}
              aria-expanded={inviteOpen}
              aria-label="友達を招待"
              onClick={toggleInvite}
              className="flex-shrink-0 rounded-full border-[3px] border-dashed px-5 py-2 text-[14px] font-black transition-colors"
              style={
                inviteOpen
                  ? { background: INDIGO, borderColor: INDIGO, color: "#fff" }
                  : { background: "#fff", borderColor: "#C9CDF0", color: INDIGO }
              }
            >
              ＋
            </button>
          )}
        </div>

        {/* ── 吹き出し (＋の直下・矢印つき小カード) ── */}
        {invitePanel && inviteOpen && (
          <div
            ref={bubbleRef}
            role="dialog"
            aria-label="友達を招待"
            className="animate-modal-slide-up absolute inset-x-0 top-full z-30"
          >
            {/* 矢印 (＋ボタン中央に合わせた回転スクエア) */}
            <span
              aria-hidden="true"
              className="absolute -top-[7px] h-[14px] w-[14px] rotate-45 bg-white"
              style={{
                left: (arrowX ?? 24) - 7,
                borderTop: "1px solid rgba(46,46,92,0.10)",
                borderLeft: "1px solid rgba(46,46,92,0.10)",
              }}
            />
            <div
              className="mx-auto w-full max-w-[440px] rounded-[20px] bg-white px-5 pb-5 pt-5"
              style={{
                border: "1px solid rgba(46,46,92,0.10)",
                boxShadow: "0 12px 32px rgba(46,46,92,0.18)",
              }}
            >
              {invitePanel}
            </div>
          </div>
        )}
      </div>

      {/* ── 選択中の友達の結果シート ── */}
      {panels[idx]}
    </div>
  );
}
