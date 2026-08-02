"use client";

// ロック中の「友達に評価してもらう」招待導線 (QR + シェアピル)。
// TakoLockedState / OthersPerceptionSection(/me) / 解除後 /tako で共用。課金導線は一切含めない。
//
// - シェアピル: X(黒) / LINE(ko は KakaoTalk) / リンク(ブランド紫) の 3 つを横並び。ラベル付きの塗りピルで
//   世界観に合わせる (色は CharacterShareButton と同系統)。
// - QR: 友達評価への招待URL (inviteCode 付き) を対面スキャン用に表示。
// - 見出し/長い注意書きは持たない (呼び出し側の文脈に委ねてシンプルに)。

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";
import { KakaoTalkGlyph } from "@/components/icons/KakaoTalkGlyph";
import { shareToKakaoTalk } from "@/lib/kakao-share";
import type { ResultLocale } from "@/i18n/result";

interface LockedInviteShareProps {
  /** 友達評価の招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
  /** 横並びレイアウト用にQRとボタンを少し締める。 */
  compact?: boolean;
  /**
   * 計測ソース。指定時のみ X/LINE/KakaoTalk/コピー タップで friend_invite_clicked を発火する
   * (metadata: { channel, source })。未指定 (ロック状態など) は無発火で挙動を変えない。
   */
  trackSource?: string;
  ownerToken?: string;
  inviteCode?: string;
  /**
   * QR 中央に重ねるキャラ顔画像 (丸抜き・白リング)。未開放ページ (TakoShareGate) と
   * 同じ見せ方。level="H" (30%欠損許容) に対し約34%幅の被覆で運用実績あり。
   */
  qrImageSrc?: string | null;
  locale?: ResultLocale;
}

const SHARE_TEXT: Record<ResultLocale, string> = {
  ja: "友達から見たわたしを教えて！「ワタシのトリセツ」で友達診断テストができるよ",
  ko: "친구 눈에 비친 나를 알려 줘! ‘나의 사용설명서’에서 친구 진단 테스트에 참여할 수 있어.",
};

export function LockedInviteShare({
  inviteUrl,
  compact = false,
  trackSource,
  ownerToken,
  inviteCode,
  qrImageSrc,
  locale = "ja",
}: LockedInviteShareProps) {
  const [copied, setCopied] = useState(false);
  const isKorean = locale === "ko";
  const shareText = SHARE_TEXT[locale];

  // チャネル別に ?ref を付けて、この招待から来た友達の流入元 (acquisition_source) を計測する。
  const lineUrl = isKorean
    ? undefined
    : `https://line.me/R/msg/text/?${encodeURIComponent(
        `${shareText} ${withRef(inviteUrl, "line")}`,
      )}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(withRef(inviteUrl, "x"))}`;

  const fire = (channel: "x" | "line" | "kakao" | "copy") => {
    if (!trackSource) return;
    track("friend_invite_clicked", {
      ownerToken,
      inviteCode,
      metadata: { channel, source: trackSource },
    });
  };

  const copyInviteValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      // クリップボード不可環境では何もしない (QR / 他ピルを使ってもらう)
      return false;
    }
  };

  const handleKakao = async () => {
    const url = withRef(inviteUrl, "kakao");
    const result = await shareToKakaoTalk({
      text: shareText,
      url,
      fallbackCopy: () => copyInviteValue(url),
    });
    if (result !== "unavailable") fire("kakao");
  };

  const handleCopy = async () => {
    const succeeded = await copyInviteValue(withRef(inviteUrl, "copy"));
    if (succeeded) fire("copy");
  };

  const pill = `inline-flex flex-1 items-center justify-center gap-1.5 rounded-full ${
    compact ? "py-2.5 md:py-1.5 text-[13px] md:text-[12px]" : "py-2.5 text-[13px]"
  } font-black text-white transition-transform active:scale-95`;

  return (
    <div
      className={
        compact
          ? "mx-auto max-w-[320px] md:max-w-[236px]"
          : "mx-auto max-w-[340px] md:max-w-[288px]"
      }
    >
      {/* QR (対面スキャン用)。白タイルはピル行と同じ幅 (w-full)、QRは中央フレーム。 */}
      <div
        className={`w-full rounded-2xl bg-white ${
          compact ? "p-4" : "p-5"
        } shadow-[0_8px_24px_rgba(46,46,92,0.10)]`}
        role="img"
        aria-label={
          isKorean ? "친구 진단 초대 QR 코드" : "友達評価ページへの招待QRコード"
        }
      >
        <div className="relative">
          <QRCodeSVG
            value={withRef(inviteUrl, "qr")}
            size={compact ? 204 : 248}
            className="h-auto w-full"
            bgColor="#FFFFFF"
            fgColor="#2E2E5C"
            level="H"
            marginSize={0}
          />
          {/* 中央のキャラ顔 (丸抜き・白リング)。TakoShareGate と同じ被覆率。 */}
          {qrImageSrc && (
            <span className="absolute left-1/2 top-1/2 block w-[34%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white ring-4 ring-white shadow-[0_2px_8px_rgba(46,46,92,0.18)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageSrc}
                alt=""
                className="block h-full w-full object-cover"
              />
            </span>
          )}
        </div>
      </div>
      <p className="mt-2.5 text-center text-[12px] font-bold text-[#2E2E5C]/50">
        {isKorean
          ? "친구의 스마트폰으로 QR 코드를 스캔해 주세요"
          : "友達のスマホで読み取ってもらおう"}
      </p>

      {/* シェアピル: X / LINE(ko は KakaoTalk) / リンク (QR と同じ幅・ラベル付き塗りピル) */}
      <div className="mt-3 flex items-center gap-2">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fire("x")}
          className={`${pill} bg-black`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white" aria-hidden="true">
            <path d="M18.244 2H21.5l-7.5 8.59L23 22h-6.844l-5.357-7.012L4.66 22H1.4l8.04-9.196L1 2h6.998l4.84 6.4Zm-1.2 18h1.846L7.04 4H5.09l11.954 16Z" />
          </svg>
          <span className="sr-only">
            {isKorean ? "X로 공유" : "Xで共有"}
          </span>
        </a>
        {isKorean ? (
          <button
            type="button"
            onClick={handleKakao}
            aria-label="카카오톡으로 보내기"
            className={pill}
            style={{ background: "#FEE500", color: "#3C1E1E" }}
          >
            <KakaoTalkGlyph className="h-4 w-4" />
            카카오톡
          </button>
        ) : (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fire("line")}
            className={`${pill} bg-[#06C755]`}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" aria-hidden="true">
              <path d="M12 3C6.477 3 2 6.69 2 11.246c0 4.082 3.547 7.503 8.34 8.146.325.07.767.215.879.494.1.252.066.647.032.901l-.142.852c-.043.252-.2.985.864.537 1.064-.448 5.735-3.376 7.823-5.78C20.98 14.94 22 13.21 22 11.246 22 6.69 17.523 3 12 3Z" />
            </svg>
            LINE
          </a>
        )}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={isKorean ? "초대 링크 복사" : "招待リンクをコピー"}
          className={`${pill} bg-[#5B5BEF]`}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 6" />
              </svg>
              {isKorean ? "복사됨" : "コピー済"}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {isKorean ? "링크" : "リンク"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
