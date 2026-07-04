"use client";

// 全ページ共通の下部固定ナビ (16personalities 風)。ハンバーガーメニューの代替。
//   - fixed bottom-0 全幅・白地・上端 0.5px 境界線 + 淡い上向き影・角丸なし。
//   - 中身は max-w-[480px] 中央寄せ (PCでもアプリ風に中央に収める。md:hidden にはしない)。
//   - 5列均等 grid。各列アイコン(インラインSVG)+ラベル(10px)縦積み。
//   - 配色は全ネイビー濃淡: アクティブ #2A3A5C / 非アクティブ #9BA3B4。
//   - アクティブ項目の上端に短いインジケーターバー (幅34px・高さ3px・角丸)。
//   - iOS セーフエリア: paddingBottom: env(safe-area-inset-bottom)。
//   - アクティブ判定は usePathname()。トリセツ(2) の URL は既存 HamburgerMenu と同じく
//     localStorage torisetsu_owner_token から /me/[token] を解決 (無ければ /diagnosis)。

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactElement } from "react";

// アクティブ=ブランドのディープネイビー / 非アクティブ=グレーネイビー。
const ACTIVE = "#2A3A5C";
const INACTIVE = "#9BA3B4";

// 下部固定CTA (StickyCtaFooter / Floating* CTA) を持つフロー系ページでは、
// ナビと衝突する / フローに集中させたいため表示しない。前方一致で判定。
//   - /diagnosis : 自己診断の回答フロー (全幅 StickyCtaFooter)
//   - /friend/   : /friend/{招待コード} の友達回答フロー (StickyCtaFooter)。末尾スラッシュ必須で
//                  /friend-evaluation (オーナー管理ハブ・ナビ非対象) と /friend (招待無し) は対象外。
//   - /evaluate/ : 友達評価の着地/完了ページ (FloatingDiagnosisCta 等・ナビの目的地ではない)
// ※ /me・/tako・/ は「ナビの目的地」なので (フローティングCTAがあっても) ナビは表示したまま。
//   他己診断タブは /friend-evaluation ではなく /tako/[token] を指す。
const HIDE_ON_PREFIXES = ["/diagnosis", "/friend/", "/evaluate/"];

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V19h12v-8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8.5 11h7M8.5 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// 相性 (/aisho): 2つ重なるハート。他アイコンと同じ viewBox・stroke 流儀。
//   フルサイズのハートパスを 0.55 倍に縮小し左右に少し重ねて配置 (strokeWidth は
//   縮小分を戻して視覚上 2px 相当に)。多色にしない。
const HEART_PATH =
  "M12 20.3l-1.45-1.32C5.4 14.24 2 11.16 2 7.38 2 4.3 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09C13.09 2.81 14.76 2 16.5 2 19.58 2 22 4.3 22 7.38c0 3.78-3.4 6.86-8.55 11.61L12 20.3z";
function HeartPairIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={HEART_PATH} transform="translate(-0.5 4) scale(0.55)" stroke="currentColor" strokeWidth="3.6" strokeLinejoin="round" />
      <path d={HEART_PATH} transform="translate(8.5 4) scale(0.55)" stroke="currentColor" strokeWidth="3.6" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14.6c2 .6 3.5 2.4 3.5 4.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="4" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="4" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
      <rect x="13" y="13" width="7" height="7" rx="1.6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  // トリセツ(2)=/me/[token]、他己診断(4)=/tako/[token] を localStorage の
  // owner_token から解決。無ければトリセツ=/diagnosis、他己診断=/tako (未診断ガード)。
  const [torisetsuUrl, setTorisetsuUrl] = useState("/diagnosis");
  const [takoUrl, setTakoUrl] = useState("/tako");
  // ★ステール対策 (バグ①): BottomNav はルートレイアウト常駐で再マウントされないため、
  //   診断完了→/me のクライアント遷移で token が保存されても初回読みのままだと
  //   古い誘導URLに固定される。usePathname() を依存に入れ「遷移のたびに再読込」して
  //   最新 token を反映する。token 消失 (端末クリア等) 時はフォールバックへ戻す。
  //   localStorage は SSR 時に無いため初期化子ではなく effect で読む (set-state-in-effect
  //   は外部ストレージ→state 同期の正当なケース)。
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("torisetsu_owner_token");
    } catch {
      // localStorage 不可環境: token=null 扱い (フォールバックのまま)。
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTorisetsuUrl(token ? `/me/${token}` : "/diagnosis");
    setTakoUrl(token ? `/tako/${token}` : "/tako");
  }, [pathname]);

  // 現在地判定込みのタブ定義。pathname / 動的URL が変わった時だけ再計算 (常駐再レンダ軽量化)。
  // ※ useMemo は hook なので early return より前に呼ぶ (rules-of-hooks 遵守)。
  const items: {
    key: string;
    label: string;
    href: string;
    active: boolean;
    Icon: () => ReactElement;
  }[] = useMemo(
    () => [
      { key: "home", label: "トップ", href: "/?stay=1", active: pathname === "/", Icon: HomeIcon },
      { key: "me", label: "トリセツ", href: torisetsuUrl, active: pathname.startsWith("/me"), Icon: ClipboardIcon },
      { key: "friend", label: "他己診断", href: takoUrl, active: pathname.startsWith("/tako"), Icon: UsersIcon },
      { key: "type", label: "タイプ", href: "/zukan-internal", active: pathname.startsWith("/zukan"), Icon: GridIcon },
      { key: "aisho", label: "相性", href: "/aisho", active: pathname.startsWith("/aisho"), Icon: HeartPairIcon },
    ],
    [pathname, torisetsuUrl, takoUrl],
  );

  // フロー系ページ (下部固定CTAあり) ではナビを描画しない。
  if (HIDE_ON_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <nav
      aria-label="グローバルナビゲーション"
      className="fixed inset-x-0 bottom-0 z-40 bg-white"
      style={{
        borderTop: "0.5px solid rgba(42,58,92,0.14)",
        boxShadow: "0 -2px 10px rgba(42,58,92,0.06)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto grid max-w-[480px] grid-cols-5">
        {items.map((it) => {
          const { Icon } = it;
          return (
            <Link
              key={it.key}
              href={it.href}
              aria-current={it.active ? "page" : undefined}
              // touch-manipulation: モバイルのタップ遅延を排除。
              // active:scale/opacity: 押下を即時に視覚反応させ「無反応」感を消す。
              className="relative flex flex-col items-center justify-center gap-1 py-2 select-none touch-manipulation transition-transform duration-100 active:scale-90 active:opacity-70"
              style={{ color: it.active ? ACTIVE : INACTIVE }}
            >
              {it.active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[3px] w-[34px] rounded-full"
                  style={{ background: ACTIVE }}
                />
              )}
              <Icon />
              <span className="text-[10px] font-bold leading-none">
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
