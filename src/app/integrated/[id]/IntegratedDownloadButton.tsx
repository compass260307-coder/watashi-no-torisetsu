"use client";

// プレミアム化 v2 Week 2 T2-3: 統合トリセツ PDF 表示ボタン
//
// LIFF 内で id_token を取得 → /api/integrated-trisetsu/[id]/pdf を叩く →
// Blob を window.open で新規タブに PDF プレビュー表示。
//
// iOS WKWebView (LINE 内ブラウザ) は <a download> 属性を無視するため、
// ダウンロードではなくプレビュー表示にして、ユーザーが共有メニューから
// 「ファイルに保存」する導線にしている。
//
// 非 LIFF 環境 (普通のブラウザ) や認可エラー時は alert で案内。

import { useState } from "react";

interface Props {
  integratedId: string;
}

type Phase = "idle" | "preparing" | "downloading" | "done" | "error";

export function IntegratedDownloadButton({ integratedId }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = async () => {
    if (phase === "preparing" || phase === "downloading") return;
    setPhase("preparing");
    setErrorMsg(null);

    // Web ファースト: Cookie wn_session で認可。Bearer 不要。
    setPhase("downloading");
    let response: Response;
    try {
      response = await fetch(
        `/api/integrated-trisetsu/${encodeURIComponent(integratedId)}/pdf`,
        {
          method: "GET",
          credentials: "include",
        },
      );
    } catch (err) {
      setPhase("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`ネットワークエラー: ${msg}`);
      alert(`ネットワークエラーで PDF を取得できませんでした。\n${msg}`);
      return;
    }

    // ステータス別ハンドリング
    if (response.status === 401) {
      setPhase("error");
      setErrorMsg("セッションが切れています。診断ページからやり直してください。");
      alert("セッションが切れています。診断ページからやり直してください。");
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

    // 4. Blob を受け取り、新規タブで PDF プレビューを開く
    //    WKWebView (LIFF) は <a download> を無視するためダウンロードではなくプレビュー表示。
    //    端末保存はユーザーが共有メニュー → 「ファイルに保存」で行う。
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const opened = window.open(blobUrl, "_blank");
    if (!opened) {
      // ポップアップブロック等で新規タブを開けない環境では現在のタブで遷移
      window.location.href = blobUrl;
    }
    // プレビュー表示中に revoke するとタブが空白になる。
    // 共有メニュー操作の時間も考慮して長めに遅延 (2 分)。
    setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);

    setPhase("done");
    // 数秒後に idle に戻して再度開けるように
    setTimeout(() => setPhase("idle"), 3000);
  };

  const label = (() => {
    switch (phase) {
      case "preparing":
        return "準備中...";
      case "downloading":
        return "PDF を取得中...";
      case "done":
        return "新規タブで開きました";
      case "error":
        return "もう一度試す";
      default:
        return "PDF を表示";
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
      <p className="text-xs text-muted text-center mt-2 leading-relaxed">
        新しいタブで PDF が開きます。端末に保存するには、共有メニューから「ファイルに保存」を選択してください。
      </p>
      {phase === "error" && errorMsg && (
        <p className="text-xs text-muted text-center mt-2 whitespace-pre-line">
          {errorMsg}
        </p>
      )}
    </>
  );
}
