"use client";

// 課金カードの解放項目につく「覗き見 (?) ボタン」。2026-08-17 追加。
// 16Personalities の「例」プレビューを参考に、押すとその項目で解放される実画面の
// スクショをモーダルでチラ見せする。「何が読めるのか」を買う前に具体化して
// 不安を減らすのが目的 (コピーだけでは中身が想像できない、の解消)。
//
// 画像は public/paywall-peek/*.webp (ローカルの実画面を撮影した固定サンプル)。
// 課金判定・計測・Checkout には一切触れない純UI。KO 項目には peek を渡さない
// (ボタン自体が出ない) ので KO 表示は従来どおり。

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SmoothImage } from "@/components/ui/SmoothImage";

// 解放項目1つぶんのチラ見せ素材。width/height は実ファイルの寸法 (CLS 防止)。
// lead/points は 16P の「例」同様、画像だけでなく「何が手に入るか」を言葉でも
// 具体化する説明文と箇条書き (2026-08-17 指示)。
export type UnlockPeek = {
  img: string;
  alt: string;
  width: number;
  height: number;
  /** タイトル下の説明文。不要な項目は省略可 (2026-08-17: 電子書籍は無し)。 */
  lead?: string;
  points: string[];
  // 16P の「例」風に紙面2枚をずらして重ねる書籍プレビュー (電子書籍用)。
  // 指定時は img の単枚表示より優先する。[奥(左上), 手前(右下)] の順。
  pages?: { img: string; alt: string; width: number; height: number }[];
};

