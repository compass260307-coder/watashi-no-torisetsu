"use client";

// 全ページ共通の下部固定ナビ (16personalities 風)。ハンバーガーメニューの代替。
//   - fixed bottom-0 全幅・白地・上端 0.5px 境界線 + 淡い上向き影・角丸なし。
//   - 中身は max-w-[480px] 中央寄せ (スマホは全幅を均等分割・PCはアプリ風に中央)。
//   - 5列均等 grid。各列アイコン(インラインSVG 32px)+ラベル(11px)縦積み。
//   - 配色は全ネイビー濃淡: アクティブ #2A3A5C / 非アクティブ #9BA3B4。
//   - アクティブ項目の上端に短いインジケーターバー (幅34px・高さ3px・角丸)。
//   - iOS セーフエリア: paddingBottom: env(safe-area-inset-bottom)。
//   - アクティブ判定は usePathname()。トリセツ(2) の URL は既存 HamburgerMenu と同じく
//     localStorage torisetsu_owner_token から /me/[token] を解決 (無ければ /diagnosis)。

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";
import {
  TakoLockPopover,
  type DiagnosisLockTarget,
} from "@/components/TakoLockPopover";
import LineAliceLinkCard from "@/components/result/LineAliceLinkCard";
import { PaywallOverlay } from "@/components/result/PaywallModal";
import {
  TAKO_ATTENTION_GRANTED_EVENT,
  TAKO_ATTENTION_PENDING_KEY,
  takoAttentionImpressionKey,
} from "@/lib/tako-attention";
import {
  UNMEI_ATTENTION_PENDING_KEY,
  unmeiAttentionImpressionKey,
} from "@/lib/unmei-attention";
import {
  ME_ATTENTION_GRANTED_EVENT,
  ME_ATTENTION_PENDING_KEY,
} from "@/lib/me-attention";
import { THREE_COURSE_PAYWALL_VERSION } from "@/lib/access-products";
import { DIRECT_PAYWALL_SOURCE } from "@/lib/paywall-source";
import { track } from "@/lib/track";
import { trackingPageFromPathname } from "@/lib/tracking-page";
import { useCourseNavigationAccess } from "@/lib/use-course-navigation-access";

const UNMEI_COURSE_PRODUCTS = ["premium_bundle"] as const;
const ALICE_COURSE_PRODUCTS = ["full_access", "premium_bundle"] as const;
const TAROT_COURSE_PRODUCTS = ["full_access"] as const;
const UNMEI_PAYWALL_HASH = "#unlock-unmei";
const TAROT_PAYWALL_HASH = "#unlock-tarot";

type CourseLockTarget = "hoshiyomi" | "unmei" | "tarot";

// アクティブ=ブランドのディープネイビー / 非アクティブ=グレーネイビー。
const ACTIVE = "#2A3A5C";
const INACTIVE = "#9BA3B4";

// 下部固定CTA (StickyCtaFooter / Floating* CTA) を持つフロー系ページでは、
// ナビと衝突する / フローに集中させたいため表示しない。前方一致で判定。
//   - /friend/   : /friend/{招待コード} の友達回答フロー (StickyCtaFooter)。末尾スラッシュ必須で
//                  /friend-evaluation (オーナー管理ハブ・ナビ非対象) と /friend (招待無し) は対象外。
//   - /evaluate/ : 友達評価の着地/完了ページ (FloatingDiagnosisCta 等・ナビの目的地ではない)
//   - /share/    : キャラシェアの獲得ランディング (新規向け・診断CTA 1点に集中させる)
// ※ /me・/tako・/ は「ナビの目的地」なので (フローティングCTAがあっても) ナビは表示したまま。
//   友達診断タブは /friend-evaluation ではなく /tako/[token] を指す。
// ※ /diagnosis (自己診断の回答フロー) はサイト共通chrome統一のためナビを表示する。
//   下部の StickyCtaFooter は aboveBottomNav でナビの上に持ち上げて衝突を避ける。
const HIDE_ON_PREFIXES = [
  "/friend/",
  // /evaluate/sent (評価送信後の案内ページ) ではナビを出す (2026-08-04:
  // 未診断者への「自己診断」誘いバッジの受け皿。旧: /evaluate/ 全体を非表示)。
  // /evaluate/result は本人向け結果表示のため従来どおり非表示。
  "/evaluate/result/",
  "/ko/friend/",
  "/ko/evaluate/result/",
  "/share/",
  "/ko/share/",
  "/admin",
  "/ko/admin",
  "/report/", // 自己診断PDF生成専用ページ
  "/tako-report/", // PDF生成専用ページ (印刷にナビを写さない)
  "/line/", // LINE内ブラウザ専用ページ (Plus LP/決済着地)。固定CTAと衝突するためナビ非表示
  "/liff", // LIFF入口 (即リダイレクトのつなぎページ)。サイトchromeは出さない
];

function ClipboardIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 11h7M8.5 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.6c2 .6 3.5 2.4 3.5 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 未診断時に「友達診断」アイコンの右上へ重ねるミニ南京錠バッジ。
//   白フチ付きで下のアイコンと視覚的に分離する。
function LockBadge() {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-2 flex h-[15px] w-[15px] items-center justify-center rounded-full"
      style={{ background: "#9BA3B4", boxShadow: "0 0 0 2px #fff" }}
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
        <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" fill="#fff" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// 自己診断完了後、まだ友達診断ページを見ていないことを知らせるバッジ。
// 小さい下部ナビでも見落としにくい赤で表示する。
function AttentionBadge() {
  return (
    <span
      data-notification-badge="true"
      aria-hidden="true"
      className="absolute -right-2 -top-2 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[12px] font-black leading-none text-white"
      style={{
        background: "#EF4444",
        boxShadow: "0 0 0 2px #fff, 0 2px 6px rgba(239,68,68,0.35)",
      }}
    >
      !
    </span>
  );
}

// タロット占い: 重なったカードと中央の星。タイプ一覧のグリッドと区別しつつ、
// ほかのタブと同じ32px・単色ストロークで揃える。
function TarotCardsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="5" width="11.5" height="15.5" rx="2.2" transform="rotate(-7 4.5 5)" stroke="currentColor" strokeWidth="1.8" />
      <rect x="8" y="3.5" width="11.5" height="16.5" rx="2.2" fill="white" stroke="currentColor" strokeWidth="2" />
      <path d="m13.75 8 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" fill="currentColor" />
    </svg>
  );
}

// 運命の設計図 (/unmei): 出生図ホイール (外周円 + アスペクト線の三角 + 天体の点)。
//   他アイコンと同じ viewBox・stroke 流儀。アスペクト線は細め (1.8) で階層をつける。
function NatalWheelIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5 19.36 16.25H4.64L12 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
      <circle cx="19.36" cy="16.25" r="1.5" fill="currentColor" />
      <circle cx="4.64" cy="16.25" r="1.5" fill="currentColor" />
    </svg>
  );
}

