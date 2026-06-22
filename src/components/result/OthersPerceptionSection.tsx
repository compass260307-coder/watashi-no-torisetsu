// ロックされた「他者評価」セクション (/me/[token] 結果ページ、深掘りの直下)。
//
// 設計方針:
//   - presentational な Server Component。タブ等のインタラクションは持たない
//     (ロックのチラ見せ用 LockedBlur のみ client、children として重ねる)。
//   - 解除条件は「友達 N 人」(REPORT_FRIEND_THRESHOLD = 3)。friendCount >= 閾値で解除。
//     既存の ¥500 課金ロック (perception-unlock.ts / Stripe) には一切触れない別ゲート。
//   - 解除後の分析は既存ロジック (perception-analysis.ts の buildDimensionGaps /
//     calcMutualUnderstanding / topGaps) を再利用。自己認知ギャップは BigFiveDivergingBars
//     に友達平均を重ねて可視化する。
//   - ロックUIは既存の LockedBlur / InlineLockCard を再利用 (¥500 ボタンは canPurchase=false で出さない)。

import { LockedBlur } from "./LockedBlur";
import { InlineLockCard } from "./InlineLockCard";
import { LockedInviteShare } from "./LockedInviteShare";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  topGaps,
  type BigFiveScores,
} from "@/lib/perception-analysis";

interface OthersPerceptionSectionProps {
  /** 友達評価の件数 (friend_perceptions の行数)。 */
  friendCount: number;
  /** 解除閾値 (= REPORT_FRIEND_THRESHOLD)。 */
  threshold: number;
  /** ページ所有者本人が見ているか (招待CTAの出し分け)。 */
  isOwner: boolean;
  /** 自己診断スコア (0-10)。 */
  selfScores: BigFiveScores;
  /** 友達評価の平均スコア (0-10)。0 件のときは null。 */
  friendAvgScores: BigFiveScores | null;
  /** ② 評価してくれた友達の名前 (記名表示)。 */
  friendNames?: string[];
  /** ③ 友達からのメッセージ (記名)。空メッセージは含めない。 */
  friendMessages?: { name: string; message: string }[];
  /** 友達評価への招待 URL (ロック中の招待導線 QR/共有に使用)。 */
  inviteUrl: string;
  className?: string;
}

// ロック中にチラ見せする 3 項目 (ぼかし本文 + 価値先行の一文)。
const LOCKED_TEASERS = [
  {
    value: "友達から見たアナタの特徴",
    blurText:
      "友達はアナタのことを、自分が思っているより◯◯だと感じています。相互理解度は◯◯%。いちばんギャップが大きいのは……",
  },
  {
    value: "自分では気づいていない、隠れた強み",
    blurText:
      "アナタが控えめに評価している◯◯を、友達はずっと高く見ています。これは自分では気づきにくい、隠れた強みです。",
  },
];

export function OthersPerceptionSection({
  friendCount,
  threshold,
  isOwner,
  selfScores,
  friendAvgScores,
  friendNames = [],
  friendMessages = [],
  inviteUrl,
  className = "",
}: OthersPerceptionSectionProps) {
  const unlocked = friendCount >= threshold && friendAvgScores !== null;

  return (
    <section className={`mb-8 ${className}`.trim()}>
      <div className="flex items-center gap-3 mb-4">
        <span
          aria-hidden="true"
          className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white text-lg flex items-center justify-center"
        >
          {unlocked ? "🔓" : "🔐"}
        </span>
        <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
          みんなから見たアナタ
        </h2>
      </div>

      {unlocked ? (
        <UnlockedContent
          friendCount={friendCount}
          selfScores={selfScores}
          friendAvgScores={friendAvgScores}
          friendNames={friendNames}
          friendMessages={friendMessages}
        />
      ) : (
        <LockedContent
          friendCount={friendCount}
          threshold={threshold}
          isOwner={isOwner}
          inviteUrl={inviteUrl}
        />
      )}
    </section>
  );
}

// =========================================================================
// ロック中: 3 項目をチラ見せ + 解除ゲージ + 招待CTA
// =========================================================================
function LockedContent({
  friendCount,
  threshold,
  isOwner,
  inviteUrl,
}: {
  friendCount: number;
  threshold: number;
  isOwner: boolean;
  inviteUrl: string;
}) {
  const remaining = Math.max(0, threshold - friendCount);
  const progressPct = Math.min(100, Math.round((friendCount / threshold) * 100));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[#3A2D6B]/80 font-bold text-sm leading-relaxed">
        友達が {threshold} 人評価してくれると、友達から見たアナタが見られるようになります。
      </p>

      {/* チラ見せ 3 項目 (既存 LockedBlur + InlineLockCard を再利用) */}
      <div className="flex flex-col gap-3">
        {LOCKED_TEASERS.map((t) => (
          <LockedBlur
            key={t.value}
            blurText={t.blurText}
            blurTextClassName="text-sm font-bold leading-relaxed"
            blurPx={5}
            padClassName="py-6"
            targetId="friend-unlock-cta"
          >
            {/* canPurchase=false → ¥500 ボタンは出さない (人数ゲートのため) */}
            <InlineLockCard perceptionId="" value={t.value} canPurchase={false} />
          </LockedBlur>
        ))}
      </div>

      {/* 解除ゲージ + CTA */}
      <div
        id="friend-unlock-cta"
        className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 text-center scroll-mt-6"
      >
        <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-2">
          あと {remaining} 人で解除
        </p>
        <div
          className="w-full h-3 bg-card-border rounded-full overflow-hidden mb-2"
          role="progressbar"
          aria-valuenow={friendCount}
          aria-valuemin={0}
          aria-valuemax={threshold}
          aria-label={`友達評価 ${friendCount} / ${threshold} 人`}
        >
          <div
            className="h-full bg-[var(--primary)] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[#3A2D6B]/70 font-bold text-xs tabular-nums">
          {friendCount} / {threshold} 人
        </p>
        {!isOwner && (
          <p className="text-[#3A2D6B]/70 font-bold text-xs leading-relaxed mt-3">
            友達の評価が {threshold} 人集まると公開されます。
          </p>
        )}
      </div>

      {/* 友達招待導線 (QR + LINE + インスタ=コピー)。課金導線は一切なし。 */}
      <LockedInviteShare inviteUrl={inviteUrl} />
    </div>
  );
}

