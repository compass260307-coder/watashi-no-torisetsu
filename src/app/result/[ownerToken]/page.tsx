"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { BigFiveDimension, DiagnosisResult } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import {
  computeGapAnalysis,
  generateGapSummary,
  generateFriendTrends,
} from "@/lib/gap-analysis";

const REQUIRED_FOR_COMPLETE = 3;
const REQUIRED_FOR_DEEP = 5;

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

function getShareUrl(inviteCode: string | null) {
  const base = "https://watashi-no-torisetsu.vercel.app/friend";
  return inviteCode ? `${base}/${inviteCode}` : base;
}

function getShareTexts(shareUrl: string) {
  return [
    `自分の取説作れるやつやってみたんだけど\n友達から見た自分も知りたくて\n\n5問だけだから、気が向いたらやってみて〜\n\n${shareUrl}`,
    `自分の取扱説明書作ってみたんだけど\n友達からどう見えてるか気になって！\n\n5問だけで終わるからよかったら〜\n\n${shareUrl}`,
    `自分のトリセツ作れるやつやってみた！\n友達目線の自分も知りたくて\n\n5問だけだからサクッとお願い〜\n\n${shareUrl}`,
  ];
}

function ShareButtons({ inviteCode }: { inviteCode: string | null }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = getShareUrl(inviteCode);
  const texts = getShareTexts(shareUrl);
  const lineText = texts[Math.floor(Date.now() / 60000) % texts.length];
  const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(lineText)}`;

  const handleCopy = async () => {
    const copyText = texts[Math.floor(Date.now() / 60000) % texts.length];
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-2.5 w-full">
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2.5 w-full rounded-full py-[18px] text-[17px] font-bold text-white shadow-lg shadow-[#06C755]/20 transition-all duration-300 active:scale-[0.98]"
        style={{ backgroundColor: "#06C755" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <path d={LINE_ICON_PATH} />
        </svg>
        LINEで友達に送る
      </a>
      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 w-full rounded-full py-3 text-xs font-bold text-muted transition-all active:scale-[0.98]"
      >
        {copied ? "コピーしました" : "リンクをコピー"}
      </button>
    </div>
  );
}

function ProgressRing({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  const capped = Math.min(current, total);
  const percentage = (capped / total) * 100;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e8e0d8"
          strokeWidth="6"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#FF6B6B"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-extrabold">{capped}</span>
        <span className="text-[10px] text-muted">/ {total}人</span>
      </div>
    </div>
  );
}

function TorisetsuCard({
  label,
  value,
  color,
  isNew,
  className: extraClass,
}: {
  label: string;
  value: string;
  color: string;
  isNew?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-card-border bg-card-bg overflow-hidden ${extraClass ?? ""}`}
    >
      <div
        className="flex items-center gap-2 px-4 py-2 border-b border-card-border"
        style={{ backgroundColor: color + "08" }}
      >
        <span className="text-xs font-bold text-muted">{label}</span>
        {isNew && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary animate-fade-in">
            NEW
          </span>
        )}
      </div>
      <div className="px-4 py-3 text-sm leading-relaxed">{value}</div>
    </div>
  );
}

