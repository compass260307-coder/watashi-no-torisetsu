// 他己診断 (タコ診断) 結果ページ /tako/[token]。
//   owner_token でアクセス (自己 /me/[token] と対)。
//   /me から切り出した「友達が見た自分」パートを集約:
//     友達平均キャラ / 自己認知ギャップバー / みんなの目(B-1) / 他者評価 / 招待。
//   友達の回答が 3人 (REPORT_FRIEND_THRESHOLD) 未満なら TakoLockedState (ロック空状態)。

import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  loadOwnerReportData,
  type OwnerReportData,
} from "@/lib/owner-report-data";
import { computeMinnaNoMeContext } from "@/lib/minna-no-me";
import { buildDeepDive } from "@/lib/tako-deepdive";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { ResultHero } from "@/components/result/ResultHero";
import { heroColorsForGroup } from "@/lib/hero-colors";
import TopHeader from "@/components/top/TopHeader";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { TakoDeepDive } from "@/components/result/TakoDeepDive";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoLockedState } from "@/components/result/TakoLockedState";
import { BragShare } from "@/components/result/BragShare";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoCatchphrase,
  thirtyTwoGroup,
  thirtyTwoName,
  thirtyTwoImagePath,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { preferCutImage } from "@/lib/character-image";
import { classifySixteenType, sixteenTypes } from "@/lib/sixteen-types";
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import type { BigFiveDimension } from "@/lib/types";

const SITE_URL =
  resolveSiteUrl();

