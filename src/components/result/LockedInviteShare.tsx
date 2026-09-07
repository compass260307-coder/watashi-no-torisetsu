"use client";

// ロック中の「友達に評価してもらう」招待導線 (QR + シェアピル)。
// TakoLockedState / OthersPerceptionSection(/me) / 解除後 /tako で共用。課金導線は一切含めない。
//
// - シェアピル: X(黒) / LINE(ko は KakaoTalk) / リンク(ブランド紫) の 3 つを横並び。ラベル付きの塗りピルで
//   世界観に合わせる (色は CharacterShareButton と同系統)。
// - QR: 友達評価への招待URL (inviteCode 付き) を対面スキャン用に表示。
// - 見出し/長い注意書きは持たない (呼び出し側の文脈に委ねてシンプルに)。

import { useEffect, useRef, useState } from "react";
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
  /** QRを補助導線として折りたたみ、SNS・リンク共有を先に見せる。 */
  deferQr?: boolean;
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
  deferQr = false,
  trackSource,
  ownerToken,
  inviteCode,
  qrImageSrc,
  locale = "ja",
}: LockedInviteShareProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(!deferQr);
  const rootRef = useRef<HTMLDivElement>(null);
  const uiShownFired = useRef(false);
  const isKorean = locale === "ko";
  const shareText = SHARE_TEXT[locale];

  // 解除後の「＋」タブはクリックだけでなく、招待UIが実際に見えたかも計測する。
  useEffect(() => {
    const element = rootRef.current;
    if (!trackSource || !element || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (uiShownFired.current || !entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        uiShownFired.current = true;
        track("tako_invite_ui_shown", {
          ownerToken,
          inviteCode,
          metadata: { surface: trackSource },
        });
        observer.disconnect();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inviteCode, ownerToken, trackSource]);

  // チャネル別に ?ref を付けて、この招待から来た友達の流入元 (acquisition_source) を計測する。
  const lineUrl = isKorean
    ? undefined
    : `https://line.me/R/msg/text/?${encodeURIComponent(
        `${shareText} ${withRef(inviteUrl, "line")}`,
      )}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(withRef(inviteUrl, "x"))}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    withRef(inviteUrl, "facebook"),
  )}`;

  const fire = (
    channel: "x" | "line" | "kakao" | "facebook" | "share" | "copy",
  ) => {
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

  const handleShare = async () => {
    const url = withRef(inviteUrl, "share");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: isKorean ? "친구 진단 초대" : "友達診断に招待",
          text: shareText,
          url,
        });
        fire("share");
      } catch (error) {
        // 共有シートをユーザー自身が閉じた場合は、コピーへ切り替えない。
        if (error instanceof DOMException && error.name === "AbortError") return;
        const succeeded = await copyInviteValue(url);
        if (succeeded) fire("share");
      }
      return;
    }
    const succeeded = await copyInviteValue(url);
    if (succeeded) fire("share");
  };

  const shareButton =
    "group flex min-w-[64px] flex-col items-center gap-2 rounded-xl text-[12px] font-black text-[#4B4B66] outline-none focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/45 focus-visible:ring-offset-4";
  const shareIcon =
    "flex h-12 w-12 items-center justify-center rounded-full shadow-[0_5px_14px_rgba(46,46,92,0.12)] transition-transform group-hover:-translate-y-0.5 group-active:scale-95 md:h-14 md:w-14";

  const qrPanel = (
    <div className="mx-auto w-full max-w-[248px] rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(46,46,92,0.10)]">
      <div className="relative">
        <QRCodeSVG
          value={withRef(inviteUrl, "qr")}
          size={compact ? 216 : 248}
          className="h-auto w-full"
          bgColor="#FFFFFF"
          fgColor="#2E2E5C"
          level="H"
          marginSize={0}
        />
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
  );

  return (
    <div
      ref={rootRef}
      className={
        compact
          ? "mx-auto w-full max-w-[560px]"
          : "mx-auto max-w-[340px] md:max-w-[288px]"
      }
    >
      <p className="text-[13px] font-black text-[#2E2E5C]">
        {isKorean ? "초대 링크 보내기" : "招待リンクを送る"}
      </p>

      {/* SNSを主導線にする。大きな丸アイコン + ラベルで、共有先を一目で選べる。 */}
      <div className="mt-3 flex items-start gap-4 md:gap-5">
        {isKorean ? (
          <button
            type="button"
            onClick={handleKakao}
            className={shareButton}
          >
            <span className={`${shareIcon} bg-[#FEE500] text-[#3C1E1E]`}>
              <KakaoTalkGlyph className="h-6 w-6" />
            </span>
            카카오톡
          </button>
        ) : (
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fire("line")}
            className={shareButton}
          >
            <span className={`${shareIcon} bg-[#06C755]`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden="true">
                <path d="M12 3C6.477 3 2 6.69 2 11.246c0 4.082 3.547 7.503 8.34 8.146.325.07.767.215.879.494.1.252.066.647.032.901l-.142.852c-.043.252-.2.985.864.537 1.064-.448 5.735-3.376 7.823-5.78C20.98 14.94 22 13.21 22 11.246 22 6.69 17.523 3 12 3Z" />
              </svg>
            </span>
            LINE
          </a>
        )}
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fire("x")}
          className={shareButton}
        >
          <span className={`${shareIcon} bg-black`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
              <path d="M18.244 2H21.5l-7.5 8.59L23 22h-6.844l-5.357-7.012L4.66 22H1.4l8.04-9.196L1 2h6.998l4.84 6.4Zm-1.2 18h1.846L7.04 4H5.09l11.954 16Z" />
            </svg>
          </span>
          X
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => fire("facebook")}
          className={shareButton}
        >
          <span className={`${shareIcon} bg-[#1877F2]`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden="true">
              <path d="M13.6 22v-9h3l.45-3.5H13.6V7.27c0-1.01.28-1.7 1.74-1.7h1.86V2.44A24.8 24.8 0 0 0 14.5 2C11.83 2 10 3.63 10 6.62V9.5H7V13h3v9h3.6Z" />
            </svg>
          </span>
          Facebook
        </a>
        <button
          type="button"
          onClick={handleShare}
          className={shareButton}
        >
          <span className={`${shareIcon} bg-[#EEEEFF] text-[#5B5BEF]`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 16V3" />
              <path d="m7 8 5-5 5 5" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </span>
          {isKorean ? "기타" : "その他"}
        </button>
      </div>

      {/* URL全体をコピーできるフィールド。長いURLは一行で省略する。 */}
      <p className="mt-5 text-[12px] font-black text-[#2E2E5C]/65">
        {isKorean ? "초대 링크" : "招待リンク"}
      </p>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={isKorean ? "초대 링크 복사" : "招待リンクをコピー"}
        className="mt-2 flex w-full items-center gap-3 rounded-xl border border-[#DADBE8] bg-white px-4 py-3.5 text-left shadow-[0_3px_12px_rgba(46,46,92,0.06)] outline-none transition hover:border-[#5B5BEF]/45 focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/40"
      >
        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#5A5A72] md:text-[14px]">
          {withRef(inviteUrl, "copy")}
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEEEFF] text-[#5B5BEF]">
          {copied ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </span>
      </button>
      <p aria-live="polite" className="mt-1.5 min-h-5 text-[11px] font-bold text-[#5B5BEF]">
        {copied ? (isKorean ? "링크를 복사했어요" : "リンクをコピーしました") : ""}
      </p>

      {/* QRは補助導線。ユーザーが選んだ時だけ展開する。 */}
      {deferQr ? (
        <div className="mt-1 border-t border-[#E8E8F1] pt-3">
          <button
            type="button"
            onClick={() => setQrOpen((open) => !open)}
            aria-expanded={qrOpen}
            className="mx-auto flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-black text-[#5B5BEF] outline-none hover:bg-[#F4F4FF] focus-visible:ring-2 focus-visible:ring-[#5B5BEF]/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <rect x="3" y="3" width="6" height="6" rx="1" />
              <rect x="15" y="3" width="6" height="6" rx="1" />
              <rect x="3" y="15" width="6" height="6" rx="1" />
              <path d="M15 15h2v2h-2zM19 15h2v6h-6v-2M15 19h2" />
            </svg>
            {qrOpen
              ? isKorean
                ? "QR 코드 닫기"
                : "QRコードを閉じる"
              : isKorean
                ? "QR 코드 표시"
                : "QRコードを表示"}
            <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${qrOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </button>
          {qrOpen ? (
            <div
              className="mt-3"
              role="img"
              aria-label={isKorean ? "친구 진단 초대 QR 코드" : "友達評価ページへの招待QRコード"}
            >
              {qrPanel}
              <p className="mt-2.5 text-center text-[12px] font-bold text-[#2E2E5C]/50">
                {isKorean
                  ? "친구의 스마트폰으로 QR 코드를 스캔해 주세요"
                  : "近くにいる友達に読み取ってもらおう"}
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4" role="img" aria-label={isKorean ? "친구 진단 초대 QR 코드" : "友達評価ページへの招待QRコード"}>
          {qrPanel}
        </div>
      )}
    </div>
  );
}
