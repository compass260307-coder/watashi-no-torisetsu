"use client";

// /tako 友達タブ (2026-07-18 1人完結モデル):
//   友達1人ごとに独立した結果シートができ、名前タブで切り替える。
//   平均 (みんなの目) は廃止。パネル本体はサーバで全員ぶん描画済みを props で受け取り、
//   ここでは表示切替だけを行う (本文の再計算・データ取得をクライアントでしない)。
//   末尾の「＋」タブ (invitePanel 指定時のみ) は、タブの下に吹き出し (ポップオーバー) で
//   招待パネルを開く。背景は暗くしない。外側タップ / Esc / 再タップで閉じる。
//
// 2026-07-20: 友達からのひとことメッセージを、その友達のアバターから吹き出しで
//   しゃべらせる (無料コンテンツ)。タブを選ぶと自動でぽこっと出る。同じアバターを
//   もう一度タップでトグル。招待吹き出しとは同時に開かない。

import { useEffect, useRef, useState, type ReactNode } from "react";

const NAVY = "#2E2E5C";
const INDIGO = "#5B5BEF";

// タブ表示用: 自由入力の名前が長いときの折返し崩れを防ぐ (表示のみ切り詰め)。
function tabLabel(name: string): string {
  const trimmed = name.trim() || "ともだち";
  return trimmed.length > 6 ? `${trimmed.slice(0, 6)}…` : trimmed;
}

export type FriendTab = {
  /** 友達の表示名。 */
  name: string;
  /** その友達から見えたキャラの顔画像 (無ければ頭文字にフォールバック)。 */
  imageSrc: string | null;
  /** 友達からのひとことメッセージ (全文)。無ければ空/undefined で吹き出しなし。 */
  message?: string | null;
};