function PeekOverlay({
  peek,
  title,
  accent,
  onClose,
}: {
  peek: UnlockPeek;
  title: string;
  accent: string;
  onClose: () => void;
}) {
  // 開いている間は背面スクロールをロック。PaywallOverlay (モーダル内カード) の上に
  // 重なるケースでも、前の値を保存して戻すので二重ロックしても壊れない。
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // capture 段で拾って止める: PaywallOverlay も window で Esc を拾うため、
    // バブル段に流すと下の課金モーダルまで一緒に閉じてしまう。
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title}の例`}
      // PaywallOverlay (z-100) の中の項目からも開けるよう、その上の z-120。
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2E2E5C]/55 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        // 下の PaywallOverlay の「背景クリックで閉じる」に届かせない。
        e.stopPropagation();
        onClose();
      }}
    >
      {/* 外側 = 位置決めだけのラッパー (overflow なし)。× をここに置くことで、
          内側のスクロール箱 (overflow-y-auto + 角丸) にはみ出し分が欠けられない。
          スクロールしても × は右上に留まる。 */}
      <div
        className="relative w-full max-w-[400px] md:max-w-[860px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute -right-2 -top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95"
          style={{ backgroundColor: accent }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain rounded-3xl bg-white p-4 pb-4 shadow-[0_24px_64px_rgba(46,46,92,0.35)] md:p-7">
          {/* SP: テキスト → ビジュアルの縦積み / md+: 左=ビジュアル・右=説明の2カラム
              (16P の「例」レイアウト。order で DOM は共通のまま入れ替える)。 */}
          <div className="flex flex-col md:flex-row md:items-center md:gap-7">
            {/* ビジュアル (SP=下 / md+=左) + 注記 */}
            <div className="order-2 md:order-1 md:w-[45%] md:flex-shrink-0">
              {peek.pages && peek.pages.length >= 2 ? (
                /* 紙面プレビュー: ライトグレーのパネルに実画面をずらして重ねる (16P の「例」風)。
                   2枚 = 左上/右下、3枚 = 左上→中央→右下の階段。コンテナ高さは
                   ページの実アスペクト比から計算して paddingBottom で確保する。 */
                (() => {
                  const pages = peek.pages.slice(0, 3);
                  const isTriple = pages.length >= 3;
                  const widthPct = isTriple ? 54 : 62;
                  const aspect = pages[0].height / pages[0].width;
                  const pageHeightPct = widthPct * aspect;
                  // 3枚 = 左上・右上(少し下げ)・手前中央下の三角配置。重なりを浅くして
                  // どのシーンもほぼ全体が見えるようにする (2026-08-18 指示)。
                  // 2枚 = 左上/右下の従来配置。
                  const boxHeightPct = isTriple
                    ? pageHeightPct * 1.7
                    : pageHeightPct + 19;
                  const layouts: React.CSSProperties[] = isTriple
                    ? [
                        { top: 0, left: 0 },
                        { top: "5%", right: 0 },
                        { bottom: 0, left: "23%" },
                      ]
                    : [
                        { top: 0, left: 0 },
                        { bottom: 0, right: 0 },
                      ];
                  return (
                    <div className="mt-3 overflow-hidden rounded-2xl bg-[#EEF0F6] p-3 md:mt-0 md:p-4">
                      <div
                        className="relative"
                        style={{ paddingBottom: `${boxHeightPct}%` }}
                      >
                        {pages.map((pg, index) => (
                          <div
                            key={pg.img}
                            className={`absolute overflow-hidden rounded-lg border border-black/5 bg-white ${
                              index === pages.length - 1
                                ? "shadow-[0_16px_40px_rgba(46,46,92,0.25)]"
                                : "shadow-[0_8px_24px_rgba(46,46,92,0.18)]"
                            }`}
                            style={{
                              ...layouts[index],
                              width: `${widthPct}%`,
                              zIndex: index + 1,
                            }}
                          >
                            <SmoothImage
                              src={pg.img}
                              alt={pg.alt}
                              width={pg.width}
                              height={pg.height}
                              className="h-auto w-full"
                              placeholderColor="#FFFFFF"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* 実画面スクショ。縦長でも収まるよう高さ上限 + 下端は白フェードで
                   「続きがある」チラ見せにする。 */
                <div
                  className="relative mt-3 max-h-[42dvh] overflow-hidden rounded-2xl border-2 md:mt-0 md:max-h-[440px]"
                  style={{ borderColor: `${accent}33` }}
                >
                  <SmoothImage
                    src={peek.img}
                    alt={peek.alt}
                    width={peek.width}
                    height={peek.height}
                    className="h-auto w-full"
                    placeholderColor="#F6F7FB"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent"
                  />
                </div>
              )}
            </div>

            {/* テキスト (SP=先 / md+=右): 見出し + (任意の説明文) + チェック箇条書き */}
            <div className="order-1 md:order-2 md:min-w-0 md:flex-1">
              {/* [text-wrap:balance]: 26px で折り返すとき「籍」だけ2行目に落ちる等の
                  1文字孤立を防ぎ、2行を均等に割る。 */}
              {/* md+ は右カラムが縦中央に座り × と被らないため pr 不要。
                  24px = 現行タイトル (最長16文字) が1行に収まる上限 (26px だと
                  「あなた」等の語の途中で折れる)。 */}
              <p className="pr-7 text-[18px] font-black leading-snug text-[#2E2E5C] [text-wrap:balance] md:pr-0 md:text-[24px] md:leading-[1.4]">
                {title}
              </p>

              {peek.lead && (
                <p className="body-gothic mt-2 text-[13px] leading-[1.7] text-[#5A5A6E] md:mt-3 md:text-[15px] md:leading-[1.8]">
                  {peek.lead}
                </p>
              )}
              <ul className="mt-2 grid gap-1.5 md:mt-4 md:gap-2.5">
                {peek.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={accent}
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 md:mt-[5px] md:h-4 md:w-4"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {/* 太字にしない (2026-08-17 指示: ウェイト軽め)。balance を付けると
                        「自分」等の語の途中で均等割りされ逆に読みにくいので自然な折返しのまま。 */}
                    <span className="body-gothic text-[12px] leading-[1.6] text-[#2E2E5C] md:text-[15px] md:leading-[1.7]">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// 項目タイトルの後ろに置く小さな「?」。タップでその項目のチラ見せモーダルを開く。
export function PeekButton({
  peek,
  title,
  accent,
}: {
  peek: UnlockPeek;
  title: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`${title}の中身をチラ見せ`}
        onClick={() => setOpen(true)}
        // タイトル文章の末尾にインラインで続ける (align-middle で文字の縦中央)。
        // 2行に折り返しても最後の文字のすぐ後ろに来る (右端に浮かせない / 2026-08-18)。
        // -my-1 で行の高さを崩さず、p-1 でタップ領域を確保。
        className="-my-1 ml-1 inline-flex items-center justify-center p-1 align-middle"
      >
        {/* 白地 + アクセント枠線の ? (塗りつぶし版はオーナー確認で不採用 2026-08-18)。 */}
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 bg-white text-[12px] font-black leading-none transition hover:scale-110 active:scale-95"
          style={{ borderColor: accent, color: accent }}
        >
          ?
        </span>
      </button>
      {open && (
        <PeekOverlay
          peek={peek}
          title={title}
          accent={accent}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
