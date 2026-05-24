"use client";

// Phase 3-β B-4: マイ図鑑画面 (LIFF 上で開く想定、Web 直接アクセスも fallback で動く)
// プレミアム化 v2 (Week 3 T3-7): 旧「準備中」表記を更新済 (¥500 で生成可)。
//
// 構造:
//   🟢 自己トリセツ (current = 最新診断)
//   📜 過去のあなた (current 以外の users 行、存在時のみ折りたたみ表示)
//   🟡 ○○さんから見た、あなた (friend_perceptions リスト、空時は招待 CTA)
//   🟣 統合トリセツ (プレミアム ¥500、/integrated/new から購入導線)
//
// 認可:
//   LIFF init → id_token → /api/zukan-mine GET (Bearer 必須)
//   LIFF 不可 (Web 直接アクセス) → 「LINE 内で開いてください」ガイド

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TorisetsuCard } from "@/components/torisetsu/TorisetsuCard";
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

type IntegratedCard = {
  id: string;
  title: string;
  summary: string;
  generatedAt: string;
  perceptionCount: number;
  includeSelf: boolean;
};

type ZukanMineResponse = {
  ok: true;
  ownerName: string | null;
  current: DiagnosisCard | null;
  past: DiagnosisCard[];
  perceptions: PerceptionCard[];
  integrated: IntegratedCard[];
  integratedTotalCount: number;
};

