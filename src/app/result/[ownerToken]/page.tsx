"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BigFiveDimension, DiagnosisResult } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { track } from "@/lib/track";
import {
  computeGapAnalysis,
  generateGapSummary,
  generateFriendTrends,
} from "@/lib/gap-analysis";
import { TYPE_DEEP_DIVE } from "@/lib/report-data";
import { AnalyzingLoader } from "@/components/AnalyzingLoader";
import { TorisetsuCard } from "@/components/torisetsu/TorisetsuCard";
import { CardDownloadButton } from "@/components/torisetsu/CardDownloadButton";
import { ModifierParagraph } from "@/components/torisetsu/ModifierParagraph";
import { DimensionPolarityBar } from "@/components/torisetsu/DimensionPolarityBar";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";

const REQUIRED_FOR_COMPLETE = 3;
const REQUIRED_FOR_DEEP = 5;

const LINE_FRIEND_URL = "https://lin.ee/VbAOXrV";

function getLineRegisterUrl(ownerToken: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) return LINE_FRIEND_URL;
  return `https://liff.line.me/${liffId}?owner_token=${encodeURIComponent(ownerToken)}`;
}

const FIRST_FRIEND_COMMENTS = [
  "なんか当たっててちょっと怖いんだけどw",
  "まあ知ってたけどね、って感じ",
  "これ本人に言ったら絶対否定するやつ",
];

type FriendData = {
  id: string;
  answers: Record<string, string | number>;
  created_at: string;
};

// --- Sub-components ---

const LINE_ICON_PATH =
  "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314";

