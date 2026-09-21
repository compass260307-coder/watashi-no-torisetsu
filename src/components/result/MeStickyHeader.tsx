"use client";

// /me (自己診断結果) 専用のヘッダー + アンロックバー (16P 参考、2026-07-13 指示)。
//
// 挙動:
//   - ヘッダー部分は従来の ScrollHideHeader と同じ (下スクロールで隠れ、上で出る)
//   - その直下のバー (シェア + すべての結果のロックを解除) は「常時表示」。
//     ヘッダーが隠れるときはヘッダーの高さぶんだけ全体を持ち上げ、バーが最上部に残る。
//   - 解放後もバー自体 (シェアボタン) は出し続ける (2026-07-15 指示)。
//     解除 CTA ボタンだけ未解放時限定 (showUnlockCta)。
// ScrollHideHeader は children ごと -100% 平行移動するためバーも消えてしまう。
// ここではヘッダー実高を測り、隠すときは -headerHeight だけ動かす (バーは残る)。
//
// /me のシェアは上部バーの丸ボタン1個に集約し、押すとシェアカードを開く。
// その隣に、本人の友達診断ページへ移動する丸アイコンを表示する。
// /tako の招待モードも、従来どおり丸ボタンからモーダルを開く。
// モーダルは createPortal で body 直下に出す。ヘッダーは隠れるとき transform を
// 持つため、この中で fixed を使うと基準がヘッダーになり画面全体を覆えない。

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";
import { track } from "@/lib/track";
import { withRef } from "@/lib/acquisition-link";
import { KakaoTalkGlyph } from "@/components/icons/KakaoTalkGlyph";
import { shareToKakaoTalk } from "@/lib/kakao-share";
import { SHARE_OPEN_EVENT } from "@/components/result/ShareModalOpenButton";
import type { AppResultLocale } from "@/i18n/result";
import { resultActionColorsForGroup } from "@/lib/hero-colors";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";

interface MeStickyHeaderProps {
  /** ヘッダー本体 (TopHeader)。 */
  children: ReactNode;
  /** 「すべての結果のロックを解除」CTA を出すか (第二部が未解放のときのみ true)。
      false でもシェアボタンのバー自体は shareUrl があれば表示する。 */
  showUnlockCta: boolean;
  /** 解除CTAの文言差し替え (/tako は「結果をアップグレード」・2026-08-26)。
      指定時はアイコンも錠前から上向き矢印 (アップグレード) に切り替える。 */
  unlockCtaLabel?: string;
  /** 共有 URL。character=/share/[inviteCode]、invite=/friend/[inviteCode]。 */
  shareUrl?: string;
  /** 友達診断への招待 URL。指定時は共有ポップアップに2つ目の選択肢を表示する。 */
  friendShareUrl?: string;
  /** 本人の友達診断ページ (/tako/[token]) への遷移先。指定時は上部バーに導線を出す。 */
  friendDiagnosisHref?: string;
  /** アップグレード済み結果で表示するLINE追加導線。指定時はシェア/友達診断を置き換える。 */
  lineAddHref?: string;
  /**
   * シェアボタンの種別 (2026-07-28)。
   *   - "character" (既定): 自分の結果 (キャラ) をシェアする従来モード (/me)。
   *   - "invite": 友達にもっと診断してもらう招待モード (/tako)。文言・計測を
   *     LockedInviteShare (招待パネル) と揃え、friend_invite_clicked を発火する。
   */
  shareKind?: "character" | "invite";
  /** invite モードの計測用 (friend_invite_clicked に載せる)。 */
  ownerToken?: string;
  inviteCode?: string;
  /** invite モードのQR中央に重ねるキャラ顔 (丸抜き・白リング。LockedInviteShare と同じ)。 */
  qrImageSrc?: string | null;
  /** シェア文言用の称号 (essence)。character モードのみ使用。 */
  essence?: string;
  /** シェア文言用の Big Five コード (ヒーローと同じ大小方式。例 "OCeAN")。 */
  code?: string;
  /** 解除CTAのスクロール先 id。省略時は /me の #fullaccess-promo (/tako は "tako-promo")。 */
  paywallTargetId?: string;
  /**
   * 完全版レポート生成ボタンの href (/tako の購入者向け・2026-07-21)。
   * 指定時はバー右端に「完全版レポートを生成」を表示 (解除CTAとは排他運用を想定)。
   */
  reportHref?: string;
  /** reportHref ボタンの表示文言。省略時は友達診断の従来文言。 */
  reportLabel?: string;
  /** reportHref ボタンのアイコン。アップグレード導線では上向き矢印を表示する。 */
  reportIcon?: "download" | "upgrade";
  /** true のときは遷移せず、その場で課金カードを開く。href はJS無効時の遷移先。 */
  reportOpensPaywall?: boolean;
  /** reportHref ボタンの差し替えノード。指定時は <a> の代わりにそのまま描画する
   *  (/me のアップグレード導線は Alice チャットをモーダルで開く・2026-08-26)。 */
  reportCta?: React.ReactNode;
  /** バーの丸ボタン (シェア/友達診断) の配色。/me の完全版課金後はアップグレード
   *  ピルがゴールドになるため "gold" で隣のトーンを揃える (2026-08-26)。既定 indigo。 */
  circleTone?: "indigo" | "gold";
  /** 結果グループ。指定時は circleTone より優先してCTA・丸ボタンをタイプ色にする。 */
  group?: ThirtyTwoGroup;
  /**
   * 獲得ランディング (/share) 用: バー右端に「無料で性格診断をする」を表示 (2026-07-26)。
   * 課金CTA (showUnlockCta) / シェアボタンとは排他運用を想定。
   */
  diagnosisCta?: boolean;
  /**
   * 診断CTAの遷移先の差し替え (既定: /diagnosis)。評価送信後ページは
   * ?source=<owner invite_code> を載せてバイラルツリー計測を維持する (2026-08-04)。
   */
  diagnosisCtaHref?: string;
  /** 診断CTAの文言差し替え (既定: 無料で性格診断をする)。 */
  diagnosisCtaLabel?: string;
  /**
   * 指定時のみ診断CTAクリックを計測する。評価者ページは
   * friend_to_diagnosis_clicked、結果シェア着地は share_to_diagnosis_clicked を使う。
   * inviteCode prop と組で指定する。
   */
  diagnosisCtaTrackSource?: string;
  /** 診断CTAのイベント名。結果シェア着地では専用イベントへ切り替える。 */
  diagnosisCtaEvent?:
    | "friend_to_diagnosis_clicked"
    | "share_to_diagnosis_clicked";
  /** true のとき、固定バー内側の最大幅を外してCTAを画面右端へ寄せる。既定は true。 */
  fullWidthBar?: boolean;
  /** ローカル確認用。シェアUIの計測イベントを送信しない。 */
  previewMode?: boolean;
  locale?: AppResultLocale;
}

