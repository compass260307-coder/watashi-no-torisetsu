"use client";

// 完全版 (日本語 Web) を買った直後の「完全版の準備画面」。出す条件は MeResultPage.tsx (日本語の本人の full_access 購入なら全員)。
//
// - 自己診断の解析待ち画面 (DiagnosisAnalyzingLoader) を金色の豪華版 (theme="premium") で使い、
//   20秒 (1枚5秒) のあいだ、「結果をアップグレードできる」(1枚) とそのやり方 (3枚) を流す。
// - 権利がもう反映済みでも、20秒は必ず見せる。終わったら ?paid= を外して自己診断結果を出す。
// - 戻った時点でまだ反映されていない (webhook 待ち) ときは、裏で反映を確かめる。
//   20秒たっても反映されていなければ、今までの「決済処理中...」(PaidUnlockWatcher) に引き継ぐ。
// - スライドはボタンを持たない。紹介だけにして、買ったもの (自己診断結果) を先に見せる。

import { useEffect, useMemo, useRef, useState } from "react";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import type { AnalyzingSlide } from "@/i18n/diagnosis";
import { requestFullAccessStatus } from "@/lib/full-access-status-client";
import { startVisiblePolling } from "@/lib/visible-polling";

export const PURCHASE_LOADING_MS = 20_000; // 4枚 × 5秒 (2026-11-24 本人指示で15秒から延長)

// 2枚目の図 (本人の結果ページの上の端の見立て) に使う、本人の結果ページの見た目。
export type PurchaseLoadingSelf = {
  // 本人のキャラの顔。
  face: string;
  // ヒーローの大きい名前 (結果ページの実物と同じもの)。
  typeName: string;
  // ヒーローの帯の色。
  heroColor: string;
  // 「結果をアップグレード」のボタンの色と、下の縁の色。
  buttonColor: string;
  buttonShadow: string;
};

// 1枚目で「結果をアップグレードできる」と伝え、そのやり方を3枚で見せる (2026-11-24 本人指示)。
// 値段の手順は入れない (本人指示)。1枚5秒なので、文は短くする。
const buildSlides = (self: PurchaseLoadingSelf): AnalyzingSlide[] => [
  {
    visual: {
      kind: "upgrade",
      // 変身後の見本 (benefit-character.webp) はうさぎなので、変身前も同じうさぎにする。
      beforeFace: "/characters/face/rabbit_N.webp",
      beforeLabel: "いつものキャラ",
      afterArt: "/result-upgrade/benefit-character.webp",
      afterLabel: "あなた専用",
    },
    tint: "#F1ECFA",
    text: "完全版を購入した方はさらに、\n結果をアップグレードできるよ！",
    highlight: "結果をアップグレード",
  },
  {
    // 「結果をアップグレード」は、結果ページの右上にいつも出ている (上の固定バー)。
    // 準備画面が終わった直後に見える画面と同じ並び・同じ色で見せる。
    visual: {
      kind: "upgradeButton",
      selfFace: self.face,
      heroLabel: "あなたの性格タイプ:",
      typeName: self.typeName,
      heroColor: self.heroColor,
      buttonLabel: "結果をアップグレード",
      buttonColor: self.buttonColor,
      buttonShadow: self.buttonShadow,
      bubble: "ここ！",
    },
    tint: "#FFF4DA",
    text: "結果ページの右上から\nアップグレード！",
    highlight: "右上",
  },
  {
    // 実際の会話画面 (ResultUpgradeChat) と同じ並び: 上に Alice と「n / 7」と7つの目盛り、下に質問と答え。
    visual: {
      kind: "aliceQa",
      aliceAvatar: "/mascot/hoshiyomi-alice-avatar-transparent.png",
      aliceName: "Alice",
      total: 7,
      questionLabel: "質問 1/7",
      question: "自分を動物にたとえるなら？",
      answer: "ねこ！気まぐれだから",
    },
    tint: "#EEF0FD",
    text: "Aliceの7つの質問に\n答えるだけ！",
    highlight: "7つの質問",
  },
  {
    // 絵は ChatGPT で作成 (2026-11-25)。「専用キャラ」「鑑定書」の札は絵の中の刺しゅう。
    visual: {
      kind: "upgradeResult",
      art: "/result-upgrade/alice-presents-gifts-v1.webp",
    },
    // 絵が出るまでの地色 (絵の夜空の紺)。
    tint: "#1A1F4B",
    text: "Aliceが、あなた専用の\nキャラと鑑定書を作るよ！",
    highlight: "あなた専用",
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

export function PurchaseLoadingScreen({
  ownerToken,
  self,
  waitingForAccess,
  durationMs = PURCHASE_LOADING_MS,
  preview = false,
}: {
  ownerToken: string;
  self: PurchaseLoadingSelf;
  // 戻った時点で、完全版の権利がまだ反映されていないか。
  waitingForAccess: boolean;
  durationMs?: number;
  // dev のプレビュー: 反映の確かめも URL の書き換えもせず、時間がたったら最初から流し直す。
  preview?: boolean;
}) {
  const [phase, setPhase] = useState<"loading" | "waiting" | "done">("loading");
  const unlockedRef = useRef(!waitingForAccess);
  const { face, typeName, heroColor, buttonColor, buttonShadow } = self;
  const slides = useMemo(
    () => buildSlides({ face, typeName, heroColor, buttonColor, buttonShadow }),
    [face, typeName, heroColor, buttonColor, buttonShadow],
  );

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
        steps={STEPS}
        totalMs={durationMs}
        slides={slides}
        slidesLabel="完全版を購入した方へ"
      />
    </div>
  );
}
