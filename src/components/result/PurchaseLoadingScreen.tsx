"use client";

// 完全版 (日本語 Web) を買った直後の「完全版の準備画面」。出す条件は MeResultPage.tsx (日本語の本人の full_access 購入なら全員)。
//
// - 自己診断の解析待ち画面 (DiagnosisAnalyzingLoader) を金色の豪華版 (theme="premium") で使い、
//   20秒 (1枚5秒) のあいだ、「結果をアップグレードできる」(1枚) とそのやり方 (3枚) を流す。
// - 権利がもう反映済みでも、20秒は必ず見せる。
// - 戻った時点でまだ反映されていない (webhook 待ち) ときは、裏で反映を確かめる。反映されたら、準備画面は
//   出したまま、うしろの結果ページだけを解放後の中身に描き直す (router.refresh。読み込み直さない)。
//   20秒たっても反映されていなければ、今までの「決済処理中...」(PaidUnlockWatcher) に引き継ぐ。
// - 20秒が終わったら「解放の発表」(PurchaseUnlockedReveal、6秒ほど) を出し、そのまま、うしろの
//   自己診断結果ページへ移る (金色の舞台が晴れて結果ページが見える)。終わったら ?paid= を外す。
//   反映がまだのときは出さない (解放されていないのに「解放されたよ」と言わない)。
// - どのページから買っても、Stripe からはこの結果ページ (/me) に戻る (create-full-access-session)。
// - スライドはボタンを持たない。紹介だけにして、買ったもの (自己診断結果) を先に見せる。

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DiagnosisAnalyzingLoader } from "@/components/DiagnosisAnalyzingLoader";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import {
  PURCHASE_REVEAL_IMAGES,
  PurchaseUnlockedReveal,
} from "@/components/result/PurchaseUnlockedReveal";
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
  "お支払いを確認中",
  "7つの特典を準備中",
  "あなた専用の結果を作成中",
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
  // 完全版の権利がまだ反映されていないか (反映されると、描き直しで false に変わる)。
  waitingForAccess: boolean;
  durationMs?: number;
  // dev のプレビュー: 反映の確かめも URL の書き換えもせず、終わったら最初から流し直す。
  preview?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "reveal" | "waiting" | "done">("loading");
  // 解放の発表の夜空が準備画面を覆いきったか (覆ったら準備画面を外し、うしろを結果ページにする)。
  const [covered, setCovered] = useState(false);
  // うしろの結果ページが解放後の中身になっているか。時間の進行を巻き戻さないよう、ref で持つ。
  const waitingRef = useRef(waitingForAccess);
  useEffect(() => {
    waitingRef.current = waitingForAccess;
  }, [waitingForAccess]);
  const { face, typeName, heroColor, buttonColor, buttonShadow } = self;
  const slides = useMemo(
    () => buildSlides({ face, typeName, heroColor, buttonColor, buttonShadow }),
    [face, typeName, heroColor, buttonColor, buttonShadow],
  );

  // 準備画面と発表のあいだは、うしろの結果ページを動かさない。
  useEffect(() => {
    if (phase !== "loading" && phase !== "reveal") return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [phase]);

  // まだ反映されていなければ、裏で反映を確かめる。反映されたら、うしろの結果ページを描き直す。
  useEffect(() => {
    if (preview || !waitingForAccess || phase !== "loading") return;
    let pollDelay = INITIAL_POLL_INTERVAL_MS;
    return startVisiblePolling(async (signal) => {
      try {
        const data = await requestFullAccessStatus(ownerToken, { fresh: true });
        if (signal.aborted) return false;
        if (data && data.astrologer === true && data.unmei === true && data.tarot === true) {
          router.refresh();
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
  }, [ownerToken, phase, preview, router, waitingForAccess]);

  // 解放の発表で使う絵を、準備画面のあいだに読み込んでおく。
  useEffect(() => {
    for (const src of PURCHASE_REVEAL_IMAGES) {
      const img = new Image();
      img.src = src;
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // まだ反映されていない: 発表はせず、今までの「決済処理中...」に引き継ぐ。
      setPhase(!preview && waitingRef.current ? "waiting" : "reveal");
    }, durationMs);
    return () => clearTimeout(timeout);
  }, [durationMs, preview]);

  // 解放の発表が終わった (うしろの結果ページへ着地した)。
  const finishReveal = () => {
    if (preview) {
      window.location.reload();
      return;
    }
    // 読み込み直さずに ?paid= と session_id を外し、再読み込みで準備画面が出直さないようにする。
    const url = new URL(window.location.href);
    url.searchParams.delete("paid");
    url.searchParams.delete("session_id");
    window.history.replaceState(window.history.state, "", url.toString());
    setPhase("done");
  };

  if (phase === "done") return null;
  if (phase === "waiting") {
    return <PaidUnlockWatcher ownerToken={ownerToken} locale="ja" product="full_access" />;
  }
  return (
    <>
      {phase === "reveal" && (
        <PurchaseUnlockedReveal onCovered={() => setCovered(true)} onDone={finishReveal} />
      )}
      {covered ? null : (
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
      )}
    </>
  );
}