function FriendVoiceCard({
  friend,
  index,
  color,
  isFirst,
  comment,
}: {
  friend: FriendData;
  index: number;
  color: string;
  isFirst?: boolean;
  comment?: string;
}) {
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const label = labels[index] ?? String(index + 1);
  const q4 = friend.answers?.["4"] as string | undefined;
  const q5 = friend.answers?.["5"] as string | undefined;

  return (
    <div
      className="rounded-xl border border-card-border bg-card-bg overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {label}
          </div>
          <span className="text-xs font-bold">友達{label}</span>
          {isFirst && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              最初の回答！
            </span>
          )}
        </div>

        {comment && (
          <div
            className="rounded-lg p-3 mb-3 text-sm leading-relaxed"
            style={{ backgroundColor: color + "08" }}
          >
            &ldquo;{comment}&rdquo;
          </div>
        )}

        {(q4 || q5) && (
          <div className="flex gap-3">
            {q4 && (
              <div className="flex-1 rounded-lg bg-background p-2.5">
                <div className="text-[10px] text-muted mb-0.5">ここが好き</div>
                <div className="text-xs font-bold">{q4}</div>
              </div>
            )}
            {q5 && (
              <div className="flex-1 rounded-lg bg-background p-2.5">
                <div className="text-[10px] text-muted mb-0.5">隠れた魅力</div>
                <div className="text-xs font-bold">{q5}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GapAnalysisItem({
  label,
  selfLabel,
  friendLabel,
  color,
}: {
  label: string;
  selfLabel: string;
  friendLabel: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="text-xs font-bold text-muted mb-3">{label}</div>
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-background p-3 text-center">
          <div className="text-[10px] text-muted mb-1">自分の回答</div>
          <div className="text-sm font-medium">{selfLabel}</div>
        </div>
        <div className="flex items-center text-muted text-xs">vs</div>
        <div
          className="flex-1 rounded-lg p-3 text-center"
          style={{ backgroundColor: color + "10" }}
        >
          <div className="text-[10px] text-muted mb-1">友達から</div>
          <div className="text-sm font-bold" style={{ color }}>
            {friendLabel}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main ---

export default function OwnerResultPage({
  params,
}: {
  params: Promise<{ ownerToken: string }>;
}) {
  const { ownerToken } = use(params);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendCount, setFriendCount] = useState(0);
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [resultLinkCopied, setResultLinkCopied] = useState(false);
  const tracked = useRef(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const stored = localStorage.getItem("torisetsu_result");
    if (stored) {
      const parsed = JSON.parse(stored) as DiagnosisResult;
      setResult(parsed);
      setLoading(false);
    }

    fetch(`/api/result?token=${ownerToken}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          // API は新形式 (facetScores / fullCode / modifier 等) を返す。
          // レガシー行 (Phase 2F 以前に保存) では一部 null が返るため、scores から派生して補う。
          const scores = data.scores as Record<BigFiveDimension, number> | null;
          const { cModifier: derivedC, nModifier: derivedN } = scores
            ? classifyModifier(scores)
            : { cModifier: "C" as const, nModifier: "N" as const };
          const cModifier = data.cModifier ?? derivedC;
          const nModifier = data.nModifier ?? derivedN;
          const fullCode =
            data.fullCode ?? buildFullCode(data.typeId, cModifier, nModifier);
          const modifierLabel =
            data.modifierLabel ?? getModifierLabel(cModifier, nModifier);

          setResult({
            scores: scores ?? { E: 5, A: 5, O: 5, C: 5, N: 5 },
            typeId: data.typeId,
            reasons: data.reasons ?? [],
            supplement: data.supplement ?? "",
            facetScores: data.facetScores ?? {
              E_assertiveness: 5,
              E_warmth: 5,
              A_cooperation: 5,
              A_sympathy: 5,
              O_adventurousness: 5,
              O_imagination: 5,
              C_achievement: 5,
              C_orderliness: 5,
              N_volatility: 5,
              N_anxiety: 5,
            },
            cModifier,
            nModifier,
            fullCode,
            modifierLabel,
          });
          setFriendCount(data.friendCount);
          setFriends(data.friendAnswers ?? []);
          setInviteCode(data.inviteCode);
          localStorage.setItem("torisetsu_owner_token", ownerToken);
          if (data.inviteCode) {
            localStorage.setItem("torisetsu_invite_code", data.inviteCode);
          }
          if (!tracked.current) {
            tracked.current = true;
            const isRevisit = !!localStorage.getItem("torisetsu_result_viewed");
            track(isRevisit ? "result_revisited" : "result_viewed", {
              ownerToken,
              inviteCode: data.inviteCode,
              metadata: { typeId: data.typeId, friendCount: data.friendCount },
            });
            localStorage.setItem("torisetsu_result_viewed", "1");
          }
        } else {
          setNotFound(true);
        }
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [ownerToken]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCopyResultLink = async () => {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.watashi-torisetsu.com";
    await navigator.clipboard.writeText(`${baseUrl}/result/${ownerToken}`);
    setResultLinkCopied(true);
    setTimeout(() => setResultLinkCopied(false), 2500);
  };

  if (loading) {
    return <AnalyzingLoader />;
  }

  if (notFound || !result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5">
        <p className="text-muted text-sm mb-6">診断結果が見つかりません</p>
        <Link
          href="/diagnosis"
          className="rounded-full bg-primary-gradient px-8 py-3 text-sm font-bold text-white"
        >
          診断をやり直す
        </Link>
      </div>
    );
  }

  const typeData = torisetsuTypes[result.typeId];
  const isComplete = friendCount >= REQUIRED_FOR_COMPLETE;
  const isDeep = friendCount >= REQUIRED_FOR_DEEP;

  const activeFriends = friends.slice(0, friendCount);

  const gapItems =
    isComplete && result.scores
      ? computeGapAnalysis(
          result.scores as Record<BigFiveDimension, number>,
          activeFriends,
        )
      : [];

  const gapSummary = isDeep ? generateGapSummary(gapItems) : "";
  const friendTrends = isComplete ? generateFriendTrends(gapItems) : [];

  function getTorisetsuTitle() {
    if (isComplete) return "ワタシのトリセツ";
    return "ワタシのトリセツ（仮）";
  }

  function getTorisetsuSub() {
    if (isDeep) return `友達${friendCount}人の声で完全版`;
    if (isComplete) return `友達${friendCount}人の声で完成`;
    if (friendCount > 0) return `自己評価 + 友達${friendCount}人の声を反映`;
    return "自己評価をもとに作成";
  }

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col items-center px-5 py-6 max-w-lg mx-auto w-full">

        {/* ===== 1. TorisetsuCard + タイプ名 + 5 文字コード ===== */}
        {result.fullCode && (
          <section className="w-full flex flex-col items-center mb-5 animate-fade-in-up">
            <TorisetsuCard
              fullCode={result.fullCode}
              size="md"
              alt={`${typeData.name} - ${result.modifierLabel}`}
              priority
            />
            <h1
              className="text-2xl font-extrabold mt-4 text-center"
              style={{ color: typeData.color }}
            >
              {typeData.name}
            </h1>
            <p className="text-sm text-muted text-center mt-1">
              {typeData.subtitle}
            </p>
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-wider"
              style={{
                borderColor: typeData.color + "60",
                color: typeData.color,
                backgroundColor: typeData.color + "10",
              }}
            >
              <span>{result.fullCode}</span>
              {result.modifierLabel && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{result.modifierLabel}</span>
                </>
              )}
            </div>
            <div className="mt-4">
              <CardDownloadButton fullCode={result.fullCode} />
            </div>
          </section>
        )}

        {/* ===== 1.6 ModifierParagraph (個性パーソナライズ文章) ===== */}
        <section className="w-full mb-5 animate-fade-in-up stagger-3">
          <ModifierParagraph
            typeId={result.typeId}
            cModifier={result.cModifier}
            nModifier={result.nModifier}
            accentColor={typeData.color}
          />
        </section>

        {/* ===== 1.7 DimensionPolarityBar (5 文字コード由来の極性表示) ===== */}
        <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="h-5 w-1 rounded-full"
              style={{ backgroundColor: typeData.color }}
            />
            <h3 className="text-sm font-bold">あなたの 5 軸プロファイル</h3>
          </div>
          <div className="flex flex-col gap-5">
            {(["E", "A", "O", "C", "N"] as BigFiveDimension[]).map((dim) => (
              <DimensionPolarityBar
                key={dim}
                dimension={dim}
                score={result.scores[dim]}
              />
            ))}
          </div>
          {result.fullCode && (
            <div className="mt-6 text-center border-t border-card-border pt-4">
              <p className="text-[10px] font-bold tracking-wider text-muted">
                あなたの 5 文字コード
              </p>
              <p
                className="text-2xl font-extrabold tracking-wider mt-1"
                style={{ color: typeData.color }}
              >
                {result.fullCode}
              </p>
            </div>
          )}
        </section>

        {/* ===== 2. トリセツ親カード + LINE登録CTA（統合） ===== */}
        {(() => {
          const dive = TYPE_DEEP_DIVE[result.typeId];
          const strengthFirst = dive.strength.body.split("\n\n")[0] ?? "";
          const previewBody = `${dive.essence.body}\n\n${strengthFirst}`;
          return (
            <section className="w-full rounded-2xl border border-card-border bg-card-bg overflow-hidden mb-5 animate-fade-in-up stagger-3">
              {/* ヘッダー */}
              <div
                className="px-5 pt-5 pb-4"
                style={{ backgroundColor: typeData.color + "06" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">📋</span>
                  <h2 className="text-lg font-extrabold">
                    {getTorisetsuTitle()}
                  </h2>
                </div>
                <p className="text-xs text-muted">{getTorisetsuSub()}</p>
              </div>

              {/* タイプ深掘りプレビュー（フェードアウト） */}
              <div
                className="px-5 pt-5 pb-0 relative"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to bottom, black 50%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to bottom, black 50%, transparent 100%)",
                }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-line">
                  {previewBody}
                </p>
              </div>

              {/* LINE登録CTA (ミニマル型) */}
              <div className="px-6 pt-2 pb-6">
                <div className="flex flex-col items-center text-center">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#06C755] mb-4">
                    <svg
                      viewBox="0 0 24 24"
                      className="w-9 h-9"
                      fill="white"
                      aria-hidden="true"
                    >
                      <path d={LINE_ICON_PATH} />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold leading-snug mb-3">
                    LINE で、もっと自分を知る
                  </h2>
                  <p className="text-sm text-muted leading-relaxed mb-6">
                    続きを読む / 友達評価通知 / 図鑑 / 再診断
                    <br />
                    すべてここから
                  </p>
                  <a
                    href={getLineRegisterUrl(ownerToken)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      track("line_register_clicked", { ownerToken, inviteCode })
                    }
                    className="inline-flex items-center justify-center gap-2 w-full max-w-xs rounded-full bg-[#06C755] px-8 py-4 text-base font-bold text-white shadow-md shadow-[#06C755]/25 transition-all hover:bg-[#05b34a] active:scale-[0.98]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                      fill="white"
                      aria-hidden="true"
                    >
                      <path d={LINE_ICON_PATH} />
                    </svg>
                    LINE で続きを読む
                  </a>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ===== 3. 友達の声 ===== */}
        {activeFriends.length > 0 && (
          <section className="w-full mb-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-5 w-1 rounded-full"
                style={{ backgroundColor: typeData.color }}
              />
              <h3 className="text-sm font-bold">友達から見たワタシ</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary ml-auto">
                {activeFriends.length}人回答
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {activeFriends.map((friend, i) => (
                <FriendVoiceCard
                  key={friend.id}
                  friend={friend}
                  index={i}
                  color={typeData.color}
                  isFirst={i === 0 && friendCount === 1}
                  comment={
                    i === 0
                      ? FIRST_FRIEND_COMMENTS[
                          Math.abs(result.typeId.charCodeAt(0)) %
                          FIRST_FRIEND_COMMENTS.length
                        ]
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}

        {/* ===== 4. 自他ギャップ (3+) ===== */}
        {isComplete && gapItems.length > 0 && (
          <section className="w-full mb-5 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="h-5 w-1 rounded-full"
                style={{ backgroundColor: typeData.color }}
              />
              <h3 className="text-sm font-bold">自他ギャップ</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary ml-auto">
                {friendCount}人の声
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {gapItems.map((item) => (
                <GapAnalysisItem
                  key={item.dimension}
                  label={`${item.emoji} ${item.label}`}
                  selfLabel={item.selfLabel}
                  friendLabel={item.friendLabel}
                  color={typeData.color}
                />
              ))}
            </div>

            {friendTrends.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-3">
                {friendTrends.map((trend, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-card-border bg-card-bg p-4"
                    style={{
                      borderLeftWidth: 4,
                      borderLeftColor: typeData.color,
                    }}
                  >
                    <p className="text-sm leading-relaxed">{trend}</p>
                  </div>
                ))}
              </div>
            )}

            {gapSummary && (
              <div className="rounded-xl border border-card-border bg-card-bg p-4 mt-3">
                <div className="text-xs font-bold text-muted mb-2">
                  📊 総合分析
                </div>
                <p className="text-sm leading-relaxed">{gapSummary}</p>
              </div>
            )}
          </section>
        )}

        {/* ===== 5. あとで見返す ===== */}
        <div className="w-full flex items-center justify-between py-3 mb-3">
          <span className="text-[11px] text-muted">🔖 このページをブックマークしておくと便利です</span>
          <button
            onClick={handleCopyResultLink}
            className="shrink-0 text-[11px] font-bold text-muted transition-all active:scale-[0.98] hover:text-foreground"
          >
            {resultLinkCopied ? "✓ コピー済" : "URLをコピー"}
          </button>
        </div>

        {/* Footer */}
        <Link
          href="/"
          className="text-xs text-muted hover:text-foreground transition-colors mb-2"
        >
          トップに戻る
        </Link>
        <p className="text-[10px] text-muted/60 mb-4">ワタシのトリセツ</p>
      </main>
    </div>
  );
}