// =========================================================================
// 解除後: 他者分析 / 隠れた強み / 自己認知ギャップ
// =========================================================================
function UnlockedContent({
  friendCount,
  selfScores,
  friendAvgScores,
  friendNames,
  friendMessages,
}: {
  friendCount: number;
  selfScores: BigFiveScores;
  friendAvgScores: BigFiveScores;
  friendNames: string[];
  friendMessages: { name: string; message: string }[];
}) {
  const gaps = buildDimensionGaps(selfScores, friendAvgScores);
  const mutual = calcMutualUnderstanding(gaps);
  const tops = topGaps(gaps, 3);
  // 隠れた強み = 友達評価が自己評価より高い軸 (差の大きい順)。
  const hidden = gaps
    .filter((g) => g.otherPercent > g.selfPercent)
    .sort(
      (a, b) =>
        b.otherPercent - b.selfPercent - (a.otherPercent - a.selfPercent),
    );

  return (
    <div className="flex flex-col gap-5">
      {/* 他者分析 */}
      <article className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
        <h3 className="text-[#3A2D6B] font-black text-lg mb-2">他者分析</h3>
        <p className="text-[#3A2D6B]/80 font-bold text-sm leading-relaxed mb-4">
          友達 {friendCount} 人が評価してくれました。アナタと友達の見方の一致度
          (相互理解度) は <span className="text-[#FE3C72]">{mutual}%</span> です。
        </p>
        <ul className="flex flex-col gap-2">
          {tops.map((g) => (
            <li
              key={g.key}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-[#3A2D6B] font-black">{g.label}</span>
              <span className="text-[#3A2D6B]/70 font-bold tabular-nums">
                自分 {g.selfPercent}% / 友達 {g.otherPercent}%
              </span>
            </li>
          ))}
        </ul>

        {/* ② 評価してくれた友達 (記名)。名前はユーザー入力 → JSX で自動エスケープ。 */}
        {friendNames.length > 0 && (
          <div className="mt-5 pt-4 border-t border-[#0094D8]/15">
            <p className="text-[#3A2D6B]/60 font-bold text-xs mb-2">
              評価してくれた友達
            </p>
            <div className="flex flex-wrap gap-2">
              {friendNames.map((name, i) => (
                <span
                  key={`${name}-${i}`}
                  className="inline-block bg-[#FFF0F3] text-[#3A2D6B] font-bold text-xs rounded-full px-3 py-1"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* 隠れた強み */}
      <article className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
        <h3 className="text-[#3A2D6B] font-black text-lg mb-2">隠れた強み</h3>
        {hidden.length > 0 ? (
          <>
            <p className="text-[#3A2D6B]/80 font-bold text-sm leading-relaxed mb-4">
              アナタが控えめに見ているのに、友達はもっと高く評価している軸です。自分では気づきにくい強みかも。
            </p>
            <ul className="flex flex-col gap-2">
              {hidden.map((g) => (
                <li
                  key={g.key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-[#3A2D6B] font-black">{g.label}</span>
                  <span className="text-[#3A2D6B]/70 font-bold tabular-nums">
                    友達 {g.otherPercent}% ＞ 自分 {g.selfPercent}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-[#3A2D6B]/80 font-bold text-sm leading-relaxed">
            友達の評価は、アナタの自己評価とおおむね一致していました。自己理解がしっかりできています。
          </p>
        )}
      </article>

      {/* ③ 友達からのメッセージ (記名)。本文・名前はユーザー入力 → JSX で自動エスケープ。 */}
      {friendMessages.length > 0 && (
        <article className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
          <h3 className="text-[#3A2D6B] font-black text-lg mb-3">
            友達からのメッセージ
          </h3>
          <ul className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-3">
            {friendMessages.map((m, i) => (
              <li
                key={`${m.name}-${i}`}
                className="bg-[#FFF9F0] rounded-2xl border border-[#FFE993] p-4"
              >
                <p className="text-[#3A2D6B] font-bold text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {m.message}
                </p>
                <p className="text-[#3A2D6B]/60 font-bold text-xs mt-2 text-right">
                  — {m.name} より
                </p>
              </li>
            ))}
          </ul>
        </article>
      )}
      {/* 発散バー (自己認知ギャップ) は章②ページ側に一本化したため、ここには置かない。 */}
    </div>
  );
}
