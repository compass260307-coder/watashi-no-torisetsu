"use client";

// Phase 3-β リリース 3 C-3: 統合素材選択 UI (LIFF 上で開く想定)
//
// フロー:
//   LIFF init → id_token → /api/zukan-mine GET
//   → デフォルト「全員チェック ON」で表示
//   → 折りたたみ「詳細」で個別チェック可能
//   → 「✨ 統合トリセツを生成」→ POST /api/integrated-trisetsu
//   → レスポンスの redirect_to で router.push

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { TorisetsuTypeId } from "@/lib/types";

type DiagnosisCard = {
  userId: string;
  ownerToken: string | null;
  typeId: TorisetsuTypeId;
  typeName: string;
  typeColor: string;
  fullCode: string;
  modifierLabel: string;
  diagnosedAt: string;
};

type PerceptionCard = {
  id: string;
  targetUserId: string;
  perceiverName: string;
  perceivedTypeId: TorisetsuTypeId;
  perceivedTypeName: string;
  perceivedFullCode: string;
  perceivedModifierLabel: string;
  perceivedModifierParagraph: string;
  qualitativeData: Record<string, string> | null;
  createdAt: string;
};

type ZukanMineResponse = {
  ok: true;
  ownerName: string | null;
  current: DiagnosisCard | null;
  past: DiagnosisCard[];
  perceptions: PerceptionCard[];
};

type Status =
  | "loading"
  | "needs-liff"
  | "missing-liff"
  | "needs-self-diagnosis"
  | "ready"
  | "generating"
  | "error";

