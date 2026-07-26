"use client";

// 下部ナビ「運命」+「友達診断」赤バッジのローカル確認用プレビュー
// (tako-attention-preview と同じ流儀)。本番仕様は課金済み /me 表示で両方
// 同時に付与されるため (2026-07-27 指示)、ここでも両方付与して見え方を再現する。
// 開くと localStorage にバッジ pending を付与して1回リロードし、実物の BottomNav
// ロジックでバッジを描画させる (モックではなく本物の表示・解除経路を通す)。
// 各タブをタップするとそれぞれのバッジが消え、このページに戻ると再付与される。

import { useEffect } from "react";
import { notFound } from "next/navigation";
import {
  UNMEI_ATTENTION_PENDING_KEY,
  unmeiAttentionImpressionKey,
} from "@/lib/unmei-attention";
import {
  TAKO_ATTENTION_PENDING_KEY,
  takoAttentionImpressionKey,
} from "@/lib/tako-attention";

export default function UnmeiAttentionPreviewPage() {
  // UI確認専用。本番デプロイではページ自体を公開しない。
  if (process.env.NODE_ENV !== "development") notFound();

  useEffect(() => {
    try {
      const token =
        localStorage.getItem("torisetsu_owner_token") ?? "unmei-badge-preview";
      // BottomNav の effect との実行順に依存しないよう、未付与→付与のときだけ
      // 1回リロードして確実にバッジを描画させる (付与済みならそのまま)。
      const alreadyPending =
        localStorage.getItem(UNMEI_ATTENTION_PENDING_KEY) === token &&
        localStorage.getItem(TAKO_ATTENTION_PENDING_KEY) === token;
      localStorage.setItem("torisetsu_owner_token", token);
      localStorage.setItem(UNMEI_ATTENTION_PENDING_KEY, token);
      localStorage.removeItem(unmeiAttentionImpressionKey(token));
      localStorage.setItem(TAKO_ATTENTION_PENDING_KEY, token);
      localStorage.removeItem(takoAttentionImpressionKey(token));
      if (!alreadyPending) location.reload();
    } catch {
      // localStorage 不可環境では何もしない
    }
  }, []);

  return (
    <main className="flex min-h-[calc(100dvh-56px)] items-center justify-center bg-[#F6F7FB] px-6 py-16 text-center">
      <div className="w-full max-w-[420px] rounded-3xl border border-[#E3E6F5] bg-white px-6 py-8 shadow-sm">
        <p className="text-[11px] font-black tracking-[0.14em] text-[#5B5BEF]">
          LOCAL PREVIEW
        </p>
        <h1 className="mt-2 text-[22px] font-black text-[#2A3A5C]">
          運命+友達診断の赤バッジ表示
        </h1>
        <p className="mt-4 text-[13px] font-bold leading-[1.8] text-[#7A8498]">
          下の「運命」「友達診断」アイコン右上にある
          <br />
          赤色の「！」を確認してください。
          <br />
          (課金完了後は両方同時にこの状態になります)
        </p>
        <p className="mt-5 rounded-2xl bg-[#F1F1FF] px-4 py-3 text-[12px] font-bold leading-[1.7] text-[#45457A]">
          各タブを押すとそのページに進み「！」が消えます。
          <br />
          このページに戻ると、確認用に再付与されます。
        </p>
      </div>
    </main>
  );
}
