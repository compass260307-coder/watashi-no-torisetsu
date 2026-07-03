"use client";

// 職業判明の「変身」演出 (動物 → 演出 → 職業動物)。
// /me 結果ページのヒーロー名 (CharacterHero の h1) で、職業が判明している場合のみ使用。
//
// タイミング: 判明後に初めて結果ページを見たときだけ 1 回再生 (localStorage フラグ)。
//   再生後は通常の「{職業}{動物}」表示で固定。forcePlay (デモ) は毎回再生しフラグを書かない。
// reduced-motion: 省略し、最初から静的に「{職業}{動物}」。
// a11y: スクリーンリーダーには常に確定名 (sr-only) を提示し、演出ビジュアルは aria-hidden。

import { useEffect, useState } from "react";

interface JobRevealNameProps {
  animal: string; // 例: イルカ
  jobName: string; // 例: 記者
  revealKey: string; // localStorage キー (ユーザーごと)。再生済み判定に使用。
  forcePlay?: boolean; // デモ用: フラグを無視して毎回再生 (フラグも書かない)
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type Phase = "done" | "intro" | "reveal";

export function JobRevealName({
  animal,
  jobName,
  revealKey,
  forcePlay = false,
}: JobRevealNameProps) {
  // 既定は "done" (確定名で固定)。SSR / reduced-motion / 再生済みはこのまま静的表示。
  const [phase, setPhase] = useState<Phase>("done");

  useEffect(() => {
    if (prefersReducedMotion()) return; // アニメ省略 → done のまま

    if (!forcePlay) {
      let already = false;
      try {
        already = localStorage.getItem(revealKey) === "1";
      } catch {
        // localStorage 不可 → 1 回だけ再生する方向で続行
      }
      if (already) return; // 再生済み → 静的
    }

    // 初回 (or デモ): 動物のみ → 演出 → 確定名、のシーケンス。
    // マウント後にクライアント専用情報 (localStorage / reduced-motion) で再生判断する
    // 正当なパターン (SSR は静的 done)。意図的な 1 回の再レンダーなので rule を抑制。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("intro");
    const toReveal = window.setTimeout(() => setPhase("reveal"), 850);
    const toDone = window.setTimeout(() => {
      setPhase("done");
      if (!forcePlay) {
        try {
          localStorage.setItem(revealKey, "1");
        } catch {
          // 無視 (次回また再生されるだけで害はない)
        }
      }
    }, 850 + 750);

    return () => {
      window.clearTimeout(toReveal);
      window.clearTimeout(toDone);
    };
  }, [revealKey, forcePlay]);

  // スクリーンリーダー用の確定名 (常に提示)。視覚の演出は下で aria-hidden。
  const srName = `${jobName}${animal}`;

  if (phase === "intro") {
    // まず動物だけを見せる (ワクワクの「ため」)。✨ が控えめに脈打つ。
    return (
      <span className="relative inline-flex items-center justify-center">
        <span className="sr-only">{srName}</span>
        <span aria-hidden="true" className="animate-job-intro-pulse">
          {animal}
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-5 -top-2 text-xl select-none"
        >
          ✨
        </span>
      </span>
    );
  }

  if (phase === "reveal") {
    // 光が走り、職業付きの名前がポップして着地。
    return (
      <span className="relative inline-flex items-center justify-center">
        <span className="sr-only">{srName}</span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -m-4 animate-job-flash rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)",
          }}
        />
        <span
          aria-hidden="true"
          className="animate-job-name-pop inline-flex items-baseline"
        >
          <span className="text-[var(--primary)]">{jobName}</span>
          {animal}
        </span>
        <span
          aria-hidden="true"
          className="absolute -right-6 -top-3 text-2xl select-none animate-job-sparkle"
        >
          ✨
        </span>
        <span
          aria-hidden="true"
          className="absolute -left-5 -bottom-2 text-lg select-none animate-job-sparkle"
          style={{ animationDelay: "0.12s" }}
        >
          ✨
        </span>
      </span>
    );
  }

  // done: 通常表示 (確定名で固定)。
  return <span>{srName}</span>;
}
