"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";
import { KakaoTalkGlyph } from "@/components/icons/KakaoTalkGlyph";
import { shareToKakaoTalk } from "@/lib/kakao-share";
import { resultActionColorsForGroup } from "@/lib/hero-colors";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

// 診断ページ下部 (フッター直上) のシェアバンド。16P のシェア帯
// (ギザギザ縁のグレー帯 + 実績数 + SNS 丸ボタン) を参考に、サイトの
// デザイン言語で実装する。
//   - 数字は TopStats と同じ累計診断数の仮値 (app/page.tsx の DIAGNOSED_COUNT と同値)。
//   - ボタンは LINE(ko は KakaoTalk) / X / Facebook / リンクコピー + その他 (Web Share 対応端末のみ)。
//     アイコン・共有 URL 形式・ref 付与は MeStickyHeader のシェアモーダルと同じ。
//   - 計測は share_clicked (kind: diagnosis / source: diagnosis_share_band)。
//   - 共有 URL は診断ページ自体 (/diagnosis, ko は /ko/diagnosis)。

const DEFAULT_DIAGNOSED_COUNT = 50000;

// 上端だけギザギザ・下端フラット版。直下に別の帯が密着するとき、下端のギザで
// 背後の色が波状に覗くのを防ぐ (/me 末尾CTA帯 → シェア帯の接続・2026-08-26)。
export const JAGGED_CLIP_TOP =
  "polygon(0 10px, 9% 3px, 22% 9px, 35% 2px, 48% 8px, 61% 3px, 74% 9px, 87% 2px, 100% 8px, 100% 100%, 0 100%)";

// ギザギザ縁 (16P の帯の上下端)。clip-path で数 px の折れを作る。
// /me 下部のCTA帯 (MeResultPage) でも同じ縁を使うため export する。
export const JAGGED_CLIP =
  "polygon(0 10px, 9% 3px, 22% 9px, 35% 2px, 48% 8px, 61% 3px, 74% 9px, 87% 2px, 100% 8px, 100% calc(100% - 9px), 90% calc(100% - 2px), 77% calc(100% - 8px), 64% calc(100% - 3px), 51% calc(100% - 9px), 38% calc(100% - 2px), 25% calc(100% - 8px), 12% calc(100% - 3px), 0 calc(100% - 9px))";