export default function IntegratedNewPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [data, setData] = useState<ZukanMineResponse | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);

  // 選択状態
  const [includeSelf, setIncludeSelf] = useState(true);
  const [selectedPerceptionIds, setSelectedPerceptionIds] = useState<
    Set<string>
  >(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  // ローディング演出の段階表示
  const [generatingPhase, setGeneratingPhase] = useState<0 | 1>(0);

  const initialized = useRef(false);

  // LIFF init + データ取得 (初回マウント時のみ; SSR 後のハイドレーション正規パターン)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TORISETSU_REDIRECT;
    if (!liffId) {
      setStatus("missing-liff");
      return;
    }

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const token = liff.getIDToken();
        if (!token) {
          setStatus("error");
          setErrorMessage("LIFF id_token not available");
          return;
        }
        setIdToken(token);

        const res = await fetch("/api/zukan-mine", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          setStatus("needs-liff");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(`HTTP ${res.status}`);
          return;
        }
        const json = (await res.json()) as ZukanMineResponse;
        if (!json.current) {
          setStatus("needs-self-diagnosis");
          return;
        }
        setData(json);
        // デフォルト: 全 perceptions チェック ON
        setSelectedPerceptionIds(new Set(json.perceptions.map((p) => p.id)));
        setStatus("ready");
      } catch (err) {
        console.error("[integrated/new] init error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const togglePerception = (id: string) => {
    setSelectedPerceptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCount = useMemo(() => {
    return selectedPerceptionIds.size + (includeSelf ? 1 : 0);
  }, [selectedPerceptionIds, includeSelf]);

  const canGenerate = selectedCount > 0 && status === "ready";

  const handleGenerate = async () => {
    if (!canGenerate || !idToken) return;
    setStatus("generating");
    setGeneratingPhase(0);
    setErrorMessage("");

    // 2 秒後に段階 2 のメッセージに切替 (UX 演出)
    const phaseTimer = setTimeout(() => setGeneratingPhase(1), 2000);

    try {
      const res = await fetch("/api/integrated-trisetsu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          perception_ids: Array.from(selectedPerceptionIds),
          include_self: includeSelf,
        }),
      });
      const json = await res.json().catch(() => null);
      clearTimeout(phaseTimer);

      if (!res.ok || !json?.ok) {
        setStatus("error");
        if (res.status === 403) {
          setErrorMessage("他人の評価は統合素材に使えません");
        } else if (res.status === 400) {
          setErrorMessage(json?.error ?? "入力が正しくありません");
        } else if (res.status === 500 && json?.error === "API key not configured") {
          setErrorMessage(
            "AI 機能が一時的に利用できません (運営側の設定問題)。少し時間をおいてお試しください。",
          );
        } else {
          setErrorMessage(
            json?.detail ?? json?.error ?? `HTTP ${res.status}`,
          );
        }
        return;
      }

      // 成功 → 表示ページへ
      router.push(json.redirect_to ?? `/integrated/${json.integrated_trisetsu_id}`);
    } catch (err) {
      clearTimeout(phaseTimer);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  // ===== render branches =====
  if (status === "loading") {
    return <CenteredMessage>読み込み中...</CenteredMessage>;
  }
  if (status === "missing-liff") {
    return (
      <CenteredMessage>
        LIFF 設定が見つかりません
        <br />
        管理者にお問い合わせください
      </CenteredMessage>
    );
  }
  if (status === "needs-liff") {
    return (
      <CenteredMessage>
        LINE 内で開いてください
        <br />
        <span className="text-xs text-muted">(LIFF 経由でのみ利用できます)</span>
      </CenteredMessage>
    );
  }
  if (status === "needs-self-diagnosis") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
        <Image
          src="/mascot/step1-receive.png"
          alt=""
          width={160}
          height={160}
          className="w-32 h-32 object-contain mb-4"
        />
        <p className="text-base font-bold mb-2">
          まずは自己診断を完了してください
        </p>
        <Link
          href="/diagnosis"
          className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-md mt-4"
        >
          自己診断を始める →
        </Link>
      </div>
    );
  }
  if (status === "generating") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
        <Image
          src="/mascot/analyzing-penguin.png"
          alt=""
          width={160}
          height={160}
          className="w-32 h-32 object-contain animate-bounce-slow mb-6"
        />
        <p className="text-lg font-extrabold text-center mb-2">
          ✨ AI が統合トリセツを生成中...
        </p>
        <p className="text-sm text-muted text-center transition-opacity duration-500">
          {generatingPhase === 0
            ? "複数の眼から、あなたの輪郭が見えてきます"
            : "あなたの本当の姿が、見えてきました 🐧"}
        </p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
        <p className="text-base font-bold text-foreground mb-3">
          🙏 申し訳ありません
        </p>
        <p className="text-sm text-muted text-center mb-6 leading-relaxed max-w-sm">
          {errorMessage || "問題が発生しました"}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              setStatus("ready");
              setErrorMessage("");
            }}
            className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white shadow-md"
          >
            戻る
          </button>
          <Link
            href="/zukan-mine"
            className="text-xs text-muted underline text-center"
          >
            マイ図鑑に戻る
          </Link>
        </div>
      </div>
    );
  }

  // ===== ready =====
  if (!data) return null;
  const { current, perceptions } = data;

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-8 max-w-lg mx-auto w-full pb-12">
        {/* ヘッダー */}
        <div className="text-center mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            INTEGRATED TRISETSU
          </p>
          <h1 className="text-2xl font-extrabold leading-tight">
            🟣 統合トリセツを作る
          </h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            自己評価 + 友達評価 {perceptions.length} 人分を
            <br />
            AI が統合して「真のトリセツ」を生成します
          </p>
        </div>

        {/* メインボタン */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`w-full rounded-2xl px-6 py-6 text-base font-extrabold text-center transition-all shadow-md mb-3 ${
            canGenerate
              ? "bg-primary-gradient text-white hover:scale-[1.02] active:scale-[0.98]"
              : "bg-card-border text-muted cursor-not-allowed"
          }`}
        >
          ✨ 統合トリセツを生成
          <br />
          <span className="text-xs font-normal mt-1 inline-block opacity-90">
            ({selectedCount} 素材から統合)
          </span>
        </button>

        {/* 折りたたみトグル */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          className="text-xs text-muted hover:text-foreground transition-colors py-3 self-center"
        >
          {isExpanded ? "▲ 統合する素材を選ぶ" : "▼ 統合する素材を選ぶ（詳細）"}
        </button>

        {/* 詳細セクション */}
        {isExpanded && (
          <section className="mt-2 animate-fade-in-up">
            {/* 自己評価 */}
            <div className="rounded-2xl border border-card-border bg-card-bg p-4 mb-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSelf}
                  onChange={(e) => setIncludeSelf(e.target.checked)}
                  className="w-5 h-5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold mb-0.5">
                    🟢 自分の自己評価
                  </p>
                  {current && (
                    <p
                      className="text-xs text-muted truncate"
                      style={{ color: current.typeColor }}
                    >
                      {current.fullCode} ({current.typeName}・{current.modifierLabel})
                    </p>
                  )}
                </div>
              </label>
            </div>

            {/* perceptions */}
            {perceptions.length > 0 ? (
              <>
                <p className="text-[10px] font-bold tracking-wider text-muted px-2 mt-4 mb-2">
                  ── 友達からの評価 ({perceptions.length}) ──
                </p>
                {perceptions.map((p) => {
                  const checked = selectedPerceptionIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-card-border bg-card-bg p-4 mb-2"
                    >
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerception(p.id)}
                          className="w-5 h-5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold mb-0.5">
                            🟡 {p.perceiverName}さんから見た私
                          </p>
                          <p className="text-xs text-muted truncate">
                            {p.perceivedFullCode} ({p.perceivedTypeName})
                          </p>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-card-border bg-card-bg p-5 mt-4 text-center">
                <p className="text-xs text-muted mb-3">
                  まだ友達からの評価がありません
                </p>
                <Link
                  href="/share"
                  className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white"
                >
                  💌 友達を招待する
                </Link>
              </div>
            )}

            {/* 統合する素材の確認 */}
            <div className="mt-5 px-2 text-xs text-muted text-center">
              ── 統合する素材 ──
              <br />
              <span className="text-sm font-bold text-foreground">
                {selectedCount} 件
              </span>{" "}
              から統合します
            </div>
          </section>
        )}

        <Link
          href="/zukan-mine"
          className="text-xs text-muted/70 underline hover:text-foreground text-center mt-8"
        >
          マイ図鑑に戻る
        </Link>
      </main>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10 text-center">
      <p className="text-sm text-foreground leading-relaxed">{children}</p>
    </div>
  );
}