function LockedCard({
  labels,
  friendsNeeded,
}: {
  labels: { emoji: string; name: string }[];
  friendsNeeded: number;
}) {
  return (
    <div className="relative rounded-xl border border-dashed border-card-border overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-card-bg/80 to-card-bg/95 backdrop-blur-[2px]" />
      <div className="relative p-5 flex flex-col items-center text-center">
        <div className="text-2xl mb-2">🔒</div>
        <p className="text-xs font-bold text-muted mb-3">
          友達あと{friendsNeeded}人の回答で解放
        </p>
        <div className="flex flex-wrap justify-center gap-1.5">
          {labels.map((item) => (
            <span
              key={item.name}
              className="rounded-full bg-background/80 px-3 py-1.5 text-[11px] text-muted border border-card-border"
            >
              {item.emoji} {item.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

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

function SaveResultSection({ ownerToken }: { ownerToken: string }) {
  const [copied, setCopied] = useState(false);

  const resultUrl = `https://watashi-no-torisetsu.vercel.app/result/${ownerToken}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(resultUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm">🔖</span>
        <p className="text-xs font-bold text-muted">あとで見返す</p>
      </div>
      <p className="text-[12px] text-muted leading-relaxed mb-3">
        このページを保存しておくと、友達の回答が集まったあとに見返せます
      </p>
      <button
        onClick={handleCopy}
        className="w-full rounded-xl border border-card-border bg-background px-4 py-3 text-sm font-bold text-foreground transition-all active:scale-[0.98] hover:border-primary/40"
      >
        {copied ? "コピーしました ✓" : "結果ページのリンクをコピー"}
      </button>
    </section>
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
  const [displayName, setDisplayName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("torisetsu_result");
    if (stored) {
      setResult(JSON.parse(stored));
    }

    fetch(`/api/result?token=${ownerToken}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setResult({
            scores: data.scores,
            typeId: data.typeId,
            reasons: data.reasons ?? [],
            supplement: data.supplement ?? "",
          });
          setFriendCount(data.friendCount);
          setFriends(data.friendAnswers ?? []);
          setInviteCode(data.inviteCode);
          if (data.displayName) {
            setDisplayName(data.displayName);
            setNameSaved(true);
          }
          localStorage.setItem("torisetsu_owner_token", ownerToken);
          if (data.inviteCode) {
            localStorage.setItem("torisetsu_invite_code", data.inviteCode);
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

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setNameSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerToken, displayName: displayName.trim() }),
      });
      if (res.ok) {
        setNameSaved(true);
      }
    } catch {
      // fail silently
    } finally {
      setNameSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-muted text-sm animate-fade-in">
          トリセツを読み込み中...
        </div>
      </div>
    );
  }

  if (notFound || !result) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5">
        <p className="text-muted text-sm mb-6">診断結果が見つかりません</p>
        <Link
          href="/diagnosis"
          className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-white"
        >
          診断をやり直す
        </Link>
      </div>
    );
  }

  const typeData = torisetsuTypes[result.typeId];
  const isStage0 = friendCount === 0;
  const isStage1 = friendCount >= 1 && friendCount < 3;
  const isStage3 = friendCount >= 3 && friendCount < 5;
  const isComplete = friendCount >= REQUIRED_FOR_COMPLETE;
  const isDeep = friendCount >= REQUIRED_FOR_DEEP;

  const remaining3 = Math.max(0, REQUIRED_FOR_COMPLETE - friendCount);
  const remaining5 = Math.max(0, REQUIRED_FOR_DEEP - friendCount);

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

  const lockedLabels: { emoji: string; name: string }[] = [];
  if (isStage0) lockedLabels.push({ emoji: "🌧️", name: "苦手な環境" });
  if (!isComplete) {
    lockedLabels.push(
      { emoji: "📖", name: "取扱いのコツ" },
      { emoji: "👀", name: "隠れ能力" },
      { emoji: "✨", name: "気づいてない魅力" },
      { emoji: "💕", name: "愛されるクセ" },
    );
  }

  function getCtaHeading() {
    if (isComplete) return `あと${remaining5}人で深掘りレポート！`;
    if (isStage0) return "友達に送って、トリセツを完成させよう";
    return `あと${remaining3}人で完成！`;
  }

  function getSectionTitle() {
    if (isDeep) return "ワタシのトリセツ（完全版）";
    if (isComplete) return "ワタシのトリセツ（完成版）";
    return "ワタシのトリセツ（仮）";
  }

  function getSectionBadge() {
    if (isDeep) return "5人の声入り";
    if (isComplete) return "3人の声入り";
    if (isStage1) return `自己評価 + 友達${friendCount}人`;
    return "自己評価のみ";
  }

  return (
    <div className="flex flex-col flex-1">
      <main className="flex flex-col items-center px-5 py-6 max-w-lg mx-auto w-full">
        {/* Type card - screenshot-worthy */}
        <section
          className="w-full rounded-2xl border bg-card-bg overflow-hidden mb-5 animate-scale-in"
          style={{ borderColor: typeData.color + "40" }}
        >
          {/* Color accent bar */}
          <div className="h-1.5" style={{ backgroundColor: typeData.color }} />

          <div className="flex flex-col items-center text-center px-5 pt-6 pb-5">
            <div className="text-[10px] font-bold tracking-wider text-muted mb-4">
              YOUR TYPE
            </div>
            <div
              className="text-5xl mb-3 w-20 h-20 flex items-center justify-center rounded-2xl"
              style={{ backgroundColor: typeData.color + "15" }}
            >
              {typeData.emoji}
            </div>
            <h1
              className="text-2xl font-extrabold mb-1 animate-fade-in-up stagger-1"
              style={{ color: typeData.color }}
            >
              {typeData.name}
            </h1>
            <p className="text-sm text-muted animate-fade-in-up stagger-2">
              {typeData.subtitle}
            </p>

            {/* Reasons inline */}
            {result.reasons?.length > 0 && (
              <div className="w-full mt-5 pt-4 border-t border-card-border">
                <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
                  このタイプになった理由
                </p>
                <ul className="flex flex-col gap-2 text-left">
                  {result.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">
                        {["🗣️", "🤝", "🌈"][i] ?? "•"}
                      </span>
                      <span className="text-[13px] leading-relaxed">
                        {reason}
                      </span>
                    </li>
                  ))}
                </ul>
                {result.supplement && (
                  <p className="text-[13px] text-muted leading-relaxed mt-2.5">
                    {result.supplement}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer watermark */}
          <div className="bg-label-bg/50 px-5 py-2 text-center border-t border-card-border">
            <p className="text-[9px] font-bold tracking-wider text-muted/60">
              ワタシのトリセツ
            </p>
          </div>
        </section>

        {/* Name input */}
        {!isDeep && (
          <section className="w-full rounded-2xl border border-card-border bg-card-bg p-5 mb-4 animate-fade-in-up stagger-3">
            <p className="text-xs font-bold text-muted mb-1">
              友達に見てもらう名前
            </p>
            <p className="text-[10px] text-muted mb-3">
              この名前が友達の回答画面に表示されます
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  setNameSaved(false);
                }}
                placeholder="ニックネームでOK"
                maxLength={20}
                className="flex-1 rounded-xl border border-card-border bg-background px-4 py-3 text-sm outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={handleSaveName}
                disabled={nameSaving || !displayName.trim()}
                className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all disabled:opacity-40 active:scale-[0.98]"
              >
                {nameSaving ? "..." : nameSaved ? "OK" : "保存"}
              </button>
            </div>
            {nameSaved && (
              <p className="text-[10px] text-primary mt-2 animate-fade-in">
                {displayName}さんのトリセツとして友達に表示されます
              </p>
            )}
          </section>
        )}

        {/* CTA Section */}
        {!isDeep && (
          <section
            className="w-full rounded-2xl p-5 mb-5 animate-fade-in-up stagger-4"
            style={{
              backgroundColor: typeData.color + "0C",
              border: `1px solid ${typeData.color}30`,
            }}
          >
            {isStage0 && (
              <p className="text-sm font-extrabold text-center mb-4">
                {getCtaHeading()}
              </p>
            )}

            {!isStage0 && (
              <div className="flex flex-col items-center text-center mb-4">
                <ProgressRing
                  current={friendCount}
                  total={isComplete ? REQUIRED_FOR_DEEP : REQUIRED_FOR_COMPLETE}
                />
                <h2 className="text-sm font-extrabold mt-2">
                  {getCtaHeading()}
                </h2>
              </div>
            )}

            <ShareButtons inviteCode={inviteCode} />

            <p className="text-[10px] text-muted text-center mt-2">
              ログイン不要・5問・1分で完了
            </p>
          </section>
        )}

        {/* Save result section */}
        <SaveResultSection ownerToken={ownerToken} />

        {/* Friend voices */}
        {activeFriends.length > 0 && (
          <section className="w-full mb-5 animate-fade-in-up stagger-4">
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

        {/* Self-other gap + friend trends (3+ friends) */}
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

        {/* Torisetsu cards */}
        <section className="w-full mb-5 animate-fade-in-up stagger-4">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-5 w-1 rounded-full"
              style={{ backgroundColor: typeData.color }}
            />
            <h3 className="text-sm font-bold">{getSectionTitle()}</h3>
            <span className="text-[10px] text-muted ml-auto">
              {getSectionBadge()}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <TorisetsuCard
              label="📦 基本スペック"
              value={typeData.basicSpec}
              color={typeData.color}
              className="animate-fade-in-up stagger-5"
            />
            <TorisetsuCard
              label="💬 喜ぶ言葉"
              value={typeData.happyWords}
              color={typeData.color}
              className="animate-fade-in-up stagger-6"
            />
            <TorisetsuCard
              label="⚡ エネルギーが上がる瞬間"
              value={typeData.energyBoost}
              color={typeData.color}
              className="animate-fade-in-up stagger-7"
            />

            {!isStage0 && (
              <TorisetsuCard
                label="🌧️ 苦手な環境"
                value={typeData.weakEnvironment}
                color={typeData.color}
                isNew={isStage1}
                className="animate-fade-in-up stagger-8"
              />
            )}

            {isComplete && (
              <>
                <TorisetsuCard
                  label="📖 取扱いのコツ"
                  value={typeData.handlingTips}
                  color={typeData.color}
                  isNew={isStage3}
                />
                <TorisetsuCard
                  label="👀 友達から見た隠れ能力"
                  value={typeData.hiddenAbility}
                  color={typeData.color}
                  isNew={isStage3}
                />
                <TorisetsuCard
                  label="✨ 自分では気づいてない魅力"
                  value={typeData.unknownCharm}
                  color={typeData.color}
                  isNew={isStage3}
                />
                <TorisetsuCard
                  label="💕 愛されるクセ"
                  value={typeData.lovedQuirk}
                  color={typeData.color}
                  isNew={isStage3}
                />
              </>
            )}

            {/* Locked cards */}
            {lockedLabels.length > 0 && (
              <LockedCard
                labels={lockedLabels}
                friendsNeeded={remaining3}
              />
            )}
          </div>
        </section>

        {/* Stage 5: Bottom share */}
        {isDeep && (
          <section
            className="w-full rounded-2xl p-5 mb-5 text-center"
            style={{
              backgroundColor: typeData.color + "0C",
              border: `1px solid ${typeData.color}30`,
            }}
          >
            <p className="text-sm font-extrabold mb-3">
              友達にもシェアしてみよう
            </p>
            <ShareButtons inviteCode={inviteCode} />
          </section>
        )}

        {/* Dev mock switcher */}
        {process.env.NODE_ENV === "development" && (
          <section className="w-full rounded-xl border border-dashed border-card-border p-4 mb-5">
            <p className="text-[10px] text-muted text-center mb-2">
              DEV：友達数の切り替え（実データ: {friends.length}人）
            </p>
            <div className="flex justify-center gap-2">
              {[0, 1, 3, 5].map((n) => (
                <button
                  key={n}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                    friendCount === n
                      ? "bg-primary text-white"
                      : "bg-card-bg border border-card-border text-muted hover:border-primary/40"
                  }`}
                  onClick={() => setFriendCount(n)}
                >
                  {n}人
                </button>
              ))}
            </div>
          </section>
        )}

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
