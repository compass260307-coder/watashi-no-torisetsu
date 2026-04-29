"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DiagnosisResult } from "@/lib/types";
import { torisetsuTypes } from "@/lib/torisetsu-data";

const REQUIRED_FOR_COMPLETE = 3;
const REQUIRED_FOR_DEEP = 5;

const FIRST_FRIEND_COMMENTS = [
  "なんか当たっててちょっと怖いんだけどw",
  "まあ知ってたけどね、って感じ",
  "これ本人に言ったら絶対否定するやつ",
];

const MOCK_FRIENDS = [
  {
    name: "友達A",
    q4: "一緒にいると楽しい",
    q5: "実はめっちゃ繊細",
  },
  {
    name: "友達B",
    q4: "刺激をもらえる",
    q5: "実はめっちゃ頼りになる",
  },
  {
    name: "友達C",
    q4: "安心感がある",
    q5: "実はめっちゃ面白い",
  },
  {
    name: "友達D",
    q4: "素でいられる",
    q5: "実はめっちゃ優しい",
  },
  {
    name: "友達E",
    q4: "一緒にいると楽しい",
    q5: "実はめっちゃ繊細",
  },
];

// --- Sub-components ---

const LINE_ICON_PATH =
  "M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314";

function getShareTexts(
  typeData: (typeof torisetsuTypes)[keyof typeof torisetsuTypes],
  url: string
) {
  return [
    `自分のトリセツ作れるやつやってみたんだけど\nちょっとこれやってみてw 5問だけ、1分で終わる\n${url}`,
    `${typeData.emoji}「${typeData.name}」って出たw\n私ってそう見える？ 5問だけ答えてみて、1分で終わる\n${url}`,
    `これ絶対${typeData.name}っぽいって言われそうw\nどう思うか5問だけ教えて、1分で終わる\n${url}`,
  ];
}

function ShareButtons({
  typeData,
}: {
  typeData: (typeof torisetsuTypes)[keyof typeof torisetsuTypes];
}) {
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/friend` : "";
  const texts = getShareTexts(typeData, shareUrl);
  const lineText = texts[Math.floor(Date.now() / 60000) % texts.length];
  const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(lineText)}`;

  const handleCopy = async () => {
    const copyText = texts[Math.floor(Date.now() / 60000) % texts.length];
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <a
        href={lineUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-center gap-2 w-full rounded-full py-4 text-base font-bold text-white transition-all duration-300 active:scale-[0.98] ${
          copied ? "shadow-lg shadow-[#06C755]/25" : "shadow-md"
        }`}
        style={{ backgroundColor: "#06C755" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d={LINE_ICON_PATH} />
        </svg>
        LINEで友達に送る
      </a>
      <button
        onClick={handleCopy}
        className="flex items-center justify-center gap-2 w-full rounded-full border-2 border-card-border bg-card-bg py-3.5 text-sm font-bold text-foreground transition-all hover:border-primary/40 active:scale-[0.98]"
      >
        {copied ? "✅ コピーしました" : "📋 リンクをコピー"}
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
  locked,
  color,
  isNew,
}: {
  label: string;
  value: string;
  locked?: boolean;
  color: string;
  isNew?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card-bg p-4 transition-all ${locked ? "border-card-border" : "border-card-border"}`}
      style={
        locked ? undefined : { borderLeftWidth: 4, borderLeftColor: color }
      }
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-bold text-muted">{label}</span>
        {isNew && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            NEW
          </span>
        )}
      </div>
      {locked ? (
        <div className="flex items-center gap-2 text-sm text-muted/60">
          <span>🔒</span>
          <span>友達の回答で解放されます</span>
        </div>
      ) : (
        <div className="text-sm leading-relaxed">{value}</div>
      )}
    </div>
  );
}

