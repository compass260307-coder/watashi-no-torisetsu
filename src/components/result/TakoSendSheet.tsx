"use client";

// 送信先ピッカー (追加機能③)。3人ゲート最大の離脱点「あと1人、誰に送る？」で手を止めさせない。
//   CTA押下 → このシートが即出て“送る相手を選ぶ”ところまで一気に運ぶ。
//
// 方針 (shareTargetPicker は現状 infra 未整備のため使えない):
//   1) tryLiffPicker() … 将来 LIFF SDK 復活時の抜き差し口。今は capability 検知で即 unavailable。
//   2) LINEで送る … 既存 line.me/R/msg URL を主役化。モバイル/LINEなら実質トーク相手ピッカー。
//   3) 他アプリで送る … navigator.share (Web Share API)。
//   4) リンクをコピー … clipboard。
//   末尾に QR (面前用)。どの経路でも「送れずに詰む」を作らない。
//
// 送信後: 呼び出し側に onSent を返し、空スロットを楽観的に pending へ (クライアント表示のみ)。
// 世界観: 既存フェルトトークン内。reduced-motion 尊重 (スライドを止める)。

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";

const NAVY = "#2E2E5C";
const INACTIVE = "#9BA3B4";
const LAVENDER = "#5B5BEF";

const SHARE_TEXT =
  "友達から見たわたしを教えて！「ワタシのトリセツ」で他己診断テストができるよ";

type LiffPickerResult = "sent" | "cancelled" | "unavailable";

// 将来の LIFF shareTargetPicker 抜き差し口。SDK 未配線の今は必ず unavailable → フォールバック。
async function tryLiffPicker(message: string): Promise<LiffPickerResult> {
  try {
    const liff = (window as unknown as { liff?: unknown }).liff as
      | {
          isApiAvailable?: (n: string) => boolean;
          shareTargetPicker?: (
            msgs: { type: string; text: string }[],
          ) => Promise<unknown>;
        }
      | undefined;
    if (!liff?.isApiAvailable?.("shareTargetPicker")) return "unavailable";
    const res = await liff.shareTargetPicker!([{ type: "text", text: message }]);
    // 新しめの SDK は送信=オブジェクト / キャンセル=null を返す。
    return res ? "sent" : "cancelled";
  } catch {
    return "unavailable";
  }
}

interface TakoSendSheetProps {
  open: boolean;
  onClose: () => void;
  inviteUrl: string;
  /** 「あと◯人」表記 (シート見出しの残数連動)。title 未指定時のみ使う。 */
  toSend: number;
  /** 送信アクションが取られたら呼ぶ (空スロット→pending の楽観表示に使う)。 */
  onSent: () => void;
  /** プレビュー: 'liff-sim' で疑似ピッカー面を表示。 */
  previewShareMode?: string;
  /** ④ Path2 再利用: 見出し上書き (例「◯◯さんを診断に誘う」)。 */
  title?: string;
  /** 見出し下のサブコピー上書き (例 相性文脈の芯コピー)。 */
  subtitle?: string;
  /** シェア文面上書き (未指定は評価招待の既定文)。 */
  shareText?: string;
}

