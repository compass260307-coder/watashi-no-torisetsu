"use client";

// 自己診断の解析待ち画面を載せる層 (src/lib/analyzing-veil.ts)。ルートレイアウトに1つだけ置く。
// ページ移動をまたいで残り、移動先 (結果ページ) が出てから、結果発表の演出 (ResultRevealStage) へつなぐ。
// 演出を出せないとき (結果ページの絵が間に合わない、動きを減らす設定など) は、ふわっと消える。
import { isMotionReduced } from "@/lib/a11y-style";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ResultRevealTarget } from "@/components/result/ResultRevealStage";
import {
  getAnalyzingVeil,
  getServerAnalyzingVeil,
  hideAnalyzingVeil,
  releaseAnalyzingVeil,
  subscribeAnalyzingVeil,
} from "@/lib/analyzing-veil";

// 移動先のページが描かれるのを待つ時間 (移動が確定してから消し始めるまで)。
const SETTLE_MS = 150;
// 層を出したままページ移動が起きなかったときに、出しっぱなしを防ぐ上限。
// 解析待ちは最低20秒 + 保存の応答待ちなので、それより十分長くする。
const STUCK_LIMIT_MS = 90000;
// 結果ページの名前と絵が描かれるのを待つ上限。超えたら演出なしで消す。
const REVEAL_WAIT_LIMIT_MS = 2500;
// 書体の読み込みを待つ上限 (名前の位置を測るため)。
const FONT_WAIT_MS = 700;

// 発表の演出は、解析待ち画面が出てから読み込む (診断を終えた人だけが受け取る。ほかのページの
// 読み込みを重くしない)。解析待ちは20秒あるので、結果ページへ移るまでに読み終わる。
type RevealModule = typeof import("@/components/result/ResultRevealStage");
let revealModule: RevealModule | null = null;
let revealLoading: Promise<void> | null = null;
function loadReveal() {
  revealLoading ??= import("@/components/result/ResultRevealStage")
    .then((mod) => {
      revealModule = mod;
    })
    .catch(() => {
      revealLoading = null; // 読めなかったら、演出なしで消えるだけ
    });
}

function canReveal(pathname: string) {
  if (!/^\/me\//.test(pathname)) return false;
  if (typeof Element === "undefined" || !("animate" in Element.prototype)) return false;
  return !isMotionReduced();
}

export function AnalyzingVeilHost() {
  const veil = useSyncExternalStore(
    subscribeAnalyzingVeil,
    getAnalyzingVeil,
    getServerAnalyzingVeil,
  );
  const pathname = usePathname();
  const shown = veil.node !== null;
  const [reveal, setReveal] = useState<{
    target: ResultRevealTarget;
    Stage: RevealModule["ResultRevealStage"];
  } | null>(null);

  useEffect(() => {
    if (shown) loadReveal();
  }, [shown]);

  // 層を出した時点のページを覚えておき、別のページへ移ったら消し始める。
  const shownAtPath = useRef<string | null>(null);
  useEffect(() => {
    if (!shown) {
      shownAtPath.current = null;
      return;
    }
    if (shownAtPath.current === null) {
      shownAtPath.current = pathname;
      return;
    }
    if (shownAtPath.current === pathname) return;
    if (!canReveal(pathname)) {
      const timeout = setTimeout(releaseAnalyzingVeil, SETTLE_MS);
      return () => clearTimeout(timeout);
    }
    // 結果ページの名前と絵が描けたら、発表の演出を始める。
    const startedAt = performance.now();
    let timeout: ReturnType<typeof setTimeout>;
    const tick = () => {
      const waited = performance.now() - startedAt;
      const fontsReady = document.fonts?.status !== "loading" || waited > FONT_WAIT_MS;
      const mod = revealModule;
      const target = fontsReady && mod ? mod.readResultRevealTarget() : null;
      if (target && mod) {
        setReveal({ target, Stage: mod.ResultRevealStage });
      } else if (waited > REVEAL_WAIT_LIMIT_MS) {
        releaseAnalyzingVeil();
      } else {
        timeout = setTimeout(tick, 60);
      }
    };
    timeout = setTimeout(tick, SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [shown, pathname]);

  useEffect(() => {
    if (!shown) return;
    const timeout = setTimeout(hideAnalyzingVeil, STUCK_LIMIT_MS);
    return () => clearTimeout(timeout);
  }, [shown]);

  if (!shown && !reveal) return null;
  return (
    <>
      {shown && (
        <div
          className={`fixed inset-0 z-[70] flex flex-col overflow-y-auto overscroll-contain bg-[#FCFCFC] ${
            veil.leaving ? "friend-welcome-leave pointer-events-none" : ""
          }`}
        >
          {veil.node}
        </div>
      )}
      {reveal && (
        <reveal.Stage
          target={reveal.target}
          onCovered={hideAnalyzingVeil}
          onDone={() => setReveal(null)}
        />
      )}
    </>
  );
}
