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
import Image from "next/image";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import type { ResultLocale } from "@/i18n/result";

const NAVY = "#2E2E5C";
const INDIGO = "#5B5BEF";
const FRIEND_HASH_PREFIX = "friend-";

// タブ表示用: 自由入力の名前が長いときの折返し崩れを防ぐ (表示のみ切り詰め)。
function tabLabel(name: string, locale: ResultLocale): string {
  const trimmed = name.trim() || (locale === "ko" ? "친구" : "ともだち");
  return trimmed.length > 6 ? `${trimmed.slice(0, 6)}…` : trimmed;
}

export type FriendTab = {
  /** friend_perceptions.id。#friend-<id> で直接タブを開くために使う。 */
  perceptionId?: string;
  /** 友達の表示名。 */
  name: string;
  /** その友達から見えたキャラの顔画像 (無ければ頭文字にフォールバック)。 */
  imageSrc: string | null;
  /** 友達からのひとことメッセージ (全文)。無ければ空/undefined で吹き出しなし。 */
  message?: string | null;
  /** 全ロックシート (2人目以降・未購入)。顔アバター・メッセージは見せたまま
      ミニ鍵バッジを重ね、タップで課金モーダル (PaywallModal) を開く。
      シート本文は panels 側で全ロック (実データはクライアントに渡さない)。 */
  locked?: boolean;
};

function friendTabDomId(perceptionId: string): string {
  return `${FRIEND_HASH_PREFIX}${encodeURIComponent(perceptionId)}`;
}

