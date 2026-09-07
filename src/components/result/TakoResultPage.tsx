// 友達診断 (タコ診断) 結果ページ /tako/[token]。
//   owner_token でアクセス (自己 /me/[token] と対)。
//   /me から切り出した「友達が見た自分」パートを集約:
//     友達平均キャラ / 自己認知ギャップバー / みんなの目(B-1) / 他者評価 / 招待。
//   友達の回答が0人なら招待だけの空状態、1人以上なら友達ごとの結果を表示。

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
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import { MeStickyHeader } from "@/components/result/MeStickyHeader";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import {
  MinnaTypeProse,
  sceneImageFor,
} from "@/components/result/MinnaTypeProse";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { TakoFriendTabs } from "@/components/result/TakoFriendTabs";
import { TakoFaq } from "@/components/result/TakoFaq";
import { REPORT_FRIEND_THRESHOLD } from "@/lib/report-data";
import { LockedInviteShare } from "@/components/result/LockedInviteShare";
import { TakoViewTracker } from "@/components/result/TakoViewTracker";
import { TakoLockedBlock } from "@/components/result/TakoLockedBlock";
import { JohariWindow } from "@/components/result/JohariWindow";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { PaywallModal } from "@/components/result/PaywallModal";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import {
  createMetaPurchaseClaimToken,
  verifyPaidFullAccessCheckoutSession,
} from "@/lib/paid-checkout-session";
import { hasTakoAccess } from "@/lib/entitlements";
import {
  resolveFriendLove,
  resolveLoveScene,
} from "@/lib/friend-love-content";
import { LOVE_BY_TYPE_32 } from "@/lib/love-by-type-32";
import {
  KO_LOVE_BY_TYPE_32,
  KO_PERCEIVED_BY_TYPE_32,
} from "@/i18n/ko/me-content-32";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import type { ResultLocale } from "@/i18n/result";
import type { ContentItem } from "@/lib/mutual-result-content";
import {
  classifyThirtyTwoType,
  thirtyTwoEssence,
  thirtyTwoGroup,
  thirtyTwoName,
  thirtyTwoImagePath,
  perceivedContentFor,
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

// 友達が回答直後に見る理解度ページと同じ結果画像。
// 実スコアに最も近い画像を選び、本人側でも同じ見え方に揃える。
const UNDERSTANDING_RESULTS = [
  {
    score: 32,
    image: "/result/understanding/understanding-32-transparent.webp",
  },
  {
    score: 54,
    image: "/result/understanding/understanding-54-transparent.webp",
  },
  {
    score: 82,
    image: "/result/understanding/understanding-82-transparent.webp",
  },
  {
    score: 99,
    image: "/result/understanding/understanding-99-transparent.webp",
  },
  {
    score: 100,
    image: "/result/understanding/understanding-100-gold-transparent.webp",
  },
] as const;

function understandingResultFor(score: number) {
  return UNDERSTANDING_RESULTS.reduce((nearest, candidate) =>
    Math.abs(candidate.score - score) < Math.abs(nearest.score - score)
      ? candidate
      : nearest,
  );
}

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
// 危険信号の各項目に足す締め文 (surprises は1文で薄いため2文化)。トーンは
// 「欠点の断罪」ではなく「仲がいいからこそ見えているクセ」(ネガは愛されるクセに変換)。
// /me の DISLIKE_TAIL と同発想。インデックス別に付け替えてテンプレ感を避ける。
const CONCERN_TAIL = [
  "悪気がないのは伝わってる。ただ、先にひと言あるだけで印象はまるで違う。",
  "嫌われるほどじゃない。むしろ長所が出すぎた瞬間で、気づくだけで武器に変わる。",
  "面と向かっては言わないけど、仲がいいからこそ気にしてる部分かも。",
  "隠しているつもりでも、近くにいる人にはちゃんと伝わってる。",
  "一つひとつは小さいけど、積み重なると静かな距離になっていく類のもの。",
  "気づいた日から変えられるクセ。むしろ伸びしろだと思われてる。",
];

// ⑤「ぶっちゃけ嫌われてない…？」の危険信号リスト。/me の「嫌われやすい性格」WarnList と
// 同じ組版 = 枠なし2カラム・黄色の注意アイコン + 太字タイトル + 字下げ本文。
// トーンは断罪ではなく「仲がいいからこそ見えるクセ」(傷つけないルール準拠)。
function ConcernList({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
      {items.map((it, i) => (
        <div key={`${it.title}-${i}`}>
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
            {it.title}
          </p>
          <p className="body-gothic pl-7 text-[14px] leading-[1.6] text-[#1A1A1A]">
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function koSubject(viewer: string): string {
  return viewer === "친구" ? "친구가" : `${viewer}이`;
}

function koTopic(viewer: string): string {
  return viewer === "친구" ? "친구는" : `${viewer}은`;
}

function koWith(viewer: string): string {
  return viewer === "친구" ? "친구와" : `${viewer}과`;
}

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

export async function TakoResultPage({
  params,
  searchParams,
  locale = "ja",
}: PageProps & { locale?: ResultLocale }) {
  const { token } = await params;
  const sp = await searchParams;
  const isKo = locale === "ko";

  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;

  // ?previewLocked=1: 回答0人の空状態モック。dev / fromPreview=1 のみ。
  const previewLocked = previewAllowed && sp.previewLocked === "1";

  // 決済着地 (?paid=1&session_id=) の Meta Purchase 計測候補。/me と同じ流儀で、
  // Stripe 検証はレポートデータ取得と並列に進める。
  const paidCheckoutSessionPromise =
    !previewType && !previewLocked && sp.paid === "1"
      ? verifyPaidFullAccessCheckoutSession(sp.session_id)
      : Promise.resolve(null);

  const data = previewType
    ? mockTakoData(
        previewType,
        locale,
        typeof sp.friends === "string" ? Number(sp.friends) : undefined,
      )
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
  const inviteUrl = isKo
    ? `${SITE_URL}/ko/friend/${encodeURIComponent(data.inviteCode)}`
    : data.inviteUrl;

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
    const essence = isKo
      ? KO_RESULT_TYPES[type32].essence
      : thirtyTwoEssence(type32);
    const imageSrc =
      f.perceivedImageSrc ?? preferCutImage(thirtyTwoImagePath(type32));
    // タブ用の顔ズーム版アバター (無ければ原画)。
    const faceSrc = preferFaceImage(thirtyTwoImagePath(type32));
    const sheetHero = heroColorsForGroup(thirtyTwoGroup(type32));
    const sheetDeep = buildDeepDive(
      data.selfScores,
      f.perceivedScores,
      locale,
    );
    const sheetLove = resolveFriendLove(f.perceivedScores);
    // 見出し・本文の「誰から見たか」。空/フォールバック名は総称「友達」に落とす。
    const sourceName = f.name.trim();
    const rawName = isKo
      ? ({
          そら: "소라",
          ゆい: "유이",
          はる: "하루",
        } as Record<string, string>)[sourceName] ?? sourceName
      : sourceName;
    const hasRealName =
      rawName && rawName !== "ともだち" && rawName !== "친구";
    const viewer = hasRealName
      ? isKo
        ? `${rawName}님`
        : `${rawName}さん`
      : isKo
        ? "친구"
        : "友達";
    // ②恋愛のメイン本文: 認識タイプの恋愛コンテンツ (LOVE_BY_TYPE_32・全32タイプ確認済み) を
    // 「◯◯さんから見たあなたの恋は、〜」に変換して流用 (2026-07-20 リッチ化)。
    // 表示は先頭2段落 (具体的な長所の描写) だけ。3段落目以降の内省パート
    // (でも、じつは…/欠点じゃありません…) は抽象的で、下のモテポイントとも
    // 役割がかぶるため出さない (2026-07-20 指示)。
    const loveContent = isKo
      ? KO_LOVE_BY_TYPE_32[type32]
      : LOVE_BY_TYPE_32[type32];
    const loveProse = (loveContent?.body ?? "")
      .split("\n\n")
      .filter(Boolean)
      .slice(0, 2);
    // 3段落目: モテ寄与度トップ2軸から選ぶ具体的なデートシーン (たとえば、〜)。
    const loveScene = resolveLoveScene(f.perceivedScores, locale);
    if (loveScene) loveProse.push(loveScene);
    if (isKo && loveProse[0]?.startsWith("당신의 사랑은")) {
      loveProse[0] = `${koSubject(viewer)} 보는 ${loveProse[0]}`;
    } else if (loveProse[0]?.startsWith("あなたの恋は")) {
      loveProse[0] = `${viewer}から見た${loveProse[0]}`;
    }
    // ⑤「ぶっちゃけ嫌われてない…？」の危険信号: その友達が見た認識タイプ(32→16)の
    //   surprises (あれっ?) を流用。/me の「嫌われやすい」と同じく DISLIKE_TAIL で
    //   2文化し「仲がいいからこそ見えるクセ」に軟化する (傷つけないルール準拠)。
    //   本文の {B}さん プレースホルダは、この友達の表示名 (viewer) に解決する。
    const perceived = isKo
      ? KO_PERCEIVED_BY_TYPE_32[type32]
      : perceivedContentFor(type32);
    const message = isKo
      ? ({
          "いつも冷静で頼れる。周りをよく見てるよね。":
            "항상 침착하고 믿음직해. 주변을 정말 잘 살피는 것 같아.",
          "いつも冷静で頼れる。周りをよく見てるよね。会うたびに落ち着くわ〜":
            "항상 침착하고 믿음직해. 주변을 정말 잘 살피는 것 같아. 만날 때마다 마음이 편해져~",
          "自分の考えをちゃんと持ってて素敵だと思う！":
            "자기 생각이 분명한 점이 정말 멋지다고 생각해!",
        } as Record<string, string>)[f.message] ?? f.message
      : f.message;
    const concernItems: ContentItem[] = perceived
      ? perceived.surprises.map((it, i) => ({
          title: it.title,
          body: isKo
            ? it.body
                .replace(/\{B\}님/g, viewer)
                .replace(/\{B\}/g, viewer)
            : `${it.body.replace(/\{B\}さん/g, viewer).replace(/\{B\}/g, viewer)}${CONCERN_TAIL[i % CONCERN_TAIL.length]}`,
        }))
      : [];
    return {
      key: f.perceptionId,
      tabName: rawName || (isKo ? "친구" : "ともだち"),
      faceSrc,
      message,
      viewer,
      type32,
      essence,
      imageSrc,
      hero: sheetHero,
      mutual: f.mutual,
      deep: sheetDeep,
      love: sheetLove,
      loveProse,
      concernItems,
      scores: f.perceivedScores,
      // ④相性: 常に回答ギャップからの推定 (2026-07-20 指示で診断済み分岐は廃止)。
      estCompat: estimateCompatFromGaps(
        data.selfScores,
        f.perceivedScores,
        viewer,
        locale,
      ),
    };
  });

  const previewMode = Boolean(previewType || previewLocked);

  // ===== 解放判定 =====
  // 友達診断は hasTakoAccess で判定する。
  // プレビュー: &lock=1 でロック状態を確認できる (旧 &discount は廃止)。
  const takoUnlocked = previewMode
    ? sp.lock !== "1"
    : await hasTakoAccess(data.user.id as string);
  // ロック中フラグ (未購入)。ロックカードはセクション別の文言で都度生成する。
  // 2026-07-28: 「1人目無料」モデル。最初に回答した友達 (friends は created_at 昇順
  // なので先頭) のシートは未購入でも全セクション公開し、価値のデモにする。
  // 2人目以降のシートだけ完全版ゲート (シート別の sheetLocked をパネル内で使う)。
  const takoLocked = !takoUnlocked;

  // 決済着地の Meta Purchase 計測 (/me と同じ: 支払済み Session の購入者 = 本人のみ)。
  const paidCheckoutSession = await paidCheckoutSessionPromise;
  const paidAccessProduct =
    paidCheckoutSession?.product === "premium_bundle"
      ? "premium_bundle"
      : paidCheckoutSession?.product === "full_access"
        ? "full_access"
        : "self_report";
  const shouldTrackMetaPurchase =
    !previewMode && paidCheckoutSession?.userId === (data.user.id as string);
  const metaPurchaseClaimToken =
    shouldTrackMetaPurchase && paidCheckoutSession
      ? createMetaPurchaseClaimToken(paidCheckoutSession.id)
      : null;

  // 未購入で「回答0人」または「2人目以降の結果あり」のときに使う共通課金カード。
  // 回答1人の無料体験中は従来どおり表示しない。
  const takoPromo = !takoLocked || data.friends.length === 1 ? null : (() => {
    const promoType = data.friendCharacter?.type32 ?? data.ownerType32;
    const promoGroup = promoType ? thirtyTwoGroup(promoType) : "unknown";
    const promoAlt =
      isKo && promoType
        ? KO_RESULT_TYPES[promoType].essence
        : data.friendCharacter?.essence ??
          (data.ownerType32 ? thirtyTwoEssence(data.ownerType32) : "");
    const promoImage =
      sceneImageForGroup(promoGroup, "love") ??
      sceneImageForGroup(promoGroup, "normal1") ??
      data.friendCharacter?.imageSrc ??
      (data.ownerType32
        ? preferFaceImage(thirtyTwoImagePath(data.ownerType32))
        : undefined);

    return (
      <>
        <div id="tako-promo" className="scroll-mt-16">
          <FullAccessPromoCard
            surface="tako"
            ownerToken={token}
            returnTo="tako"
            products={["full_access", "premium_bundle"]}
            imageSrc={promoImage}
            reportCharacterImageSrc={
              promoType ? thirtyTwoImagePath(promoType) : undefined
            }
            imageAlt={promoAlt}
            group={promoGroup}
            locale={locale}
          />
        </div>
        <PaywallModal
          surface="tako"
          ownerToken={token}
          returnTo="tako"
          products={["full_access", "premium_bundle"]}
          imageSrc={promoImage}
          reportCharacterImageSrc={
            promoType ? thirtyTwoImagePath(promoType) : undefined
          }
          imageAlt={promoAlt}
          group={promoGroup}
          locale={locale}
        />
      </>
    );
  })();

  return (
    <>
      {shouldTrackMetaPurchase &&
        paidCheckoutSession &&
        metaPurchaseClaimToken && (
          <MetaPurchaseDataLayer
            checkoutSessionId={paidCheckoutSession.id}
            product={paidCheckoutSession.product}
            claimToken={metaPurchaseClaimToken}
          />
        )}
      <TakoViewTracker
        ownerToken={token}
        inviteCode={data.inviteCode}
        enabled={!previewMode}
      />
      {/* 決済直後は Stripe webhook の plan='full' 反映が数秒遅れることがある。
          /me と同じく、払った直後に再ロック表示になるのを防ぐ。 */}
      {!previewMode && sp.paid === "1" && !takoUnlocked && (
        <PaidUnlockWatcher
          ownerToken={token}
          returnTo="tako"
          locale={locale}
          product={paidAccessProduct}
        />
      )}
      {/* /me と同じ常時表示バー付きヘッダー (シェア3ボタン + 未購入時は解除CTA)。
          解除CTAは最下部の課金カード (#tako-promo) へスクロールする。 */}
      {/* 解除CTAは「ページ上に実際にロックがある」= 2人目以降がいる時だけ出す
          (1人目無料モデルでは友達1人ならロック対象が無い)。 */}
      <MeStickyHeader
        showUnlockCta={takoLocked && data.friends.length > 1}
        unlockCtaLabel={isKo ? undefined : "結果をアップグレード"}
        // 回答0人では固定バーを出さず、本文の招待タブと空状態CTAに集約する。
        // 1人以上では従来どおり「さらに友達に診断してもらう」招待バーを表示する。
        shareUrl={data.friends.length > 0 ? inviteUrl : undefined}
        shareKind="invite"
        ownerToken={token}
        inviteCode={data.inviteCode}
        qrImageSrc={
          data.ownerType32
            ? preferFaceImage(thirtyTwoImagePath(data.ownerType32))
            : null
        }
        paywallTargetId="tako-promo"
        reportHref={
          takoUnlocked && data.friends.length > 0
            ? previewMode && previewType
              ? `/tako-report/preview/pdf?previewType=${encodeURIComponent(previewType)}${isKo ? "&locale=ko" : ""}`
              : `/tako-report/${encodeURIComponent(token)}/pdf${isKo ? "?locale=ko" : ""}`
            : undefined
        }
        locale={locale}
      >
        {isKo ? <KoTopHeader /> : <TopHeader />}
      </MeStickyHeader>
      <main
        className={`relative overflow-x-clip px-4 md:px-8 ${
          data.friends.length === 0 ? "pb-0" : "min-h-dvh pb-8"
        }`}
        style={{ background: "#FFFFFF" }}
      >
        <div className="relative z-10">
          {!data.unlocked ||
          !data.minnaContext ||
          !data.friendCharacter ||
          !takoHero ? (
            /* ===== 回答0人: 招待タブ + 淡いグレーの空状態。結果の予告・ぼかしは出さない。 ===== */
            <div className="mx-auto max-w-[1080px]">
              <TakoFriendTabs
                tabs={[]}
                panels={[]}
                invitePanel={
                  <LockedInviteShare
                    inviteUrl={inviteUrl}
                    trackSource="tako_empty"
                    ownerToken={token}
                    inviteCode={data.inviteCode}
                    compact
                    deferQr
                    locale={locale}
                    qrImageSrc={
                      data.ownerType32
                        ? preferFaceImage(thirtyTwoImagePath(data.ownerType32))
                        : null
                    }
                  />
                }
                locale={locale}
              />
            </div>
          ) : (
            /* ===== 解除後: 他己コンテンツ (自己診断と同じ世界観)。本文幅は /me・フッターと統一 (1080)。 ===== */
            <div className="mx-auto max-w-[1080px]">
              {/* 友達タブ + 友達1人ごとの結果シート (1人完結モデル)。
                  ヒーロー/①理解度/本文/②ギャップ/③恋愛傾向 をその友達のスコアで描画。 */}
              <TakoFriendTabs
                tabs={friendSheets.map((sh, i) => ({
                  perceptionId: sh.key,
                  name: sh.tabName,
                  // 2人目以降 (未購入) も顔アバター・メッセージ吹き出しは見せて
                  // 「読みたい欲」を起こす。タップで課金モーダルが開く (locked)。
                  // シート本文は panels 側で全ロックのまま (実データは渡らない)。
                  imageSrc: sh.faceSrc,
                  message: sh.message,
                  locked: takoLocked && i > 0,
                }))}
                invitePanel={
                  /* ＋タブの招待カード。SNS・リンクを主役にし、QRは任意展開する。 */
                  <LockedInviteShare
                    inviteUrl={inviteUrl}
                    trackSource="tako_unlocked"
                    ownerToken={token}
                    inviteCode={data.inviteCode}
                    compact
                    deferQr
                    locale={locale}
                    qrImageSrc={
                      data.ownerType32
                        ? preferFaceImage(thirtyTwoImagePath(data.ownerType32))
                        : null
                    }
                  />
                }
                locale={locale}
                panels={friendSheets.map((sh, shIdx) => {
                  // 1人目 (最初に回答した友達) は無料公開 = 価値のデモ。
                  // 2人目以降 (未購入) はシートまるごと非公開で早期 return する
                  // (2026-07-28。キャラ・本文・相性・ジョハリの一切を描画しない)。
                  // 以降の本文中に残るセクション別ゲート (sheetLocked 参照) は到達時
                  // つねに false (部分ロック時代の名残。全ロック方針を戻す時のため残置)。
                  const sheetLocked = takoLocked && shIdx > 0;
                  if (sheetLocked) {
                    return (
                      <div key={sh.key}>
                        <section className="mb-14 mt-10">
                          <h2 className="mb-2 text-center text-[24px] font-black leading-tight text-[#2E2E5C] md:text-[30px]">
                            {isKo
                              ? `${koSubject(sh.viewer)} 보는 나는…?`
                              : `${sh.viewer}から見たあなたは…？`}
                          </h2>
                          <p className="mx-auto mb-8 max-w-[440px] text-center text-[13px] font-bold leading-[1.75] text-[#8A8AA3]">
                            {isKo
                              ? `${sh.viewer}의 답변은 이미 도착했어요. 두 번째 친구부터의 결과 시트는 완전판에서 모두 열려요.`
                              : `${sh.viewer}の回答はもう届いてるよ。2人目からの結果シートは、完全版でぜんぶ開くよ。`}
                          </p>
                          <TakoLockedBlock
                            source="tako_sheet_lock"
                            description={
                              isKo
                                ? `완전판에서는 ${koSubject(sh.viewer)} 보는 내 캐릭터, 성격 차이, 연애 성향, 궁합까지 결과 시트 전체를 읽을 수 있어요.`
                                : `完全版で、${sh.viewer}から見たあなたのキャラ・性格のギャップ・恋愛傾向・相性まで、この結果シートをまるごと読めます。`
                            }
                            locale={locale}
                          />
                        </section>
                      </div>
                    );
                  }
                  return (
                  <div key={sh.key}>
                    {/* ヒーロー帯 (/me と同じ ResultHero・色帯)。称号=その友達が見たキャラ。 */}
                    <ResultHero
                      label={
                        isKo
                          ? `${koSubject(sh.viewer)} 보는 나는:`
                          : `${sh.viewer}から見たあなた:`
                      }
                      essence={sh.essence}
                      scores={sh.scores}
                      heroBg={sh.hero.heroBg}
                      codeTint={sh.hero.codeTint}
                      imageSrc={sh.imageSrc}
                      alt={sh.essence}
                      name={
                        isKo
                          ? KO_RESULT_TYPES[sh.type32].name
                          : thirtyTwoName(sh.type32)
                      }
                    />

                    {/* ① 理解度。友達の回答直後ページと同じ画像を、キャラの直後に置く。 */}
                    <section className="mb-6 mt-10">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                        >
                          1
                        </span>
                        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                          {isKo
                            ? `${koWith(sh.viewer)}의 이해도`
                            : `${sh.viewer}の理解度`}
                        </h2>
                      </div>
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
                        <div className="relative flex flex-col items-center px-4 pb-8 pt-3 md:px-6 md:pb-9 md:pt-5">
                          {(() => {
                            const result = understandingResultFor(sh.mutual);
                            return (
                              <>
                                <SmoothImage
                                  src={result.image}
                                  alt={
                                    isKo
                                      ? `이해도 ${result.score}%`
                                      : `理解度 ${result.score}%`
                                  }
                                  width={1448}
                                  height={1086}
                                  unoptimized
                                  className="h-auto w-full max-w-[640px] object-contain"
                                />
                                <p className="mt-3 max-w-[760px] text-center text-[12px] font-bold text-white">
                                  {isKo
                                    ? `이해도는 ${result.score}%. ${sh.viewer}의 답변과 자기 진단의 차이로 계산했어요`
                                    : `理解度は${result.score}%。${sh.viewer}の回答と自己診断のギャップから算出したよ`}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </section>

                    {/* 本文: 見出し・導入なしで「◯◯さんから見たあなたは〜」からいきなり始める
                        (2026-07-18 指示。/me の本文と同じ見た目)。
                        本文中間 (挿絵の直後) に「②五つの性格傾向のギャップ」グラフを差し込む
                        (2026-07-19 指示。/me の「①五つの性格傾向」と同じ構図)。 */}
                    <section className="mb-14">
                      <MinnaTypeProse
                        type32={sh.type32}
                        viewer={sh.viewer}
                        locale={locale}
                        midSlot={
                          /* ②五つの性格傾向のギャップ (2026-07-20 指示で旧③をここへ統合):
                             見出し → 一番のギャップカード → グラフ → 解説文 の順。
                             カードをグラフより上に置くため、見出しは BigFiveDivergingBars 内蔵
                             (hideHeading) ではなくここで描画する。 */
                          <>
                            <div className="mb-4 flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                              >
                                2
                              </span>
                              <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                                {isKo
                                  ? "5가지 성격 경향의 차이"
                                  : "五つの性格傾向のギャップ"}
                              </h2>
                            </div>
                            {/* 一番のギャップ (唯一の見せ場・淡ラベンダーカード)。グラフの上。 */}
                            {sh.deep && (
                              <div className="mb-4 rounded-3xl bg-[#F4F4FE] px-6 py-7">
                                <p className="text-[#2E2E5C] font-black text-[22px] leading-[1.35] md:text-[26px]">
                                  {isKo
                                    ? `가장 큰 차이는 ${sh.deep.gap.label}. 나는 `
                                    : `一番のギャップは${sh.deep.gap.label}。自分では`}
                                  <span className="text-[#5B5BEF]">
                                    {sh.deep.gap.selfPercent <= 10
                                      ? isKo
                                        ? "거의 0"
                                        : "ほぼゼロ"
                                      : `${sh.deep.gap.selfPercent}%`}
                                  </span>
                                  {isKo
                                    ? `로 느끼지만 ${koTopic(sh.viewer)} `
                                    : `、でも${sh.viewer}は`}
                                  <span className="text-[#5B5BEF]">
                                    {sh.deep.gap.otherPercent}%
                                  </span>
                                  {isKo ? "로 느끼고 있어요." : "感じてる。"}
                                </p>
                              </div>
                            )}
                            <BigFiveDivergingBars
                              scores={sh.scores}
                              friendScores={data.selfScores}
                              primaryLabel={
                                isKo
                                  ? `${sh.viewer}의 시선`
                                  : `${sh.viewer}の目`
                              }
                              friendLabel={isKo ? "자기 진단" : "自分の診断"}
                              hideHeading
                              locale={locale}
                            />
                          </>
                        }
                        afterBodySlot={
                          /* ③ その友達から見た恋愛傾向 (本文の締めとクセの間。2026-07-19 指示)。
                             見出し直下に /me と同じ恋愛シーン挿絵 (love) を表示。 */
                          sh.love ? (
                            <section>
                              {/* 見出し (丸数字③)。 */}
                              <div className="mb-4 flex items-center gap-3">
                                <span
                                  aria-hidden="true"
                                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                                >
                                  3
                                </span>
                                <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                                  {isKo
                                    ? `${koSubject(sh.viewer)} 보는 연애 성향`
                                    : `${sh.viewer}から見た恋愛傾向`}
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
                              {/* メイン本文: 「◯◯さんから見たあなたの恋は、〜」(認識タイプの恋愛本文) */}
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
                              {/* 「あなたに沼る人」「損してるポイント」(FriendLoveSection) は
                                  2026-07-28 削除指示で撤去 (コンポーネントと
                                  friend-love-content の resolver は残置)。 */}
                            </section>
                          ) : null
                        }
                      />
                    </section>

                    {/* ④ ◯◯さんとの相性 (2026-07-20 追加)。
                        友達自身も自己診断済み (friendOwnType32 あり) なら compat() で
                        ルールベースの相性本文を表示。未診断ならティザー文のみ。
                        関係を深めるヒント・壊すワナ をこの中にまとめる。 */}
                    <section className="mb-14">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                        >
                          4
                        </span>
                        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                          {isKo
                            ? `${koWith(sh.viewer)}의 궁합`
                            : `${sh.viewer}との相性`}
                        </h2>
                      </div>
                      {(() => {
                        // 2026-07-20 指示: 相性は常に「回答ギャップからの推定」のみ。
                        // 表示は /aisho のヒーロー (ピンク帯 + ランク画像 S/A/B/C) を流用。
                        const c = sh.estCompat;
                        if (!c) {
                          return (
                            <p className="body-gothic text-[17px] font-normal leading-[1.4] text-[#1A1A1A]">
                              {isKo
                                ? `${koWith(sh.viewer)}의 궁합을 지금은 계산할 수 없어요.`
                                : `${sh.viewer}との相性は、いま計算できなかったよ。`}
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
                                    alt={
                                      isKo
                                        ? `궁합 등급 ${c.rank}`
                                        : `相性ランク ${c.rank}`
                                    }
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
                                  {isKo
                                    ? `궁합은 ${c.percent}%. ${sh.viewer}의 답변과 자기 진단의 차이로 추정했어요`
                                    : `相性度は${c.percent}%。${sh.viewer}の回答と自己診断のギャップから推定したよ`}
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

                            {/* 小見出し②「ぶっちゃけ嫌われていない…？」= 相性の中の不安フック。
                                未購入時はコンテンツを完全に隠し、見出し＋解除カードのみ (2026-07-23 指示)。
                                解放時のみ 安心ブロック + “危険信号”(surprises を軟化) を全部見せる。 */}
                            {sh.concernItems.length > 0 && (
                              <div>
                                <h3 className="mb-5 text-[22px] font-black leading-snug text-[#2E2E5C] md:text-[26px]">
                                  {isKo
                                    ? `솔직히, ${koSubject(sh.viewer)} 나를 싫어하는 건 아닐까…?`
                                    : `ぶっちゃけ、${sh.viewer}に嫌われていない…？`}
                                </h3>

                                {sheetLocked ? (
                                  <TakoLockedBlock
                                    source="tako_kirai_card"
                                    description={
                                      isKo
                                        ? `완전판에서 ${koSubject(sh.viewer)} 느끼는 신호와 관계가 꼬이기 전에 주의할 점을 읽을 수 있어요.`
                                        : `完全版で、${sh.viewer}が感じてる“危険信号”と、こじれる前に気をつけたいポイントが読めます。`
                                    }
                                    locale={locale}
                                  />
                                ) : (
                                  <>
                                    {/* 安心ブロック (答えてくれた=好意の証拠)。淡ラベンダーカード。 */}
                                    <div className="mb-6 rounded-3xl bg-[#F4F4FE] px-6 py-6">
                                      <p className="mb-2 text-[18px] font-black leading-[1.5] text-[#2E2E5C] md:text-[20px]">
                                        {isKo
                                          ? "답: 아마 괜찮아요."
                                          : "答え：たぶん、大丈夫。"}
                                      </p>
                                      <p className="body-gothic text-[15px] leading-[1.7] text-[#1A1A1A]">
                                        {isKo
                                          ? `${koTopic(sh.viewer)} 모든 질문에 시간을 내어 답해 줬어요. 아무 관심 없는 사람에게는 그렇게까지 하지 않으니까요.`
                                          : `だって${sh.viewer}、わざわざ全部の質問に答えてくれた。どうでもいい相手には、そんな時間かけないから。`}
                                      </p>
                                    </div>

                                    <p className="body-gothic mb-6 text-[15px] font-normal leading-[1.6] text-[#1A1A1A]">
                                      {isKo
                                        ? `다만 이런 순간에는 ${koSubject(sh.viewer)} 조용히 거리감을 느낄 수도 있어요.`
                                        : `ただ——こういう瞬間だけ、${sh.viewer}は静かに「あれ?」と距離を感じてるかも。`}
                                    </p>

                                    {/* 危険信号 (解放時のみ・全部見せる) */}
                                    <ConcernList items={sh.concernItems} />
                                  </>
                                )}
                              </div>
                            )}

                            {/* 小見出し①「関係を深めるヒント・壊すワナ」= 深める(緑)/壊す(黄)の2リスト */}
                            <div>
                              <h3 className="mb-5 text-[22px] font-black leading-snug text-[#2E2E5C] md:text-[26px]">
                                {isKo
                                  ? "관계를 깊게 하는 힌트와 피해야 할 함정"
                                  : "関係を深めるヒント・壊すワナ"}
                              </h3>
                              {sheetLocked ? (
                                <TakoLockedBlock
                                  source="tako_kotsu_wana_card"
                                  description={
                                    isKo
                                      ? `완전판에서 ${koWith(sh.viewer)} 더 가까워지는 방법과 피하고 싶은 오해 포인트를 모두 읽을 수 있어요.`
                                      : `完全版で、${sh.viewer}ともっと仲良くなるコツと、避けたいすれ違いポイントの両方が読めます。`
                                  }
                                  locale={locale}
                                />
                              ) : (
                              <div className="flex flex-col gap-8">
                                <div>
                              <div
                                className={
                                  sheetLocked
                                    ? "hidden"
                                    : "grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2"
                                }
                              >
                                {(sheetLocked ? [] : c.kotsu).map((k) => (
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

                            {/* 壊すワナ (WarnList と同じ組版・黄色の注意アイコン・8つ)。キャプション削除。 */}
                            <div>
                              <div
                                className={
                                  sheetLocked
                                    ? "hidden"
                                    : "grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2"
                                }
                              >
                                {(sheetLocked ? [] : c.wana).map((w) => (
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
                              )}
                            </div>

                          </div>
                        );
                      })()}
                    </section>

                    {/* ⑤ 2人がつくるジョハリの窓 (2026-07-23 追加)。
                        自己診断 × この友達の回答を4つの窓に仕分け。盲点の窓のみ課金ゲート。 */}
                    <section className="mb-14">
                      <div className="mb-4 flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                        >
                          5
                        </span>
                        <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                          {isKo
                            ? "두 사람이 만드는 조해리의 창"
                            : "2人がつくるジョハリの窓"}
                        </h2>
                      </div>
                      <p className="body-gothic mb-6 text-[15px] font-normal leading-[1.6] text-[#1A1A1A]">
                        {isKo
                          ? `나의 자기 진단과 ${sh.viewer}의 답변을 겹쳐 네 개의 창으로 나눴어요.`
                          : `あなたの自己診断と${sh.viewer}の回答を重ねて、4つの窓に仕分けたよ。`}
                      </p>
                      <JohariWindow
                        selfScores={data.selfScores}
                        friendScores={sh.scores}
                        viewer={sh.viewer}
                        locked={sheetLocked}
                        locale={locale}
                      />
                    </section>

                  </div>
                  );
                })}
              />

            {/* 友達からの回答 (一覧) セクションは 2026-07-20 指示で削除。
                友達ごとの結果は上部のタブで見る。 */}
            {/* ページ下部のレポートDLカードは 2026-07-21 削除。
                生成導線は常時表示バーの「完全版レポートを生成」に一本化。 */}
            </div>
        )}
        </div>
      </main>
      {/* 2人目以降の結果がある未購入ユーザー向けの最下部課金カード。 */}
      {data.friends.length > 1 ? takoPromo : null}
      {/* 招待バンド (もっと友達に聞くと〜 + QR) は 2026-07-20 指示で一旦削除。 */}
      {/* FAQ は招待前の疑問解消用。1人でも回答が付いたら出さない (2026-08-26 指示)。 */}
      {data.friends.length === 0 && <TakoFaq locale={locale} />}
      {/* 回答0人の未購入ユーザーには、FAQの直後・フッターの直前で課金カードを案内する。 */}
      {data.friends.length === 0 ? takoPromo : null}
      {/* サイト共通フッター (トップ / /me / /types / /about と同じ) */}
      {isKo ? <KoTopFooter /> : <TopFooter />}
    </>
  );
}
