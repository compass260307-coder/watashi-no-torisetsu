// 他己診断 (タコ診断) 結果ページ /tako/[token]。
//   owner_token でアクセス (自己 /me/[token] と対)。
//   /me から切り出した「友達が見た自分」パートを集約:
//     友達平均キャラ / 自己認知ギャップバー / みんなの目(B-1) / 他者評価 / 招待。
//   友達の回答が 3人 (REPORT_FRIEND_THRESHOLD) 未満なら TakoLockedState (ロック空状態)。

import type { Metadata } from "next";
import { resolveSiteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import {
  loadOwnerReportData,
  type OwnerReportData,
} from "@/lib/owner-report-data";
import { computeMinnaNoMeContext } from "@/lib/minna-no-me";
import { buildDeepDive, buildMinnaProse } from "@/lib/tako-deepdive";
import {
  buildDimensionGaps,
  calcMutualUnderstanding,
  type BigFiveScores,
} from "@/lib/perception-analysis";
import { ResultHero } from "@/components/result/ResultHero";
import { heroColorsForGroup } from "@/lib/hero-colors";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { MinnaTypeProse } from "@/components/result/MinnaTypeProse";
import { FriendList } from "@/components/result/FriendList";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { hasFullAccess } from "@/lib/entitlements";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoLockedState } from "@/components/result/TakoLockedState";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoName,
  thirtyTwoImagePath,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { preferCutImage, sceneImageForGroup } from "@/lib/character-image";
import { sixteenTypes } from "@/lib/sixteen-types";
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