function perceptionIdFromHash(hash: string): string | null {
  if (!hash.startsWith(`#${FRIEND_HASH_PREFIX}`)) return null;
  const raw = hash.slice(FRIEND_HASH_PREFIX.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function TakoFriendTabs({
  tabs,
  panels,
  invitePanel,
  unlockCta,
  locale = "ja",
}: {
  /** 友達タブ (panels と同順)。キャラアイコン + 名前で表示する。 */
  tabs: FriendTab[];
  /** 友達ごとの結果シート (サーバ描画済み・tabs と同順)。 */
  panels: ReactNode[];
  /** 「＋」タブの吹き出しで開く招待パネル (さらに友達診断してもらう導線)。省略時はタブを出さない。 */
  invitePanel?: ReactNode;
  /** タブ行の右端に置く解除CTA (未購入時のみ渡す)。タブとは独立して右端に固定。 */
  unlockCta?: ReactNode;
  locale?: ResultLocale;
}) {
  const isKo = locale === "ko";
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
  // ロックタブごとに課金モーダルを出したか (同一表示中の再タップでは開き直さない)。
  const paywallShownRef = useRef<Set<number>>(new Set());
  // コメント自動ローテーション: メッセージ持ちの友達の吹き出しを2秒ごとに順繰りに
  // 出す (複数コメントの見せ場)。ユーザーが何か操作したら停止し、以降は従来の
  // タップ挙動に戻る。state はローテ effect の起動/停止用、ref は idx effect が
  // レンダーを跨いで同期的に参照するため (タブ切替 effect との競合回避)。
  const [autoRotate, setAutoRotate] = useState(true);
  const autoRotateRef = useRef(true);
  const stopAutoRotate = () => {
    autoRotateRef.current = false;
    setAutoRotate(false);
  };

  useEffect(() => {
    const selectHashTab = () => {
      const targetId = perceptionIdFromHash(window.location.hash);
      if (!targetId) return;
      const nextIdx = tabs.findIndex((tab) => tab.perceptionId === targetId);
      if (nextIdx < 0) return;
      autoRotateRef.current = false;
      setAutoRotate(false);
      setInviteOpen(false);
      setMsgOpenIdx(null);
      setIdx(nextIdx);
      window.setTimeout(() => {
        tabRefs.current[nextIdx]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }, 0);
    };

    selectHashTab();
    window.addEventListener("hashchange", selectHashTab);
    return () => window.removeEventListener("hashchange", selectHashTab);
  }, [tabs]);

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

  // マウスホバーでそのタブのコメントを出す (デスクトップ用の「触れたら出る」)。
  //   - mouse 限定: タッチは pointerenter がタップ直前に発火し、click 側の
  //     トグルと二重になって開閉が暴れるため、タップ挙動 (handleTabClick) に任せる。
  //   - 開くだけで閉じない (tab→吹き出しへカーソル移動で消えると読めないため)。
  //     閉じるのは従来どおり外側タップ/Esc/別タブ操作。paywall はホバーでは開かない。
  const handleTabHover = (i: number, pointerType: string) => {
    if (pointerType !== "mouse") return;
    if (!tabs[i]?.message?.trim()) return;
    if (msgOpenIdx === i) return;
    stopAutoRotate();
    openMessage(i);
  };

  const handleTabClick = (i: number) => {
    // タブ操作が始まったら自動ローテーションは終了 (以降は手動挙動)。
    stopAutoRotate();
    if (tabs[i]?.locked) {
      // 全ロックシート (2人目以降・未購入): パネルは切り替えない (1人目の
      // 無料シートに留まったまま)。コメント吹き出しは無料なので通常どおり
      // トグルし、課金モーダルは同じタブでは初回タップのみ開く (2回目以降は
      // コメントを読む操作にモーダルを被せない。購入導線は下部カード等にある)。
      // source は歴史的に「友達エントリのタップ」を表す friend_list を継続使用。
      if (msgOpenIdx === i) setMsgOpenIdx(null);
      else openMessage(i);
      if (!paywallShownRef.current.has(i)) {
        paywallShownRef.current.add(i);
        scrollToPaywall("friend_list");
      }
      return;
    }
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
  // 自動ローテーション中は吹き出しをローテ側が管理するため何もしない。
  useEffect(() => {
    if (autoRotateRef.current) return;
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

  // コメント自動ローテーション本体。初回は従来と同じ 350ms 後、以降 2 秒ごとに
  // メッセージ持ちタブ (ロック含む: コメントは無料コンテンツ) を順繰りに表示。
  // 1件ならそのまま出しっぱなし (従来挙動と同等)。停止は stopAutoRotate() 経由。
  useEffect(() => {
    if (!autoRotate) return;
    const idxs = tabs
      .map((t, i) => (t.message?.trim() ? i : -1))
      .filter((i) => i >= 0);
    if (idxs.length === 0) return;
    let pos = 0;
    let interval: number | undefined;
    const show = () => {
      const i = idxs[pos];
      anchorTo(tabRefs.current[i]);
      setMsgOpenIdx(i);
    };
    const first = window.setTimeout(() => {
      show();
      if (idxs.length > 1) {
        interval = window.setInterval(() => {
          pos = (pos + 1) % idxs.length;
          show();
        }, 2000);
      }
    }, 350);
    return () => {
      window.clearTimeout(first);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [autoRotate, tabs]);

  const toggleInvite = () => {
    stopAutoRotate();
    if (!inviteOpen) {
      setMsgOpenIdx(null);
    }
    setInviteOpen((v) => !v);
  };

  const anyBubbleOpen = inviteOpen || msgOpenIdx !== null;

  // 外側タップ / Esc で閉じる (暗幕オーバーレイは使わない: 下の要素の操作を殺さない)。
  useEffect(() => {
    if (!anyBubbleOpen) return;
    const close = () => {
      // 外側タップ/Esc は「もう吹き出しはいい」の意思表示なので自動ローテも止める
      // (止めないと2秒後にまた開いてしまう)。
      stopAutoRotate();
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
      // 課金モーダル (PaywallModal) 上の操作 (×・背景タップ) では閉じない:
      // ロックタブはモーダルと同時に吹き出しを開くため、モーダルを閉じた後も
      // コメントを読めるように残す。
      if (t instanceof Element && t.closest('[role="dialog"]')) return;
      close();
    };
    window.addEventListener("keydown", handleEsc);
    document.addEventListener("pointerdown", handleOutside);
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [anyBubbleOpen]);

  // 招待カードを開いている間は背面をスクロールさせない。スマホではカードの
  // 表示領域を確保するため、サイトヘッダーと下部ナビも一時的に隠す。
  useEffect(() => {
    if (!inviteOpen) return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPaddingBottom = body.style.paddingBottom;
    const mobileChrome = Array.from(
      document.querySelectorAll<HTMLElement>(
        "[data-result-sticky-header], [data-bottom-nav]",
      ),
    );
    const previousDisplays = mobileChrome.map((element) =>
      element.style.getPropertyValue("display"),
    );

    body.style.overflow = "hidden";
    if (window.matchMedia("(max-width: 767px)").matches) {
      body.style.paddingBottom = "0px";
      mobileChrome.forEach((element) => {
        element.style.display = "none";
      });
    }

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingBottom = previousPaddingBottom;
      mobileChrome.forEach((element, index) => {
        element.style.display = previousDisplays[index];
      });
    };
  }, [inviteOpen]);

  const msgTab = msgOpenIdx !== null ? tabs[msgOpenIdx] : null;

  return (
    <div>
      {/* ── 名前タブ (横スクロール可・通常スクロール)。吹き出しの基準にするため relative ── */}
      <div ref={barRef} className="relative mb-2">
        <div className="-mx-4 flex items-center gap-2 px-4 md:mx-0 md:px-0">
          <div
            role="tablist"
            aria-label={isKo ? "친구별 결과" : "友達ごとの結果"}
            className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-2 pt-6"
          >
          {tabs.map((tab, i) => {
            const selected = i === idx;
            return (
              <button
                key={i}
                id={
                  tab.perceptionId ? friendTabDomId(tab.perceptionId) : undefined
                }
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                aria-selected={selected}
                onClick={() => handleTabClick(i)}
                onPointerEnter={(e) => handleTabHover(i, e.pointerType)}
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
                      {(tab.name.trim() || (isKo ? "친" : "と")).slice(0, 1)}
                    </span>
                  )}
                </span>
                {/* ロックシートの友達: アバター右下にミニ鍵バッジ (顔は見せる) */}
                {tab.locked && (
                  <span
                    aria-hidden="true"
                    className="absolute flex items-center justify-center rounded-full"
                    style={{
                      width: 18,
                      height: 18,
                      right: 1,
                      top: 32,
                      background: INDIGO,
                      boxShadow: "0 0 0 2px #fff",
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="#fff" />
                      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
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
                  {tabLabel(tab.name, locale)}
                </span>
              </button>
            );
          })}
          {/* 友達がここへ増えていくことを示す、次の1人ぶんの空き枠。 */}
          {invitePanel && (
            <div
              aria-hidden="true"
              className="flex w-14 flex-shrink-0 flex-col items-center gap-1"
            >
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 border-dashed border-[#D1D4E2] bg-[#FCFCFE]">
                <svg
                  width="27"
                  height="27"
                  viewBox="0 0 25 25"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="9" cy="8" r="3.5" fill="#D1D3DF" />
                  <path
                    d="M2.75 19.5c0-3.7 2.8-6.2 6.25-6.2s6.25 2.5 6.25 6.2"
                    fill="#D8DAE4"
                  />
                  <circle cx="17.25" cy="9.25" r="2.75" fill="#DFE0E8" />
                  <path
                    d="M14.1 14.2c.9-.7 2-1.05 3.15-1.05 2.85 0 5 2.05 5 5.15v1.2h-5.4c-.15-2.15-1.1-4-2.75-5.3Z"
                    fill="#E5E6EC"
                  />
                </svg>
              </span>
              <span className="h-[17px]" />
            </div>
          )}

          {/* ＋: 招待の吹き出しを開閉 */}
          {invitePanel && (
            <button
              ref={plusRef}
              aria-expanded={inviteOpen}
              aria-label={isKo ? "친구 초대" : "友達を招待"}
              onClick={toggleInvite}
              className="flex w-14 flex-shrink-0 flex-col items-center gap-1 focus:outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-[#5B5BEF] focus-visible:ring-offset-2"
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
                {isKo ? "초대" : "招待"}
              </span>
            </button>
          )}
          </div>

          {/* 右端の解除CTA (タブのスクロールに巻き込まれない) */}
          {unlockCta && <div className="flex-shrink-0 py-3">{unlockCta}</div>}
        </div>

        {/* ── 友達からのひとこと吹き出し (対象アバター直下・矢印つき) ── */}
        {msgTab && msgOpenIdx !== null && (
          <div
            // key: 表示対象が変わるたびに再マウントして「ぽわん」を再生する
            // (同一要素の中身差し替えだと CSS アニメが再発火しない)。
            key={`msg-${msgOpenIdx}`}
            ref={bubbleRef}
            role="dialog"
            aria-label={
              isKo
                ? `${msgTab.name}님의 메시지`
                : `${msgTab.name}からのメッセージ`
            }
            className="animate-bubble-pop absolute inset-x-0 top-full z-30"
            // 膨らむ起点 = 矢印 (対象アバターの中央直下)。キャラがしゃべった感を出す。
            style={{ transformOrigin: `${(arrowX ?? 24) - 7}px top` }}
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
                  {isKo
                    ? `${msgTab.name}님이 남긴 한마디`
                    : `${msgTab.name}からのひとこと`}
                </p>
                <p className="body-gothic whitespace-pre-wrap text-[15px] font-normal leading-[1.7] text-[#1A1A1A]">
                  {msgTab.message}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 招待カード。SNS・リンクを主役にし、QRはカード内で任意展開する。 ── */}
      {inviteOpen && invitePanel ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2E2E5C]/40 px-3 py-2 backdrop-blur-[2px] md:px-6 md:py-8"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) setInviteOpen(false);
          }}
        >
          <div
            ref={bubbleRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tako-invite-dialog-title"
            className="animate-bubble-pop relative max-h-[calc(100dvh-1rem)] w-full max-w-[640px] overflow-y-auto rounded-[24px] border border-[#DEDFEC] bg-white shadow-[0_24px_70px_rgba(34,34,70,0.28)] md:max-h-[calc(100dvh-4rem)] md:rounded-[28px]"
            style={{ transformOrigin: "center" }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div aria-hidden="true" className="h-1.5 bg-[#5B5BEF]" />
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              aria-label={isKo ? "초대 카드 닫기" : "招待カードを閉じる"}
              autoFocus
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[#DADBE5] bg-white text-[#8A8A9E] outline-none transition hover:bg-[#F5F5FA] hover:text-[#2E2E5C] focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/45 md:right-5 md:top-5"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>

            <div className="px-5 pb-6 pt-6 md:px-8 md:pb-8 md:pt-8">
              <div className="flex items-center gap-4 pr-10 md:gap-7 md:pr-12">
                <div className="min-w-0 flex-1">
                  <h2
                    id="tako-invite-dialog-title"
                    className="text-[26px] font-black leading-[1.25] text-[#2E2E5C] md:text-[34px]"
                  >
                    {tabs.length === 0
                      ? isKo
                        ? "친구를 초대해요"
                        : "友達を招待しよう"
                      : isKo
                        ? "친구를 더 초대해요"
                        : "もっと友達を招待しよう"}
                  </h2>
                  <p className="mt-2 text-[13px] font-bold leading-[1.7] text-[#73738A] md:text-[14px]">
                    {tabs.length === 0
                      ? isKo
                        ? "한 명이 답하면 친구가 보는 나의 결과가 열려요."
                        : "1人が回答すると「友達から見たあなた」の結果が表示されます。"
                      : isKo
                        ? "답변이 도착할 때마다 친구별 결과 시트가 늘어나요."
                        : "回答が届くたびに、友達ごとの結果シートが増えていきます。"}
                  </p>
                </div>
                <Image
                  src="/empty-states/tako-friends-waiting-felt.png"
                  alt=""
                  aria-hidden="true"
                  width={1402}
                  height={1122}
                  sizes="(min-width: 768px) 150px, 96px"
                  className="h-auto w-24 shrink-0 select-none md:w-[150px]"
                />
              </div>

              <div className="mt-6 border-t border-[#E8E8F1] pt-5 md:mt-7 md:pt-6">
                {invitePanel}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 0人の空状態 / 選択中の友達の結果シート ── */}
      {tabs.length === 0 ? (
        <section className="-mx-4 flex min-h-[calc(100dvh-230px)] flex-col items-center justify-center bg-[#F7F7FA] px-4 pb-28 pt-14 text-center md:mx-0 md:min-h-[560px] md:pb-20 md:pt-16">
          <Image
            src="/empty-states/tako-friends-waiting-felt.png"
            alt=""
            aria-hidden="true"
            width={1402}
            height={1122}
            sizes="(min-width: 768px) 144px, 132px"
            className="h-auto w-[132px] select-none md:w-[144px]"
          />

          <h1 className="mt-7 text-[22px] font-black leading-[1.5] text-[#2E2E5C] md:text-[26px]">
            {isKo
              ? "아직 친구의 답변이 없어요"
              : "まだ友達からの回答はありません"}
          </h1>
          <p className="mt-2 max-w-[360px] text-[14px] font-bold leading-[1.9] text-[#8A8AA3] md:text-[15px]">
            {isKo
              ? "친구 한 명이 답하면 여기에 ‘친구가 보는 나’의 결과가 표시돼요."
              : "何人かを招待して、結果を比較してみましょう！"}
          </p>
          <button
            type="button"
            onClick={toggleInvite}
            aria-expanded={inviteOpen}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-[#5B5BEF] px-7 py-3.5 text-[16px] font-black text-white shadow-[0_10px_24px_rgba(91,91,239,0.24)] transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5BEF] focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {isKo ? "친구에게 진단 부탁하기" : "友達を招待する"}
          </button>
        </section>
      ) : (
        panels[idx]
      )}
    </div>
  );
}
