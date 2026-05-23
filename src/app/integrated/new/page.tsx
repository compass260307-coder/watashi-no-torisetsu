"use client";

// プレミアム化 v3 Day 3: 統合素材選択 UI (Web ファースト版)
//
// フロー:
//   Cookie wn_session で認可 → /api/zukan-mine GET
//   → デフォルト: pdf_consent=true の perception のみチェック ON
//   → 折りたたみ「詳細」で個別選択可能 (未同意はグレーアウト)
//   → 「¥500 で統合トリセツを生成」→ POST /api/checkout/create-session
//   → 受信 url で window.location.href (Stripe Checkout hosted page へ遷移)
//   → 決済成功後は Stripe が /checkout/success?session_id=... に戻す
//   → /checkout/success の polling UI が AI 生成完了を待って /integrated/[id] に遷移

import { useEffect, useMemo, useRef, useState } from "react";
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
  // T3-3: PDF 利用同意フラグ。false の perception は AI 統合素材に使えない。
  pdfConsent: boolean;
  createdAt: string;
};

type ZukanMineResponse = {
  ok: true;
  ownerName: string | null;
  email: string | null;
  current: DiagnosisCard | null;
  past: DiagnosisCard[];
  perceptions: PerceptionCard[];
};

type Status =
  | "loading"
  | "needs-self-diagnosis"
  | "ready"
  | "redirecting" // Stripe Checkout への遷移中
  | "error";