type Status =
  | "loading"
  | "needs-self-diagnosis"
  | "error"
  | "ready";

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ZukanMinePage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [data, setData] = useState<ZukanMineResponse | null>(null);
  const [selectedPerception, setSelectedPerception] =
    useState<PerceptionCard | null>(null);
  const [showPast, setShowPast] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        // Web ファースト: Cookie wn_session が自動送信される。Bearer 不要。
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
        setStatus("ready");
      } catch (err) {
        console.error("[zukan-mine] init error:", err);
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  }, []);

  if (status === "loading") {
    return <CenteredMessage>マイ図鑑を読み込み中...</CenteredMessage>;
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
        <p className="text-xs text-muted text-center mb-6 leading-relaxed">
          マイ図鑑には、診断完了後の
          <br />
          あなたのトリセツが並びます
        </p>
        <Link
          href="/diagnosis"
          className="rounded-full bg-primary-gradient px-8 py-4 text-base font-bold text-white shadow-md"
        >
          自己診断を始める →
        </Link>
        <Link
          href="/login"
          className="text-xs text-muted/70 underline hover:text-foreground mt-6"
        >
          別端末でログイン
        </Link>
      </div>
    );
  }
  if (status === "error" || !data) {
    return (
      <CenteredMessage>
        読み込みに失敗しました
        <br />
        <span className="text-xs text-muted">{errorMessage}</span>
      </CenteredMessage>
    );
  }

  // ===== ready =====
  const { ownerName, current, past, perceptions } = data;
  const ownerLabel = ownerName ?? "あなた";
  const perceptionCount = perceptions.length;
  const pastCount = past.length;

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col px-5 py-6 max-w-lg mx-auto w-full pb-12">
        {/* ヘッダー */}
        <header className="text-center mb-6 animate-fade-in-up">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            MY ZUKAN
          </p>
          <h1 className="text-2xl font-extrabold">
            🎴 {ownerLabel}のトリセツ図鑑
          </h1>
        </header>

        {/* 🟢 自己トリセツ (current) */}
        {current && (
          <section className="w-full mb-6 animate-fade-in-up stagger-2">
            <SectionHeader label="🟢 あなたが思う、あなた" count={1} />
            <Link
              href={current.ownerToken ? `/result/${current.ownerToken}` : "#"}
              className="block"
            >
              <DiagnosisCardView card={current} isCurrent />
            </Link>
          </section>
        )}

        {/* 📜 過去のあなた */}
        {pastCount > 0 && (
          <section className="w-full mb-6 animate-fade-in-up stagger-2">
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              className="w-full flex items-center justify-between mb-3"
            >
              <SectionHeader label="📜 過去のあなた" count={pastCount} />
              <span className="text-xs text-muted">
                {showPast ? "閉じる ▲" : "開く ▼"}
              </span>
            </button>
            {showPast && (
              <div className="grid grid-cols-2 gap-3">
                {past.map((p) => (
                  <Link
                    key={p.userId}
                    href={p.ownerToken ? `/result/${p.ownerToken}` : "#"}
                    className="block"
                  >
                    <PastDiagnosisCardView card={p} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 🟡 ○○さんから見た、あなた */}
        <section className="w-full mb-6 animate-fade-in-up stagger-3">
          <SectionHeader
            label={`🟡 ${ownerLabel}を見た、誰かの眼`}
            count={perceptionCount}
          />
          {perceptionCount === 0 ? (
            <EmptyPerceptions />
          ) : (
            <div className="flex flex-col gap-4">
              {perceptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPerception(p)}
                  className="block w-full text-left"
                >
                  <PerceptionCardView perception={p} />
                </button>
              ))}
              <div className="mt-2">
                <Link
                  href="/"
                  className="block w-full rounded-full bg-primary-gradient px-6 py-4 text-center text-base font-bold text-white shadow-md"
                >
                  ➕ もっと集める (友達を招待)
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* 🟣 統合トリセツ (Phase 3-β リリース 3 C-4: 本物データ表示) */}
        <section className="w-full mb-6 animate-fade-in-up stagger-3">
          <SectionHeader
            label="🟣 統合トリセツ"
            count={data.integratedTotalCount}
          />
          {data.integratedTotalCount === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/30 p-6 text-center">
              <p className="text-3xl mb-2">✨</p>
              <p className="text-sm font-bold mb-2">
                初めての統合トリセツを作る
              </p>
              <p className="text-xs text-muted leading-relaxed mb-4">
                友達からの評価 + 自分の評価を
                <br />
                AI が統合して「真のトリセツ」を生成します
              </p>
              <Link
                href="/integrated/new"
                className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md"
              >
                🟣 統合トリセツを作る
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.integrated.map((it) => (
                <Link
                  key={it.id}
                  href={`/integrated/${it.id}`}
                  className="block rounded-2xl border border-card-border bg-card-bg p-4 transition-all hover:bg-label-bg active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-bold text-foreground flex-1 min-w-0 truncate">
                      ✨ {it.title}
                    </p>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5 shrink-0">
                      {it.includeSelf
                        ? it.perceptionCount + 1
                        : it.perceptionCount}{" "}
                      素材
                    </span>
                  </div>
                  {it.summary && (
                    <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-2">
                      {it.summary}
                    </p>
                  )}
                  <p className="text-[10px] text-muted">
                    {formatDate(it.generatedAt)}
                  </p>
                </Link>
              ))}
              <Link
                href="/integrated/new"
                className="mt-2 block w-full rounded-full bg-primary-gradient text-white px-6 py-3 text-center text-sm font-bold shadow-md"
              >
                + 新しい統合トリセツを作る
              </Link>
            </div>
          )}
        </section>

        <Link
          href="/"
          className="text-xs text-muted/70 underline hover:text-foreground transition-colors text-center"
        >
          トップに戻る
        </Link>
      </main>

      {/* 他者カードの詳細モーダル */}
      {selectedPerception && (
        <PerceptionModal
          perception={selectedPerception}
          ownerLabel={ownerLabel}
          onClose={() => setSelectedPerception(null)}
        />
      )}
    </div>
  );
}

// =========================================================================
// 子コンポーネント
// =========================================================================

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-5 py-10 text-center">
      <p className="text-sm text-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-foreground">{label}</h2>
      <span className="text-[10px] font-bold text-muted">{count} 件</span>
    </div>
  );
}