export const metadata: Metadata = {
  // owner_token は推測不可だが、検索エンジン除外で誤共有時の漏洩経路を絞る (/me と同方針)。
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// ?previewType=<32タイプID> 指定時のモック解除後データ (dev / fromPreview=1 のみ)。実DBは介さない。
// /me のプレビュー機構と同型。実 compute 関数を流用して現実的な描画にする。
function mockTakoData(previewType: ThirtyTwoTypeId): OwnerReportData {
  const code = sixteenTypes[baseIdOf(previewType)].code;
  const hi = (ax: string) => (code.includes(`${ax}＋`) ? 8 : 2);
  const selfScores = {
    O: hi("O"),
    C: hi("C"),
    E: hi("E"),
    A: hi("A"),
    N: nAxisOf(previewType) === "N" ? 8 : 2,
  };
  // 友達3人: 本人スコアを少しずらして「自己認知ギャップ」が見えるように。
  const shifts: Record<string, number>[] = [
    { E: 2, O: -2 },
    { E: 1, A: 1 },
    { E: 3, N: -2 },
  ];
  const clamp = (v: number) => Math.max(0, Math.min(10, v));
  const friends = shifts.map((s, i) => ({
    name: ["ゆい", "そら", "はる"][i],
    perceivedScores: Object.fromEntries(
      (["O", "C", "E", "A", "N"] as const).map((k) => [
        k,
        clamp(selfScores[k] + (s[k] ?? 0)),
      ]),
    ) as Record<string, number>,
    qualitative: null,
  }));
  const friendAvgScores = Object.fromEntries(
    (["O", "C", "E", "A", "N"] as const).map((k) => [
      k,
      friends.reduce((a, f) => a + (f.perceivedScores[k] as number), 0) /
        friends.length,
    ]),
  ) as Partial<Record<BigFiveDimension, number>>;
  const t = classifyThirtyTwoType(friendAvgScores);
  return {
    user: {
      id: "preview",
      type_id: null,
      scores: selfScores,
      display_name: "プレビュー",
      invite_code: "preview",
      owner_token: "preview",
    },
    selfScores,
    friendEvalCount: friends.length,
    friendAvgScores,
    friendNames: friends.map((f) => f.name),
    friendMessages: [
      { name: "ゆい", message: "いつも冷静で頼れる。周りをよく見てるよね。" },
      { name: "そら", message: "自分の考えをちゃんと持ってて素敵だと思う！" },
    ],
    friends: friends
      .map((f, i) => {
        const message =
          f.name === "ゆい"
            ? "いつも冷静で頼れる。周りをよく見てるよね。会うたびに落ち着くわ〜"
            : f.name === "そら"
              ? "自分の考えをちゃんと持ってて素敵だと思う！"
              : "";
        return {
          perceptionId: `preview-${i}`,
          name: f.name,
          perceivedScores: f.perceivedScores as Partial<
            Record<BigFiveDimension, number>
          >,
          mutual: calcMutualUnderstanding(
            buildDimensionGaps(selfScores, f.perceivedScores as BigFiveScores),
          ),
          hasMessage: message.length > 0,
          message,
        };
      })
      .sort((a, b) => b.mutual - a.mutual),
    minnaContext: computeMinnaNoMeContext({ selfScores, friends }),
    inviteCode: "preview",
    inviteUrl: `${SITE_URL}/friend/preview`,
    threshold: 3,
    unlocked: true,
    friendCharacter: {
      type32: t,
      essence: thirtyTwoEssence(t),
      name: thirtyTwoName(t),
      imageSrc: preferCutImage(thirtyTwoImagePath(t)),
      previewPath: `/preview/${t}`,
    },
  };
}

export default async function TakoPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  const data = previewType
    ? mockTakoData(previewType)
    : await loadOwnerReportData(token);
  if (!data) {
    notFound();
  }

  // 拡散シェア (従) 用の自己タイプ素材。/me と同じく selfScores から決定的に導出。
  //   称号・キャッチ = 自己タイプ (32/16 フラグ準拠)、code = OCEAN 高低の大小文字表記。
  const bragStored = data.selfScores;
  const bragFlag32 = isThirtyTwoEnabled();
  const bragT32 = classifyThirtyTwoType(bragStored);
  const bragS16 = classifySixteenType(bragStored);
  const bragEssence = bragFlag32
    ? thirtyTwoEssence(bragT32)
    : sixteenTypes[bragS16].essence;
  const bragCatch = bragFlag32
    ? thirtyTwoCatchphrase(bragT32)
    : sixteenTypes[bragS16].oneLiner;
  const bragCode = (["O", "C", "E", "A", "N"] as BigFiveDimension[])
    .map((k) =>
      (typeof bragStored[k] === "number" ? (bragStored[k] as number) : 5) >= 5
        ? k
        : k.toLowerCase(),
    )
    .join("");

  // 解除後ヒーロー用: 友達平均キャラのグループから帯トーンを解決 (/me と共通)。
  const takoHero = data.friendCharacter
    ? heroColorsForGroup(thirtyTwoGroup(data.friendCharacter.type32))
    : null;

  // ② 深掘りの自動生成データ (一致度・ギャップ・隠れた長所)。友達平均が無ければ null。
  const deep = buildDeepDive(data.selfScores, data.friendAvgScores);

  return (
    <>
      {/* 自己診断と同じ 16P 風スクロール連動ヘッダー (世界観統一) */}
      <ScrollHideHeader>
        <TopHeader />
      </ScrollHideHeader>
      <main
        className="relative min-h-dvh overflow-x-clip px-4 pb-8 md:px-8"
        style={{ background: "#FFFFFF" }}
      >
        <div className="relative z-10 mx-auto max-w-[560px]">
          {!data.unlocked ||
          !data.minnaContext ||
          !data.friendCharacter ||
          !takoHero ? (
            /* ===== ロック空状態 (友達3人未満) ===== */
            <div className="pt-6">
              <Link
                href={`/me/${token}`}
                className="inline-flex items-center gap-1 text-[#2A3A5C]/70 font-bold text-sm hover:text-[#2A3A5C] transition-colors mb-5"
              >
                ← 自分のトリセツに戻る
              </Link>
              <TakoLockedState
                friendCount={data.friendEvalCount}
                threshold={data.threshold}
                inviteUrl={data.inviteUrl}
              />
            </div>
          ) : (
            /* ===== 解除後: 他己コンテンツ (自己診断と同じ世界観) ===== */
            <>
              {/* 戻り導線 + 友達平均コンテキスト (ヒーロー上のスリムなキャプション) */}
              <div className="pt-4">
                <Link
                  href={`/me/${token}`}
                  className="inline-flex items-center gap-1 text-[#2A3A5C]/70 font-bold text-sm hover:text-[#2A3A5C] transition-colors"
                >
                  ← 自分のトリセツに戻る
                </Link>
                <p className="mt-2 text-center text-[#2A3A5C]/70 font-bold text-xs">
                  友達 {data.friendEvalCount} 人の平均から
                </p>
              </div>

              {/* ヒーロー帯 (/me と同じ ResultHero・色帯 (a))。他己は単カラム縦積み・本文幅560。
                  称号=友達平均キャラ / OCEAN=友達平均スコア。 */}
              <ResultHero
                label="みんなから見たあなたは:"
                essence={data.friendCharacter.essence}
                scores={data.friendAvgScores ?? {}}
                heroBg={takoHero.heroBg}
                codeTint={takoHero.codeTint}
                imageSrc={data.friendCharacter.imageSrc}
                alt={data.friendCharacter.essence}
                name={data.friendCharacter.name}
                imageAspectClassName="aspect-square max-h-[44vh] md:max-h-[360px]"
                contentMaxWidthClass="max-w-[560px]"
                twoColumn={false}
              />

              <section className="mb-8">
                <div className="text-center pt-4">
                  <Link
                    href={data.friendCharacter.previewPath}
                    className="inline-block rounded-full border-2 border-[#2A3A5C] text-[#2A3A5C] font-black text-sm px-5 py-2 hover:bg-[#2A3A5C]/5 transition-colors"
                  >
                    このタイプを詳しく見る →
                  </Link>
                </div>
              </section>

            {/* ① 五つの性格傾向 (発散バー: 自己 × 友達ギャップ)。/me の①と同じ丸数字見出し。 */}
            <section className="mb-14">
              <BigFiveDivergingBars
                scores={data.selfScores}
                friendScores={data.friendAvgScores ?? undefined}
                title="五つの性格傾向"
                number="1"
              />
            </section>

            {/* ② アナタの深掘り (一致度 → ギャップ → AI解説 → 友達の声 → 隠れた長所)。
                みんなの目 + 他者評価を統合。/me の丸数字見出しスタイルに準拠。 */}
            {deep && (
              <section className="mb-14">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                  >
                    2
                  </span>
                  <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                    アナタの深掘り
                  </h2>
                </div>
                <TakoDeepDive
                  deep={deep}
                  friends={data.friends}
                  token={token}
                  ownerToken={token}
                />
              </section>
            )}

            {/* ③ 友達にシェア (拡散シェア + もっと友達に診断してもらう招待)。 */}
            <section className="mb-6">
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                >
                  3
                </span>
                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                  友達にシェア
                </h2>
              </div>

              {/* 拡散シェア。source="tako" で結果ページ発と測り分け。 */}
              <BragShare
                essence={bragEssence}
                code={bragCode}
                catchphrase={bragCatch}
                topUrl={`${SITE_URL}/`}
                source="tako"
              />

              {/* もっと友達に診断してもらう招待。source="tako_unlocked" で計測。 */}
              <div className="mt-8">
                <p className="text-center text-[#2A3A5C] font-black text-sm mb-3">
                  もっと友達に診断してもらう
                </p>
                <div className="mx-auto max-w-[360px]">
                  <LockedInviteShare
                    inviteUrl={data.inviteUrl}
                    trackSource="tako_unlocked"
                  />
                </div>
              </div>
            </section>
          </>
        )}

          {/* ===== フッター: 戻り ===== */}
          <div className="text-center pt-2 pb-2">
            <Link
              href={`/me/${token}`}
              className="text-[#2A3A5C]/60 font-bold text-sm underline hover:text-[#2A3A5C] transition-colors"
            >
              自分のトリセツに戻る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