export default function IntegratedNewPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [data, setData] = useState<ZukanMineResponse | null>(null);

  // 選択状態
  const [includeSelf, setIncludeSelf] = useState(true);
  const [selectedPerceptionIds, setSelectedPerceptionIds] = useState<
    Set<string>
  >(new Set());
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState<string>("");

  const initialized = useRef(false);

  // Web ファースト: Cookie wn_session で認可。/api/zukan-mine GET から状態取得。
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const res = await fetch("/api/zukan-mine", {
          credentials: "include",
        });
        if (res.status === 401) {
          setStatus("needs-self-diagnosis");
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
        // 既に登録済みの email があれば prefill (購入履歴があるユーザー等)
        if (json.email) setEmail(json.email);
        // T3-3: デフォルト ON は「PDF 利用同意済」だけに絞る。
        setSelectedPerceptionIds(
          new Set(json.perceptions.filter((p) => p.pdfConsent).map((p) => p.id)),
        );
        setStatus("ready");
      } catch (err) {
        console.error("[integrated/new] init error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  }, []);

  const togglePerception = (id: string) => {
    // T3-3: pdfConsent=false の perception は選択不可。UI 側でも防御。
    const target = data?.perceptions.find((p) => p.id === id);
    if (!target || !target.pdfConsent) return;
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

  // Day 7: email 入力必須 (Stripe customer_email + 完成通知メール送信のため)
  const trimmedEmail = email.trim();
  const isEmailValid =
    trimmedEmail.length > 0 &&
    trimmedEmail.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const canCheckout =
    selectedCount > 0 && status === "ready" && isEmailValid;

  // T3-2: 旧 handleGenerate (無料即時 AI 呼び出し) を Stripe Checkout 経路に置換。
  // create-session で URL を取得 → window.location.href で Stripe に遷移。
  // 戻ってきた後は /checkout/success の polling UI が AI 完了を待つ。
  const handleProceedToCheckout = async () => {
    if (!canCheckout) return;
    setStatus("redirecting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          perception_ids: Array.from(selectedPerceptionIds),
          include_self: includeSelf,
          email: trimmedEmail,
        }),
      });
      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.url) {
        setStatus("error");
        if (res.status === 403) {
          setErrorMessage(
            json?.error ??
              "選択した友達評価が統合素材に使えません",
          );
        } else if (res.status === 400) {
          setErrorMessage(json?.error ?? "入力が正しくありません");
        } else if (
          res.status === 500 &&
          (json?.error === "STRIPE_SECRET_KEY not configured" ||
            json?.error === "STRIPE_PRICE_ID not configured")
        ) {
          setErrorMessage(
            "決済機能が一時的に利用できません (運営側の設定問題)。少し時間をおいてお試しください。",
          );
        } else {
          setErrorMessage(
            json?.detail ?? json?.error ?? `HTTP ${res.status}`,
          );
        }
        return;
      }

      // Stripe Checkout に遷移
      window.location.href = json.url;
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  };

  // ===== render branches =====
  if (status === "loading") {
    return <CenteredMessage>読み込み中...</CenteredMessage>;
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
  if (status === "redirecting") {
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
          決済ページに移動しています...
        </p>
        <p className="text-sm text-muted text-center leading-relaxed whitespace-pre-line">
          Stripe の安全な決済画面が開きます。{"\n"}
          しばらくお待ちください。
        </p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 py-10">
        <p className="text-base font-bold text-foreground mb-3">
          申し訳ありません
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
          <h1 className="font-serif text-2xl font-bold leading-tight">
            統合トリセツを作る
          </h1>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            自己評価 + 友達評価 {perceptions.length} 人分を
            <br />
            AI が統合して「真のトリセツ」を生成します
          </p>
        </div>

        {/* T3-2: 価格・内容説明カード (購入前提示) */}
        <section className="rounded-2xl border border-card-border bg-card-bg p-5 mb-4 animate-fade-in-up">
          <div className="flex items-baseline justify-center gap-2 mb-3">
            <span className="text-3xl font-extrabold text-foreground tracking-tight">
              ¥500
            </span>
            <span className="text-xs text-muted">（買い切り、税込）</span>
          </div>
          <ul className="text-xs text-foreground leading-relaxed space-y-1.5 mb-3">
            <li>・7 章・5,000 字以上の本格レポート (PDF 約 12 ページ)</li>
            <li>・永続閲覧可能、PDF はお手元にダウンロード保存</li>
            <li>・友達評価が増えるたび再統合 (新たに ¥500 で都度購入)</li>
          </ul>
          <p className="text-[10px] text-muted leading-relaxed">
            決済はクレジットカード / PayPay / コンビニ / Apple Pay /
            Google Pay に対応 (Stripe 経由、安全決済)。
          </p>
        </section>

        {/* Day 7: メール入力 (Stripe Checkout + 完成通知の宛先) */}
        <section className="mb-4 animate-fade-in-up">
          <label
            htmlFor="purchase-email"
            className="block text-xs font-bold text-muted mb-2"
          >
            メールアドレス
            <span className="ml-2 text-[10px] font-normal text-muted/80">
              (決済確認 + 完成通知の送信先)
            </span>
          </label>
          <input
            id="purchase-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={254}
            className="w-full rounded-xl border border-card-border bg-card-bg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <p className="text-[11px] text-muted mt-1 leading-relaxed">
            完成したトリセツはこのアドレスに永続 URL を送ります。
            <br />
            別端末からも同じアドレスでログインできます。
          </p>
        </section>

        {/* メインボタン (T3-2: Stripe Checkout 遷移) */}
        <button
          type="button"
          onClick={handleProceedToCheckout}
          disabled={!canCheckout}
          className={`w-full rounded-2xl px-6 py-6 text-base font-extrabold text-center transition-all shadow-md mb-3 ${
            canCheckout
              ? "bg-primary-gradient text-white hover:scale-[1.02] active:scale-[0.98]"
              : "bg-card-border text-muted cursor-not-allowed"
          }`}
        >
          ¥500 で統合トリセツを生成
          <br />
          <span className="text-xs font-normal mt-1 inline-block opacity-90">
            ({selectedCount} 素材から統合)
          </span>
        </button>

        {/* 特商法表記 (Week 5 で本実装、現状は stub ページ) */}
        <p className="text-[10px] text-muted/80 text-center mb-3 leading-relaxed">
          ご購入前に{" "}
          <Link
            href="/legal/commerce"
            className="underline hover:text-foreground"
          >
            特定商取引法に基づく表記
          </Link>
          {" "}
          をご確認ください
        </p>

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
                    自分の自己評価
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
                {(() => {
                  // T3-3: PDF 利用同意済 ↓ そうでない順 でソート (使えるものを上に)
                  const sorted = [...perceptions].sort(
                    (a, b) => Number(b.pdfConsent) - Number(a.pdfConsent),
                  );
                  return sorted.map((p) => {
                    const checked = selectedPerceptionIds.has(p.id);
                    const disabled = !p.pdfConsent;
                    return (
                      <div
                        key={p.id}
                        className={
                          disabled
                            ? "rounded-2xl border border-card-border bg-card-bg/50 p-4 mb-2 opacity-60"
                            : "rounded-2xl border border-card-border bg-card-bg p-4 mb-2"
                        }
                      >
                        <label
                          className={
                            disabled
                              ? "flex items-center gap-3 cursor-not-allowed"
                              : "flex items-center gap-3 cursor-pointer"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => togglePerception(p.id)}
                            className="w-5 h-5 disabled:cursor-not-allowed"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold mb-0.5 flex items-center gap-2 flex-wrap">
                              <span>{p.perceiverName}さんから見た私</span>
                              {p.pdfConsent ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                  PDF 可
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/10 text-muted">
                                  Web のみ
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted truncate">
                              {p.perceivedFullCode} ({p.perceivedTypeName})
                            </p>
                            {disabled && (
                              <p className="text-[10px] text-muted mt-1 leading-tight">
                                ※ {p.perceiverName}さんが PDF 利用を許可していないため、
                                統合素材に使えません
                              </p>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  });
                })()}
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-card-border bg-card-bg p-5 mt-4 text-center">
                <p className="text-xs text-muted mb-3">
                  まだ友達からの評価がありません
                </p>
                <Link
                  href="/"
                  className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white"
                >
                  友達を招待する
                </Link>
              </div>
            )}

            {/* 統合する素材の確認 + PDF 可能数の内訳 */}
            <div className="mt-5 px-2 text-xs text-muted text-center">
              ── 統合する素材 ──
              <br />
              <span className="text-sm font-bold text-foreground">
                {selectedCount} 件
              </span>{" "}
              から統合します
              {perceptions.length > 0 && (() => {
                const consented = perceptions.filter((p) => p.pdfConsent).length;
                const blocked = perceptions.length - consented;
                if (blocked === 0) return null;
                return (
                  <p className="mt-2 text-[10px] text-muted/80 leading-relaxed">
                    友達評価 {perceptions.length} 件中 PDF 利用可: {consented} 件 / Web のみ: {blocked} 件
                  </p>
                );
              })()}
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