export function DiagnosisShareBand({
  locale,
  diagnosedCount = DEFAULT_DIAGNOSED_COUNT,
  // 設置面の識別用 (share_clicked の source)。/me 下部にも設置するため prop 化 (2026-08-17)。
  source = "diagnosis_share_band",
  // 帯の背景色。/me はページの薄グレー (#FBFBFD) に合わせる (2026-08-26)。
  // /diagnosis は従来の #F5F6FA のまま。
  background = "#F5F6FA",
  // /me の末尾では直前の課金カードと一続きに見せるため、波形を外して余白を詰める。
  compact = false,
  flatTop = false,
  group,
}: {
  locale: "ja" | "ko";
  diagnosedCount?: number;
  source?: string;
  background?: string;
  compact?: boolean;
  flatTop?: boolean;
  /** /me では結果グループに合わせ、シェアボタンのリングと補助色を切り替える。 */
  group?: ThirtyTwoGroup;
}) {
  const isKo = locale === "ko";
  const actionTone = group ? resultActionColorsForGroup(group) : null;
  const themedCircleStyle = actionTone
    ? {
        borderColor: actionTone.accent,
        boxShadow: `0 2px 8px color-mix(in srgb, ${actionTone.accent} 18%, transparent)`,
      }
    : undefined;

  // navigator / location は SSR に無いためマウント後に確定させる。
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShareUrl(
      `${window.location.origin}${isKo ? "/ko/diagnosis" : "/diagnosis"}`,
    );
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, [isKo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const countText = isKo
    ? `${(diagnosedCount / 10000).toLocaleString("ko-KR")}만+`
    : `${(diagnosedCount / 10000).toLocaleString("ja-JP")}万+`;

  const fireShare = (
    channel:
      | "line"
      | "kakao"
      | "x"
      | "facebook"
      | "pinterest"
      | "copy"
      | "native",
  ) =>
    track("share_clicked", {
      metadata: { channel, kind: "diagnosis", source },
    });

  // 共有内容は診断ページの URL だけ (宣伝文は付けない。2026-08-01 指示)。
  const lineUrl = shareUrl && !isKo
    ? `https://line.me/R/msg/text/?${encodeURIComponent(withRef(shareUrl, "line"))}`
    : undefined;
  const xUrl = shareUrl
    ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(withRef(shareUrl, "x"))}`
    : undefined;
  // Facebook は sharer.php (テキストは付与不可・URL のみ)。
  const fbUrl = shareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withRef(shareUrl, "facebook"))}`
    : undefined;
  const pinterestUrl = shareUrl
    ? `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(withRef(shareUrl, "pinterest"))}&media=${encodeURIComponent(new URL("/ogp-v5.jpg", shareUrl).toString())}&description=${encodeURIComponent(isKo ? "나의 사용설명서 무료 성격 진단" : "ワタシのトリセツ｜無料性格診断テスト")}`
    : undefined;

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.share({ url: withRef(shareUrl, "native") });
      // 共有先を選んで完了した時のみ計測 (キャンセルは reject され catch へ)。
      fireShare("native");
    } catch {
      // キャンセル/非対応は無視
    }
  };

  const copyShareValue = async (value: string) => {
    let succeeded = false;
    try {
      await navigator.clipboard.writeText(value);
      succeeded = true;
    } catch {
      // アプリ内ブラウザなど Clipboard API が使えない環境向けのフォールバック。
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.select();
        succeeded = document.execCommand("copy");
      } finally {
        textarea.remove();
      }
    }
    if (!succeeded) return false;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    return true;
  };

  const handleKakaoShare = async () => {
    if (!shareUrl) return;
    const value = withRef(shareUrl, "kakao");
    const result = await shareToKakaoTalk({
      text: value,
      url: value,
      fallbackCopy: () => copyShareValue(value),
    });
    if (result !== "unavailable") fireShare("kakao");
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    const succeeded = await copyShareValue(withRef(shareUrl, "copy"));
    if (!succeeded) return;
    fireShare("copy");
  };

  // 参考UIに合わせ、白背景 + ブランド色の細枠で統一する。
  // 文字色はSNSごとに変えるため、共通クラスには含めない。
  const circle =
    "flex h-12 w-12 items-center justify-center rounded-full border bg-white shadow-[0_2px_6px_rgba(46,46,92,0.08)] transition-transform hover:scale-105";

  return (
    <section
      aria-label={isKo ? "진단 테스트 공유" : "診断テストをシェア"}
      className={`w-full px-4 ${compact ? "pb-8 pt-7" : "pb-10 pt-12"}`}
      style={{ background, clipPath: flatTop ? undefined : JAGGED_CLIP }}
    >
      <div className="relative mx-auto flex max-w-[1080px] flex-col items-center gap-1.5">
        <p className="text-[32px] font-black leading-tight text-[#1A1A1A]">
          {countText}
        </p>

        <div className="mt-4 flex items-center gap-2.5 sm:gap-4">
          {isKo ? (
            <button
              type="button"
              aria-label="카카오톡으로 공유"
              onClick={handleKakaoShare}
              className={`${circle} border-[#F4D400] text-[#3C1E1E]`}
              style={themedCircleStyle}
            >
              <KakaoTalkGlyph className="h-[26px] w-[26px]" />
            </button>
          ) : (
            <a
              href={lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LINEでシェア"
              onClick={() => fireShare("line")}
              className={`${circle} border-[#06C755]/55 text-[#06C755]`}
              style={themedCircleStyle}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
              </svg>
            </a>
          )}
          <a
            href={xUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isKo ? "X로 공유" : "Xでシェア"}
            onClick={() => fireShare("x")}
            className={`${circle} border-black/45 text-black`}
            style={themedCircleStyle}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
            </svg>
          </a>
          <a
            href={fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isKo ? "Facebook으로 공유" : "Facebookでシェア"}
            onClick={() => fireShare("facebook")}
            className={`${circle} border-[#1877F2]/50 text-[#1877F2]`}
            style={themedCircleStyle}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13.5 21v-7h2.4l.45-3H13.5V9.1c0-.87.28-1.6 1.66-1.6h1.34V4.85c-.3-.04-1.3-.13-2.44-.13-2.4 0-4.06 1.47-4.06 4.17V11H7.6v3h2.4v7h3.5z" />
            </svg>
          </a>
          <a
            href={pinterestUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={isKo ? "Pinterest에 저장" : "Pinterestに保存"}
            onClick={() => fireShare("pinterest")}
            className={`${circle} border-[#E60023]/50 text-[#E60023]`}
            style={themedCircleStyle}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9.04 21.54C10 21.83 10.97 22 12 22a10 10 0 1 0-3.56-.66c-.09-.78-.18-2.07 0-2.96l1.15-4.94s-.29-.58-.29-1.44c0-1.4.81-2.44 1.82-2.44.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.84 3.33-.24.98.5 1.78 1.45 1.78 1.74 0 3.08-1.84 3.08-4.49 0-2.35-1.69-3.99-4.11-3.99-2.81 0-4.47 2.1-4.47 4.26 0 .84.32 1.75.73 2.29.05.06.06.12.04.21L8 15.45c-.04.18-.14.22-.31.13-1.19-.58-1.93-2.4-1.93-3.87 0-3.16 2.31-6.03 6.64-6.03 3.49 0 6.2 2.49 6.2 5.82 0 3.47-2.18 6.27-5.2 6.27-1.01 0-1.97-.53-2.3-1.16l-.63 2.39c-.23.88-.84 1.97-1.43 2.54Z" />
            </svg>
          </a>
          {/* リンクコピー (コピー後はチェックに切替)。グレー帯の上でも沈まないよう
              白地 + 枠線 + 影で立たせる (薄ラベンダーは帯に溶けて見えにくかった)。 */}
          <button
            type="button"
            aria-label={isKo ? "링크 복사" : "リンクをコピー"}
            onClick={handleCopy}
            className={`${circle} border-[#B8BDCB] text-[#8B91A3]`}
            style={
              actionTone
                ? { ...themedCircleStyle, color: actionTone.accent }
                : undefined
            }
          >
            {copied ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            )}
          </button>
          {/* その他 = OS のシェアシート (対応端末のみ。Instagram 等はこちらから) */}
          {canNativeShare && (
            <button
              type="button"
              aria-label={isKo ? "기타 방법으로 공유" : "その他の方法でシェア"}
              onClick={handleNativeShare}
              className={`${circle} border-[#B8BDCB] text-[#8B91A3]`}
              style={
                actionTone
                  ? { ...themedCircleStyle, color: actionTone.accent }
                  : undefined
              }
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          )}
        </div>
        {/* コピー完了の控えめなフィードバック (absolute で高さを取らない =
            非表示時に帯の下余白が膨らまないようにする) */}
        <p
          role="status"
          className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold text-[#5B5BEF] transition-opacity ${
            copied ? "opacity-100" : "opacity-0"
          }`}
        >
          {isKo ? "링크를 복사했어요 ✓" : "リンクをコピーしました ✓"}
        </p>
      </div>
    </section>
  );
}
