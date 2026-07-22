// 友達診断 (タコ診断) 結果ページ /tako/[token]。
//   owner_token でアクセス (自己 /me/[token] と対)。
//   /me から切り出した「友達が見た自分」パートを集約:
//     友達平均キャラ / 自己認知ギャップバー / みんなの目(B-1) / 他者評価 / 招待。
//   友達の回答が 3人 (REPORT_FRIEND_THRESHOLD) 未満なら TakoLockedState (ロック空状態)。

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { resolveSiteUrl } from "@/lib/site-url";
import { notFound } from "next/navigation";
import {
  loadOwnerReportData,
  type OwnerReportData,
} from "@/lib/owner-report-data";
import { mockTakoData } from "@/lib/tako-mock";
import { buildDeepDive, estimateCompatFromGaps } from "@/lib/tako-deepdive";
import { ResultHero } from "@/components/result/ResultHero";
import { heroColorsForGroup } from "@/lib/hero-colors";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { MeStickyHeader } from "@/components/result/MeStickyHeader";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import {
  MinnaTypeProse,
  sceneImageFor,
} from "@/components/result/MinnaTypeProse";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { TakoFriendTabs } from "@/components/result/TakoFriendTabs";
import { REPORT_FRIEND_THRESHOLD } from "@/lib/report-data";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoLockedState } from "@/components/result/TakoLockedState";
import { FriendLoveSection } from "@/components/result/FriendLoveSection";
import { TakoViewTracker } from "@/components/result/TakoViewTracker";
import { TakoLockedBlock } from "@/components/result/TakoLockedBlock";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { PaywallModal } from "@/components/result/PaywallModal";
import { hasTakoAccess } from "@/lib/entitlements";
import {
  resolveFriendLove,
  resolveFriendLoveChecklist,
  resolveLoveScene,
  resolveMoteHints,
} from "@/lib/friend-love-content";
import { LOVE_BY_TYPE_32 } from "@/lib/love-by-type-32";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoName,
  thirtyTwoImagePath,
  baseIdOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import {
  preferCutImage,
  preferFaceImage,
  sceneImageForGroup,
} from "@/lib/character-image";
import characterImages from "@/generated/character-images.json";
import { sixteenTypes } from "@/lib/sixteen-types";

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

// ?previewLocked=1 用: 解放前 (友達 threshold 未満) のモック。実DBは介さない。
// &friends=N (answered 人数 0..threshold-1) と &pending=M (診断中) でゲートの各状態を確認できる。
// answered には実キャラ画像 (その友達から見たあなた) を割り当て、スロットの“顔”を再現する。
const MOCK_ANSWERED: {
  name: string;
  type32: ThirtyTwoTypeId;
  ownType32: ThirtyTwoTypeId;
}[] = [
  {
    name: "ゆい",
    type32: "sparkle-dolphin__N" as ThirtyTwoTypeId,
    ownType32: "whim-fox__N" as ThirtyTwoTypeId,
  },
  {
    name: "そら",
    type32: "smiley-panda__N" as ThirtyTwoTypeId,
    ownType32: "quiet-owl__N" as ThirtyTwoTypeId,
  },
];

// &diag=N: 先頭 N 人の answered 友達を「自己診断済み(Path1)」として扱う (相性ループ確認用)。
function mockLockedTakoData(
  friends: number,
  pending: number,
  diag: number,
): OwnerReportData {
  const threshold = REPORT_FRIEND_THRESHOLD;
  const count = Math.max(0, Math.min(threshold - 1, Math.floor(friends || 0)));
  const diagCount = Math.max(0, Math.min(count, Math.floor(diag || 0)));
  const mockFriends = Array.from({ length: count }, (_, i) => {
    const m = MOCK_ANSWERED[i % MOCK_ANSWERED.length];
    const valid = sixteenTypes[baseIdOf(m.type32)];
    const isDiagnosed = i < diagCount;
    return {
      perceptionId: `preview-${i}`,
      name: m.name,
      perceivedScores: {},
      mutual: 0,
      hasMessage: false,
      message: "",
      perceivedType32: valid ? m.type32 : null,
      perceivedImageSrc: valid
        ? preferCutImage(thirtyTwoImagePath(m.type32))
        : null,
      perceiverUserId: isDiagnosed ? `preview-user-${i}` : null,
      friendOwnType32: isDiagnosed ? m.ownType32 : null,
    };
  });
  const pendingCount = Math.max(
    0,
    Math.min(threshold - count, Math.floor(pending || 0)),
  );
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
    friends: mockFriends,
    minnaContext: null,
    pendingFriendCount: pendingCount,
    inviteCode: "preview",
    inviteUrl: `${SITE_URL}/friend/preview`,
    threshold,
    unlocked: false,
    friendCharacter: null,
    ownerType32: "idea-monkey__R" as ThirtyTwoTypeId,
  };
}