// iOS 風のシェアグリフ (トレイ + 上矢印。16P のシェアボタン参考)。
function ShareGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15V3" />
      <path d="m8 7 4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

// 下部バー「友達診断」と同じ人物2人のアイコン。上部バー用にだけ縮小する。
function FriendDiagnosisGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.6c2 .6 3.5 2.4 3.5 4.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyGlyph({ copied }: { copied: boolean }) {
  return copied ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l4 4L19 6" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function MeStickyHeader({
  children,
  showUnlockCta,
  unlockCtaLabel,
  shareUrl,
  friendShareUrl,
  friendDiagnosisHref,
  lineAddHref,
  shareKind = "character",
  ownerToken,
  inviteCode,
  qrImageSrc = null,
  essence,
  code,
  paywallTargetId,
  reportHref,
  reportLabel,
  reportIcon = "download",
  reportOpensPaywall = false,
  reportCta,
  circleTone = "indigo",
  group,
  diagnosisCta,
  diagnosisCtaHref,
  diagnosisCtaLabel,
  diagnosisCtaTrackSource,
  diagnosisCtaEvent = "friend_to_diagnosis_clicked",
  fullWidthBar = true,
  previewMode = false,
  locale = "ja",
}: MeStickyHeaderProps) {
  // バー自体は CTA (未解放) か シェアボタン (shareUrl) のどちらかがあれば出す。
  const showBar =
    showUnlockCta ||
    Boolean(shareUrl) ||
    Boolean(friendDiagnosisHref) ||
    Boolean(lineAddHref) ||
    Boolean(reportHref) ||
    Boolean(reportCta) ||
    Boolean(diagnosisCta);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const [pickerCopiedKind, setPickerCopiedKind] =
    useState<"character" | "invite" | null>(null);
  const [activeShareKind, setActiveShareKind] =
    useState<"character" | "invite">(shareKind);
  // モーダルを開いた設置場所 (share_clicked の metadata.source)。
  // ヘッダーのボタン=sticky_bar / 本文中の ShareModalOpenButton=イベントの detail.source。
  const [shareSource, setShareSource] = useState("sticky_bar");
  const lastY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(0);

  useEffect(() => {
    // ヘッダー実高を測る (リサイズにも追従)
    const measure = () => setHeaderH(headerRef.current?.offsetHeight ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 40) {
        setHidden(false);
      } else {
        const delta = y - lastY.current;
        if (delta > 4) setHidden(true);
        else if (delta < -4) setHidden(false);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 本文中の「シェア」ピル (ShareModalOpenButton) からの開く要求を拾う。
  // shareUrl の無いページ (獲得ランディング等) では無視する。
  useEffect(() => {
    if (!shareUrl) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ source?: unknown }>).detail;
      setShareSource(
        typeof detail?.source === "string" ? detail.source : "sticky_bar",
      );
      if (friendShareUrl && shareKind === "character") {
        setActiveShareKind("character");
        setSharePickerOpen(true);
      } else {
        setActiveShareKind(shareKind);
        setShareOpen(true);
      }
    };
    window.addEventListener(SHARE_OPEN_EVENT, handler);
    return () => window.removeEventListener(SHARE_OPEN_EVENT, handler);
  }, [friendShareUrl, shareKind, shareUrl]);

  // モーダルは Escape でも閉じられるように。
  useEffect(() => {
    if (!shareOpen && !sharePickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShareOpen(false);
        setSharePickerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen, sharePickerOpen]);

  const defaultIsInvite = shareKind === "invite";
  const isInvite = activeShareKind === "invite";
  const isKo = locale === "ko";
  const isEn = locale === "en";
  const isId = locale === "id";
  const shareCopy = isEn
    ? {
        pickerLabel: "Choose what to share",
        close: "Close",
        pickerTitle: "Share your result",
        more: "More",
        personalityTitle: "Your personality type",
        personalityDescription:
          "Personality scores are not included. Recommended for sharing on social media.",
        personalityCopy: "Copy personality type link",
        personalityCopied: "Personality type link copied",
        friendTitle: "Ask friends to take the friend test",
        friendDescription:
          "Share this invitation link with friends and family so they can tell you how they see you.",
        friendCopy: "Copy friend test link",
        friendCopied: "Friend test link copied",
        resultTitle: "Share your result",
        inviteTitle: "Ask a friend to take the test",
        inviteDescription:
          "Each friend who answers adds another result sheet.",
        inviteLink: "Invitation link",
        characterLink: "Character link",
        copied: "Copied",
        inviteLinkCopy: "Copy invitation link",
        inviteLinkCopied: "Invitation link copied",
        characterLinkCopy: "Copy character link",
        characterLinkCopied: "Character link copied",
        qrCode: "QR code",
        qrCodeLabel: "Friend test invitation QR code",
        qrCodeDescription: "Ask your friend to scan it with their phone",
      }
    : isId
      ? {
          pickerLabel: "Pilih yang ingin dibagikan",
          close: "Tutup",
          pickerTitle: "Bagikan hasilmu",
          more: "Lainnya",
          personalityTitle: "Tipe kepribadianmu",
          personalityDescription: "Skor kepribadian tidak disertakan. Cocok untuk dibagikan di media sosial.",
          personalityCopy: "Salin tautan tipe kepribadian",
          personalityCopied: "Tautan tipe kepribadian disalin",
          friendTitle: "Minta teman mengikuti tes teman",
          friendDescription: "Bagikan tautan undangan ini agar teman dan keluarga dapat memberi tahu cara mereka melihatmu.",
          friendCopy: "Salin tautan tes teman",
          friendCopied: "Tautan tes teman disalin",
          resultTitle: "Bagikan hasilmu",
          inviteTitle: "Undang teman mengikuti tes",
          inviteDescription: "Setiap teman yang menjawab akan menambahkan satu lembar hasil.",
          inviteLink: "Tautan undangan",
          characterLink: "Tautan karakter",
          copied: "Disalin",
          inviteLinkCopy: "Salin tautan undangan",
          inviteLinkCopied: "Tautan undangan disalin",
          characterLinkCopy: "Salin tautan karakter",
          characterLinkCopied: "Tautan karakter disalin",
          qrCode: "Kode QR",
          qrCodeLabel: "Kode QR undangan tes teman",
          qrCodeDescription: "Minta temanmu memindainya dengan ponsel",
        }
    : isKo
      ? {
          pickerLabel: "공유할 내용 선택",
          close: "닫기",
          pickerTitle: "무엇을 공유할까요?",
          more: "기타",
          personalityTitle: "나의 성격 유형",
          personalityDescription:
            "성격 점수는 포함되지 않아요. SNS 공유에 추천해요.",
          personalityCopy: "성격 유형 링크 복사",
          personalityCopied: "성격 유형 링크를 복사했어요",
          friendTitle: "친구 진단 부탁하기",
          friendDescription:
            "친구나 가족에게 나에 대한 인상을 답해 달라고 부탁하는 링크예요.",
          friendCopy: "친구 진단 링크 복사",
          friendCopied: "친구 진단 링크를 복사했어요",
          resultTitle: "결과를 공유해요",
          inviteTitle: "친구에게 진단을 부탁해요",
          inviteDescription: "답해 준 친구 수만큼 결과 시트가 늘어나요",
          inviteLink: "초대 링크",
          characterLink: "캐릭터 링크",
          copied: "복사했어요",
          inviteLinkCopy: "초대 링크 복사",
          inviteLinkCopied: "초대 링크를 복사했어요",
          characterLinkCopy: "캐릭터 링크 복사",
          characterLinkCopied: "캐릭터 링크를 복사했어요",
          qrCode: "QR 코드",
          qrCodeLabel: "친구 진단 초대 QR 코드",
          qrCodeDescription: "친구의 스마트폰으로 스캔해 주세요",
        }
      : {
          pickerLabel: "共有する内容を選ぶ",
          close: "閉じる",
          pickerTitle: "結果をシェアしよう",
          more: "その他",
          personalityTitle: "あなたの性格タイプ",
          personalityDescription:
            "性格スコアは含まれません。SNSでのシェアにおすすめです。",
          personalityCopy: "性格タイプのリンクをコピー",
          personalityCopied: "性格タイプのリンクをコピーしました",
          friendTitle: "友達診断をお願いする",
          friendDescription:
            "友達や家族に、あなたの印象を答えてもらうための招待リンクです。",
          friendCopy: "友達診断リンクをコピー",
          friendCopied: "友達診断リンクをコピーしました",
          resultTitle: "結果をシェアしよう",
          inviteTitle: "友達に診断してもらおう",
          inviteDescription:
            "答えてくれた友達のぶんだけ、結果シートが増えていくよ",
          inviteLink: "招待リンク",
          characterLink: "キャラクターのリンク",
          copied: "コピーしました",
          inviteLinkCopy: "招待リンクをコピー",
          inviteLinkCopied: "招待リンクをコピーしました",
          characterLinkCopy: "キャラクターのリンクをコピー",
          characterLinkCopied: "キャラクターのリンクをコピーしました",
          qrCode: "QRコード",
          qrCodeLabel: "友達診断への招待QRコード",
          qrCodeDescription: "友達のスマホでスキャンしてもらってね",
        };
  const actionTone = group ? resultActionColorsForGroup(group) : null;
  const circleButtonStyle: CSSProperties | undefined = actionTone
    ? {
        borderColor: actionTone.border,
        color: actionTone.accent,
        boxShadow: `0 2px 8px color-mix(in srgb, ${actionTone.accent} 16%, transparent)`,
      }
    : undefined;
  const primaryButtonStyle: CSSProperties | undefined = actionTone
    ? {
        backgroundColor: actionTone.accent,
        boxShadow: `0 2px 0 ${actionTone.shadow}`,
      }
    : undefined;
  // バーの丸ボタン共通クラス。gold はプレミアムカードのCTA (#9A6A24) と同系色。
  const circleButtonClass =
    actionTone
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white transition-all hover:brightness-[0.98] active:scale-95 sm:h-11 sm:w-11"
      : circleTone === "gold"
      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#9A6A24]/35 bg-white text-[#9A6A24] shadow-[0_2px_8px_rgba(154,106,36,0.10)] transition-all hover:border-[#9A6A24]/60 hover:bg-[#FFF6DF] active:scale-95 sm:h-11 sm:w-11"
      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#5B5BEF]/35 bg-white text-[#5B5BEF] shadow-[0_2px_8px_rgba(91,91,239,0.10)] transition-all hover:border-[#5B5BEF]/60 hover:bg-[#F4F4FE] active:scale-95 sm:h-11 sm:w-11";
  // /tako は従来どおり shareUrl 自体が招待 URL。/me の友達ボタンだけ
  // friendShareUrl を優先し、キャラクター共有と同じモーダルを安全に再利用する。
  const activeShareUrl = isInvite ? (friendShareUrl ?? shareUrl) : shareUrl;

  // シェアUIの露出計測。/me は最初の共有先選択UI、/tako は個別の
  // 共有モーダルを開いた時点で拾う。旧実装は shareOpen だけを見ていたため、
  // /me の主導線で share_ui_shown が漏れ、操作数が表示数を超えていた。
  useEffect(() => {
    if (previewMode) return;
    if (sharePickerOpen) {
      track("share_ui_shown", {
        ownerToken,
        inviteCode,
        metadata: { kind: "character", source: shareSource },
      });
      return;
    }
    if (!shareOpen) return;
    if (isInvite) {
      track("tako_invite_ui_shown", {
        ownerToken,
        inviteCode,
        metadata: { surface: "sticky_modal" },
      });
      return;
    }
    track("share_ui_shown", {
      ownerToken,
      inviteCode,
      metadata: { kind: "character", source: shareSource },
    });
  }, [
    shareOpen,
    sharePickerOpen,
    isInvite,
    ownerToken,
    inviteCode,
    previewMode,
    shareSource,
  ]);

  // キャラクター共有文言。称号 + Big Five コード (例: 寄添者（OCeAN）) を差し込む。
  // 友達診断への回答依頼は含めず、純粋なキャラ共有として扱う。
  // invite モード (/tako) は LockedInviteShare と同じ招待文言に切り替える。
  const title = code ? `${essence ?? ""} (${code})` : (essence ?? "");
  const inviteShareText =
    isEn
      ? "Tell me how you see me! You can answer the friend-perspective test in Alice Personalities."
      : isId
      ? "Ceritakan bagaimana kamu melihatku! Kamu bisa menjawab tes pandangan teman di Alice Test."
      : locale === "ko"
      ? "친구 눈에 비친 나를 알려 줘! ‘나의 사용설명서’에서 친구 진단에 답할 수 있어요."
      : "友達から見たわたしを教えて！「ワタシのトリセツ」で友達診断テストができるよ";
  const characterShareText =
    isEn
      ? `Alice Personalities says I’m “${title}”!\nSee my character 👇`
      : isId
      ? `Hasil Alice Test-ku adalah “${title}”!\nLihat karakterku 👇`
      : locale === "ko"
      ? `나의 사용설명서는 ‘${title}’ 유형이었어요!\n내 캐릭터를 확인해 보세요👇`
      : `ワタシのトリセツは「${title}」でした！\n私のキャラクターを見てみて👇`;
  const shareText = isInvite ? inviteShareText : characterShareText;
  const xUrl = activeShareUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(withRef(activeShareUrl, "x"))}`
    : undefined;
  const lineUrl = activeShareUrl && !isKo && !isEn
    ? `https://line.me/R/msg/text/?${encodeURIComponent(`${shareText}\n${withRef(activeShareUrl, "line")}`)}`
    : undefined;
  // Facebook は sharer.php (テキストは付与不可・URL のみ)。
  const fbUrl = activeShareUrl
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withRef(activeShareUrl, "facebook"))}`
    : undefined;

  // 「その他」= OS のシェアシート (Web Share API)。Instagram 等の個別対応が
  // 不要になる。非対応環境 (主に PC ブラウザ) ではボタン自体を出さない。
  // navigator は SSR に無いため effect で判定する。
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  // invite モードは招待ファネルの friend_invite_clicked (LockedInviteShare と同じ
  // イベント・source だけ設置場所で分ける)。character は従来の share_clicked。
  const fireShareForKind = (
    kind: "character" | "invite",
    channel: "copy" | "x" | "line" | "kakao" | "facebook" | "native",
    sourceOverride?: string,
  ) => {
    if (previewMode) return;
    if (kind === "invite") {
      track("friend_invite_clicked", {
        ownerToken,
        inviteCode,
        metadata: { channel, source: "tako_sticky_bar" },
      });
      return;
    }
    track("share_clicked", {
      ownerToken,
      inviteCode,
      metadata: {
        channel,
        kind: "character",
        source: sourceOverride ?? shareSource,
      },
    });
  };

  const fireShare = (
    channel: "copy" | "x" | "line" | "kakao" | "facebook" | "native",
  ) => fireShareForKind(activeShareKind, channel);

  const handleNativeShare = async () => {
    if (!activeShareUrl) return;
    try {
      await navigator.share({
        text: shareText,
        url: withRef(activeShareUrl, "native"),
      });
      // 共有先を選んで完了した時のみ計測 (キャンセルは reject され catch へ)。
      fireShare("native");
    } catch {
      // キャンセル/非対応は無視
    }
  };

  const writeClipboard = async (value: string) => {
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
    return succeeded;
  };

  const copyShareValue = async (value: string) => {
    const succeeded = await writeClipboard(value);
    if (!succeeded) return false;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    return true;
  };

  const handleKakaoShare = async () => {
    if (!activeShareUrl) return;
    const url = withRef(activeShareUrl, "kakao");
    const result = await shareToKakaoTalk({
      text: shareText,
      url,
      fallbackCopy: () => copyShareValue(url),
    });
    if (result !== "unavailable") fireShare("kakao");
  };

  const handleCopy = async () => {
    if (!activeShareUrl) return;
    // コピーは文章を付けずリンクだけ (2026-07-28 指示。invite/character 共通形式。
    // 共有文 shareText は LINE/KakaoTalk/X/その他 のシェア側でのみ使う)。
    const succeeded = await copyShareValue(withRef(activeShareUrl, "copy"));
    if (!succeeded) return;
    fireShare("copy");
  };

  const handlePickerCopy = async (
    kind: "character" | "invite",
    url: string,
  ) => {
    const succeeded = await writeClipboard(withRef(url, "copy"));
    if (!succeeded) return;
    setPickerCopiedKind(kind);
    window.setTimeout(
      () => setPickerCopiedKind((current) => (current === kind ? null : current)),
      1600,
    );
    fireShareForKind(kind, "copy");
  };

  return (
    <div data-result-sticky-header className="sticky top-0 z-50">
      <div
        className="transition-transform duration-300"
        // 表示中は transform を持たせない (undefined)。translateY(0) でも transform が
        // あると子孫の fixed 要素 (TopHeader のドロワー等) の基準がこの div になり、
        // メニューがヘッダー内に閉じ込められて崩れる (ScrollHideHeader と同じ対策)。
        style={{
          transform: hidden
            ? showBar
              ? `translateY(-${headerH}px)`
              : "translateY(-100%)"
            : undefined,
        }}
      >
        <div ref={headerRef}>{children}</div>

        {showBar && (
          <div className="relative border-y border-[#E6E7F1] bg-white/95 px-3 py-1.5 shadow-[0_4px_16px_rgba(46,46,92,0.08)] backdrop-blur-md sm:px-4 md:px-6 md:py-2">
            <div
              className={`flex w-full min-w-0 items-stretch justify-end gap-1.5 sm:gap-2 ${
                fullWidthBar ? "" : "mx-auto max-w-[720px]"
              }`}
            >
              {/* シェア先は上部に並べず、丸ボタンからシェアカードへ集約する。 */}
              {lineAddHref && (
                <a
                  href={lineAddHref}
                  aria-label="LINE追加"
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#06C755] px-3.5 py-1.5 text-[12px] font-black leading-none text-white shadow-[0_2px_0_#049E44] transition-all hover:translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_1px_0_#049E44] active:scale-[0.99] sm:min-h-11 sm:px-4 sm:text-[13px]"
                >
                  <svg
                    width="19"
                    height="19"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      fillRule="evenodd"
                      d="M12 3C6.48 3 2 6.72 2 11.3c0 4.1 3.54 7.53 8.32 8.18.32.07.76.22.87.5.1.25.07.64.03.89l-.14.84c-.04.25-.2.98.87.53 1.07-.45 5.78-3.4 7.89-5.82C21.3 14.82 22 13.2 22 11.3 22 6.72 17.52 3 12 3Zm-4.1 10.82H5.84a.54.54 0 0 1-.54-.54V9.16a.54.54 0 1 1 1.08 0v3.58H7.9a.54.54 0 1 1 0 1.08Zm1.6-.54a.54.54 0 1 1-1.08 0V9.16a.54.54 0 1 1 1.08 0v4.12Zm4.48 0a.54.54 0 0 1-.98.32l-2.03-2.77v2.45a.54.54 0 1 1-1.08 0V9.16a.54.54 0 0 1 .98-.32l2.03 2.77V9.16a.54.54 0 1 1 1.08 0v4.12Zm3.44-2.6a.54.54 0 1 1 0 1.08h-1.5v.98h1.5a.54.54 0 1 1 0 1.08h-2.04a.54.54 0 0 1-.54-.54V9.16c0-.3.24-.54.54-.54h2.04a.54.54 0 1 1 0 1.08h-1.5v.98h1.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  LINE追加
                </a>
              )}

              {!lineAddHref && shareUrl && (
                <button
                  type="button"
                  aria-label={
                    defaultIsInvite
                      ? isKo
                        ? "친구에게 진단 부탁하기"
                        : isId
                          ? "Undang teman"
                        : isEn
                          ? "Invite a friend"
                          : "友達に診断してもらう"
                      : isKo
                        ? "결과 공유"
                        : isId
                          ? "Bagikan hasil"
                        : isEn
                          ? "Share result"
                          : "結果をシェア"
                  }
                  aria-haspopup="dialog"
                  aria-expanded={sharePickerOpen || shareOpen}
                  onClick={() => {
                    setShareSource("sticky_bar");
                    if (friendShareUrl && !defaultIsInvite) {
                      setActiveShareKind("character");
                      setSharePickerOpen(true);
                    } else {
                      setActiveShareKind(shareKind);
                      setShareOpen(true);
                    }
                  }}
                  className={circleButtonClass}
                  style={circleButtonStyle}
                >
                  <ShareGlyph size={20} />
                </button>
              )}

              {!lineAddHref && friendDiagnosisHref && (
                <Link
                  href={friendDiagnosisHref}
                  aria-label={
                    isEn ? "Open friend perspective" : isId ? "Buka halaman pandangan teman" : isKo ? "친구 진단 페이지로 이동" : "友達診断ページへ移動"
                  }
                  className={circleButtonClass}
                  style={circleButtonStyle}
                >
                  <FriendDiagnosisGlyph />
                </Link>
              )}

              {/* invite モード (/tako ロック中) の明示CTAピル: シェア丸ボタンと同じ招待
                  モーダルを開く (2026-08-03 指示。「ロックを解除」ピルと同スタイル)。
                  他のピル (レポート/解除CTA) が出る画面では二重にしない。 */}
              {defaultIsInvite && !reportHref && !reportCta && !showUnlockCta && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setShareSource("sticky_bar");
                    setActiveShareKind("invite");
                    setShareOpen(true);
                  }}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-1.5 text-center text-[12px] font-bold leading-[1.2] text-white shadow-[0_2px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] active:scale-[0.99] sm:min-h-11 sm:px-5 sm:text-[13px]"
                  style={primaryButtonStyle}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {isEn ? "Invite a friend" : isId ? "Undang teman" : isKo ? "친구에게 진단 부탁하기" : "友達に診断してもらう"}
                </button>
              )}

              {reportCta ?? (reportHref && (
                <a
                  href={reportHref}
                  onClick={
                    reportOpensPaywall
                      ? (event) => {
                          event.preventDefault();
                          scrollToPaywall("unmei_upgrade_sticky");
                        }
                      : undefined
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-1.5 text-center text-[12px] font-bold leading-[1.2] text-white shadow-[0_2px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] active:scale-[0.99] sm:min-h-11 sm:px-5 sm:text-[13px]"
                  style={primaryButtonStyle}
                >
                  {reportIcon === "upgrade" ? (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 20V6" />
                      <path d="m7 11 5-5 5 5" />
                      <path d="M19 2v4M17 4h4" />
                      <path d="M5 16v4M3 18h4" />
                    </svg>
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                      <path d="M14 2v5h5" />
                      <path d="M12 18v-6" />
                      <path d="m9 15 3 3 3-3" />
                    </svg>
                  )}
                  {reportLabel ??
                    (isEn ? "Download complete report" : isId ? "Unduh laporan lengkap" : isKo ? "PDF 리포트 다운로드" : "完全版レポートを生成")}
                </a>
              ))}

              {diagnosisCta && (
                <a
                  href={diagnosisCtaHref ?? (isEn ? "/en/diagnosis" : isId ? "/id/diagnosis" : isKo ? "/ko/diagnosis" : "/diagnosis")}
                  data-share-diagnosis-tracked={
                    diagnosisCtaTrackSource &&
                    diagnosisCtaEvent === "share_to_diagnosis_clicked"
                      ? "true"
                      : undefined
                  }
                  onClick={
                    diagnosisCtaTrackSource
                      ? () =>
                          track(diagnosisCtaEvent, {
                            inviteCode,
                            metadata: {
                              kind:
                                diagnosisCtaEvent === "share_to_diagnosis_clicked"
                                  ? "character"
                                  : undefined,
                              source: diagnosisCtaTrackSource,
                            },
                          })
                      : undefined
                  }
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-[#5B5BEF] px-4 py-1.5 text-center text-[12px] font-bold leading-[1.2] text-white shadow-[0_2px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] active:scale-[0.99] sm:min-h-11 sm:px-5 sm:text-[13px]"
                  style={primaryButtonStyle}
                >
                  {/* クリップボード (下部ナビ「自己診断」タブと同モチーフ)。 */}
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="5" y="4" width="14" height="17" rx="2.5" />
                    <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
                    <path d="M8.5 11h7M8.5 15h5" />
                  </svg>
                  {diagnosisCtaLabel ??
                    (isEn ? "Take the free test" : isId ? "Ikuti tes gratis" : isKo ? "무료 성격 진단 시작하기" : "無料で性格診断をする")}
                </a>
              )}

              {showUnlockCta && (
                <button
                  type="button"
                  aria-label={
                    unlockCtaLabel ??
                    (isEn ? "Unlock all results" : isId ? "Buka semua hasil" : isKo ? "모든 결과 잠금 해제" : "すべての結果のロックを解除")
                  }
                  onClick={() => scrollToPaywall("sticky_bar", paywallTargetId)}
                  className="relative inline-flex min-h-10 w-[190px] min-w-[150px] shrink items-center justify-center rounded-full bg-[#5B5BEF] px-4 py-1.5 text-center text-[12px] font-black leading-[1.15] text-white shadow-[0_2px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_1px_0_#3d3dc4] active:scale-[0.99] sm:min-h-11 sm:w-[248px] sm:min-w-[220px] sm:px-5 sm:text-[13px]"
                  style={primaryButtonStyle}
                >
                  {unlockCtaLabel ? (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="absolute left-4 sm:left-5"
                    >
                      <path d="M12 20V6" />
                      <path d="m7 11 5-5 5 5" />
                      <path d="M19 2v4M17 4h4" />
                      <path d="M5 16v4M3 18h4" />
                    </svg>
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className="absolute left-4 sm:left-5"
                    >
                      <rect x="4" y="10" width="16" height="11" rx="2.5" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  )}
                  {unlockCtaLabel ??
                    (isEn ? (
                      "Unlock all results"
                    ) : isId ? (
                      "Buka semua hasil"
                    ) : isKo ? (
                      "모든 결과 잠금 해제"
                    ) : (
                      <>
                        <span className="sm:hidden">
                          すべての結果の
                          <br />
                          ロックを解除
                        </span>
                        <span className="hidden sm:inline">
                          すべての結果のロックを解除
                        </span>
                      </>
                    ))}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* /me は共有先が2種類あるため、参考UIと同じく最初に2つを並べて見せる。
          各行の右端ボタンは、その行のURLを直接クリップボードへコピーする。 */}
      {sharePickerOpen &&
        shareUrl &&
        friendShareUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={shareCopy.pickerLabel}
            className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          >
            <button
              type="button"
              aria-label={shareCopy.close}
              onClick={() => setSharePickerOpen(false)}
              className="absolute inset-0 cursor-default bg-[#2E2E5C]/45"
            />
            <div className="relative max-h-[calc(100dvh-32px)] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white px-5 pb-7 pt-6 shadow-[0_18px_50px_rgba(46,46,92,0.3)] md:px-7 md:pb-8">
              <button
                type="button"
                aria-label={shareCopy.close}
                onClick={() => setSharePickerOpen(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#2E2E5C]/45 transition-colors hover:bg-[#F4F4FE] hover:text-[#2E2E5C]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <h2 className="pr-8 text-[22px] font-black leading-tight text-[#2E2E5C] md:text-[24px]">
                {shareCopy.pickerTitle}
              </h2>

              {/* SNS アイコンは、スコアを含まない「性格タイプ」を直接共有する。 */}
              <div className="mt-5 flex items-start gap-6">
                {isKo ? (
                  <button
                    type="button"
                    aria-label="카카오톡으로 공유"
                    onClick={handleKakaoShare}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-[#3C1E1E] transition-transform hover:scale-105"
                      style={{ background: "#FEE500" }}
                    >
                      <KakaoTalkGlyph className="h-6 w-6" />
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      카카오톡
                    </span>
                  </button>
                ) : isEn ? null : (
                  <a
                    href={lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => fireShare("line")}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#06C755] text-white transition-transform hover:scale-105">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
                      </svg>
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      LINE
                    </span>
                  </a>
                )}
                <a
                  href={xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("x")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    X
                  </span>
                </a>
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("facebook")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white transition-transform hover:scale-105">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M13.5 21v-7h2.4l.45-3H13.5V9.1c0-.87.28-1.6 1.66-1.6h1.34V4.85c-.3-.04-1.3-.13-2.44-.13-2.4 0-4.06 1.47-4.06 4.17V11H7.6v3h2.4v7h3.5z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    Facebook
                  </span>
                </a>
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEEFC] text-[#5B5BEF] transition-transform hover:scale-105">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      {shareCopy.more}
                    </span>
                  </button>
                )}
              </div>

              <div className="mt-6">
                <h3 className="text-[16px] font-black text-[#2E2E5C] md:text-[18px]">
                  {shareCopy.personalityTitle}
                </h3>
                <p className="mt-1 text-[12px] font-bold leading-relaxed text-[#77778F] md:text-[13px]">
                  {shareCopy.personalityDescription}
                </p>
                <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-[#5B5BEF]/45 bg-[#FAFAFF] px-3 py-2.5 md:px-4">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2E2E5C]/80 md:text-[14px]">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    aria-label={
                      pickerCopiedKind === "character"
                        ? shareCopy.personalityCopied
                        : shareCopy.personalityCopy
                    }
                    onClick={() => handlePickerCopy("character", shareUrl)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#5B5BEF]/35 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]"
                  >
                    <CopyGlyph copied={pickerCopiedKind === "character"} />
                  </button>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-[16px] font-black text-[#2E2E5C] md:text-[18px]">
                  {shareCopy.friendTitle}
                </h3>
                <p className="mt-1 text-[12px] font-bold leading-relaxed text-[#77778F] md:text-[13px]">
                  {shareCopy.friendDescription}
                </p>
                <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-[#DADDEA] bg-white px-3 py-2.5 md:px-4">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2E2E5C]/80 md:text-[14px]">
                    {friendShareUrl}
                  </span>
                  <button
                    type="button"
                    aria-label={
                      pickerCopiedKind === "invite"
                        ? shareCopy.friendCopied
                        : shareCopy.friendCopy
                    }
                    onClick={() => handlePickerCopy("invite", friendShareUrl)}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#5B5BEF]/35 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]"
                  >
                    <CopyGlyph copied={pickerCopiedKind === "invite"} />
                  </button>
                </div>
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {pickerCopiedKind === "character"
                  ? shareCopy.personalityCopied
                  : pickerCopiedKind === "invite"
                    ? shareCopy.friendCopied
                    : ""}
              </span>
            </div>
          </div>,
          document.body,
        )}

      {/* ===== シェアモーダル (16P の「結果を共有しましょう」参考) =====
          body 直下へポータル (ヘッダーの transform に fixed が閉じ込められるのを回避)。 */}
      {shareOpen &&
        activeShareUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isInvite ? shareCopy.inviteTitle : shareCopy.resultTitle}
            className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          >
            {/* 背景 (クリックで閉じる) */}
            <button
              type="button"
              aria-label={shareCopy.close}
              onClick={() => setShareOpen(false)}
              className="absolute inset-0 cursor-default bg-[#2E2E5C]/45"
            />
            <div className="relative w-full max-w-[360px] rounded-2xl bg-white px-6 pb-7 pt-6 shadow-[0_18px_50px_rgba(46,46,92,0.3)]">
              {/* 閉じる × */}
              <button
                type="button"
                aria-label={shareCopy.close}
                onClick={() => setShareOpen(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#2E2E5C]/45 transition-colors hover:bg-[#F4F4FE] hover:text-[#2E2E5C]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>

              <p className="mb-5 text-[18px] font-black text-[#2E2E5C]">
                {isInvite ? shareCopy.inviteTitle : shareCopy.resultTitle}
              </p>
              {isInvite && (
                <p className="-mt-3 mb-5 text-[12.5px] font-bold leading-[1.7] text-[#8A8AA3]">
                  {shareCopy.inviteDescription}
                </p>
              )}

              {/* SNS ボタン (丸アイコン + ラベル。16P の Facebook/X 行の体裁) */}
              <div className="mb-6 flex items-start gap-6">
                {isKo ? (
                  <button
                    type="button"
                    aria-label="카카오톡으로 공유"
                    onClick={handleKakaoShare}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full text-[#3C1E1E] transition-transform hover:scale-105"
                      style={{ background: "#FEE500" }}
                    >
                      <KakaoTalkGlyph className="h-6 w-6" />
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      카카오톡
                    </span>
                  </button>
                ) : isEn ? null : (
                  <a
                    href={lineUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => fireShare("line")}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#06C755] text-white transition-transform hover:scale-105">
                      {/* LINE 吹き出し */}
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.4 8.3 8-.1.4-.5 1.8-.6 2.1 0 0-.1.4.2.6.3.2.6 0 .6 0 .8-.5 4.4-2.9 5.9-4.2 3.3-1.2 5.6-3.7 5.6-6.5C22 6.6 17.5 3 12 3z" />
                      </svg>
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      LINE
                    </span>
                  </a>
                )}
                <a
                  href={xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("x")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white transition-transform hover:scale-105">
                    {/* X ロゴ */}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    X
                  </span>
                </a>
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => fireShare("facebook")}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white transition-transform hover:scale-105">
                    {/* Facebook "f" */}
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M13.5 21v-7h2.4l.45-3H13.5V9.1c0-.87.28-1.6 1.66-1.6h1.34V4.85c-.3-.04-1.3-.13-2.44-.13-2.4 0-4.06 1.47-4.06 4.17V11H7.6v3h2.4v7h3.5z" />
                    </svg>
                  </span>
                  <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                    Facebook
                  </span>
                </a>
                {/* その他 = OS のシェアシート (対応端末のみ。Instagram 等はこちらから) */}
                {canNativeShare && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EDEEFC] text-[#5B5BEF] transition-transform hover:scale-105">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </span>
                    <span className="text-[11px] font-bold text-[#2E2E5C]/70">
                      {shareCopy.more}
                    </span>
                  </button>
                )}
              </div>

              {/* リンクコピー (URL 表示 + コピー。コピー内容は共有文つき) */}
              <p className="mb-1.5 text-[12px] font-bold text-[#2E2E5C]/60">
                {isInvite ? shareCopy.inviteLink : shareCopy.characterLink}
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-[#E3E6F5] bg-[#FAFAFF] px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2E2E5C]/80">
                  {activeShareUrl}
                </span>
                <button
                  type="button"
                  aria-label={
                    copied
                      ? shareCopy.copied
                      : isInvite
                        ? shareCopy.inviteLinkCopy
                        : shareCopy.characterLinkCopy
                  }
                  onClick={handleCopy}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[#5B5BEF]/30 bg-white text-[#5B5BEF] transition-colors hover:bg-[#F4F4FE]"
                >
                  {copied ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12l4 4L19 6" />
                    </svg>
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="9" y="9" width="12" height="12" rx="2.5" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <span className="sr-only" role="status" aria-live="polite">
                {copied
                  ? isInvite
                    ? shareCopy.inviteLinkCopied
                    : shareCopy.characterLinkCopied
                  : ""}
              </span>

              {/* invite モードのみ: 対面スキャン用QR (LockedInviteShare と同じ流儀・
                  2026-08-03 指示)。リンク行と同じフル幅・中央にキャラ顔 (丸抜き・白リング)。
                  ref=qr で流入元を分けて計測する。 */}
              {isInvite && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[12px] font-bold text-[#2E2E5C]/60">
                    {shareCopy.qrCode}
                  </p>
                  <div
                    className="w-full rounded-2xl border border-[#E3E6F5] bg-white p-4"
                    role="img"
                    aria-label={shareCopy.qrCodeLabel}
                  >
                    <div className="relative">
                      <QRCodeSVG
                        value={withRef(activeShareUrl, "qr")}
                        size={248}
                        className="h-auto w-full"
                        bgColor="#FFFFFF"
                        fgColor="#2E2E5C"
                        level="H"
                        marginSize={0}
                      />
                      {/* 中央のキャラ顔 (丸抜き・白リング)。LockedInviteShare と同じ被覆率 */}
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
                  <p className="mt-2 text-center text-[12px] font-bold text-[#2E2E5C]/50">
                    {shareCopy.qrCodeDescription}
                  </p>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
