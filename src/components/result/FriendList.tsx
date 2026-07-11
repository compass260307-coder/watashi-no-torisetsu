// 総合ページ /tako の「友達一覧」。評価してくれた全員 (メッセージ有無問わず) を
// 相互理解度の高い順に並べる。旧「友達からの声」の格上げ版。
// アイコンは実アバターが無いため、ニックネーム頭文字の淡色プレースホルダで代用。
//
// PR3: タップ挙動を課金状態で出し分ける。
//   - 課金済(full): 本人向け個別ページ (/tako/[token]/friend/[perceptionId]) へ遷移。
//   - 未課金:       遷移せず、同ページ最下部の課金案内カードへスライド (scrollToPaywall)。
//     カード自体はぼかさない (メッセージ/名前は無料の引きとして見せる)。

"use client";

import Link from "next/link";
import type { FriendSummary } from "@/lib/owner-report-data";
import { scrollToPaywall } from "@/lib/scroll-to-paywall";

// 頭文字プレースホルダの淡色トーン (/me・/tako パレット内で循環)。
const AVATAR_TONES = [
  { bg: "#EAF6FA", fg: "#3D9DB1" }, // 海
  { bg: "#FBF4DA", fg: "#C4A83F" }, // 空
  { bg: "#EAF6E5", fg: "#6DAA50" }, // 陸
  { bg: "#F4F4FE", fg: "#5B5BEF" }, // ラベンダー
] as const;

export function FriendList({
  friends,
  token,
  hasFullAccess,
}: {
  friends: FriendSummary[];
  token: string;
  /** 閲覧者(本人)が全解放済みか。false のときタップは課金カードへスライド。 */
  hasFullAccess: boolean;
}) {
  if (friends.length === 0) return null;

  return (
    <section>
      <ul className="flex flex-col gap-2">
        {friends.map((f, i) => {
          const tone = AVATAR_TONES[i % AVATAR_TONES.length];
          const initial = (f.name.trim()[0] ?? "友").toUpperCase();
          const cardClass =
            "flex w-full items-center gap-3 rounded-2xl bg-white border-2 border-[#0094D8]/15 px-4 py-3 text-left hover:bg-[#F4F4FE] transition-colors";
          const inner = (
            <>
              <span
                aria-hidden="true"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-black text-lg"
                style={{ background: tone.bg, color: tone.fg }}
              >
                {initial}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[#2E2E5C] font-black text-[15px] truncate">
                    {f.name}
                  </span>
                  {f.hasMessage && (
                    <span className="flex-shrink-0 rounded-full bg-[#F4F4FE] text-[#5B5BEF] font-bold text-[10px] px-2 py-0.5">
                      メッセージあり
                    </span>
                  )}
                </span>
                {/* メッセージあり: 本文を1行チラ見せ (途中カット・…省略。全文は個別ページ)。
                    メッセージ無し: 従来どおり相互理解度。 */}
                {f.hasMessage ? (
                  <span className="block text-[#2E2E5C]/70 font-bold text-xs truncate">
                    {f.message}
                  </span>
                ) : (
                  <span className="block text-[#2E2E5C]/55 font-bold text-xs">
                    見方の一致 {f.mutual}%
                  </span>
                )}
              </span>
              <span
                aria-hidden="true"
                className="flex-shrink-0 text-[#5B5BEF] font-black"
              >
                →
              </span>
            </>
          );
          return (
            <li key={f.perceptionId}>
              {hasFullAccess ? (
                <Link
                  href={`/tako/${token}/friend/${f.perceptionId}`}
                  className={cardClass}
                >
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={scrollToPaywall} className={cardClass}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
