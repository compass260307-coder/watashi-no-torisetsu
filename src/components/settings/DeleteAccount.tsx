"use client";

// Phase 3-β D-11: データ削除・退会タブ
//
// 削除対象の件数取得: /api/zukan-mine (既存) から派生
// 削除実行: POST /api/account/delete (A-4 完成済) → 成功で完了画面
// 確認: 2 段階 (説明 → 確認テキスト「削除します」入力 → 完全に削除する)

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Counts = {
  diagnosesTotal: number;
  perceptionsTotal: number;
  integratedTotal: number;
};

type Stage = "init" | "confirm" | "deleting" | "done" | "error";

interface Props {
  idToken: string;
}

export function DeleteAccount({ idToken }: Props) {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [stage, setStage] = useState<Stage>("init");
  const [confirmText, setConfirmText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const res = await fetch("/api/zukan-mine", {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (!res.ok) {
          // 件数取得失敗でも削除自体は実行可能なので、ゼロ件で続行
          setCounts({
            diagnosesTotal: 0,
            perceptionsTotal: 0,
            integratedTotal: 0,
          });
          return;
        }
        const data = await res.json();
        const pastCount = Array.isArray(data.past) ? data.past.length : 0;
        const currentCount = data.current ? 1 : 0;
        setCounts({
          diagnosesTotal: pastCount + currentCount,
          perceptionsTotal: Array.isArray(data.perceptions)
            ? data.perceptions.length
            : 0,
          integratedTotal:
            typeof data.integratedTotalCount === "number"
              ? data.integratedTotalCount
              : Array.isArray(data.integrated)
                ? data.integrated.length
                : 0,
        });
      } catch {
        setCounts({
          diagnosesTotal: 0,
          perceptionsTotal: 0,
          integratedTotal: 0,
        });
      }
    })();
  }, [idToken]);

  const handleDelete = async () => {
    if (confirmText.trim() !== "削除します") return;
    setStage("deleting");
    setErrorMessage("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setStage("error");
        setErrorMessage(
          data?.message ?? data?.error ?? `削除に失敗しました (${res.status})`,
        );
        return;
      }
      setStage("done");
    } catch (err) {
      setStage("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (stage === "done") {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-3">🐧</p>
        <p className="text-base font-bold mb-3">削除が完了しました</p>
        <p className="text-sm text-muted leading-relaxed mb-6">
          ご利用ありがとうございました。
          <br />
          LINE bot もブロック / 削除すると完全に退会できます。
        </p>
        <Link
          href="/"
          className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md"
        >
          トップに戻る
        </Link>
      </div>
    );
  }

  if (stage === "deleting") {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-muted">削除中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground leading-relaxed">
        退会するとすべてのデータが消えます。
      </p>

      <div className="rounded-2xl border border-card-border bg-card-bg p-4 my-2">
        <p className="text-xs font-bold text-muted mb-2">削除されるデータ:</p>
        <ul className="text-sm text-foreground space-y-1">
          <li>・自己診断の結果 ({counts?.diagnosesTotal ?? "?"} 件)</li>
          <li>・友達からの評価 ({counts?.perceptionsTotal ?? "?"} 件)</li>
          <li>・統合トリセツ ({counts?.integratedTotal ?? "?"} 件)</li>
          <li>・通知設定</li>
        </ul>
      </div>

      <p className="text-xs text-muted leading-relaxed">
        復元はできません。LINE bot をブロック / 削除しても
        <br />
        DB データは残るため、完全削除はこちらから実行してください。
      </p>

      {stage === "init" && (
        <button
          type="button"
          onClick={() => setStage("confirm")}
          className="w-full rounded-full border-2 border-red-400 text-red-500 px-6 py-3 text-sm font-bold mt-4 transition-all active:scale-[0.98]"
        >
          ⚠️ 削除を進める
        </button>
      )}

      {stage === "confirm" && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/30 p-5 mt-4">
          <p className="text-sm font-bold text-foreground mb-3">
            本当に削除しますか?
          </p>
          <p className="text-xs text-muted leading-relaxed mb-4">
            この操作は取り消せません。
            <br />
            確認のため、下に「削除します」と入力してください。
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="削除します"
            className="w-full rounded-xl border border-card-border bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 mb-4"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText.trim() !== "削除します"}
              className={`w-full rounded-full px-6 py-3 text-sm font-bold transition-all ${
                confirmText.trim() === "削除します"
                  ? "bg-red-500 text-white active:scale-[0.98]"
                  : "bg-card-border text-muted cursor-not-allowed"
              }`}
            >
              ⚠️ 完全に削除する
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("init");
                setConfirmText("");
              }}
              className="text-xs text-muted underline"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="rounded-2xl border border-red-300 bg-red-50/40 p-4 mt-4 text-center">
          <p className="text-sm font-bold text-red-600 mb-2">
            削除に失敗しました
          </p>
          <p className="text-xs text-muted mb-3">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setStage("init")}
            className="text-xs text-muted underline"
          >
            最初からやり直す
          </button>
        </div>
      )}
    </div>
  );
}
