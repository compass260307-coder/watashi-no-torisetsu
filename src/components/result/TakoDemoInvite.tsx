"use client";

// 友達診断の「見本」ページ (/tako/preview?...&demo=1) から、招待へ戻す導線。
// 招待カードの「結果の見本を見る」リンクから来た人に、これは見本であることを伝え、招待してもらう。
//
// - 上部バー (TakoDemoBarContent): 自己診断結果・友達診断結果と同じ常時表示バー (MeStickyHeader) の中に
//   点滅する「見本を確認中...」と、友達診断結果の上部バーと同じ「友達を招待」ボタンを出す。
//   以前は画面下に固定バーを出していた。
// - 途中のポップアップ (TakoDemoInvitePopup): 見本を半分ほど読み進めたところで、友達診断ページと同じ
//   招待カードを1回だけ開く (日本語のみ)。上部バーのボタンからも同じカードを開く。
// - 本人の招待コードは、見本へのリンクに付けた &invite= で受け取る。付いていない見本
//   (URL を直接開いた・韓国語) では、ボタンは従来どおり元のページ (招待カード) へ戻す。
// - 計測: 既存の tako_invite_ui_shown / friend_invite_clicked を、surface / source =
//   "tako_demo_popup" (途中で自動で開いた分) / "tako_demo_bar" (上部バーから開いた分) で送る。

import { useCallback, useEffect, useState } from "react";
import { InviteCardDialog } from "@/components/result/InviteCardDialog";
import { INVITE_PILL_CLASS } from "@/components/result/MeStickyHeader";

const COPY = {
  ja: { note: "見本を確認中...", button: "友達を招待", entryPath: "/tako" },
  ko: { note: "예시 확인 중...", button: "친구 초대", entryPath: "/ko/tako" },
} as const;

/** 上部バーのボタンが、招待カードを開くよう頼むイベント。 */
const OPEN_EVENT = "tako-demo-invite-open";
const POPUP_SOURCE = "tako_demo_popup";
const BAR_SOURCE = "tako_demo_bar";
// 自動で開く位置: ページ全体のこの割合まで読み進めたとき。
const AUTO_OPEN_SCROLL_RATIO = 0.5;
// ほかのモーダル (宝箱・課金カードなど) が開いている間は出さない。
// 友達のひとことの吹き出しも role="dialog" だが、読み進めても開いたままなので数えない。
const OPEN_DIALOG_SELECTOR = '[aria-modal="true"]';
const TITLE_ID = "tako-demo-invite-title";
const OWNER_TOKEN_KEY = "torisetsu_owner_token";

/** 上部バーの中身。MeStickyHeader の reportCta に渡す。 */
export function TakoDemoBarContent({
  locale = "ja",
  opensInviteCard,
}: {
  locale?: "ja" | "ko";
  /** true: ボタンで招待カードを開く。false: 元のページ (招待カード) へ戻す。 */
  opensInviteCard: boolean;
}) {
  const copy = COPY[locale];
  const handleClick = () => {
    if (opensInviteCard) {
      window.dispatchEvent(new CustomEvent(OPEN_EVENT));
      return;
    }
    // 招待カードから来た場合は元のページへ戻る。見本URLを直接開いた場合は
    // 友達診断の入口 (/tako) へ送る。
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = copy.entryPath;
    }
  };

  return (
    <>
      {/* いま見ているのは見本だと分かるよう、ゆっくり点滅させる (動きを減らす設定の端末では止める)。
          狭い画面では文字を少し小さくする。 */}
      <p className="mr-auto animate-pulse self-center whitespace-nowrap pl-1 text-[12px] font-black leading-[1.35] text-[#2E2E5C] motion-reduce:animate-none min-[375px]:text-[13px] sm:text-[14px]">
        {copy.note}
      </p>
      {/* 友達診断結果の上部バー (MeStickyHeader) の「友達を招待」と同じボタン。 */}
      <button
        type="button"
        aria-haspopup={opensInviteCard ? "dialog" : undefined}
        onClick={handleClick}
        className={INVITE_PILL_CLASS}
      >
        {/* 絵は、友達診断結果の「友達に診断してもらう」ボタンと同じ人物2人。 */}
        <svg
          width="18"
          height="18"
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
        {copy.button}
      </button>
    </>
  );
}

/** 見本の途中で開く招待カード (日本語)。上部バーのボタンからも開く。 */
export function TakoDemoInvitePopup({
  inviteUrl,
  inviteCode,
}: {
  /** 本人の招待 URL (絶対 URL, /friend/[inviteCode])。 */
  inviteUrl: string;
  inviteCode: string;
}) {
  // 開いているカードの計測名。閉じているときは null。
  const [source, setSource] = useState<string | null>(null);
  const [ownerToken, setOwnerToken] = useState<string | undefined>(undefined);

  const open = useCallback((nextSource: string) => {
    // 計測に載せる本人の印。見本ページの URL には無いので、この端末の保存領域から読む。
    try {
      setOwnerToken(localStorage.getItem(OWNER_TOKEN_KEY) ?? undefined);
    } catch {
      /* 保存領域が使えない環境: 印なしで送る */
    }
    setSource(nextSource);
  }, []);
  const close = useCallback(() => setSource(null), []);

  useEffect(() => {
    // 1回の表示で自動で開くのは1回だけ。上部バーから自分で開いた人には、あとから出さない。
    let done = false;
    const onScroll = () => {
      if (done) return;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0 || window.scrollY / scrollable < AUTO_OPEN_SCROLL_RATIO) return;
      // ほかのモーダルが開いている間は待つ (次のスクロールでもう一度確かめる)。
      if (document.querySelector(OPEN_DIALOG_SELECTOR) !== null) return;
      done = true;
      open(POPUP_SOURCE);
    };
    const onOpenRequest = () => {
      done = true;
      open(BAR_SOURCE);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(OPEN_EVENT, onOpenRequest);
    };
  }, [open]);

  if (source === null) return null;

  return (
    <InviteCardDialog
      titleId={TITLE_ID}
      onClose={close}
      inviteUrl={inviteUrl}
      trackSource={source}
      ownerToken={ownerToken}
      inviteCode={inviteCode}
    />
  );
}
