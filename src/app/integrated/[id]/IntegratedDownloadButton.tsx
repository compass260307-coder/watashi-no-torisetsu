"use client";

// プレミアム化 v2 Week 2 T2-3: 統合トリセツ PDF ダウンロードボタン
//
// LIFF 内で id_token を取得 → /api/integrated-trisetsu/[id]/pdf を叩く →
// Blob を受け取って <a download> でブラウザにダウンロードさせる。
//
// 非 LIFF 環境 (普通のブラウザ) や認可エラー時は alert で案内。

import { useState } from "react";

interface Props {
  integratedId: string;
}

type Phase = "idle" | "preparing" | "downloading" | "done" | "error";

// RFC 5987 (filename*=UTF-8''<percent-encoded>) を優先、なければ filename= を採用
function parseFilenameFromDisposition(
  header: string | null,
): string | null {
  if (!header) return null;
  // filename*=UTF-8''xxx (拡張形式) を最優先
  const star = /filename\*=([^']+)''([^;]+)/i.exec(header);
  if (star) {
    const enc = star[1].toLowerCase();
    const raw = star[2].trim().replace(/^"|"$/g, "");
    try {
      // utf-8 / UTF-8 のみ実用上想定
      if (enc === "utf-8" || enc === "utf8") {
        return decodeURIComponent(raw);
      }
    } catch {
      // fall through to legacy filename
    }
  }
  // filename="xxx" (レガシー、ASCII fallback)
  const legacy = /filename=("[^"]+"|[^;]+)/i.exec(header);
  if (legacy) {
    return legacy[1].trim().replace(/^"|"$/g, "");
  }
  return null;
}

export function IntegratedDownloadButton({ integratedId }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    if (phase === "preparing" || phase === "downloading") return;
    setPhase("preparing");
    setErrorMsg(null);

    // 1. LIFF 初期化 + id_token 取得
    let idToken: string | null = null;
    try {
      const liff = (await import("@line/liff")).default;
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
      if (liffId) {
        try {
          await liff.init({ liffId });
        } catch {
          // already initialized 等は無視
        }
      }
      if (typeof liff.getIDToken === "function") {
        idToken = liff.getIDToken() ?? null;
      }
    } catch {
      // import 失敗 = LIFF 未対応環境
    }

    if (!idToken) {
      setPhase("error");
      setErrorMsg(
        "PDF ダウンロードには LINE アプリ内で開いてください。\nLINE トーク画面のメニューからアクセスしてください。",
      );
      alert(
        "PDF ダウンロードには LINE アプリ内で開いてください。\nLINE トーク画面のメニューからアクセスしてください。",
      );
      return;
    }

    // 2. API 呼び出し
    setPhase("downloading");
    let response: Response;
    try {
      response = await fetch(
        `/api/integrated-trisetsu/${encodeURIComponent(integratedId)}/pdf`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${idToken}` },
        },
      );
    } catch (err) {
      setPhase("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`ネットワークエラー: ${msg}`);
      alert(`ネットワークエラーで PDF を取得できませんでした。\n${msg}`);
      return;
    }

    // 3. ステータス別ハンドリング
    if (response.status === 401) {
      setPhase("error");
      setErrorMsg("認可に失敗しました。LINE で再ログインしてください。");
      alert("認可に失敗しました。LINE で再ログインしてからお試しください。");
      return;
    }
    if (response.status === 403) {
      setPhase("error");
      setErrorMsg("このトリセツの所有者のみダウンロードできます。");
      alert("このトリセツの所有者のみダウンロードできます。");
      return;
    }
    if (response.status === 404) {
      setPhase("error");
      setErrorMsg("このトリセツはダウンロード可能な状態ではありません。");
      alert("このトリセツはダウンロード可能な状態ではありません。");
      return;
    }
    if (!response.ok) {
      setPhase("error");
      let detail = `${response.status} ${response.statusText}`;
      try {
        const j = (await response.json()) as { error?: string; detail?: string };
        if (j.error) detail = `${j.error}${j.detail ? `: ${j.detail}` : ""}`;
      } catch {
        // body は読めなくても無視
      }
      setErrorMsg(`ダウンロードに失敗しました: ${detail}`);
      alert(`ダウンロードに失敗しました。${detail}`);
      return;
    }

    // 4. Blob を受け取って <a download> でダウンロード起動
    const blob = await response.blob();
    const filename =
      parseFilenameFromDisposition(response.headers.get("Content-Disposition")) ??
      `trisetsu_${integratedId.slice(0, 8)}.pdf`;
    const blobUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // ObjectURL を即解放するとブラウザによっては DL が中断されるので遅延
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);

    setPhase("done");
    // 数秒後に idle に戻して再度ダウンロード可能に
    setTimeout(() => setPhase("idle"), 3000);
  };

  const label = (() => {
    switch (phase) {
      case "preparing":
        return "準備中...";
      case "downloading":
        return "PDF を取得中...";
      case "done":
        return "ダウンロード開始";
      case "error":
        return "もう一度試す";
      default:
        return "PDF をダウンロード";
    }
  })();

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        disabled={phase === "preparing" || phase === "downloading"}
        className="w-full rounded-full bg-primary-gradient text-white text-center px-6 py-4 text-base font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
      >
        {label}
      </button>
      {phase === "error" && errorMsg && (
        <p className="text-xs text-muted text-center mt-2 whitespace-pre-line">
          {errorMsg}
        </p>
      )}
    </>
  );
}