export function TakoSendSheet({
  open,
  onClose,
  inviteUrl,
  toSend,
  onSent,
  previewShareMode,
  title,
  subtitle,
  shareText = SHARE_TEXT,
}: TakoSendSheetProps) {
  // reduced は一度だけ遅延評価 (シートは開いた時=クライアントでのみ描画)。
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Esc で閉じる & 開いたらフォーカス移動。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(
    `${shareText} ${withRef(inviteUrl, "line")}`,
  )}`;
  const pickerMessage = `${shareText} ${withRef(inviteUrl, "line")}`;

  const fire = (channel: string) =>
    track("friend_invite_clicked", {
      metadata: { channel, source: "tako_send_sheet" },
    });

  // LINEで送る: LIFFピッカーが使えれば最優先、無ければ URL 起動 (a要素のデフォルト遷移)。
  const handleLine = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    const picker = await tryLiffPicker(pickerMessage);
    if (picker === "unavailable") {
      // a のデフォルト遷移 (LINE URL) に任せる。送った扱いで pending へ → シートを閉じ、
      // 戻ってきたときに埋まった pending スロットが見えるようにする。
      fire("line");
      onSent();
      onClose();
      return;
    }
    // ピッカーが動いた場合は URL 遷移を止める。
    e.preventDefault();
    if (picker === "sent") {
      fire("line_picker");
      onSent();
      onClose();
    }
    // cancelled は何もしない (詰まない・再操作可)。
  };

  // 他アプリで送る: Web Share API → 未対応なら copy。
  const handleWebShare = async () => {
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({
          text: `${shareText}`,
          url: withRef(inviteUrl, "os"),
        });
        fire("os_share");
        onSent();
        onClose();
        return;
      }
    } catch {
      // キャンセル/失敗 → copy にフォールバック
    }
    await handleCopy("os_share_fallback");
  };

  const handleCopy = async (channel = "copy") => {
    try {
      await navigator.clipboard.writeText(withRef(inviteUrl, "copy"));
      setCopied(true);
      setNote("リンクをコピーしました。送りたい相手に貼り付けてね");
      window.setTimeout(() => setCopied(false), 2000);
      fire(channel);
      onSent();
    } catch {
      setNote("コピーできませんでした。下のQRか他の方法を使ってね");
    }
  };

  const heading =
    title ??
    (toSend >= 2
      ? `あと${toSend}人、誰に送る？`
      : toSend === 1
        ? "ラスト1人、誰に送る？"
        : "もう一度、誰に送る？"); // toSend=0 (リマインド) も同じピッカーを再利用

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="送信先を選ぶ"
    >
      {/* 背景 */}
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 ${reduced ? "" : "animate-modal-fade-in"}`}
      />

      {/* シート本体 */}
      <div
        className={`relative w-full max-w-[520px] rounded-t-[28px] bg-white px-5 pb-8 pt-3 shadow-[0_-12px_40px_rgba(46,46,92,0.18)] ${reduced ? "" : "animate-modal-slide-up"}`}
      >
        {/* つまみ + 閉じる */}
        <div className="mb-3 flex items-center justify-center">
          <span className="h-1.5 w-10 rounded-full bg-[#E3E5EE]" />
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#9BA3B4] transition-colors active:bg-[#F1F3FB]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2
          className="text-center text-[22px] font-black leading-tight md:text-[24px]"
          style={{ color: NAVY }}
        >
          {heading}
        </h2>
        <p
          className="mt-1.5 text-center text-[12.5px] font-bold"
          style={{ color: INACTIVE }}
        >
          {subtitle ?? "送った相手が答えると、あなたのトリセツが1つ埋まる"}
        </p>

        {/* プレビュー: 疑似 shareTargetPicker 面 (Phase2 のイメージ)。実送信はしない。 */}
        {previewShareMode === "liff-sim" && (
          <div className="mt-4 rounded-2xl border border-[#E6E8F5] bg-[#F7F8FD] p-4">
            <p className="mb-2 text-[12px] font-bold" style={{ color: INACTIVE }}>
              （プレビュー）LINEの友だちを選ぶ
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {["A", "K", "M", "R", "Y", "S"].map((c, i) => (
                <div key={i} className="flex w-14 shrink-0 flex-col items-center gap-1">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-black"
                    style={{ background: "#E7ECFB", color: LAVENDER }}
                  >
                    {c}
                  </span>
                  <span className="h-2 w-8 rounded-full bg-[#E3E5EE]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ① LINEで送る (主役) */}
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLine}
          data-no-drag
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-[17px] font-black text-white shadow-[0_8px_24px_rgba(6,199,85,0.28)] transition-transform active:scale-[0.98]"
          style={{ background: "#06C755" }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
            <path d="M12 3C6.477 3 2 6.69 2 11.246c0 4.082 3.547 7.503 8.34 8.146.325.07.767.215.879.494.1.252.066.647.032.901l-.142.852c-.043.252-.2.985.864.537 1.064-.448 5.735-3.376 7.823-5.78C20.98 14.94 22 13.21 22 11.246 22 6.69 17.523 3 12 3Z" />
          </svg>
          LINEで送る
        </a>

        {/* ② 他アプリで送る (Web Share) / ③ コピー */}
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={handleWebShare}
            data-no-drag
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-[15px] font-black transition-transform active:scale-[0.98]"
            style={{ borderColor: "#E3E5EE", color: NAVY }}
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
              <path d="M12 3v13M8 7l4-4 4 4" />
            </svg>
            他アプリで送る
          </button>
          <button
            type="button"
            onClick={() => handleCopy()}
            data-no-drag
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3.5 text-[15px] font-black transition-transform active:scale-[0.98]"
            style={{ borderColor: "#E3E5EE", color: copied ? LAVENDER : NAVY }}
          >
            {copied ? (
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
            {copied ? "コピー済" : "リンクをコピー"}
          </button>
        </div>

        {note && (
          <p className="mt-3 text-center text-[12.5px] font-bold" style={{ color: LAVENDER }}>
            {note}
          </p>
        )}

        {/* ④ QR (面前用)。どの経路でも詰まないための最終手段。 */}
        <div className="mt-6 flex flex-col items-center">
          <div className="rounded-2xl bg-white p-3 shadow-[0_6px_20px_rgba(46,46,92,0.10)] ring-1 ring-black/5">
            <QRCodeSVG
              value={withRef(inviteUrl, "qr")}
              size={128}
              bgColor="#FFFFFF"
              fgColor="#2E2E5C"
              level="H"
              marginSize={0}
            />
          </div>
          <p className="mt-2 text-[12px] font-bold" style={{ color: "#9BA3B4" }}>
            目の前の友達には QR を読み取ってもらおう
          </p>
        </div>
      </div>
    </div>
  );
}