// ?previewLocked=1 用: 解放前 (友達 threshold 未満) のモック。実DBは介さない。
// friends は 0..threshold-1 にクランプ (進捗ドット確認用)。
function mockLockedTakoData(friends: number): OwnerReportData {
  const threshold = 3;
  const count = Math.max(0, Math.min(threshold - 1, Math.floor(friends || 0)));
  return {
    user: {
      id: "preview",
      type_id: null,
      scores: {},
      display_name: "プレビュー",
      invite_code: "preview",
      owner_token: "preview",
    },
    selfScores: {},
    friendEvalCount: count,
    friendAvgScores: null,
    friendNames: [],
    friendMessages: [],
    friends: [],
    minnaContext: null,
    inviteCode: "preview",
    inviteUrl: `${SITE_URL}/friend/preview`,
    threshold,
    unlocked: false,
    friendCharacter: null,
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

  // ?previewLocked=1 (任意 &friends=N): 解放前 (ロック空状態) のモック。dev / fromPreview=1 のみ。
  // 友達 friends 人 (0..threshold-1) の未達データを組み立て、TakoLockedState を描画させる。
  const previewLocked = previewAllowed && sp.previewLocked === "1";

  const data = previewType
    ? mockTakoData(previewType)
    : previewLocked
      ? mockLockedTakoData(
          typeof sp.friends === "string" ? Number(sp.friends) : 0,
        )
      : await loadOwnerReportData(token);
  if (!data) {
    notFound();
  }

  // PR3: 閲覧者(本人)が全解放済みか。未課金なら友達カードのタップは課金カードへスライドし、
  // 最下部に課金案内カードを出す。preview は常に未課金扱い (ロックUIを確認できるように)。
  const takoFull =
    previewType || previewLocked
      ? false
      : await hasFullAccess(data.user.id as string);

  // 解除後ヒーロー用: 友達平均キャラのグループから帯トーンを解決 (/me と共通)。
  const takoHero = data.friendCharacter
    ? heroColorsForGroup(thirtyTwoGroup(data.friendCharacter.type32))
    : null;

  // ロック空状態 (友達3人未満=未達成) か。下の描画分岐と同条件。
  // 課金カード上のセクションタイトルは、この未達成ページでのみ出す (完成ページには出さない)。
  const isTakoLocked =
    !data.unlocked ||
    !data.minnaContext ||
    !data.friendCharacter ||
    !takoHero;

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
        <div className="relative z-10">
          {!data.unlocked ||
          !data.minnaContext ||
          !data.friendCharacter ||
          !takoHero ? (
            /* ===== ロック空状態 (友達3人未満)。本文幅は /me・フッターと統一 (1080)。 ===== */
            <div className="mx-auto max-w-[1080px] pt-6">
              <TakoLockedState
                friendCount={data.friendEvalCount}
                threshold={data.threshold}
                inviteUrl={data.inviteUrl}
              />
            </div>
          ) : (
            /* ===== 解除後: 他己コンテンツ (自己診断と同じ世界観)。本文幅は /me・フッターと統一 (1080)。 ===== */
            <div className="mx-auto max-w-[1080px]">
              {/* ヒーロー帯 (/me と同じ ResultHero・色帯 (a))。自己診断と同じ 2カラム・本文幅1080・
                  大きめキャラ (ResultHero 既定) にそろえる。称号=友達平均キャラ / OCEAN=友達平均スコア。 */}
              <ResultHero
                label="みんなから見たあなたは:"
                essence={data.friendCharacter.essence}
                scores={data.friendAvgScores ?? {}}
                heroBg={takoHero.heroBg}
                codeTint={takoHero.codeTint}
                imageSrc={data.friendCharacter.imageSrc}
                alt={data.friendCharacter.essence}
                name={data.friendCharacter.name}
              />

            {/* ① みんなの目に映るあなた (友達平均キャラの自己診断本文を他己視点に再構成)。 */}
            <section className="mb-14">
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                >
                  1
                </span>
                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                  みんなの目に映るあなた
                </h2>
              </div>
              <MinnaTypeProse
                type32={data.friendCharacter.type32}
                essence={data.friendCharacter.essence}
              />
            </section>

            {/* ② 自分とのギャップ (五つの性格傾向バー ●友達/◆自分 → 一番のギャップ → 解説)。 */}
            <section className="mb-14">
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                >
                  2
                </span>
                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                  自分とのギャップ
                </h2>
              </div>

              {/* 順番: ① 一番のギャップ (見せ場カード) → ② グラフ → ③ 本文 (固定テンプレ)。 */}

              {/* ① 一番のギャップ (唯一の見せ場・淡ラベンダーカード) */}
              {deep && (
                <div className="mb-10 rounded-3xl bg-[#F4F4FE] px-6 py-7">
                  <p className="text-[#2E2E5C] font-black text-[22px] leading-[1.35] md:text-[26px]">
                    一番のギャップは{deep.gap.label}。自分では
                    <span className="text-[#5B5BEF]">
                      {deep.gap.selfPercent <= 10
                        ? "ほぼゼロ"
                        : `${deep.gap.selfPercent}%`}
                    </span>
                    、でも友達は
                    <span className="text-[#5B5BEF]">{deep.gap.otherPercent}%</span>
                    感じてる。
                  </p>
                </div>
              )}

              {/* ② 五つの性格傾向バー: 主ノブ(●)=友達平均 / ◆=自分の自己診断を重ねギャップを可視化。
                  見出しは上の②に集約するため hideHeading。 */}
              <BigFiveDivergingBars
                scores={data.friendAvgScores ?? {}}
                friendScores={data.selfScores}
                primaryLabel="みんなの目"
                friendLabel="自分の診断"
                hideHeading
              />

              {/* ③ 本文 (AI ではなく deep から決定的に組み立てた固定テンプレ buildMinnaProse)。 */}
              {deep && (
                <div>
                  {buildMinnaProse(deep).map((para, i) => (
                    <p
                      key={i}
                      className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              )}
            </section>

            {/* ③ 友達からの回答 (評価してくれた友達一覧・個別ページ導線)。 */}
            <section className="mb-14">
              <div className="mb-4 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                >
                  3
                </span>
                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                  友達からの回答
                </h2>
              </div>
              <FriendList
                friends={data.friends}
                token={token}
                hasFullAccess={takoFull}
              />
            </section>

            </div>
        )}
        </div>
      </main>
      {/* PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。未課金時のみ。
          友達キャラの画像・グループ色を渡して MBTI 風カードで表示 (無ければ既定)。 */}
      {(() => {
        if (takoFull) return null;
        // カードのグループ (色・装飾・シーン画像)。友達平均キャラのグループ。
        const promoGroup = data.friendCharacter
          ? thirtyTwoGroup(data.friendCharacter.type32)
          : "unknown";
        return (
          <>
            {/* /tako 専用: 課金カードの上に中央寄せのセクションタイトル。
                未達成 (ロック空状態) ページのみ表示。完成した結果ページには出さない。 */}
            {isTakoLocked && (
              <div className="mx-auto max-w-[1080px] px-4 pt-3 text-left md:px-8 md:pt-5 md:text-center">
                <h2 className="text-[26px] font-black leading-[1.35] text-[#2E2E5C] md:text-[34px]">
                  トリセツを完成させよう
                </h2>
                {/* PC は1行 (whitespace-nowrap)、SP は自然折り返し。 */}
                <p className="mx-auto mt-3 max-w-[560px] text-[14px] font-bold leading-[1.7] text-[#8A8AA3] md:max-w-none md:whitespace-nowrap md:text-[15px]">
                  友達ひとりずつの本音も、自分の深掘りも。この先ぜんぶ、読めるようになります。
                </p>
              </div>
            )}
            <FullAccessPromoCard
              ownerToken={token}
              // /me のカードと同じグループ別シーン挿絵 (無ければキャラ画像にフォールバック)。
              imageSrc={
                sceneImageForGroup(promoGroup, "work") ??
                sceneImageForGroup(promoGroup, "normal1") ??
                data.friendCharacter?.imageSrc
              }
              imageAlt={data.friendCharacter?.essence ?? ""}
              group={promoGroup}
            />
          </>
        );
      })()}
      {/* 友達にシェア (もっと友達に診断してもらう招待)。課金カードの下に配置。
          解除後 (!isTakoLocked) のみ表示。main 外に出したため 1080 幅コンテナを自前で付ける。 */}
      {!isTakoLocked && (
        <section className="mx-auto max-w-[1080px] px-4 pb-6 md:px-8">
          {/* もっと友達に診断してもらう招待。完了前ページ (TakoLockedState) の「結果解放帯」と
              同じ作り: 背景帯 #EDEFFB + 2カラム (左=見出し/サブ, 右=招待カード compact)。
              source="tako_unlocked" で計測。 */}
          <div
            className="rounded-3xl p-6 md:px-9 md:py-7"
            style={{ background: "#EDEFFB" }}
          >
            <div className="md:flex md:items-center md:gap-9 lg:gap-12">
              {/* 左: 見出し + サブ (色は TakoLockedState と同じ NAVY / INACTIVE) */}
              <div className="md:flex-1">
                <h3
                  className="text-[22px] font-black leading-[1.45] md:text-[26px] md:leading-[1.4]"
                  style={{ color: "#2E2E5C" }}
                >
                  もっと友達に聞くと、
                  <br className="hidden md:block" />
                  新しい自分が見えてくる。
                </h3>
                <p
                  className="mt-2.5 text-[12.5px] font-bold md:text-sm"
                  style={{ color: "#9BA3B4" }}
                >
                  答えてくれる友達が増えるほど、深掘りの精度も上がるよ
                </p>
              </div>
              {/* 右: 招待 (QR + シェア) */}
              <div className="mt-5 md:mt-0 md:w-[38%] md:max-w-[360px] md:shrink-0">
                <LockedInviteShare
                  inviteUrl={data.inviteUrl}
                  trackSource="tako_unlocked"
                  compact
                />
              </div>
            </div>
          </div>
        </section>
      )}
      {/* サイト共通フッター (トップ / /me / /types / /about と同じ) */}
      <TopFooter />
    </>
  );
}
