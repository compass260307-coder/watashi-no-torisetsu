"use client";

// 完全版 (日本語 Web) を買った直後の「完全版の準備画面」。設定と A/B は src/lib/purchase-loading.ts。
//
// - 自己診断の解析待ち画面 (DiagnosisAnalyzingLoader) を金色の豪華版 (theme="premium") で使い、
//   20秒 (1枚5秒) のあいだ、結果アップグレードの手順 (3枚) と「完全版でできること」(1枚) を流す。
// - 権利がもう反映済みでも、20秒は必ず見せる。終わったら ?paid= を外して自己診断結果を出す。
// - 戻った時点でまだ反映されていない (webhook 待ち) ときは、裏で反映を確かめる。
//   20秒たっても反映されていなければ、今までの「決済処理中...」(PaidUnlockWatcher) に引き継ぐ。
// - スライドはボタンを持たない。紹介だけにして、買ったもの (自己診断結果) を先に見せる。

import { useEffect, useRef, useState } from "react";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import type { AnalyzingSlide } from "@/i18n/diagnosis";
import { requestFullAccessStatus } from "@/lib/full-access-status-client";
import { startVisiblePolling } from "@/lib/visible-polling";

export const PURCHASE_LOADING_MS = 20_000; // 4枚 × 5秒 (2026-11-24 本人指示で15秒から延長)

// 結果アップグレードの手順を3枚 + 完全版でできることを1枚 (2026-11-24 本人指示)。
// 値段の手順は入れない (本人指示)。1枚5秒なので、文は短くする。
const SLIDES: AnalyzingSlide[] = [
  {
    visual: {
      kind: "upgradeButton",
      selfFace: "/characters/face/penguin_N.webp",
      pageLabel: "あなたの診断結果",
      buttonLabel: "結果をアップグレード",
      bubble: "ここ！",
    },
    tint: "#FFF4DA",
    text: "結果ページの一番下から\nアップグレード！",
    highlight: "一番下",
  },
  {
    visual: {
      kind: "aliceQa",
      aliceArt: "/result-upgrade/alice-cheer.webp",
      counter: "質問 1 / 7",
      question: "自分を動物にたとえるなら？",
      answer: "ねこ！気まぐれだから",
    },
    tint: "#EEF0FD",
    text: "Aliceの7つの質問に\n答えるだけ！",
    highlight: "7つの質問",
  },
  {
    visual: {
      kind: "upgrade",
      beforeFace: "/characters/face/penguin_N.webp",
      beforeLabel: "いつものキャラ",
      afterArt: "/result-upgrade/benefit-character.webp",
      afterLabel: "あなた専用",
    },
    tint: "#F1ECFA",
    text: "Aliceが、あなた専用の\nキャラと鑑定書を作るよ！",
    highlight: "あなた専用",
  },
  {
    visual: {
      kind: "unlock",
      art: "/result-upgrade/treasure-open.webp",
      items: ["友達診断の結果", "相性診断", "運命の設計図", "Aliceとタロット"],
    },
    tint: "#FFF4DA",
    text: "完全版では、ほかにも\nこんなことができるよ！",
    highlight: "ほかにも",
  },
];

const STEPS = [
  "お支払いを確認",
  "完全版の特典をひらく",
  "あなた専用のページを仕上げ",
];

// 反映待ちの確かめ方は PaidUnlockWatcher と同じ (2秒から ×1.5、上限10秒)。
const FIRST_DELAY_MS = 1200;
const INITIAL_POLL_INTERVAL_MS = 2000;
const POLL_BACKOFF_FACTOR = 1.5;
const MAX_POLL_INTERVAL_MS = 10_000;

function Header() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <span
        className="mb-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-black tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(201,143,42,0.35)]"
        style={{ background: "linear-gradient(135deg, #E8B84A, #C98F2A)" }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 1.5 14.2 9.8 22.5 12 14.2 14.2 12 22.5 9.8 14.2 1.5 12 9.8 9.8Z" fill="currentColor" />
        </svg>
        COMPLETE EDITION
      </span>
      <p className="text-[20px] font-black leading-[1.5] text-[#2E2E5C]">
        ご購入ありがとうございます！
      </p>
      <p className="mt-1 text-[13px] font-bold leading-[1.6] text-[#9A6A24]">
        あなたの完全版を準備しています...
      </p>
    </div>
  );
}

export function PurchaseLoadingScreen({
  ownerToken,
  waitingForAccess,
  durationMs = PURCHASE_LOADING_MS,
  preview = false,
}: {
  ownerToken: string;
  // 戻った時点で、完全版の権利がまだ反映されていないか。
  waitingForAccess: boolean;
  durationMs?: number;
  // dev のプレビュー: 反映の確かめも URL の書き換えもせず、時間がたったら最初から流し直す。
  preview?: boolean;
}) {
  const [phase, setPhase] = useState<"loading" | "waiting" | "done">("loading");
  const unlockedRef = useRef(!waitingForAccess);

  // 準備画面のあいだは、うしろの結果ページを動かさない。
  useEffect(() => {
    if (phase !== "loading") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [phase]);

  // まだ反映されていなければ、裏で反映を確かめる。
  useEffect(() => {
    if (preview || !waitingForAccess) return;
    let pollDelay = INITIAL_POLL_INTERVAL_MS;
    return startVisiblePolling(async (signal) => {
      try {
        const data = await requestFullAccessStatus(ownerToken, { fresh: true });
        if (signal.aborted) return false;
        if (data && data.astrologer === true && data.unmei === true && data.tarot === true) {
          unlockedRef.current = true;
          return false;
        }
      } catch {
        // ネットワークの一時的な失敗は無視して次へ
      }
      if (signal.aborted) return false;
      const nextDelay = pollDelay;
      pollDelay = Math.min(Math.round(pollDelay * POLL_BACKOFF_FACTOR), MAX_POLL_INTERVAL_MS);
      return nextDelay;
    }, FIRST_DELAY_MS);
  }, [ownerToken, preview, waitingForAccess]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (preview) {
        window.location.reload();
        return;
      }
      if (!waitingForAccess) {
        // 権利は反映済みで、うしろには解放後の結果ページが描かれている。
        // 読み込み直さずに ?paid= と session_id を外し、再読み込みで準備画面が出直さないようにする。
        const url = new URL(window.location.href);
        url.searchParams.delete("paid");
        url.searchParams.delete("session_id");
        window.history.replaceState(window.history.state, "", url.toString());
        setPhase("done");
        return;
      }
      if (unlockedRef.current) {
        // 待っているあいだに反映された。解放後の結果ページを読み込み直す。
        window.location.replace(`/me/${encodeURIComponent(ownerToken)}`);
        return;
      }
      // まだ反映されていない: 今までの「決済処理中...」に引き継ぐ。
      setPhase("waiting");
    }, durationMs);
    return () => clearTimeout(timeout);
  }, [durationMs, ownerToken, preview, waitingForAccess]);

  if (phase === "done") return null;
  if (phase === "waiting") {
    return <PaidUnlockWatcher ownerToken={ownerToken} locale="ja" product="full_access" />;
  }
  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      role="status"
      aria-live="polite"
      aria-label="完全版を準備しています"
    >
      <DiagnosisAnalyzingLoader
        theme="premium"
        header={<Header />}
        steps={STEPS}
        totalMs={durationMs}
        slides={SLIDES}
        slidesLabel="完全版を購入した方へ"
      />
    </div>
  );
}