// 再訪リビール(②)の既読 cookie (tako_ls = {"s":scope,"n":lastSeen})。
// サーバで読んで「旧状態」を初期HTMLにレンダリングすることで、SSRフラッシュ(最終値の
// 一瞬露出)を原理的に無くす。スコープ不一致(別レポート)は安全側で null (誤発火させない)。
function readLastSeenCookie(raw: string | undefined, scope: string): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as {
      s?: unknown;
      n?: unknown;
    };
    if (parsed.s !== scope) return null;
    const n =
      typeof parsed.n === "number" ? parsed.n : Number.parseInt(String(parsed.n), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
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
          typeof sp.pending === "string" ? Number(sp.pending) : 0,
          typeof sp.diag === "string" ? Number(sp.diag) : 0,
        )
      : await loadOwnerReportData(token);
  if (!data) {
    notFound();
  }

  // 解除後ヒーロー用: 友達平均キャラのグループから帯トーンを解決 (/me と共通)。
  const takoHero = data.friendCharacter
    ? heroColorsForGroup(thirtyTwoGroup(data.friendCharacter.type32))
    : null;

  // ===== 友達1人ごとの結果シート (1人完結モデル 2026-07-18) =====
  // 平均 (みんなの目) は廃止。回答した友達ごとに独立したシートをサーバで描画し、
  // TakoFriendTabs (client) は表示切替だけを行う。
  const friendSheets = data.friends.map((f) => {
    const type32 =
      f.perceivedType32 ?? classifyThirtyTwoType(f.perceivedScores);
    const essence = thirtyTwoEssence(type32);
    const imageSrc =
      f.perceivedImageSrc ?? preferCutImage(thirtyTwoImagePath(type32));
    // タブ用の顔ズーム版アバター (無ければ原画)。
    const faceSrc = preferFaceImage(thirtyTwoImagePath(type32));
    const sheetHero = heroColorsForGroup(thirtyTwoGroup(type32));
    const sheetDeep = buildDeepDive(data.selfScores, f.perceivedScores);
    const sheetLove = resolveFriendLove(f.perceivedScores);
    const sheetLoveChecks = resolveFriendLoveChecklist(f.perceivedScores);
    // 見出し・本文の「誰から見たか」。空/フォールバック名は総称「友達」に落とす。
    const rawName = f.name.trim();
    const viewer = rawName && rawName !== "ともだち" ? `${rawName}さん` : "友達";
    const sheetLoveHints = resolveMoteHints(f.perceivedScores);
    // ②恋愛のメイン本文: 認識タイプの恋愛コンテンツ (LOVE_BY_TYPE_32・全32タイプ確認済み) を
    // 「◯◯さんから見たアナタの恋は、〜」に変換して流用 (2026-07-20 リッチ化)。
    // 表示は先頭2段落 (具体的な長所の描写) だけ。3段落目以降の内省パート
    // (でも、じつは…/欠点じゃありません…) は抽象的で、下のモテポイントとも
    // 役割がかぶるため出さない (2026-07-20 指示)。
    const loveProse = (LOVE_BY_TYPE_32[type32]?.body ?? "")
      .split("\n\n")
      .filter(Boolean)
      .slice(0, 2);
    // 3段落目: モテ寄与度トップ2軸から選ぶ具体的なデートシーン (たとえば、〜)。
    const loveScene = resolveLoveScene(f.perceivedScores);
    if (loveScene) loveProse.push(loveScene);
    if (loveProse[0]?.startsWith("アナタの恋は")) {
      loveProse[0] = `${viewer}から見た${loveProse[0]}`;
    }
    return {
      key: f.perceptionId,
      tabName: rawName || "ともだち",
      faceSrc,
      message: f.message,
      viewer,
      type32,
      essence,
      imageSrc,
      hero: sheetHero,
      deep: sheetDeep,
      love: sheetLove,
      loveChecks: sheetLoveChecks,
      loveHints: sheetLoveHints,
      loveProse,
      scores: f.perceivedScores,
      // ④相性: 常に回答ギャップからの推定 (2026-07-20 指示で診断済み分岐は廃止)。
      estCompat: estimateCompatFromGaps(
        data.selfScores,
        f.perceivedScores,
        viewer,
      ),
    };
  });

  // ===== 再訪リビール(②) の SSR 初期値 =====
  // 既読 (last_seen) を preview は &lastSeen= から、本番は cookie から読む。
  // pending (server > last_seen) なら「旧状態」を初期表示にして、演出前に最終値を見せない。
  const previewMode = Boolean(previewType || previewLocked);

  // ===== 解放判定 (2026-07-22: ¥499 完全版パッケージに一本化) =====
  // 友達診断は自己診断と同じ ¥499 full_access に含まれる。hasTakoAccess は
  // full_access 保有者と旧 ¥799 購入者の両方を true にする。
  // プレビュー: &lock=1 でロック状態を確認できる (旧 &discount は廃止)。
  const takoUnlocked = previewMode
    ? sp.lock !== "1"
    : await hasTakoAccess(data.user.id as string);
  // ロック中フラグ (未購入)。ロックカードはセクション別の文言で都度生成する。
  const takoLocked = !takoUnlocked;
  const storageScope = data.user.owner_token ?? token;
  const serverAnswered = Math.min(data.friends.length, data.threshold);
  const lastSeen: number | null = previewLocked
    ? typeof sp.lastSeen === "string"
      ? Number(sp.lastSeen)
      : null
    : previewMode
      ? null
      : readLastSeenCookie((await cookies()).get("tako_ls")?.value, storageScope);
  const revealPending =
    lastSeen != null &&
    serverAnswered < data.threshold &&
    serverAnswered - lastSeen > 0;
  const ssrInitialAnswered = revealPending
    ? Math.max(0, Math.min(data.threshold, lastSeen as number))
    : serverAnswered;

  return (
    <>
      <TakoViewTracker
        ownerToken={token}
        inviteCode={data.inviteCode}
        enabled={!previewMode}
      />
      {/* /me と同じ常時表示バー付きヘッダー (シェア3ボタン + 未購入時は解除CTA)。
          解除CTAは最下部の課金カード (#tako-promo) へスクロールする。 */}
      <MeStickyHeader
        showUnlockCta={takoLocked && data.friends.length > 0}
        shareUrl={`${SITE_URL}/share/${encodeURIComponent(data.inviteCode)}`}
        essence={
          data.ownerType32 ? thirtyTwoEssence(data.ownerType32) : undefined
        }
        paywallTargetId="tako-promo"
        reportHref={
          takoUnlocked && data.friends.length > 0
            ? previewMode && previewType
              ? `/tako-report/preview/pdf?previewType=${encodeURIComponent(previewType)}`
              : `/tako-report/${encodeURIComponent(token)}/pdf`
            : undefined
        }
      >
        <TopHeader />
      </MeStickyHeader>
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
                answered={data.friends.map((f) => ({
                  perceptionId: f.perceptionId,
                  name: f.name,
                  imageSrc: f.perceivedImageSrc,
                  perceivedType32: f.perceivedType32,
                  friendOwnType32: f.friendOwnType32,
                }))}
                pendingCount={data.pendingFriendCount}
                threshold={data.threshold}
                inviteUrl={data.inviteUrl}
                storageScope={storageScope}
                ssrInitialAnswered={ssrInitialAnswered}
                previewMode={previewMode}
                previewShareMode={
                  previewMode && typeof sp.share === "string"
                    ? sp.share
                    : undefined
                }
                ownerType32={data.ownerType32}
                ownerToken={token}
                inviteCode={data.inviteCode}
                selfDiagnoseUrl={`${SITE_URL}/diagnosis?source=${encodeURIComponent(data.inviteCode)}`}
              />
            </div>
          ) : (
            /* ===== 解除後: 他己コンテンツ (自己診断と同じ世界観)。本文幅は /me・フッターと統一 (1080)。 ===== */
            <div className="mx-auto max-w-[1080px]">
              {/* 友達タブ + 友達1人ごとの結果シート (1人完結モデル)。
                  ヒーロー/本文(見出しなし)/①ギャップ/②恋愛傾向 をその友達のスコアで描画。 */}
              <TakoFriendTabs
                tabs={friendSheets.map((sh) => ({
                  name: sh.tabName,
                  imageSrc: sh.faceSrc,
                  message: sh.message,
                }))}
                invitePanel={
                  /* ＋タブの吹き出し: さらに友達に診断してもらう招待 (2026-07-20 追加)。
                     QR + X/LINE/リンクのシェアは LockedInviteShare (compact) を流用。 */
                  <div>
                    <h2 className="mb-1 text-center text-[16px] font-black leading-[1.4] text-[#2E2E5C]">
                      もっと友達に聞いてみよう
                    </h2>
                    <p className="mb-4 text-center text-[12px] font-bold leading-[1.7] text-[#8A8AA3]">
                      答えてくれた友達のぶんだけ、結果シートが増えていくよ
                    </p>
                    <LockedInviteShare
                      inviteUrl={data.inviteUrl}
                      trackSource="tako_unlocked"
                      ownerToken={token}
                      inviteCode={data.inviteCode}
                      compact
                      qrImageSrc={
                        data.ownerType32
                          ? preferFaceImage(thirtyTwoImagePath(data.ownerType32))
                          : null
                      }
                    />
                  </div>
                }
                panels={friendSheets.map((sh) => (
                  <div key={sh.key}>
                    {/* ヒーロー帯 (/me と同じ ResultHero・色帯)。称号=その友達が見たキャラ。 */}
                    <ResultHero
                      label={`${sh.viewer}から見たあなた:`}
                      essence={sh.essence}
                      scores={sh.scores}
                      heroBg={sh.hero.heroBg}
                      codeTint={sh.hero.codeTint}
                      imageSrc={sh.imageSrc}
                      alt={sh.essence}
                      name={thirtyTwoName(sh.type32)}
                    />

                    {/* 本文: 見出し・導入なしで「◯◯さんから見たアナタは〜」からいきなり始める
                        (2026-07-18 指示。/me の本文と同じ見た目)。
                        本文中間 (挿絵の直後) に「①五つの性格傾向のギャップ」グラフを差し込む
                        (2026-07-19 指示。/me の「①五つの性格傾向」と同じ構図)。 */}
                    <section className="mb-14 mt-10">
                      <MinnaTypeProse
                        type32={sh.type32}
                        viewer={sh.viewer}
                        midSlot={
                          /* ①五つの性格傾向のギャップ (2026-07-20 指示で旧③をここへ統合):
                             見出し → 一番のギャップカード → グラフ → 解説文 の順。
                             カードをグラフより上に置くため、見出しは BigFiveDivergingBars 内蔵
                             (hideHeading) ではなくここで描画する。 */
                          <>
                            <div className="mb-4 flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                              >
                                1
                              </span>
                              <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                                五つの性格傾向のギャップ
                              </h2>
                            </div>
                            {/* 一番のギャップ (唯一の見せ場・淡ラベンダーカード)。グラフの上。 */}
                            {sh.deep && (
                              <div className="mb-4 rounded-3xl bg-[#F4F4FE] px-6 py-7">
                                <p className="text-[#2E2E5C] font-black text-[22px] leading-[1.35] md:text-[26px]">
                                  一番のギャップは{sh.deep.gap.label}。自分では
                                  <span className="text-[#5B5BEF]">
                                    {sh.deep.gap.selfPercent <= 10
                                      ? "ほぼゼロ"
                                      : `${sh.deep.gap.selfPercent}%`}
                                  </span>
                                  、でも{sh.viewer}は
                                  <span className="text-[#5B5BEF]">
                                    {sh.deep.gap.otherPercent}%
                                  </span>
                                  感じてる。
                                </p>
                              </div>
                            )}
                            <BigFiveDivergingBars
                              scores={sh.scores}
                              friendScores={data.selfScores}
                              primaryLabel={`${sh.viewer}の目`}
                              friendLabel="自分の診断"
                              hideHeading
                            />
                          </>
                        }
                        afterBodySlot={
                          /* ② その友達から見た恋愛傾向 (本文の締めとクセの間。2026-07-19 指示)。
                             見出し直下に /me と同じ恋愛シーン挿絵 (love) を表示。 */
                          sh.love ? (
                            <section>
                              {/* 見出し (丸数字②・2026-07-20 指示で復活) */}
                              <div className="mb-4 flex items-center gap-3">
                                <span
                                  aria-hidden="true"
                                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                                >
                                  2
                                </span>
                                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                                  {sh.viewer}から見た恋愛傾向
                                </h2>
                              </div>
                              {sceneImageFor(sh.type32, "love") && (
                                <SmoothImage
                                  src={sceneImageFor(sh.type32, "love")!}
                                  alt=""
                                  width={960}
                                  height={640}
                                  className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
                                />
                              )}
                              {/* メイン本文: 「◯◯さんから見たアナタの恋は、〜」(認識タイプの恋愛本文) */}
                              {sh.loveProse.length > 0 && (
                                <div className="mb-10">
                                  {sh.loveProse.map((para, i) => (
                                    <p
                                      key={i}
                                      className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
                                    >
                                      {para}
                                    </p>
                                  ))}
                                </div>
                              )}
                              <FriendLoveSection
                                items={takoLocked ? [] : sh.loveChecks}
                                hints={takoLocked ? [] : sh.loveHints}
                                viewer={sh.viewer}
                                lockedBlocks={
                                  takoLocked
                                    ? {
                                        mote: (
                                          <TakoLockedBlock
                                            source="tako_mote_card"
                                            description={`完全版で、${sh.viewer}が感じているあなたのモテ理由が分かります。自分では気づいていない魅力を見てみましょう。`}
                                          />
                                        ),
                                        hints: (
                                          <TakoLockedBlock
                                            source="tako_hints_card"
                                            description={`完全版で、${sh.viewer}にもっと好かれるための具体的なヒントが読めます。`}
                                          />
                                        ),
                                      }
                                    : undefined
                                }
                              />
                            </section>
                          ) : null
                        }
                      />
                    </section>

                    {/* ④ ◯◯さんとの相性 (2026-07-20 追加)。
                        友達自身も自己診断済み (friendOwnType32 あり) なら compat() で
                        ルールベースの相性本文を表示。未診断ならティザー文のみ。 */}
                    <section className="mb-14">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                        >
                          4
                        </span>
                        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                          {sh.viewer}との相性
                        </h2>
                      </div>
                      {(() => {
                        // 2026-07-20 指示: 相性は常に「回答ギャップからの推定」のみ。
                        // 表示は /aisho のヒーロー (ピンク帯 + ランク画像 S/A/B/C) を流用。
                        const c = sh.estCompat;
                        if (!c) {
                          return (
                            <p className="body-gothic text-[17px] font-normal leading-[1.4] text-[#1A1A1A]">
                              {sh.viewer}との相性は、いま計算できなかったよ。
                            </p>
                          );
                        }
                        // manifest の ranks は拡張子なしのランク名 (例 "S")。
                        const rankImg = (
                          characterImages.ranks as string[]
                        ).includes(c.rank)
                          ? `/aisho/ranks/${c.rank}.webp`
                          : null;
                        return (
                          <div className="flex flex-col gap-10">
                            {/* ヒーロー帯 (/aisho と同じ淡ピンク2値グラデ + ランク画像)。
                                タブパネル内なので全幅ではなく角丸カードで再現。 */}
                            <div
                              className="relative overflow-hidden rounded-3xl"
                              style={{
                                background:
                                  "linear-gradient(105deg, #FAD3E3 0%, #F8C9DC 100%)",
                              }}
                            >
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 top-0 h-[160px]"
                                style={{
                                  background:
                                    "radial-gradient(ellipse at top center, rgba(255,255,255,0.28) 0%, transparent 60%)",
                                }}
                              />
                              <div className="relative flex flex-col items-center px-4 pt-7 pb-6 text-center">
                                {rankImg ? (
                                  <SmoothImage
                                    src={rankImg}
                                    alt={`相性ランク ${c.rank}`}
                                    width={512}
                                    height={512}
                                    unoptimized
                                    className="mt-3 w-full max-w-[560px] object-contain md:max-w-[640px]"
                                  />
                                ) : (
                                  <span
                                    className="mt-2 block text-[40vw] font-black leading-none md:text-[220px]"
                                    style={{ color: "#2E2E5C" }}
                                  >
                                    {c.rank}
                                  </span>
                                )}
                                <p className="mt-3 text-[12px] font-bold text-white">
                                  相性度は{c.percent}%。{sh.viewer}
                                  の回答と自己診断のギャップから推定したよ
                                </p>
                              </div>
                            </div>

                            {/* 相性の本文 (見出しなし・総評〜シーン〜締めまでひと続きの読み物。
                                組み立ては lib 側 estimateCompatFromGaps)。 */}
                            <div>
                              {c.summaryParas.map((para, i) => (
                                <p
                                  key={i}
                                  className="body-gothic mb-4 text-[17px] font-normal leading-[1.4] text-[#1A1A1A] last:mb-0"
                                >
                                  {para}
                                </p>
                              ))}
                            </div>

                            {/* 関係を深めるヒント (武器 CheckList と同じ組版・8つ) */}
                            <div>
                              <h3 className="mb-5 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
                                関係を深めるヒント
                              </h3>
                              {takoLocked && (
                                <TakoLockedBlock
                                  source="tako_kotsu_card"
                                  description={`完全版で、${sh.viewer}ともっと仲良くなるための具体的なコツを見てみましょう。`}
                                />
                              )}
                              <div
                                className={
                                  takoLocked
                                    ? "hidden"
                                    : "grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2"
                                }
                              >
                                {(takoLocked ? [] : c.kotsu).map((k) => (
                                  <div key={k.title}>
                                    <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
                                      <span
                                        aria-hidden="true"
                                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#4CAF7D] text-[#4CAF7D]"
                                      >
                                        <svg
                                          width="11"
                                          height="11"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M20 6L9 17l-5-5" />
                                        </svg>
                                      </span>
                                      {k.title}
                                    </p>
                                    <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
                                      {k.body}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* 関係を壊すワナ (WarnList と同じ組版・黄色の注意アイコン・8つ) */}
                            <div>
                              <h3 className="mb-5 text-[20px] font-black leading-snug text-[#2E2E5C] md:text-[22px]">
                                関係を壊すワナ
                              </h3>
                              {takoLocked && (
                                <TakoLockedBlock
                                  source="tako_wana_card"
                                  description={`完全版で、${sh.viewer}との関係が陥りがちなすれ違いポイントを先回りして知っておきましょう。`}
                                />
                              )}
                              <div
                                className={
                                  takoLocked
                                    ? "hidden"
                                    : "grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2"
                                }
                              >
                                {(takoLocked ? [] : c.wana).map((w) => (
                                  <div key={w.title}>
                                    <p className="mb-1 flex items-center gap-2 text-[15px] font-black text-[#2E2E5C]">
                                      <span
                                        aria-hidden="true"
                                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[#F2C14E]"
                                      >
                                        <svg
                                          width="18"
                                          height="18"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                          <line x1="12" y1="9" x2="12" y2="13" />
                                          <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                      </span>
                                      {w.title}
                                    </p>
                                    <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
                                      {w.body}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                          </div>
                        );
                      })()}
                    </section>

                  </div>
                ))}
              />

            {/* 友達からの回答 (一覧) セクションは 2026-07-20 指示で削除。
                友達ごとの結果は上部のタブで見る。 */}
            {/* ページ下部のレポートDLカードは 2026-07-21 削除。
                生成導線は常時表示バーの「完全版レポートを生成」に一本化。 */}
            </div>
        )}
        </div>
      </main>
      {/* 最下部の課金案内カード (tako_unlock 未購入・結果表示中のみ)。
          ロックカードの CTA (#tako-promo) のスクロール先。 */}
      {takoLocked && data.friends.length > 0 && (() => {
        const promoGroup = data.friendCharacter
          ? thirtyTwoGroup(data.friendCharacter.type32)
          : "unknown";
        // 2026-07-22: ¥799 単体販売を廃止し ¥499 完全版パッケージに一本化。
        // /me と同じ FullAccessPromoCard を使い、購入後は /tako に戻す (returnTo)。
        // TakoLockedBlock の解除CTA (#tako-promo) のスクロール先を兼ねるため id を付与。
        const promoImage =
          sceneImageForGroup(promoGroup, "love") ??
          sceneImageForGroup(promoGroup, "normal1") ??
          data.friendCharacter?.imageSrc;
        return (
          <>
            <div id="tako-promo" className="scroll-mt-16">
              <FullAccessPromoCard
                surface="tako"
                ownerToken={token}
                returnTo="tako"
                imageSrc={promoImage}
                imageAlt={data.friendCharacter?.essence ?? ""}
                group={promoGroup}
              />
            </div>
            {/* ロックの「今すぐアクセス」等はこのモーダルをその場で開く (2026-07-22)。 */}
            <PaywallModal
              surface="tako"
              ownerToken={token}
              returnTo="tako"
              imageSrc={promoImage}
              imageAlt={data.friendCharacter?.essence ?? ""}
              group={promoGroup}
            />
          </>
        );
      })()}
      {/* 招待バンド (もっと友達に聞くと〜 + QR) は 2026-07-20 指示で一旦削除。 */}
      {/* サイト共通フッター (トップ / /me / /types / /about と同じ) */}
      <TopFooter />
    </>
  );
}