function DiagnosisCardView({
  card,
  isCurrent,
}: {
  card: DiagnosisCard;
  isCurrent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border-2 bg-card-bg p-5 transition-all hover:scale-[1.02] active:scale-[0.99] shadow-sm"
      style={{ borderColor: card.typeColor + "60" }}
    >
      <div className="flex gap-4 items-center">
        <div className="shrink-0">
          <TorisetsuCard fullCode={card.fullCode} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-base font-extrabold mb-1 truncate"
            style={{ color: card.typeColor }}
          >
            {card.typeName}
          </p>
          <p className="text-xs font-bold text-foreground mb-1">
            {card.fullCode}
          </p>
          <p className="text-[11px] text-muted mb-2">
            {card.modifierLabel}
          </p>
          <p className="text-[10px] text-muted">
            {isCurrent ? "最新 " : ""}({formatDate(card.diagnosedAt)})
          </p>
        </div>
      </div>
    </div>
  );
}

function PastDiagnosisCardView({ card }: { card: DiagnosisCard }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-3 transition-all active:scale-95">
      <div className="flex justify-center mb-2">
        <TorisetsuCard fullCode={card.fullCode} size="sm" />
      </div>
      <p
        className="text-[10px] font-bold text-center truncate"
        style={{ color: card.typeColor }}
      >
        {card.fullCode}
      </p>
      <p className="text-[10px] text-muted text-center">
        {formatDate(card.diagnosedAt)}
      </p>
    </div>
  );
}

function PerceptionCardView({ perception }: { perception: PerceptionCard }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-4 transition-all hover:bg-label-bg active:scale-[0.99]">
      <div className="flex gap-3 items-center">
        <div className="shrink-0">
          <TorisetsuCard fullCode={perception.perceivedFullCode} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold mb-1 truncate">
            {perception.perceivedTypeName}
          </p>
          <p className="text-[11px] font-bold text-foreground mb-1">
            {perception.perceivedFullCode}
          </p>
          <p className="text-[11px] text-muted mb-2 truncate">
            {perception.perceivedModifierLabel}
          </p>
          <p className="text-[10px] text-muted">
            by {perception.perceiverName} ({formatDate(perception.createdAt)})
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyPerceptions() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/40 p-6 text-center">
      <p className="text-3xl mb-2">👀</p>
      <p className="text-sm font-bold mb-2">まだ誰も評価してくれてない</p>
      <p className="text-xs text-muted leading-relaxed mb-4">
        友達に「あなたから見た私のトリセツが欲しい」と送って
        <br />
        他者の眼を集めましょう
      </p>
      <Link
        href="/"
        className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md"
      >
        💌 友達を招待する
      </Link>
    </div>
  );
}

function PerceptionModal({
  perception,
  ownerLabel,
  onClose,
}: {
  perception: PerceptionCard;
  ownerLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-modal-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-card-border px-5 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-foreground"
            aria-label="閉じる"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 text-center">
          <p className="text-xs text-muted mb-2">
            {perception.perceiverName}さんから見た{ownerLabel}
          </p>
          <div className="flex justify-center mb-4">
            <TorisetsuCard
              fullCode={perception.perceivedFullCode}
              size="md"
            />
          </div>
          <p className="text-xl font-extrabold mb-1">
            {perception.perceivedTypeName}
          </p>
          <p className="text-sm text-muted">
            {perception.perceivedFullCode} · {perception.perceivedModifierLabel}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-bold tracking-wider text-muted mb-2">
            あなたから見た{ownerLabel}
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-line">
            {perception.perceivedModifierParagraph}
          </p>
        </div>

        {perception.qualitativeData && (
          <div className="px-5 py-4 border-t border-card-border">
            <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
              おまけで答えてくれた
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {perception.qualitativeData.favorite_point && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted text-xs">好きなところ</span>
                  <span className="font-bold text-right">
                    {perception.qualitativeData.favorite_point}
                  </span>
                </li>
              )}
              {perception.qualitativeData.animal && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted text-xs">動物に例えると</span>
                  <span className="font-bold text-right">
                    {perception.qualitativeData.animal}
                  </span>
                </li>
              )}
              {perception.qualitativeData.impression_scene && (
                <li className="flex justify-between gap-3">
                  <span className="text-muted text-xs">印象的なシーン</span>
                  <span className="font-bold text-right">
                    {perception.qualitativeData.impression_scene}
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="px-5 py-4 text-[10px] text-muted leading-relaxed border-t border-card-border">
          回答日: {formatDate(perception.createdAt)}
        </div>
      </div>
    </div>
  );
}
