// 他己診断 (タコ診断) 結果ページ /tako/[token]。
//   owner_token でアクセス (自己 /me/[token] と対)。
//   /me から切り出した「友達が見た自分」パートを集約:
//     友達平均キャラ / 自己認知ギャップバー / みんなの目(B-1) / 他者評価 / 招待。
//   友達の回答が 3人 (REPORT_FRIEND_THRESHOLD) 未満なら TakoLockedState (ロック空状態)。

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { loadOwnerReportData } from "@/lib/owner-report-data";
import { scoreImpressionLine } from "@/lib/minna-no-me";
import { CharacterHero } from "@/components/result/CharacterHero";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { MinnaNoMePanel } from "@/components/result/MinnaNoMePanel";
import { OthersPerceptionSection } from "@/components/result/OthersPerceptionSection";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoLockedState } from "@/components/result/TakoLockedState";
import { BragShare } from "@/components/result/BragShare";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoCatchphrase,
} from "@/lib/thirty-two-types";
import { classifySixteenType, sixteenTypes } from "@/lib/sixteen-types";
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import type { BigFiveDimension } from "@/lib/types";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.watashi-torisetsu.com";

export const metadata: Metadata = {
  // owner_token は推測不可だが、検索エンジン除外で誤共有時の漏洩経路を絞る (/me と同方針)。
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TakoPage({ params }: PageProps) {
  const { token } = await params;

  const data = await loadOwnerReportData(token);
  if (!data) {
    notFound();
  }

  const session = await getSession();
  const isOwner = !!session && session.id === data.user.id;
  const ownerName = (data.user.display_name ?? "").trim() || "あなた";

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

  return (
    <main
      className="relative min-h-dvh px-4 pb-8 md:px-8"
      style={{ background: "#E4E0F5" }}
    >
      <div className="relative z-10 mx-auto max-w-[560px] pt-6">
        {/* ===== ヘッダー: 戻り導線 + タイトル ===== */}
        <div className="mb-5">
          <Link
            href={`/me/${token}`}
            className="inline-flex items-center gap-1 text-[#2A3A5C]/70 font-bold text-sm hover:text-[#2A3A5C] transition-colors"
          >
            ← 自分のトリセツに戻る
          </Link>
          <h1 className="mt-3 text-[#2A3A5C] font-black text-2xl leading-tight">
            みんなの目に映る、{ownerName}
          </h1>
          <p className="mt-1 text-[#2A3A5C]/70 font-bold text-sm">
            他己診断（タコ診断）— 友達から見たあなた
          </p>
        </div>

        {!data.unlocked || !data.minnaContext || !data.friendCharacter ? (
          /* ===== ロック空状態 (友達3人未満) ===== */
          <TakoLockedState
            friendCount={data.friendEvalCount}
            threshold={data.threshold}
            inviteUrl={data.inviteUrl}
          />
        ) : (
          /* ===== 解除後: 他己コンテンツ ===== */
          <>
            {/* 友達平均から算出したキャラ */}
            <section className="mb-8">
              <p className="text-center text-[#2A3A5C]/70 font-bold text-xs mb-1">
                友達 {data.friendEvalCount} 人の平均から
              </p>
              <div className="mx-auto max-w-[420px]">
                <CharacterHero
                  imageSrc={data.friendCharacter.imageSrc}
                  alt={data.friendCharacter.essence}
                  essence={data.friendCharacter.essence}
                  name={data.friendCharacter.name}
                  description={`みんなから見たあなたは「${data.friendCharacter.essence}」タイプ。`}
                  imageAspectClassName="aspect-square max-h-[44vh] md:max-h-[360px]"
                  imageFitClassName="object-contain"
                  imageCardClassName=""
                />
              </div>
              <div className="text-center">
                <Link
                  href={data.friendCharacter.previewPath}
                  className="inline-block rounded-full border-2 border-[#2A3A5C] text-[#2A3A5C] font-black text-sm px-5 py-2 hover:bg-white/60 transition-colors"
                >
                  このタイプを詳しく見る →
                </Link>
              </div>
            </section>

            {/* 自己認知ギャップ (自分 × 友達) */}
            <section className="mb-8">
              <BigFiveDivergingBars
                scores={data.selfScores}
                friendScores={data.friendAvgScores ?? undefined}
                title="自己認知ギャップ（自分 × 友達）"
                emoji="🪞"
              />
            </section>

            {/* みんなの目 (別タイプ・解説文・手紙 / B-1) */}
            <section className="mb-8">
              <h2 className="text-[#2A3A5C] font-black text-xl mb-3">みんなの目</h2>
              <MinnaNoMePanel
                ownerToken={token}
                selfEssence={data.minnaContext.selfEssence}
                friendEssence={data.minnaContext.friendEssence}
                friendTypeName={data.minnaContext.friendTypeName}
                friendPreviewPath={data.minnaContext.friendPreviewPath}
                matched={data.minnaContext.matched}
                gapSentence={data.minnaContext.gapSentence}
                favoritePoints={data.minnaContext.favoritePoints}
                letters={data.friendMessages}
                scoreImpression={scoreImpressionLine(
                  data.minnaContext.friendAvgScores,
                )}
              />
            </section>

            {/* 従: 診断拡散シェア (みんなの目を見終わった余韻の位置)。
                アンロック状態のみ。評価依頼(主)の役目が終わった画面なので従を置いても
                主とバッティングしない。source="tako" で結果ページ発と測り分け。 */}
            <BragShare
              essence={bragEssence}
              code={bragCode}
              catchphrase={bragCatch}
              topUrl={`${SITE_URL}/`}
              source="tako"
            />

            {/* 他者評価 (発散/隠れた強み/評価者/メッセージ) */}
            <section className="mb-8">
              <OthersPerceptionSection
                friendCount={data.friendEvalCount}
                threshold={data.threshold}
                isOwner={isOwner}
                selfScores={data.selfScores}
                friendAvgScores={data.friendAvgScores}
                friendNames={data.friendNames}
                friendMessages={data.friendMessages}
                inviteUrl={data.inviteUrl}
              />
            </section>

            {/* 招待 / もっと友達に診断してもらう */}
            <section className="mb-6">
              <p className="text-center text-[#2A3A5C] font-black text-sm mb-3">
                もっと友達に診断してもらう
              </p>
              <div className="mx-auto max-w-[360px]">
                {/* アンロック後のA招待。従シェア(source: result/tako)と並べて
                    分析するため source="tako_unlocked" で計測 (kind: friend_invite)。 */}
                <LockedInviteShare
                  inviteUrl={data.inviteUrl}
                  trackSource="tako_unlocked"
                />
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
  );
}