export function TakoFriendTabs({
  tabs,
  panels,
  invitePanel,
  unlockCta,
}: {
  /** 友達タブ (panels と同順)。キャラアイコン + 名前で表示する。 */
  tabs: FriendTab[];
  /** 友達ごとの結果シート (サーバ描画済み・tabs と同順)。 */
  panels: ReactNode[];
  /** 「＋」タブの吹き出しで開く招待パネル (さらに友達診断してもらう導線)。省略時はタブを出さない。 */
  invitePanel?: ReactNode;
  /** タブ行の右端に置く解除CTA (未購入時のみ渡す)。タブとは独立して右端に固定。 */
  unlockCta?: ReactNode;
}) {
  const [idx, setIdx] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  // メッセージ吹き出し: 開いているタブ index (null = 閉)。
  const [msgOpenIdx, setMsgOpenIdx] = useState<number | null>(null);
  // 吹き出しの矢印位置 (対象ボタン中央) とバー幅。タブ行ラッパー基準の px。
  const [arrowX, setArrowX] = useState<number | null>(null);
  const [barW, setBarW] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const anchorTo = (el: HTMLElement | null) => {
    if (!el || !barRef.current) return;
    const bar = barRef.current.getBoundingClientRect();
    const btn = el.getBoundingClientRect();
    setArrowX(btn.left - bar.left + btn.width / 2);
    setBarW(bar.width);
  };

  const openMessage = (i: number) => {
    if (!tabs[i]?.message?.trim()) return;
    setInviteOpen(false);
    anchorTo(tabRefs.current[i]);
    setMsgOpenIdx(i);
  };

  const handleTabClick = (i: number) => {
    if (i === idx) {
      // 同じアバターの再タップは吹き出しトグル
      if (msgOpenIdx === i) setMsgOpenIdx(null);
      else openMessage(i);
      return;
    }
    setIdx(i);
  };

  // タブ選択が変わったら、その友達のメッセージを少し遅らせて自動でぽこっと出す。
  // (即時 setState は cascading render になるため、閉じる方もタイマーで非同期に行う)
  useEffect(() => {
    const close = window.setTimeout(() => setMsgOpenIdx(null), 0);
    if (!tabs[idx]?.message?.trim()) return () => window.clearTimeout(close);
    const t = window.setTimeout(() => {
      anchorTo(tabRefs.current[idx]);
      setMsgOpenIdx(idx);
    }, 350);
    return () => {
      window.clearTimeout(close);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const toggleInvite = () => {
    if (!inviteOpen) {
      setMsgOpenIdx(null);
      anchorTo(plusRef.current);
    }
    setInviteOpen((v) => !v);
  };

  const anyBubbleOpen = inviteOpen || msgOpenIdx !== null;

  // 外側タップ / Esc で閉じる (暗幕オーバーレイは使わない: 下の要素の操作を殺さない)。
  useEffect(() => {
    if (!anyBubbleOpen) return;
    const close = () => {
      setInviteOpen(false);
      setMsgOpenIdx(null);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const handleOutside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (bubbleRef.current?.contains(t)) return;
      if (plusRef.current?.contains(t)) return;
      if (tabRefs.current.some((el) => el?.contains(t))) return;
      close();
    };
    window.addEventListener("keydown", handleEsc);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [anyBubbleOpen]);

  const msgTab = msgOpenIdx !== null ? tabs[msgOpenIdx] : null;

  return (
    <div>
      {/* ── 名前タブ (横スクロール可・通常スクロール)。吹き出しの基準にするため relative ── */}
      <div ref={barRef} className="relative mb-2">
        <div className="-mx-4 flex items-center gap-2 px-4 md:mx-0 md:px-0">
          <div
            role="tablist"
            aria-label="友達ごとの結果"
            className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-2 pt-6"
          >
          {tabs.map((tab, i) => {
            const selected = i === idx;
            return (
              <button
                key={i}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                aria-selected={selected}
                onClick={() => handleTabClick(i)}
                className="relative flex w-14 flex-shrink-0 flex-col items-center gap-1"
              >
                {/* キャラ顔アバター (選択中は紫リング) */}
                <span
                  className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white transition-all"
                  style={{
                    boxShadow: selected
                      ? `0 0 0 3px ${INDIGO}`
                      : "0 0 0 3px #E3E6F5",
                  }}
                >
                  {tab.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tab.imageSrc}
                      alt=""
                      className="block h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[18px] font-black" style={{ color: NAVY }}>
                      {(tab.name.trim() || "と").slice(0, 1)}
                    </span>
                  )}
                </span>
                {/* メッセージ持ちの友達には 💬 ミニバッジ */}
                {Boolean(tab.message?.trim()) && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-0.5 top-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white shadow-[0_1px_4px_rgba(46,46,92,0.25)]"
                    style={{ width: 18, height: 18 }}
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill={INDIGO}
                      aria-hidden="true"
                    >
                      <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
                    </svg>
                  </span>
                )}
                <span
                  className="max-w-full truncate text-[11px] font-black"
                  style={{ color: selected ? INDIGO : "rgba(46,46,92,0.65)" }}
                >
                  {tabLabel(tab.name)}
                </span>
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
              className="flex w-14 flex-shrink-0 flex-col items-center gap-1"
            >
              {/* 友達アバターと同サイズの円。開いている間は紫塗り + ＋が ✕ に回転。 */}
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200"
                style={
                  inviteOpen
                    ? { background: INDIGO, boxShadow: `0 0 0 3px ${INDIGO}` }
                    : { background: "#EDEEFC", boxShadow: "0 0 0 3px #E3E6F5" }
                }
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={inviteOpen ? "#fff" : INDIGO}
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  className={`transition-transform duration-200 ${
                    inviteOpen ? "rotate-45" : ""
                  }`}
                >
                  <line x1="12" y1="4.5" x2="12" y2="19.5" />
                  <line x1="4.5" y1="12" x2="19.5" y2="12" />
                </svg>
              </span>
              <span
                className="text-[11px] font-black"
                style={{ color: inviteOpen ? INDIGO : "rgba(46,46,92,0.65)" }}
              >
                招待
              </span>
            </button>
          )}
          </div>

          {/* 右端の解除CTA (タブのスクロールに巻き込まれない) */}
          {unlockCta && <div className="flex-shrink-0 py-3">{unlockCta}</div>}
        </div>

        {/* ── 吹き出し (対象アバター直下・矢印つき小カード)。招待 or メッセージのどちらか ── */}
        {(inviteOpen || (msgTab && msgOpenIdx !== null)) && (
          <div
            ref={bubbleRef}
            role="dialog"
            aria-label={inviteOpen ? "友達を招待" : `${msgTab?.name}からのメッセージ`}
            className="animate-modal-slide-up absolute inset-x-0 top-full z-30"
          >
            {/* 矢印 (対象ボタン中央に合わせた回転スクエア) */}
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
              className="rounded-[20px] bg-white px-5 pb-5 pt-5"
              // カードは矢印 (アンカーのアバター中央) の近くに寄せ、バー幅内にクランプ。
              // 中央寄せ固定だと PC 幅で矢印とカードが離れてしまう (2026-07-20 修正)。
              style={(() => {
                const w = barW ?? 440;
                const cardW = Math.min(440, w);
                const left = Math.min(
                  Math.max((arrowX ?? 24) - 40, 0),
                  Math.max(w - cardW, 0),
                );
                return {
                  width: cardW,
                  marginLeft: left,
                  border: "1px solid rgba(46,46,92,0.10)",
                  boxShadow: "0 12px 32px rgba(46,46,92,0.18)",
                };
              })()}
            >
              {inviteOpen ? (
                invitePanel
              ) : (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-black text-[#5B5BEF]">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
                    </svg>
                    {msgTab?.name}からのひとこと
                  </p>
                  <p className="body-gothic whitespace-pre-wrap text-[15px] font-normal leading-[1.7] text-[#1A1A1A]">
                    {msgTab?.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 選択中の友達の結果シート ── */}
      {panels[idx]}
    </div>
  );
}