// 診断後に表示する「占い師」: 会話バブル + 星のきらめき。
// 出生図を読むだけの「運命」と区別し、対話できることが小さいナビでも伝わる形にする。
function AstrologerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 5.5h10.5A3.5 3.5 0 0 1 19 9v4a3.5 3.5 0 0 1-3.5 3.5H10l-4.5 3v-3.35A3.5 3.5 0 0 1 2.5 13V9A3.5 3.5 0 0 1 5 5.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m10.75 7.75.55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55.55-1.45Z"
        fill="currentColor"
      />
      <path d="M17.5 2.5v2M16.5 3.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const isKorean = pathname.startsWith("/ko");
  const isKoreanResult = pathname.startsWith("/ko/me/");
  const isTakoAttentionPreview =
    process.env.NODE_ENV === "development" &&
    pathname === "/dev/tako-attention-preview";
  const isAstrologerPreview =
    process.env.NODE_ENV === "development" &&
    pathname === "/dev/hoshiyomi-preview";
  const isPaidNavigationPreview =
    process.env.NODE_ENV === "development" &&
    pathname === "/tarot/dev-preview";
  const isCoursePaywallPreview =
    process.env.NODE_ENV === "development" &&
    pathname === "/dev/bottom-nav-paywall-preview";
  // トリセツ(2)=/me/[token]、友達診断(4)=/tako/[token] を localStorage の
  // owner_token から解決。無ければトリセツ=/diagnosis、友達診断=/tako (未診断ガード)。
  const [torisetsuUrl, setTorisetsuUrl] = useState(() =>
    isKorean ? "/ko/diagnosis" : "/diagnosis",
  );
  const [takoUrl, setTakoUrl] = useState(() =>
    isKorean ? "/ko/tako" : "/tako",
  );
  // 未診断 (token 無し) なら友達診断タブをロック表示にし、タップでポップアップを出す。
  //   初期値 true (=ロックなし) にすると診断済みユーザーに一瞬ロックが見えるのを避けられる
  //   一方、未診断ユーザーには hydration 後にバッジが現れるが、こちらの方が違和感が小さい。
  const [hasToken, setHasToken] = useState(true);
  const [diagnosisLockTarget, setDiagnosisLockTarget] =
    useState<DiagnosisLockTarget | null>(null);
  const [courseLockTarget, setCourseLockTarget] =
    useState<CourseLockTarget | null>(null);
  const [coursePaywallSource, setCoursePaywallSource] = useState<string | null>(
    null,
  );
  const [lineExitOpen, setLineExitOpen] = useState(false);
  const [ownerToken, setOwnerToken] = useState<string | null>(null);
  const [showTakoAttention, setShowTakoAttention] = useState(false);
  const [showUnmeiAttention, setShowUnmeiAttention] = useState(false);
  // 未診断者への「自己診断」誘いバッジ (評価送信後ページで付与 / 2026-08-04)。
  const [showMeAttention, setShowMeAttention] = useState(false);
  const navHidden = HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p));
  // 常設ナビは全ページで表示されるため、リンク先を自動取得すると1表示あたりの
  // Edge Requestsが大きく増える。遷移自体はNext Linkのまま、取得はタップ時に行う。
  const navigationPrefetch = false;
  // ★ステール対策 (バグ①): BottomNav はルートレイアウト常駐で再マウントされないため、
  //   診断完了→/me のクライアント遷移で token が保存されても初回読みのままだと
  //   古い誘導URLに固定される。usePathname() を依存に入れ「遷移のたびに再読込」して
  //   最新 token を反映する。token 消失 (端末クリア等) 時はフォールバックへ戻す。
  //   localStorage は SSR 時に無いため初期化子ではなく effect で読む (set-state-in-effect
  //   は外部ストレージ→state 同期の正当なケース)。
  useEffect(() => {
    const evaluate = () => {
      const koreanPath = pathname.startsWith("/ko");
      let token: string | null = null;
      let attentionPending = false;
      let unmeiPending = false;
      let mePending = false;
      try {
        token = localStorage.getItem("torisetsu_owner_token");
        const pendingToken = localStorage.getItem(TAKO_ATTENTION_PENDING_KEY);
        const ownerTakoPath = token
          ? `${koreanPath ? "/ko" : ""}/tako/${token}`
          : null;

        if (token && pathname === ownerTakoPath) {
          // 到達計測と未確認解除は /tako ページ内の TakoViewTracker が担う。
          // ここでは遷移直後にバッジを描画しないための表示判定だけを行う。
          attentionPending = false;
        } else {
          attentionPending = Boolean(
            token && pendingToken === token && !navHidden,
          );
          if (attentionPending && token) {
            const impressionKey = takoAttentionImpressionKey(token);
            if (localStorage.getItem(impressionKey) !== "1") {
              localStorage.setItem(impressionKey, "1");
              track("tako_nav_badge_shown", { ownerToken: token });
            }
          }
        }

        // 運命タブの赤バッジ (友達診断と同じ流儀)。/unmei 上では出さない
        // (未確認解除は /unmei レイアウト内の UnmeiAttentionClear が担う)。
        const unmeiPendingToken = localStorage.getItem(
          UNMEI_ATTENTION_PENDING_KEY,
        );
        const unmeiPath = `${koreanPath ? "/ko" : ""}/unmei`;
        if (!pathname.startsWith(unmeiPath)) {
          unmeiPending = Boolean(
            token && unmeiPendingToken === token && !navHidden,
          );
          if (unmeiPending && token) {
            const impressionKey = unmeiAttentionImpressionKey(token);
            if (localStorage.getItem(impressionKey) !== "1") {
              localStorage.setItem(impressionKey, "1");
              track("unmei_nav_badge_shown", { ownerToken: token });
            }
          }
        }

        // 「自己診断」誘いバッジ: 評価送信後ページ (MeAttentionOnGuide) が付与した
        // pending を未診断の間だけ表示する。診断済みになった / 目的地 (/diagnosis) に
        // 到達したら役目を終えるので消す。日本語・韓国語の両方で表示する。
        if (localStorage.getItem(ME_ATTENTION_PENDING_KEY) === "1") {
          if (
            token ||
            pathname.startsWith("/diagnosis") ||
            pathname.startsWith("/ko/diagnosis")
          ) {
            localStorage.removeItem(ME_ATTENTION_PENDING_KEY);
          } else {
            mePending = !navHidden;
          }
        }
      } catch {
        // localStorage 不可環境: token=null 扱い (フォールバックのまま)。
      }
      setTorisetsuUrl(
        token
          ? `${koreanPath ? "/ko" : ""}/me/${token}`
          : `${koreanPath ? "/ko" : ""}/diagnosis`,
      );
      setTakoUrl(
        token
          ? `${koreanPath ? "/ko" : ""}/tako/${token}`
          : koreanPath
            ? "/ko/tako"
            : "/tako",
      );
      setHasToken(Boolean(token));
      setOwnerToken(token);
      setShowTakoAttention(attentionPending);
      setShowUnmeiAttention(unmeiPending);
      setShowMeAttention(mePending);
    };
    evaluate();
    // /me/[token] は loading.tsx が先にコミットされるため、pathname 変化時点の
    // 評価は付与 (TakoAttentionOnResult) より前に走る。付与側が発火する通知を
    // 拾って同一ページ内で再評価し、「/me 滞在中にバッジが出ない」を防ぐ。
    // 自己診断の誘いバッジ (MeAttentionOnGuide) も同じレースがあるため同様に拾う。
    window.addEventListener(TAKO_ATTENTION_GRANTED_EVENT, evaluate);
    window.addEventListener(ME_ATTENTION_GRANTED_EVENT, evaluate);
    return () => {
      window.removeEventListener(TAKO_ATTENTION_GRANTED_EVENT, evaluate);
      window.removeEventListener(ME_ATTENTION_GRANTED_EVENT, evaluate);
    };
  }, [navHidden, pathname]);

  // 有料コースのサーバーガードから戻ったときも、ナビの鍵をタップした
  // ときと同じ課金カードを開く。再読み込みで開き続けないよう hash は即座に除去。
  useEffect(() => {
    const openGuardedCoursePaywall = () => {
      const target: CourseLockTarget | null =
        window.location.hash === UNMEI_PAYWALL_HASH
          ? "unmei"
          : window.location.hash === TAROT_PAYWALL_HASH
            ? "tarot"
            : null;
      if (!target) return;
      setDiagnosisLockTarget(null);
      setCoursePaywallSource(DIRECT_PAYWALL_SOURCE);
      setCourseLockTarget(target);
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    };

    openGuardedCoursePaywall();
    window.addEventListener("hashchange", openGuardedCoursePaywall);
    return () =>
      window.removeEventListener("hashchange", openGuardedCoursePaywall);
  }, [pathname]);

  // Footer と同じリクエストを共有し、同一ページ内の重複通信を避ける。
  const resolvedCourseAccess = useCourseNavigationAccess(
    navHidden || isCoursePaywallPreview ? null : ownerToken,
  );
  // 権限が未確定の間は安全側のロック表示に固定する。
  // 未購入ユーザーに Alice・運命が一瞬だけ解放済みで見えるフラッシュを防ぐ。
  const hasUnmeiNavigationAccess =
    !isCoursePaywallPreview &&
    (isPaidNavigationPreview || (resolvedCourseAccess?.unmei ?? false));
  const hasAliceNavigationAccess =
    !isCoursePaywallPreview &&
    (isPaidNavigationPreview || (resolvedCourseAccess?.astrologer ?? false));
  // タロットは常時表示し、権限のない間は鍵付きにする。
  const hasTarotNavigationAccess =
    isPaidNavigationPreview || (resolvedCourseAccess?.tarot ?? false);

  const handleCoursePaywallExitAttempt = () => {
    if (lineExitOpen) return;
    if (courseLockTarget && !isKorean && !isCoursePaywallPreview) {
      setLineExitOpen(true);
      return;
    }
    setCourseLockTarget(null);
    setCoursePaywallSource(null);
  };

  const closeLineExitFlow = () => {
    setLineExitOpen(false);
    setCourseLockTarget(null);
    setCoursePaywallSource(null);
  };

  // 現在地判定込みのタブ定義。pathname / 動的URL が変わった時だけ再計算 (常駐再レンダ軽量化)。
  // ※ useMemo は hook なので early return より前に呼ぶ (rules-of-hooks 遵守)。
  const items: {
    key: string;
    label: string;
    href: string;
    active: boolean;
    Icon: () => ReactElement;
    locked?: boolean;
    disabled?: boolean;
  }[] = useMemo(
    () =>
      isKorean
        ? [
            // 日本版と同じ5タブ構成。表示文言と遷移先だけ韓国向けにする。
            { key: "me", label: "자기 진단", href: torisetsuUrl, active: isKoreanResult, Icon: ClipboardIcon },
            {
              key: "friend",
              label: "친구 진단",
              href: isTakoAttentionPreview
                ? "/ko/tako/preview?previewLocked=1&friends=0"
                : takoUrl,
              active:
                pathname.startsWith("/ko/friend") ||
                pathname.startsWith("/ko/tako"),
              Icon: UsersIcon,
              locked:
                !hasToken &&
                !isTakoAttentionPreview &&
                !isPaidNavigationPreview,
            },
            {
              key: "astrologer",
              label: "Alice",
              href: "/ko/hoshiyomi",
              active: pathname.startsWith("/ko/hoshiyomi"),
              Icon: AstrologerIcon,
              locked:
                (!hasToken && !isPaidNavigationPreview) ||
                !hasAliceNavigationAccess,
            },
            {
              key: "unmei",
              label: "운명",
              href: "/ko/unmei",
              active: pathname.startsWith("/ko/unmei"),
              Icon: NatalWheelIcon,
              locked:
                (!hasToken && !isPaidNavigationPreview) ||
                !hasUnmeiNavigationAccess,
            },
            {
              key: "tarot",
              label: "타로",
              href: "/ko/tarot",
              active: pathname.startsWith("/ko/tarot"),
              Icon: TarotCardsIcon,
              locked:
                (!hasToken && !isPaidNavigationPreview) ||
                !hasTarotNavigationAccess,
            },
          ]
        : [
            // タロットは未購入時も鍵付きで表示する。
            { key: "me", label: "自己診断", href: torisetsuUrl, active: pathname.startsWith("/me"), Icon: ClipboardIcon },
            // 未診断時はロック表示: 遷移せずポップアップ (TakoLockModal) で解放条件を伝える。
            {
              key: "friend",
              label: "友達診断",
              href: isTakoAttentionPreview
                ? "/tako/preview?previewLocked=1&friends=0"
                : takoUrl,
              active: pathname.startsWith("/tako"),
              Icon: UsersIcon,
              locked:
                !hasToken &&
                !isTakoAttentionPreview &&
                !isPaidNavigationPreview,
            },
            // AI占い師。未診断または購入権限が無い時は鍵を出し、
            // 運命の設計図と同じくタップで診断案内 / 課金カードを開く。
            {
              key: "astrologer",
              label: "Alice",
              href: isAstrologerPreview
                ? "/dev/hoshiyomi-preview"
                : "/hoshiyomi",
              active:
                pathname.startsWith("/hoshiyomi") ||
                pathname === "/dev/hoshiyomi-preview",
              Icon: AstrologerIcon,
              locked:
                (!hasToken && !isPaidNavigationPreview) ||
                !hasAliceNavigationAccess,
            },
            // 運命の設計図。未購入は鍵を出し、タップで課金カードを開く。
            // URL直打ちはページ側のサーバーガードが同じモーダルへ戻す。
            {
              key: "unmei",
              label: "運命",
              href: "/unmei",
              active: pathname.startsWith("/unmei"),
              Icon: NatalWheelIcon,
              locked:
                (!hasToken && !isPaidNavigationPreview) ||
                !hasUnmeiNavigationAccess,
            },
            {
              key: "tarot",
              label: "タロット",
              href: isPaidNavigationPreview ? "/tarot/dev-preview" : "/tarot",
              active: pathname.startsWith("/tarot"),
              Icon: TarotCardsIcon,
              locked:
                (!hasToken && !isPaidNavigationPreview) ||
                !hasTarotNavigationAccess,
            },
          ],
    [
      hasToken,
      hasAliceNavigationAccess,
      hasTarotNavigationAccess,
      hasUnmeiNavigationAccess,
      isAstrologerPreview,
      isPaidNavigationPreview,
      isKorean,
      isKoreanResult,
      isTakoAttentionPreview,
      pathname,
      takoUrl,
      torisetsuUrl,
    ],
  );

  // フロー系ページ (下部固定CTAあり) ではナビを描画しない。
  if (navHidden) {
    return null;
  }

  return (
    <nav
      data-bottom-nav
      aria-label={isKorean ? "전역 내비게이션" : "グローバルナビゲーション"}
      className="fixed inset-x-0 bottom-0 z-40 bg-white print:hidden"
      style={{
        borderTop: "0.5px solid rgba(42,58,92,0.14)",
        boxShadow: "0 -2px 10px rgba(42,58,92,0.06)",
        // iOS ホームインジケーター用の余白。ただし内蔵ブラウザ (Google アプリ等) では
        // safe-area がそのまま白い帯=スキマに見えるため、一定量詰める (最低クリアランスは確保)。
        // env=0 の環境 (Android 等) は影響なし。
        paddingBottom: "max(env(safe-area-inset-bottom) - 14px, 0px)",
      }}
    >
      {/* スマホでは全幅を均等5分割 (左右の死に余白を作らない 2026-07-26 指示)。
          PC はアプリ風に max-w-[480px] で中央寄せ。 */}
      <div
        className={`mx-auto grid max-w-[480px] ${
          items.length === 4
            ? "grid-cols-4"
            : items.length === 5
              ? "grid-cols-5"
              : "grid-cols-6"
        }`}
      >
        {items.map((it) => {
          const { Icon } = it;
          const hasAttention =
            (it.key === "friend" &&
              (showTakoAttention || isTakoAttentionPreview)) ||
            (it.key === "unmei" && showUnmeiAttention) ||
            (it.key === "me" && showMeAttention);
          if (it.disabled) {
            return (
              <button
                key={it.key}
                type="button"
                disabled
                aria-label={`${it.label}${isKorean ? " (준비 중)" : " (準備中)"}`}
                className="relative flex flex-col items-center justify-center gap-1 py-2 select-none"
                style={{ color: INACTIVE }}
              >
                <span className="relative">
                  <Icon />
                  <LockBadge />
                </span>
                <span className="text-[11px] font-bold leading-none">
                  {it.label}
                </span>
              </button>
            );
          }
          if (it.locked) {
            const diagnosisTarget: DiagnosisLockTarget =
              it.key === "unmei"
                ? "unmei"
                : it.key === "astrologer"
                  ? "astrologer"
                  : "friend";
            const courseTarget =
              it.key === "unmei"
                ? "unmei"
                : it.key === "tarot"
                  ? "tarot"
                : it.key === "astrologer"
                  ? "hoshiyomi"
                  : null;
            return (
              <button
                key={it.key}
                type="button"
                aria-label={`${it.label}${isKorean ? " (잠김)" : "（ロック中）"}`}
                onClick={() => {
                  if (
                    courseTarget === "unmei" ||
                    courseTarget === "tarot"
                  ) {
                    const source = `nav_locked_${courseTarget}`;
                    if (!isCoursePaywallPreview) {
                      track("paywall_scroll_clicked", {
                        ownerToken,
                        metadata: {
                          source,
                          page: trackingPageFromPathname(pathname),
                          surface: courseTarget,
                          destination: courseTarget,
                          paywall_version: THREE_COURSE_PAYWALL_VERSION,
                        },
                      });
                    }
                    setDiagnosisLockTarget(null);
                    setCoursePaywallSource(source);
                    setCourseLockTarget(courseTarget);
                  } else if (!hasToken && !isCoursePaywallPreview) {
                    setCourseLockTarget(null);
                    setCoursePaywallSource(null);
                    setDiagnosisLockTarget(diagnosisTarget);
                  } else if (courseTarget) {
                    const source = `nav_locked_${courseTarget}`;
                    if (!isCoursePaywallPreview) {
                      track("paywall_scroll_clicked", {
                        ownerToken,
                        metadata: {
                          source,
                          page: trackingPageFromPathname(pathname),
                          surface: courseTarget,
                          destination: courseTarget,
                          paywall_version: THREE_COURSE_PAYWALL_VERSION,
                        },
                      });
                    }
                    setDiagnosisLockTarget(null);
                    setCoursePaywallSource(source);
                    setCourseLockTarget(courseTarget);
                  } else {
                    setCourseLockTarget(null);
                    setCoursePaywallSource(null);
                    setDiagnosisLockTarget("friend");
                  }
                }}
                className="relative flex flex-col items-center justify-center gap-1 py-2 select-none touch-manipulation transition-transform duration-100 active:scale-90 active:opacity-70"
                style={{ color: INACTIVE }}
              >
                <span className="relative">
                  <Icon />
                  <LockBadge />
                </span>
                <span className="text-[11px] font-bold leading-none">
                  {it.label}
                </span>
              </button>
            );
          }
          // バッジ付きタブのタップ処理。
          //   - me (自己診断の誘い / 未診断=ownerToken 無し): pending を消して1回きりにし、
          //     既存の評価者→診断KPI (friend_to_diagnosis_clicked) に source 違いで載せる
          //     (新イベント名は events テーブルの RLS 変更が要るため増やさない)。
          //   - friend / unmei: 従来どおり *_nav_badge_clicked (ownerToken 必須)。
          const handleAttentionClick = !hasAttention
            ? undefined
            : it.key === "me"
              ? () => {
                  try {
                    localStorage.removeItem(ME_ATTENTION_PENDING_KEY);
                  } catch {
                    // noop
                  }
                  setShowMeAttention(false);
                  track("friend_to_diagnosis_clicked", {
                    metadata: { source: "nav_badge", destination: it.href },
                  });
                }
              : ownerToken
                ? () =>
                    track(
                      it.key === "unmei"
                        ? "unmei_nav_badge_clicked"
                        : "tako_nav_badge_clicked",
                      {
                        ownerToken,
                        metadata: { destination: it.href },
                      },
                    )
                : undefined;
          return (
            <Link
              key={it.key}
              href={it.href}
              prefetch={navigationPrefetch}
              aria-current={it.active ? "page" : undefined}
              aria-label={
                hasAttention
                  ? isKorean
                    ? `${it.label} (확인하지 않은 알림 있음)`
                    : `${it.label}（未確認のお知らせあり）`
                  : undefined
              }
              onClick={handleAttentionClick}
              // touch-manipulation: モバイルのタップ遅延を排除。
              // active:scale/opacity: 押下を即時に視覚反応させ「無反応」感を消す。
              className="relative flex flex-col items-center justify-center gap-1 py-2 select-none touch-manipulation transition-transform duration-100 active:scale-90 active:opacity-70"
              style={{
                color: it.active || hasAttention ? ACTIVE : INACTIVE,
              }}
            >
              {it.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[3px] w-[34px] rounded-full"
                  style={{ background: ACTIVE }}
                />
              )}
              <span className="relative">
                <Icon />
                {hasAttention ? <AttentionBadge /> : null}
              </span>
              <span className="text-[11px] font-bold leading-none">
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
      <TakoLockPopover
        isOpen={diagnosisLockTarget !== null}
        onClose={() => setDiagnosisLockTarget(null)}
        locale={isKorean ? "ko" : "ja"}
        target={diagnosisLockTarget ?? "friend"}
      />
      {courseLockTarget ? (
        <PaywallOverlay
          ownerToken={ownerToken ?? undefined}
          locale={isKorean ? "ko" : "ja"}
          returnTo={courseLockTarget === "tarot" ? "me" : courseLockTarget}
          ctaSource={
            coursePaywallSource ?? `nav_locked_${courseLockTarget}`
          }
          products={
            courseLockTarget === "hoshiyomi"
              ? ALICE_COURSE_PRODUCTS
              : courseLockTarget === "tarot"
                ? TAROT_COURSE_PRODUCTS
                : UNMEI_COURSE_PRODUCTS
          }
          defaultProduct={
            courseLockTarget === "unmei" ? "premium_bundle" : "full_access"
          }
          heading={
            courseLockTarget === "hoshiyomi"
              ? isKorean
                ? undefined
                : "Aliceを試す・本格相談を選ぶ"
              : undefined
          }
          previewMode={isCoursePaywallPreview}
          scrollLocked={lineExitOpen}
          onClose={handleCoursePaywallExitAttempt}
        />
      ) : null}
      {lineExitOpen ? (
        <BottomNavLineExitModal
          ownerToken={ownerToken ?? undefined}
          onClose={closeLineExitFlow}
          variant={
            courseLockTarget === "unmei" || courseLockTarget === "tarot"
              ? "fortune"
              : "conversation"
          }
        />
      ) : null}
    </nav>
  );
}

function BottomNavLineExitModal({
  ownerToken,
  onClose,
  variant,
}: {
  ownerToken?: string;
  onClose: () => void;
  variant: "conversation" | "fortune";
}) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        variant === "fortune"
          ? "LINEでAliceに占ってもらう"
          : "LINEでもAliceと話す"
      }
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#2E2E5C]/35 px-3 py-5 backdrop-blur-[2px] md:py-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[1120px] px-3 pb-6 pt-10 md:px-6 md:pb-10"
        onClick={(event) => event.stopPropagation()}
      >
        <LineAliceLinkCard
          ownerToken={ownerToken}
          trackingSource={
            variant === "fortune"
              ? "bottom_nav_unmei_paywall_exit"
              : "bottom_nav_alice_paywall_exit"
          }
          onClose={onClose}
          variant={variant}
        />
      </div>
    </div>,
    document.body,
  );
}