function FriendVoiceCard({
  friend,
  color,
  isFirst,
  comment,
}: {
  friend: (typeof MOCK_FRIENDS)[number];
  color: string;
  isFirst?: boolean;
  comment?: string;
}) {
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
            {friend.name.slice(-1)}
          </div>
          <span className="text-xs font-bold">{friend.name}</span>
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

        <div className="flex gap-3">
          <div className="flex-1 rounded-lg bg-background p-2.5">
            <div className="text-[10px] text-muted mb-0.5">ここが好き</div>
            <div className="text-xs font-bold">{friend.q4}</div>
          </div>
          <div className="flex-1 rounded-lg bg-background p-2.5">
            <div className="text-[10px] text-muted mb-0.5">隠れた魅力</div>
            <div className="text-xs font-bold">{friend.q5}</div>
          </div>
        </div>
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

export default function ResultPage() {
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("torisetsu_result");
    if (stored) {
      setResult(JSON.parse(stored));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center">
        <div className="text-muted text-sm">読み込み中...</div>
      </div>
    );
  }

  if (!result) {
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
  const isStage5 = friendCount >= 5;
  const isComplete = friendCount >= REQUIRED_FOR_COMPLETE;
  const isDeep = friendCount >= REQUIRED_FOR_DEEP;

  const remaining3 = Math.max(0, REQUIRED_FOR_COMPLETE - friendCount);
  const remaining5 = Math.max(0, REQUIRED_FOR_DEEP - friendCount);

  const activeFriends = MOCK_FRIENDS.slice(0, friendCount);

  function getProgressLabel() {
    if (isDeep) return "🎊 特別レポート解放！";
    if (isComplete) return `あと${remaining5}人で深掘りレポート！`;
    return `あと${remaining3}人で完成！`;
  }

  function getSectionTitle() {
    if (isDeep) return "ワタシのトリセツ（完全版）";
    if (isComplete) return "ワタシのトリセツ（完成版）";
    if (isStage1) return "ワタシのトリセツ（仮）";
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
      <main className="flex flex-col items-center px-5 py-8 max-w-lg mx-auto w-full">
        {/* Type reveal */}
        <section className="flex flex-col items-center text-center w-full mb-6">
          <div className="inline-block rounded-md bg-label-bg px-3 py-1 text-[10px] font-bold tracking-wider text-muted mb-4 border border-card-border">
            あなたのトリセツタイプ
          </div>

          <div
            className="text-5xl mb-3 w-20 h-20 flex items-center justify-center rounded-2xl"
            style={{ backgroundColor: typeData.color + "18" }}
          >
            {typeData.emoji}
          </div>

          <h1
            className="text-2xl font-extrabold mb-1"
            style={{ color: typeData.color }}
          >
            {typeData.name}
          </h1>
          <p className="text-sm text-muted">{typeData.subtitle}</p>
        </section>

        {/* Progress + CTA */}
        {!isDeep && (
          <section
            className="w-full rounded-2xl p-6 mb-6"
            style={{
              backgroundColor: typeData.color + "0C",
              border: `1px solid ${typeData.color}30`,
            }}
          >
            <div className="flex flex-col items-center text-center mb-5">
              <ProgressRing
                current={friendCount}
                total={isComplete ? REQUIRED_FOR_DEEP : REQUIRED_FOR_COMPLETE}
              />
              <h2 className="text-base font-extrabold mt-3">
                {getProgressLabel()}
              </h2>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                {isComplete
                  ? "さらに2人集めると、自他ギャップの深掘りレポートが見れます"
                  : "友達から見たあなたの姿で、本当のトリセツが完成します"}
              </p>
            </div>

            <ShareButtons typeData={typeData} />

            <p className="text-[10px] text-muted text-center mt-3">
              友達はログイン不要・5問・1分で完了します
            </p>
          </section>
        )}

        {/* Stage 1+: Friend voices */}
        {activeFriends.length > 0 && (
          <section className="w-full mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-5 w-1 rounded-full"
                style={{ backgroundColor: typeData.color }}
              />
              <h3 className="text-sm font-bold">
                友達から見たワタシ
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary ml-auto">
                {activeFriends.length}人回答
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {activeFriends.map((friend, i) => (
                <FriendVoiceCard
                  key={friend.name}
                  friend={friend}
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

        {/* Torisetsu cards */}
        <section className="w-full mb-6">
          <div className="flex items-center gap-2 mb-4">
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
            {/* Always visible */}
            <TorisetsuCard
              label="📦 基本スペック"
              value={typeData.basicSpec}
              color={typeData.color}
            />
            <TorisetsuCard
              label="💬 喜ぶ言葉"
              value={typeData.happyWords}
              color={typeData.color}
            />
            <TorisetsuCard
              label="⚡ エネルギーが上がる瞬間"
              value={typeData.energyBoost}
              color={typeData.color}
            />

            {/* Unlock at 1 friend */}
            <TorisetsuCard
              label="🌧️ 苦手な環境"
              value={typeData.weakEnvironment}
              locked={isStage0}
              color={typeData.color}
              isNew={isStage1}
            />

            {/* Unlock at 3 friends */}
            <TorisetsuCard
              label="📖 取扱いのコツ"
              value={typeData.handlingTips}
              locked={!isComplete}
              color={typeData.color}
              isNew={isStage3}
            />
            <TorisetsuCard
              label="👀 友達から見た隠れ能力"
              value={typeData.hiddenAbility}
              locked={!isComplete}
              color={typeData.color}
              isNew={isStage3}
            />
            <TorisetsuCard
              label="✨ 自分では気づいてない魅力"
              value={typeData.unknownCharm}
              locked={!isComplete}
              color={typeData.color}
              isNew={isStage3}
            />
            <TorisetsuCard
              label="💕 愛されるクセ"
              value={typeData.lovedQuirk}
              locked={!isComplete}
              color={typeData.color}
              isNew={isStage3}
            />
          </div>
        </section>

        {/* Stage 5: Deep dive report */}
        {isDeep && (
          <section className="w-full mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-5 w-1 rounded-full"
                style={{ backgroundColor: typeData.color }}
              />
              <h3 className="text-sm font-bold">
                🔬 自他ギャップ深掘りレポート
              </h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary ml-auto">
                SPECIAL
              </span>
            </div>

            <div
              className="rounded-2xl p-4 mb-4"
              style={{
                backgroundColor: typeData.color + "08",
                border: `1px solid ${typeData.color}20`,
              }}
            >
              <p className="text-xs text-muted text-center leading-relaxed">
                5人の友達の回答とあなたの自己評価を比較した
                <br />
                <span className="font-bold text-foreground">
                  特別なギャップ分析レポート
                </span>
                です
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <GapAnalysisItem
                label="🗣️ 社交性"
                selfLabel="まあまあ話せる"
                friendLabel="めっちゃ話せる！"
                color={typeData.color}
              />
              <GapAnalysisItem
                label="🤝 協調性"
                selfLabel="普通くらい"
                friendLabel="かなり気配り上手"
                color={typeData.color}
              />
              <GapAnalysisItem
                label="🌈 好奇心"
                selfLabel="割と高め"
                friendLabel="冒険心がすごい"
                color={typeData.color}
              />
            </div>

            <div className="rounded-xl border border-card-border bg-card-bg p-4 mt-3">
              <div className="text-xs font-bold text-muted mb-2">
                📊 総合ギャップ分析
              </div>
              <p className="text-sm leading-relaxed">
                あなたは自分の社交性を控えめに見ていますが、友達からは
                <span
                  className="font-bold"
                  style={{ color: typeData.color }}
                >
                  「もっと話せる人」
                </span>
                と見られています。自分が思っているより、周りはあなたの存在に助けられています。
              </p>
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        {!isComplete && (
          <section
            className="w-full rounded-2xl p-5 mb-6 text-center"
            style={{
              backgroundColor: typeData.color + "0C",
              border: `1px solid ${typeData.color}30`,
            }}
          >
            <p className="text-sm font-bold mb-1">
              🔓 ロックを解除するには？
            </p>
            <p className="text-xs text-muted mb-4">
              {isStage1
                ? `あと${remaining3}人の回答で、隠れた項目が全部見れます`
                : "友達3人に答えてもらうと、隠れた項目が全部見れます"}
            </p>
            <ShareButtons typeData={typeData} />
          </section>
        )}

        {/* Complete celebration + share */}
        {isComplete && (
          <section
            className="w-full rounded-2xl p-5 mb-6 text-center"
            style={{
              backgroundColor: typeData.color + "0C",
              border: `1px solid ${typeData.color}30`,
            }}
          >
            {isDeep ? (
              <>
                <p className="text-base font-extrabold mb-1">
                  🎊 特別レポート完成！
                </p>
                <p className="text-xs text-muted mb-4 leading-relaxed">
                  あなたのトリセツは最終形態です。
                  <br />
                  友達にもシェアしてみよう！
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-extrabold mb-1">
                  🎉 トリセツ完成！
                </p>
                <p className="text-xs text-muted mb-4 leading-relaxed">
                  さらに{remaining5}
                  人集めると、自他ギャップの深掘りレポートが解放されます
                </p>
              </>
            )}
            <ShareButtons typeData={typeData} />
          </section>
        )}

        {/* Dev mock switcher */}
        <section className="w-full rounded-xl border border-dashed border-card-border p-4 mb-6">
          <p className="text-[10px] text-muted text-center mb-2">
            🛠 開発用：友達回答数のモック切り替え
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

        <Link
          href="/"
          className="text-xs text-muted hover:text-foreground transition-colors mb-4"
        >
          トップに戻る
        </Link>
      </main>
    </div>
  );
}
