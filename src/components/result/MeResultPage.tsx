// プレミアム化 v3 Day 9: 個人の永続アクセス点 (/me/[token])
// Phase 1.5-α Day 10: Koi キャラ風 + Brand v2 に再構成
// Phase 1.5-α Day 11: 自己診断 7 章レポート (全無料) に拡張、¥500 訴求カード削除、
//                     友達評価カードをギャップ誘導文言に置換
//
// 設計判断 (なぜ Server Component か):
//   - SEO 対応 (OGP は別途、本ページは noindex で漏洩リスク抑制)
//   - 初回 paint で全コンテンツ揃う方が UX 良好
//   - DB 直接アクセスで API ラッパー不要 → コード量削減
//
// token = users.owner_token (nanoid 22 文字、既存)
// 旧 /result/[ownerToken] と互換性のある token を再利用 (Day 1 設計判断)
//
// 認可モデル:
//   - 読み取り = token のみで誰でも可 (友達シェア前提)
//
// Day 11 でのスコープ (確定設計):
//   - 軸1 (このページ) = 自己診断 7 章レポート、全部無料、集客・バイラル用途
//   - 軸2 (別ページ、Day 12 予定) = 友達評価とのギャップで ¥500 課金
//   - そのためこのページから ¥500 訴求カードは削除 (課金処理本体は触らない)
//   - 友達評価カードは「ギャップを見よう」誘導文言に置換 (バイラル動機)

import path from "node:path";
import Link from "next/link";
import { resolveSiteUrl } from "@/lib/site-url";
// 画像の存在チェックはビルド時生成のマニフェストで行う (scripts/generate-image-manifest.mjs)。
// ランタイム fs.existsSync だとトレーサーが public/ 全体を Function に同梱して
// Vercel の 250MB 上限を超えるため、fs は使わない。
import characterImages from "@/generated/character-images.json";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import {
  classifySixteenType,
  sixteenTypes,
  characterImagePath,
} from "@/lib/sixteen-types";
import { selfResultContent } from "@/lib/self-result-content";
// 32タイプ本文 (フラグ on 時のみ・本文だけ32化。型名/画像は16のまま)
import { isThirtyTwoEnabled } from "@/lib/feature-flags";
import {
  classifyThirtyTwoType,
  selfContentFor,
  thirtyTwoName,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoOneLiner,
  thirtyTwoSummary,
  thirtyTwoGroup,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { PersonalityTypeCard } from "@/components/result/PersonalityTypeCard";
import { PersonalityTraitsCard } from "@/components/result/PersonalityTraitsCard";
import { preferCutImage } from "@/lib/character-image";
import { DeepDiveSections } from "@/components/result/DeepDiveSections";
import { resolveDeepDiveSections } from "@/lib/deep-dive-resolve";
import { buildMoshimoScenes } from "@/lib/moshimo-resolve";
import { MoshimoScenes } from "@/components/result/MoshimoScenes";
import {
  hasFullAccess,
  hasPremiumBundleAccess,
  hasSelfReportAccess,
  hasUnmeiAccess,
} from "@/lib/entitlements";
import { hasPartTwoAccess } from "@/lib/friend-stairs";
import { resolvePartTwo } from "@/lib/part-two-resolve";
import { PartTwoSections } from "@/components/result/PartTwoSections";
import {
  SceneCautionTeaser,
  SceneCautionList,
} from "@/components/result/SceneCautionTeaser";
// 他己パート (他者評価/職業/みんなの目/他己フローティングCTA) と、
// 自己×友達の「自己認知ギャップ」発散バー(①)は /tako/[token] へ移設。
// ただし自己単体の発散バー(②「5つの軸で見るアナタ」)は自己ページの要素なので /me に残す。
import { classifyType } from "@/lib/diagnosis";
import { PaywallScrollButton } from "@/components/result/PaywallScrollButton";
import { PaywallModal } from "@/components/result/PaywallModal";
import { DiagnosisShareBand } from "@/components/diagnosis/DiagnosisShareBand";
import { ResultViewTracker } from "@/components/result/ResultViewTracker";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import { TakoAttentionOnResult } from "@/components/result/TakoAttentionOnResult";
import { UnmeiAttentionOnPaid } from "@/components/result/UnmeiAttentionOnPaid";
import { MetaPurchaseDataLayer } from "@/components/MetaPurchaseDataLayer";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import KoTopHeader from "@/components/ko/top/KoTopHeader";
import KoTopFooter from "@/components/ko/top/KoTopFooter";
import { ResetDataLink } from "@/components/ResetDataLink";
import { MeStickyHeader } from "@/components/result/MeStickyHeader";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
} from "@/lib/types";
import type { ResultLocale } from "@/i18n/result";
import {
  buildKoDeepDiveSections,
  buildKoPartTwo,
  buildKoSelfSections,
  KO_ME_COPY,
} from "@/i18n/ko/me";
import { KO_RESULT_TYPES } from "@/i18n/ko/result";
import {
  createMetaPurchaseClaimToken,
  verifyPaidSelfAccessCheckoutSession,
} from "@/lib/paid-checkout-session";
import { isUndiagnosedPlaceholderUser } from "@/lib/placeholder-user";

const SITE_URL =
  resolveSiteUrl();
const PREMIUM_UPGRADE_PRODUCTS = ["premium_bundle"] as const;

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// /share/[code] (キャラシェア着地) から渡すシェア主情報。指定時は「獲得モード」:
// シェア主タイプのモックを解放後の見た目で描画しつつ、課金導線 (解除CTA/ロックカード/
// 課金カード/モーダル) を一切出さず、CTA を「無料で性格診断をする」(/diagnosis) に
// 統一する (2026-07-26 指示)。実ユーザーデータは参照しない (モックのみ)。
export interface ShareLandingInfo {
  sharerName: string;
  typeId: ThirtyTwoTypeId;
}

// Phase 1.5-α Day 12-Polish: 自己診断本文は 16 タイプ別実本文 (lib/self-result-content.ts)
// に置き換え。章タイトル・本文はそこを単一の source とする (旧プレースホルダー CHAPTERS は廃止)。

// users 行のうち /me が使う最小フィールド (本番DB行 / 開発プレビュー用モック 共通の型)。
type MeUserRow = {
  id: string;
  type_id: string | null;
  scores: unknown;
  display_name: string | null;
  invite_code: string | null;
  diagnosis_completed_at: string | null;
};

export default function MeResultPage(
  props: PageProps & { locale?: ResultLocale; share?: ShareLandingInfo },
) {
  return <MeResultPageContent {...props} />;
}

async function MeResultPageContent({
  params,
  searchParams,
  locale = "ja",
  share,
}: PageProps & { locale?: ResultLocale; share?: ShareLandingInfo }) {
  const { token } = await params;
  const sp = await searchParams;
  const isKorean = locale === "ko";
  // 獲得モード (/share 経由)。previewType と同じモック描画だが、課金導線を出さない。
  const acquisition = share ?? null;
  // 獲得モードでは二人称 (あなた/アナタ) をシェア主の名前に置換する。読むのは訪問者で、
  // 「あなた」のままだと誰のトリセツか分からなくなるため (2026-07-26 指示)。
  // 通常モード (acquisition なし) では何もしない。
  const personalize = (text: string): string =>
    acquisition
      ? isKorean
        ? text.replaceAll("당신", `${acquisition.sharerName}님`)
        : text
            .replaceAll("アナタ", `${acquisition.sharerName}さん`)
            .replaceAll("あなた", `${acquisition.sharerName}さん`)
      : text;
  const personalizeHeading = (text: string): string => {
    const personalized = personalize(text);
    if (!acquisition || !isKorean) return personalized;
    return personalized.replace(/^나의 /, `${acquisition.sharerName}님의 `);
  };

  // ===== プレビュー (token/Supabase を介さずモックスコアで結果ページを描画) =====
  // ?previewType=<32タイプID> 指定時、そのタイプの High/Low モックで描画する。実ユーザー
  // データは一切参照しない (モックのみ)。許可条件は「開発環境」または「/preview/[typeId]
  // 経由 (fromPreview=1)」。本番の通常フロー (?previewType 無し) には影響しない。
  // 例(dev): /me/x?previewType=earnest-elephant__N ／ 本番: /preview/earnest-elephant__N
  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  // 獲得モードはシェア主のタイプで常にモック描画 (searchParams は見ない)。
  const previewType: ThirtyTwoTypeId | null = acquisition
    ? acquisition.typeId
    : previewAllowed &&
        /^[a-z-]+__[NR]$/.test(rawPreview) &&
        sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;
  // 本人購入は /me/[token]?paid=1 が完了着地。Stripe 検証は他の DB 取得と
  // 並列に進め、支払い済みの買い切り Session だけを計測候補にする。
  const paidCheckoutSessionPromise =
    !previewType && sp.paid === "1"
      ? verifyPaidSelfAccessCheckoutSession(sp.session_id)
      : Promise.resolve(null);
  // プレビューは既定で「解放後」の見た目 (コンテンツ QA 用) だが、?previewLock=1 を付けると
  // 未課金・友達0人の「ロック状態」(ロックカード + ぼかし + 最下部の課金カード) を描画する。
  // → 課金導線/ペイウォールの見た目をローカルで確認する用途。
  const previewLocked =
    !acquisition && previewType !== null && sp.previewLock === "1";
  // 公開タイプ別LP (/preview/[typeId]) 判定。ロック状態のモック描画だが、読者は
  // 未診断の訪問者なので課金導線は出さず、獲得モード (/share) と同じく診断CTAへ寄せる
  // (owner_token が "preview" のため購入APIはバリデーションで通らず、CTAを出しても壊れる)。
  // シェアURLも invite_code がモックで /share/preview になり機能しないため出さない。
  // dev の課金導線QA (?previewType&previewLock=1、fromPreview 無し) は従来どおり。
  const publicPreview = previewLocked && sp.fromPreview === "1";
  // プレビュー用モックスコア: base16 の OCEA コード (＋/−) と N 軸から High=8 / Low=2 を組む。
  const previewScores: Record<BigFiveDimension, number> | null = previewType
    ? (() => {
        const code = sixteenTypes[baseIdOf(previewType)].code;
        const hi = (ax: string) => (code.includes(`${ax}＋`) ? 8 : 2);
        return {
          O: hi("O"),
          C: hi("C"),
          E: hi("E"),
          A: hi("A"),
          N: nAxisOf(previewType) === "N" ? 8 : 2,
        };
      })()
    : null;

  // ===== 1. token → users 行 (プレビュー時は Supabase を介さずモック) =====
  let user: MeUserRow | null;
  if (previewType) {
    user = {
      id: "preview",
      type_id: classifyType(previewScores!),
      scores: previewScores!,
      display_name: isKorean ? "미리보기" : "プレビュー",
      invite_code: "preview",
      diagnosis_completed_at: new Date(0).toISOString(),
    };
  } else {
    const { data, error: userErr } = await supabaseAdmin
      .from("users")
      .select(
        "id, type_id, scores, display_name, invite_code, owner_token, created_at, diagnosis_completed_at",
      )
      .eq("owner_token", token)
      .maybeSingle();
    if (userErr) {
      console.error("[/me/[token]] users lookup error:", userErr);
    }
    user = data as MeUserRow | null;
  }
  if (!user) {
    notFound();
  }
  if (!previewType && isUndiagnosedPlaceholderUser(user)) {
    const current = await getSession();
    const prefix = isKorean ? "/ko" : "";
    redirect(
      current?.id === user.id ? `${prefix}/diagnosis` : `${prefix}/login`,
    );
  }

  // ===== 2. friend_perceptions (件数 + 平均スコア) =====
  // 件数は招待CTA / 人数ゲート (他者評価セクション) の判定に使う。
  // perceived_scores (Big Five 0-10) を取得し、自己認知ギャップ表示用に平均する。
  const { data: perceptionRows } = previewType
    ? { data: null }
    : await supabaseAdmin
        .from("friend_perceptions")
        .select(
          "id, perceived_scores, perceiver_name, qualitative_data, created_at",
        )
        .eq("target_user_id", user.id)
        .order("created_at", { ascending: true });
  const friendEvalCount = (perceptionRows ?? []).length;

  // ② 友達名・手紙・みんなの目 context は /tako へ移設 (owner-report-data.ts)。
  // ※ 友達評価平均 (friendAvgScores) は職業ゲージ専用だったが、新ヒーローカードで
  //   職業表示を撤去したため算出も撤去 (2026-08-19)。

  // ===== 5. ラベル + Big Five 導出 =====
  const stored = (user.scores ?? {}) as StoredScores;
  // 深掘り (TYPE_DEEP_DIVE) 用の 8 タイプ ID。user.scores から決定論的に導出
  // (classifyType は E/A/O のみ参照、欠損は中央 5.0 fallback)。
  const deepDiveTypeId = classifyType({
    E: stored.E ?? 5,
    A: stored.A ?? 5,
    O: stored.O ?? 5,
    C: stored.C ?? 5,
    N: stored.N ?? 5,
  });
  // 深掘り本文のゲート (三層モデル 第二部)。本文はここ (サーバ) で解決し、許可された
  // ぶんだけ props で渡す。解放条件 = ¥199 self_report または既存 full_access。
  // 未解放ならキャリア/成長は body=null で返り、クライアントバンドルにも本文が乗らない。
  // プレビュー (モック) は DB を引かない。/preview/[typeId] の静的生成をビルド時の
  // Supabase 接続に依存させないためでもある (課金状態は previewLock で表現済み)。
  const [
    deepDivePaid,
    fullAccessPaid,
    premiumBundlePaid,
    destinyFeaturesPaid,
  ] = previewType
    ? [false, false, false, false]
    : await Promise.all([
        hasSelfReportAccess(user.id as string),
        hasFullAccess(user.id as string),
        hasPremiumBundleAccess(user.id as string),
        hasUnmeiAccess(user.id as string),
      ]);
  // プレビュー (?previewType) は /tako のモック同様「解放後」の見た目で描画する (コンテンツ QA 用)。
  // ただし ?previewLock=1 のときは未課金ロック状態を再現する (課金導線の確認用)。
  // 獲得モード (/share) は未課金相当で解決する (課金コンテンツの本文は解決しない =
  // フェイルクローズ)。ロックUI自体も hideLocked で出さず「無いもの」として扱う。
  const partTwoUnlocked = acquisition
    ? false
    : previewType
      ? !previewLocked
      : hasPartTwoAccess(deepDivePaid, friendEvalCount);
  // ※ 課金後の /tako 誘導ティーザー (FriendLoveTeaser/FriendTruthTeaser) は
  //    2026-07-26 指示で撤去。代わりに課金後は 運命の設計図 (/unmei) への
  //    アップセルセクションを最下部に出す (16P のプレミアムキャリアキット風)。
  const showUnmeiPromo =
    !acquisition &&
    !destinyFeaturesPaid &&
    (previewType ? !previewLocked : deepDivePaid);
  // 運命の設計図 アップセルカード。② 恋愛傾向の直後 (DeepDiveSections の loveFooter
  // スロット = 旧 FriendLoveTeaser の位置) に差し込む (2026-07-26 指示)。
  // 16P「プレミアムキャリアキット」参考: 柔らかいカード + 締まったタイポ +
  // 色分けした六角形アイコン + 4つの特典を縦に読み進める構成 + 横長CTA。
  const unmeiPromoCard = !showUnmeiPromo ? null : (
    <section
      aria-label={isKorean ? "프리미엄 코스 혜택" : "プレミアムコースの特典"}
    >
      <div className="rounded-[23px] border border-[#F1DDAA] bg-white px-5 py-10 shadow-[0_8px_24px_rgba(46,46,92,0.055)] md:px-14 md:py-14">
        <div className="mx-auto mb-10 max-w-[800px] text-center md:mb-12">
          <span className="mb-4 inline-flex rounded-full bg-[#FFF6DF] px-4 py-2 text-[12px] font-black tracking-[0.08em] text-[#9A6A24] md:text-[13px]">
            {isKorean ? "프리미엄에서 잠금 해제" : "プレミアムで解放"}
          </span>
          <h2 className="mb-3 text-[24px] font-black leading-[1.35] text-[#2E2E5C] md:text-[36px]">
            {isKorean
              ? "태어난 순간의 별에서 운명을 읽어 보세요"
              : "あなたの物語の続きを、すべて解放"}
          </h2>
          <p className="text-[14px] font-bold leading-[1.8] text-[#68677F] md:text-[18px]">
            {isKorean ? (
              <>
                성격 진단에서 한 걸음 더. 출생 차트와 AI가 만드는
                <Link
                  href="/ko/unmei"
                  className="mx-1 font-black text-[#9A6A24] underline decoration-2 underline-offset-4"
                >
                  운명의 설계도
                </Link>
                로 나를 더 깊이 알아보세요
              </>
            ) : (
              "性格診断で分かったのは、いまのあなた。ここから先は、これまでの歩みと、これから訪れる転換点の話です。出生図と掛け合わせた、あなただけの1冊をつくりました。"
            )}
          </p>
        </div>
        <ul className="mx-auto mb-11 flex max-w-[820px] flex-col gap-7 md:mb-12 md:gap-8">
          {[
            {
              iconBg: "#EAF5FF",
              iconColor: "#397DB8",
              icon: (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
                  <path d="M14 2v5h5M9 13h6M9 17h4" />
                </svg>
              ),
              title: isKorean
                ? "네 장으로 이어지는 AI 감정서"
                : "4章立てのAI鑑定文",
              body: isKorean
                ? "쌓아 온 강점, 관계 속의 나, 앞으로의 전환점, 마지막 메시지를 네 장으로 풀고 바로 실천할 작은 한 걸음까지 담았어요."
                : "幼少期から、これから訪れる転換点まで。あなたの物語を最初から最後まで読み解きます。",
            },
            {
              iconBg: "#F1EEFF",
              iconColor: "#6558D9",
              icon: (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 5.5h14v10H9l-4 3v-13Z" />
                  <path d="m12 7.5.7 1.45 1.6.23-1.15 1.12.27 1.58L12 11.13l-1.43.75.27-1.58-1.15-1.12 1.6-.23L12 7.5Z" />
                </svg>
              ),
              title: isKorean
                ? "나만의 전담 점성술사"
                : "専属AI占い師に相談30回",
              body: isKorean
                ? "내 성격 진단과 출생 차트를 이해한 전담 점성술사에게 고민과 선택을 상담할 수 있어요. 프리미엄에는 채팅 30회가 포함됩니다."
                : "あなたの性格と星を全部知っている相手だから、話が早い。迷ったとき、いつでも。",
            },
            {
              iconBg: "#EAF8F2",
              iconColor: "#2F856E",
              icon: (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M12 3.5 19.36 16.25H4.64L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <circle cx="12" cy="3.5" r="1.5" fill="currentColor" />
                  <circle cx="19.36" cy="16.25" r="1.5" fill="currentColor" />
                  <circle cx="4.64" cy="16.25" r="1.5" fill="currentColor" />
                </svg>
              ),
              title: isKorean
                ? "나만의 출생 차트 휠"
                : "出生図ホイール",
              body: isKorean
                ? "생년월일·출생 시간·출생지를 바탕으로 태어난 순간의 하늘을 재현하고, 천체의 배치를 나만의 한 장의 설계도로 그려 드려요."
                : "生まれた瞬間の星の配置から、あなたが本来持っている素質を一枚に。",
            },
            {
              iconBg: "#FDECF3",
              iconColor: "#C45D86",
              icon: (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                  <circle cx="9" cy="12" r="5.8" />
                  <circle cx="15" cy="12" r="5.8" />
                </svg>
              ),
              title: isKorean
                ? "성격 진단과 별의 교차 해석"
                : "性格診断 × 星の掛け合わせ",
              body: isKorean
                ? "Big Five 진단에서 발견한 성격과 별이 보여 주는 기질을 나란히 살펴, 겹치는 부분과 작은 차이까지 읽어 드려요."
                : "「診断結果、当たってたけどなんで?」の答えが、星側から見えてきます。",
            },
          ].map((feature) => (
            <li
              key={feature.title}
              className="grid grid-cols-[58px_1fr] items-start gap-4 md:grid-cols-[72px_1fr] md:gap-6"
            >
              <span
                aria-hidden="true"
                className="flex h-[58px] w-[58px] items-center justify-center md:h-[68px] md:w-[68px]"
                style={{
                  clipPath:
                    "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
                  backgroundColor: feature.iconBg,
                  color: feature.iconColor,
                }}
              >
                {feature.icon}
              </span>
              <div className="pt-0.5 md:pt-1">
                <p className="text-[18px] font-black leading-[1.45] text-[#2E2E5C] md:text-[22px]">
                  {feature.title}
                </p>
                <p className="mt-1.5 text-[14px] font-medium leading-[1.75] text-[#66657B] md:text-[16px]">
                  {feature.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="text-center">
          <PaywallScrollButton
            source="unmei_promo_card"
            className="inline-flex min-w-[260px] items-center justify-center gap-3 rounded-full bg-[#9A6A24] px-9 py-4 text-[16px] font-black text-white shadow-[0_7px_18px_rgba(154,106,36,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#80571E] hover:shadow-[0_10px_22px_rgba(154,106,36,0.32)] md:min-w-[320px] md:text-[18px]"
          >
            {isKorean ? "프리미엄 자세히 보기" : "プレミアムの詳細を見る"}
            <span aria-hidden="true" className="text-xl font-medium">
              →
            </span>
          </PaywallScrollButton>
        </div>
      </div>
    </section>
  );
  const resolvedDeepDiveSections = resolveDeepDiveSections(deepDiveTypeId, stored, {
    hasFullAccess: partTwoUnlocked,
  });
  // 第二部「友達から見たアナタ (予測)」本文 (強み/あれっ?/取扱い方/ギャップ予告)。
  // 未解放時は本文を解決しない (フェイルクローズ)。sixteenTypeId/t32 は後段で導出するため
  // 解決自体は分類後 (下) で行う。
  // Day 12-Polish: 自己診断結果の表示は 16 タイプ (O/C/E/A 高低) で行う。
  // 既存の診断ロジック・スキーマは触らず、user.scores から決定的に派生する。
  const sixteenTypeId = classifySixteenType(stored);
  const sixteenType = sixteenTypes[sixteenTypeId];
  // 解釈B: フラグ on で本文・型名・essence・画像を32化。off=従来16 (完全に従来表示)。
  const flag32 = isKorean || previewType ? true : isThirtyTwoEnabled();
  const t32 = classifyThirtyTwoType(stored);
  // 第二部本文 (強み/あれっ?/取扱い方/ギャップ予告)。未解放時は本文なし (フェイルクローズ)。
  const partTwoRaw = isKorean
    ? buildKoPartTwo(t32, stored, partTwoUnlocked)
    : resolvePartTwo(t32, sixteenTypeId, stored, {
        unlocked: partTwoUnlocked,
      });
  // 獲得モード: 本文の二人称をシェア主の名前へ (🔒系は null のままなので触らない)。
  const partTwo = acquisition
    ? {
        ...partTwoRaw,
        likable: partTwoRaw.likable.map(personalize),
        weapons:
          partTwoRaw.weapons?.map((it) => ({
            ...it,
            title: personalize(it.title),
            body: personalize(it.body),
          })) ?? null,
      }
    : partTwoRaw;
  const deepDiveSectionsRaw = isKorean
    ? buildKoDeepDiveSections(t32, stored, partTwoUnlocked)
    : resolvedDeepDiveSections;
  // 獲得モードはロック要素をサーバ側で除去する。DeepDiveSections は client component の
  // ため、props に残すと見出しが RSC ペイロードに載ってしまう (本文は "" だが痕跡も消す)。
  // あわせて本文/見出しの二人称もシェア主の名前へ置換する。
  const deepDiveSections = acquisition
    ? deepDiveSectionsRaw
        .filter((s) => !s.locked && s.body !== null)
        .map((s) => ({
          ...s,
          tab: personalize(s.tab),
          note: personalize(s.note),
          body: s.body === null ? null : personalize(s.body),
          blocks: s.blocks
            ?.filter((b) => !b.locked)
            .map((b) => ({
              ...b,
              heading: personalizeHeading(b.heading),
              body: personalize(b.body),
            })),
        }))
    : deepDiveSectionsRaw;
  // ※「みんなの目」(他己) は /tako/[token] へ移設。/me では算出しない。
  const sectionsRaw = isKorean
    ? buildKoSelfSections(t32, stored)
    : flag32
      ? selfContentFor(t32)
      : selfResultContent[sixteenTypeId];
  // 獲得モード: ①基本特性/⑥注意点の本文もシェア主の名前へ。
  const sections = acquisition
    ? sectionsRaw.map((s) => ({
        ...s,
        title: personalize(s.title),
        ...(s.heading ? { heading: personalize(s.heading) } : {}),
        body: personalize(s.body),
      }))
    : sectionsRaw;
  const dispName = isKorean
    ? KO_RESULT_TYPES[t32].name
    : flag32
      ? thirtyTwoName(t32)
      : sixteenType.name;
  const dispEssence = isKorean
    ? KO_RESULT_TYPES[t32].essence
    : flag32
      ? thirtyTwoEssence(t32)
      : sixteenType.essence;
  // キャラ画像: /types と同じく背景除去済みの透過版 (characters/cut) を優先。
  //   v3 原画の地色は帯色と微妙にズレて四角い縁が見えるため、透過版なら帯に完全に馴染む。
  //   透過版が無いタイプのみ v3 にフォールバック。
  const v3Image = flag32
    ? thirtyTwoImagePath(t32)
    : characterImagePath(sixteenTypeId);
  const dispImage = preferCutImage(v3Image);
  // 挿絵 (シーン別イラスト・16P の章間イラスト参考):
  //   public/characters/scenes/ に「置くだけで自動表示」(無ければ非表示)。
  //   variant: normal1 / normal2 (通常2種) ・ love (恋愛) ・ work (仕事) ・ school (学校)。
  //   解決順: キャラ別 <slug>_<variant>.png → グループ共通 <group>_<variant>.png
  //   (例 jellyfish_N_love.png → sea_love.png)
  const sceneSlug = path.basename(v3Image).replace(/\.\w+$/, "");
  const sceneGroup = flag32 ? thirtyTwoGroup(t32) : null;
  const sceneImage = (variant: string): string | null => {
    const candidates = [
      `${sceneSlug}_${variant}.webp`,
      ...(sceneGroup ? [`${sceneGroup}_${variant}.webp`] : []),
    ];
    for (const name of candidates) {
      if (characterImages.scenes.includes(name)) return `/characters/scenes/${name}`;
    }
    return null;
  };
  // キャラのループ動画 (瞬き・手振り等)。public/characters/anim/<slug>.webm を置けば
  // ヒーローが静止画の代わりに動画を再生する (無ければ静止画＋微アニメ)。
  // scenes と同じ「置くだけで自動表示」運用 (manifest の anims 経由)。
  const animFile = `${sceneSlug}.webm`;
  const animSrc = (characterImages.anims as string[]).includes(animFile)
    ? `/characters/anim/${animFile}`
    : null;
  // 説明文(oneLiner): on=32キャラ一文 / off=従来16。
  const dispDesc = isKorean
    ? KO_RESULT_TYPES[t32].oneLiner
    : flag32
      ? thirtyTwoOneLiner(t32)
      : sixteenType.oneLiner;
  // 性格タイプカードの説明文 = 型サマリー (thirtyTwoSummary)。三人称・2文の事典風トーン
  // (2026-08-19 オーナー指定。16personalities のプロフィール型説明に合わせた長さ・語り口)。
  // KO は未整備のため oneLiner で代替。
  const typeSummary = isKorean
    ? KO_RESULT_TYPES[t32].oneLiner
    : flag32
      ? thirtyTwoSummary(t32)
      : dispDesc;
  const inviteCode = ((user.invite_code as string | null) ?? "").trim();
  // 自己診断結果の固定バーは、友達評価の依頼ではなくキャラクター共有に専念する。
  // 共有先は per-owner のキャラOGが出る獲得ページ。
  const characterShareUrl = `${SITE_URL}${isKorean ? "/ko" : ""}/share/${inviteCode}`;
  // 動物＋職業システム (動物名/職業ゲージ) は新ヒーローカードでは表示しないため /me からは
  // 撤去した。判定ロジック本体は lib/job・/tako 側に残存 (2026-08-19)。
  // ヒーロー見出し (16P 参考): 小ラベル「性格タイプ」+ 称号(essence)の大見出し。
  // どちらも白文字 (色帯の上に乗せる 16P の構図)。SP=中央 / PC=左寄せ。
  // ※ name/animal データは温存 (job 表示等で参照)。表示からのみ除外。
  // OCEAN コード行 (大文字小文字方式): 各軸の高低 (stored スコア ≥5 = 高) を文字の大小で表す。
  //   高 = 大文字・40px・weight800・#2B2A6B / 低 = 小文字・27px・#2B2A6B 40% (baseline 揃え)。
  //   ●○ インジケータは廃止 (大小で高低が伝わる)。ラベル「BIG FIVE CODE」は維持。
  const oceanIsHigh = (k: BigFiveDimension) =>
    (typeof stored[k] === "number" ? (stored[k] as number) : 5) >= 5;
  // 拡散シェア文用のコード表記 (ヒーローの大小方式と同じ: 高=大文字 / 低=小文字)。例 "OCeAN"。
  const dispCode = (["O", "C", "E", "A", "N"] as BigFiveDimension[])
    .map((k) => (oceanIsHigh(k) ? k : k.toLowerCase()))
    .join("");
  // キャラ名言 (サブコピー) はヒーローから撤去 (16P 構成に合わせラベル+称号+OCEAN のみ)。
  const paidCheckoutSession = await paidCheckoutSessionPromise;
  const paidAccessProduct =
    paidCheckoutSession?.product === "premium_bundle"
      ? "premium_bundle"
      : paidCheckoutSession?.product === "full_access"
        ? "full_access"
        : "self_report";
  const waitingForPaidAccess =
    paidAccessProduct === "premium_bundle"
      ? !premiumBundlePaid
      : paidAccessProduct === "full_access"
        ? !fullAccessPaid
        : !deepDivePaid;
  const shouldTrackMetaPurchase = paidCheckoutSession?.userId === user.id;
  const metaPurchaseClaimToken =
    shouldTrackMetaPurchase && paidCheckoutSession
      ? createMetaPurchaseClaimToken(paidCheckoutSession.id)
      : null;

  return (
    // 背景は全面白。ヒーローのキャラ画像をフルブリード (モバイル全幅 / md 以上は max-w-[640px]
    // 中央寄せ) で見せ、グループ色の背景帯 (旧 heroBand) は撤去した。
    // 最外周の枠線・カード・中央寄せ余白は撤去のまま、本文は左右ぎりぎり + PC 上限 1080px。
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
      {/* 決済直後 (?paid=1) だが webhook 反映がまだで未課金表示のとき、「決済処理中…」を出して
          status をポーリング → full 反映で自動的にロック解除表示へ (払ったのにロック→再購入 を防ぐ)。 */}
      {!previewType && sp.paid === "1" && waitingForPaidAccess && (
        <PaidUnlockWatcher
          ownerToken={token}
          locale={locale}
          product={paidAccessProduct}
        />
      )}
      {/* 友達診断の赤バッジ付与: /me を表示した全員に言語を問わず1回。 */}
      {!previewType && <TakoAttentionOnResult ownerToken={token} />}
      {/* 運命の赤バッジ付与: 従来どおり課金 (full_access) 済みのみ (変更しない)。 */}
      {!previewType && fullAccessPaid && !premiumBundlePaid && (
        <UnmeiAttentionOnPaid ownerToken={token} />
      )}

      {/* 表示計測 (result_viewed / result_revisited / three_friends_unlocked)。
          プレビュー (?previewType) はモック描画なので計測しない。 */}
      {!previewType && (
        <>
          <PreferredLocaleSync ownerToken={token} locale={locale} />
          <ResultViewTracker ownerToken={token} friendCount={friendEvalCount} />
        </>
      )}
    {/* 16P と同じスクロール連動ヘッダー。/me はヘッダー直下にシェアバーを常時表示
        (ヘッダーが隠れてもバーは残る)。解除CTAは未解放時のみ (2026-07-15 指示)。 */}
    <MeStickyHeader
      showUnlockCta={acquisition || publicPreview ? false : !partTwoUnlocked}
      shareUrl={acquisition || publicPreview ? undefined : characterShareUrl}
      diagnosisCta={Boolean(acquisition) || publicPreview}
      essence={dispEssence}
      code={dispCode}
      reportHref={
        showUnmeiPromo
          ? isKorean
            ? "/ko/unmei"
            : "/unmei"
          : !acquisition &&
              !publicPreview &&
              (previewType ? partTwoUnlocked : deepDivePaid)
            ? previewType
              ? `/report/preview/pdf?previewType=${encodeURIComponent(previewType)}${isKorean ? "&locale=ko" : ""}`
              : `/report/${encodeURIComponent(token)}/pdf${isKorean ? "?locale=ko" : ""}`
            : undefined
      }
      reportLabel={
        showUnmeiPromo
          ? isKorean
            ? "결과 업그레이드"
            : "結果をアップグレード"
          : isKorean
            ? undefined
            : "自己分析PDFをダウンロード"
      }
      reportIcon={showUnmeiPromo ? "upgrade" : "download"}
      reportOpensPaywall={showUnmeiPromo}
      locale={locale}
    >
      {isKorean ? <KoTopHeader /> : <TopHeader />}
    </MeStickyHeader>
    <main
      className="relative min-h-screen overflow-x-clip px-4 pb-6 pt-6 md:px-8 md:pb-10 md:pt-8"
      style={{ background: "#FFFFFF" }}
    >
      {/* 枠・カード(水色ボーダー/角丸/grid-bg/カードpadding)を撤去。背景は全面 main の白。
          本文は左右ぎりぎり (mobile px-4 / PC px-8) まで広げ、PC は上限 max-w-[1080px] で中央寄せ。
          overflow-x-clip はヒーロー画像のフルブリード (w-screen) の横はみ出し抑止用。 */}
      <div className="relative z-10 max-w-[1080px] mx-auto">
        {/* ===== プロフィール トップ (16P 参考・2026-08-19)。
            SP=ページ見出し(小) + 縦積み (性格タイプ → 性格特性)。
            PC(md+)=ページ見出し(大) + 2カラム (左:性格タイプ / 右:性格特性、上端揃え)。
            旧・全幅カラー帯 (ResultHero) は廃止。/tako は共有のため据え置き。 ===== */}
        {/* ページ見出し (SP/PC 共通・SP は小さめ + シェアはアイコンのみ) */}
        <div className="mb-5 flex items-start justify-between gap-3 md:mb-6">
          <div className="min-w-0">
            {/* PersonalityTypeCard の型名 (h1) と重複させないため視覚見出し (p) にする */}
            <p className="text-[24px] font-black leading-tight text-[#2E2E5C] md:text-[34px]">
              {acquisition
                ? isKorean
                  ? `${acquisition.sharerName}님의 프로필`
                  : `${acquisition.sharerName}さんのプロフィール`
                : isKorean
                  ? "나의 프로필"
                  : "あなたのプロフィール"}
            </p>
            <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-[#68677F] md:mt-2 md:text-[15px]">
              {isKorean
                ? "성격 테스트 결과로 나의 유형과 핵심 특성을 살펴보세요."
                : "性格テストの結果から、あなたのタイプと中心的な特性を見てみましょう。"}
            </p>
          </div>
        </div>
        {/* SP=縦積み / PC=2カラム */}
        <div className="md:mb-10 md:flex md:items-stretch md:gap-6">
          {/* 左: 性格タイプ カード (PC は約35%幅) */}
          <div className="md:w-[35%] md:max-w-[360px] md:flex-shrink-0">
            <PersonalityTypeCard
              label={
                acquisition
                  ? isKorean
                    ? `${acquisition.sharerName}님의 성격 유형`
                    : `${acquisition.sharerName}さんの性格タイプ`
                  : isKorean
                    ? KO_ME_COPY.heroLabel
                    : "性格タイプ"
              }
              essence={dispEssence}
              code={dispCode}
              imageSrc={dispImage}
              animSrc={animSrc}
              alt={dispName}
              description={typeSummary}
              group={flag32 ? thirtyTwoGroup(t32) : "unknown"}
            />
          </div>
          {/* 右: 性格特性 カード (バー/％ 切替・?ヘルプ・受験日・シェア) */}
          <div className="md:min-w-0 md:flex-1">
            <PersonalityTraitsCard
              scores={stored}
              takenAt={
                previewType
                  ? null
                  : (user.diagnosis_completed_at as string | null)
              }
              showShare={!acquisition && !publicPreview}
              locale={locale}
            />
          </div>
        </div>

        {/* 右下フローティングの「キャラをシェア」(CharacterShareButton) は
            2026-07-13 指示で撤去 (アンロックバーのシェア導線に集約)。 */}

        {/* ===== 章① 自分が見た自分 =====
            章見出し「{animal}のトリセツ」は撤去 (キャラ名はトップバー h1 へ移設)。
            キャラ画像の直後、各パートのキャッチー小見出し (heading) から本文が直接始まる。
            aria-labelledby は最初のパート見出し (id=chapter-self) を参照する。 */}
        {/* ===== ① 基本特性 (キャラ直下・見出しなし本文) =====
            五つの性格傾向 (BigFiveDivergingBars) はヒーロー直下の PersonalityTraitsCard に
            集約したため、章① は基本特性の地の文＋挿絵のみに簡素化 (2026-08-19)。
            ※注意点 (旧②) は友達から見たアナタの後 (④) へ移設済み。 */}
        <section
          aria-label={isKorean ? KO_ME_COPY.selfAriaLabel : "自分が見た自分"}
          className="mb-10"
        >
          {(() => {
            const paragraphs = sections[0] ? sections[0].body.split("\n\n") : [];
            const introImage = sceneImage("normal1");
            // 挿絵 normal1 は本文の中ほど (中間段落の後) に差し込む。
            const imageAfter = Math.max(0, Math.floor(paragraphs.length / 2) - 1);
            const paraClass =
              "body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0";
            return (
              <div className="px-1 pb-1">
                {paragraphs.map((para, pIdx) => (
                  <div key={`intro-${pIdx}`}>
                    <p className={paraClass}>{para}</p>
                    {introImage && pIdx === imageAfter && (
                      <SmoothImage
                        src={introImage}
                        alt=""
                        width={960}
                        height={640}
                        className="mx-auto my-8 h-auto w-full max-w-[560px] md:max-w-[760px]"
                      />
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </section>

        {/* ===== ② 恋愛傾向 / ③ キャリア傾向 =====
            2026-07-14 指示: 「アナタの深掘り」の親見出しを廃止し、各カテゴリを章に昇格。
            「みんなの目」(他己) は /tako へ移設。 */}
        <div className="mt-16">
          <DeepDiveSections
            number="2"
            sections={deepDiveSections}
            hideLocked={Boolean(acquisition) || publicPreview}
            locale={locale}
            sceneImages={{
              love: sceneImage("love"),
              career: sceneImage("work"),
              growth: sceneImage("school"),
            }}
            loveFooter={unmeiPromoCard ?? undefined}
          />
        </div>

        {/* ===== ④ もしもの時のアナタ (エンタメ章 / 2026-07-26 指示で友達から見たあなたの前へ) =====
            スコア由来のルールベースであるあるシーンの反応を出す。無料シーンは
            シェアの燃料、隠しシーンは課金ゲート (moshimo-resolve がフェイルクローズ)。 */}
        <section className="mt-16">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
            >
              4
            </span>
            <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
              {isKorean
                ? acquisition
                  ? `만약의 순간에 나타나는 ${acquisition.sharerName}님`
                  : "만약의 순간에 나타나는 나"
                : personalize("もしもの時のアナタ")}
            </h2>
          </div>
          {/* 章の挿絵 (グループ別のフェルトイラスト。sceneImage("moshimo") が
                land/sky/sea/unknown_moshimo.webp を解決。他章のシーン挿絵と同じ組版) */}
          {sceneImage("moshimo") && (
            <SmoothImage
              src={sceneImage("moshimo")!}
              alt=""
              width={960}
              height={640}
              className="mx-auto -mt-1 mb-2 h-auto w-full max-w-[520px] md:-mt-1 md:mb-3 md:max-w-[680px]"
            />
          )}
          <MoshimoScenes
            // 獲得モードは無料シーンのみ (課金シーンは鍵チップごと出さない) + 名前置換。
            // 公開プレビューも同様に無料シーンのみ (解除カードの課金CTAを出さない)。
            scenes={
              acquisition
                ? buildMoshimoScenes(stored, false, locale)
                    .filter((s) => !s.locked)
                    .map((s) => ({
                      ...s,
                      title: personalize(s.title),
                      body: personalize(s.body),
                    }))
                : publicPreview
                  ? buildMoshimoScenes(stored, false, locale).filter(
                      (s) => !s.locked,
                    )
                  : buildMoshimoScenes(stored, partTwoUnlocked, locale)
            }
            locale={locale}
          />
        </section>

        {/* ===== ⑤ 友達から見たあなた (16P 風ロックティーザー) =====
            ぼかしたダミーバーの上に「今すぐロックを解除」カードを重ね、
            自己診断＋PDFへの導線だけをカード内に置く。
            他己パートの本体は /tako/[token]。 */}
        <section className="mt-16">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
            >
              5
            </span>
            <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
              {isKorean
                ? acquisition
                  ? `친구가 보는 ${acquisition.sharerName}님`
                  : KO_ME_COPY.friendSectionTitle
                : personalize("友達から見たあなた")}
            </h2>
          </div>

          {/* 階段UI (1人=予兆/3人=第二部/5人=完成) は 2026-07-18 に撤去。
              2026-08-01 現在、自己診断ページの完全解放は課金のみ。 */}
          {/* 第二部本体。無料ブロック (武器/好かれやすい) は未解放でも本物を表示し、
              🔒ブロック (嫌われやすい/関係別) だけ未解放時はぼかし+解除カードになる。
              出し分けは PartTwoSections 内 (data の null 判定)。 */}
          {(() => {
            // 未解放時は自己診断＋PDFへの課金導線だけを表示する。
            // 見た目は恋愛ロックと同じ、ぼかし中央のコンパクトなカードに揃える。
            // 獲得モードはロックUI自体を出さない (hideLocked) ためカードも組まない。
            const lockCard =
              partTwoUnlocked || acquisition || publicPreview ? undefined : (
              <div className="relative w-full max-w-[380px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] bg-white/95 px-6 pb-9 pt-10 text-center shadow-[0_12px_36px_rgba(46,46,92,0.18)] backdrop-blur-sm md:max-w-[420px]">
                <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="4" y="10" width="16" height="11" rx="2.5" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                <p className="mb-2 text-[19px] font-black text-[#2E2E5C]">
                  {isKorean ? KO_ME_COPY.unlockNow : "今すぐロックを解除"}
                </p>
                <p className="mb-6 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
                  {isKorean ? (
                    KO_ME_COPY.friendLockDescription
                  ) : (
                    <>
                      自己分析レポートを入手して、
                      <br className="md:hidden" />
                      アナタが友達から誤解されやすいポイントを知りましょう。
                    </>
                  )}
                </p>
                <PaywallScrollButton
                  source="friend_dislike_card"
                  className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
                >
                  {isKorean ? KO_ME_COPY.accessNow : "今すぐアクセス"}
                </PaywallScrollButton>
              </div>
            );
            return (
              <PartTwoSections
                data={partTwo}
                lockCard={lockCard}
                hideLocked={Boolean(acquisition) || publicPreview}
                subjectName={acquisition?.sharerName}
                locale={locale}
              />
            );
          })()}

        </section>

        {/* 運命の設計図カード (2枚目): ⑤友達から見たあなた と ⑥注意点 の間にも
            同じものを置く (2026-07-26 指示)。 */}
        {unmeiPromoCard && <div className="mt-16">{unmeiPromoCard}</div>}

        {/* ===== ⑥ あなたの注意点 (① 五つの性格傾向 と同じ 16P 風スタイル) =====
            2026-07-14 指示: 友達から見たあなた の後ろに配置。 */}
        {sections[1] &&
          (() => {
            const paragraphs = sections[1].body.split("\n\n");
            // 2026-08-17: ja は先頭1段落のみ無料 (無料範囲46%→30%圧縮の一環)。
            //   1段落目は「〜ありませんか。」で終わるフック、2段落目は「それから、」
            //   始まりの続き物なので、この境界で切ると自然なクリフハンガーになる。
            //   KO は方針どおり現状維持 (全文表示)。解放済み (partTwoUnlocked) も全文。
            //   獲得モード/公開プレビューは課金コンテンツを無いものとして扱う
            //   (無料ぶんだけ表示しロックUIは出さない。⑤やシーン別と同じ扱い)。
            const cautionAllVisible = isKorean || partTwoUnlocked;
            const visibleParagraphs = cautionAllVisible
              ? paragraphs
              : paragraphs.slice(0, 1);
            const showCautionLock =
              !cautionAllVisible &&
              paragraphs.length > 1 &&
              !acquisition &&
              !publicPreview;
            return (
              <section className="mt-16 mb-14">
                <div className="mb-4 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                  >
                    6
                  </span>
                  <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                    {isKorean
                      ? acquisition
                        ? `${acquisition.sharerName}님의 주의해서 다룰 점`
                        : KO_ME_COPY.cautionTitle
                      : personalize("あなたの注意点")}
                  </h2>
                </div>
                {/* 挿絵 normal2: タイトル直下 (本文の前) に表示 */}
                {sceneImage("normal2") && (
                  <SmoothImage
                    src={sceneImage("normal2")!}
                    alt=""
                    width={960}
                    height={640}
                    className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
                  />
                )}
                <div className="px-1 pb-1">
                  {visibleParagraphs.map((para, pIdx) => (
                    <p
                      key={`caution-${pIdx}`}
                      className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
                    >
                      {para}
                    </p>
                  ))}
                </div>
                {/* 続きの注意点 (2段落目以降) のロック。本文はレンダリングすらしない
                    (フェイルクローズ)。⑤嫌われやすい性格と同じ見せ方: 対処法風タイトルの
                    デコイカードを2カラムでぼかして敷き、中央に解除カードを重ねる
                    (2026-08-17 指示)。デコイは全ユーザー共通で実本文とは無関係。 */}
                {showCautionLock && (
                  <div className="mt-10 px-1">
                    {/* 見出しはシーン別の注意点と同スタイル (ぼかしの外に置く)。 */}
                    <h3 className="mb-3 text-[20px] font-black text-[#2E2E5C]">
                      残りの注意点と対処法
                    </h3>
                    <div className="relative">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none grid select-none grid-cols-2 content-start gap-3 blur-[4px]"
                    >
                      {[
                        {
                          title: "抱え込みすぎの手放し方",
                          body: "ぜんぶ自分で背負う前に、ひとつだけ人に預ける練習から始めます。",
                        },
                        {
                          title: "「私がやらなきゃ」の見直し方",
                          body: "役割を数えて、本当にアナタでないと困るものだけを残します。",
                        },
                        {
                          title: "疲れる前のサインの見つけ方",
                          body: "限界の少し手前に出る合図を、先に決めておくのがコツです。",
                        },
                        {
                          title: "関係を壊さない断り方",
                          body: "気まずくならずに「今日はむり」を伝える言い方があります。",
                        },
                        {
                          title: "自分を後回しにしないコツ",
                          body: "予定のいちばん最初に、自分の時間を入れてしまいます。",
                        },
                        {
                          title: "優しさの配分の直し方",
                          body: "近い人にこそ雑になりがちな、優しさの向きを整えます。",
                        },
                      ].map((decoy) => (
                        <div
                          key={decoy.title}
                          className="rounded-xl border border-[#D9DCF5] bg-[#F7F7FE] px-4 py-3.5 opacity-80"
                        >
                          <p className="mb-1 text-[15px] font-black text-[#2E2E5C]">
                            {decoy.title}
                          </p>
                          <p className="body-gothic text-[14px] leading-[1.55] text-[#1A1A1A]">
                            {decoy.body}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                      <div className="relative w-full max-w-[380px] rounded-xl border border-[#E3E6F5] border-t-[3px] border-t-[#5B5BEF] bg-white/95 px-6 pb-9 pt-10 text-center shadow-[0_12px_36px_rgba(46,46,92,0.18)] backdrop-blur-sm md:max-w-[420px]">
                        <span className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <rect x="4" y="10" width="16" height="11" rx="2.5" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                          </svg>
                        </span>
                        <p className="mb-2 text-[19px] font-black text-[#2E2E5C]">
                          今すぐロックを解除
                        </p>
                        <p className="mb-6 text-[13px] font-bold leading-relaxed text-[#2E2E5C]/65">
                          残りの注意点と対処法を解放して、
                          <br className="md:hidden" />
                          アナタのトリセツを完成させましょう。
                        </p>
                        <PaywallScrollButton
                          source="caution_lock_card"
                          className="flex w-full items-center justify-center rounded-full bg-[#5B5BEF] px-6 py-3 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
                        >
                          今すぐアクセス
                        </PaywallScrollButton>
                      </div>
                    </div>
                    </div>
                  </div>
                )}
                {/* シーン別の注意点。解放済みは本文 (2026-07-15 投入)、未解放はロック
                    ティザー (本文はサーバで解決していない。フェイルクローズ)。 */}
                {partTwo.sceneCautions ? (
                  <SceneCautionList
                    items={partTwo.sceneCautions}
                    locale={locale}
                  />
                ) : acquisition || publicPreview ? null : (
                  // 獲得モード/公開プレビューではロックティザーも出さない
                  // (課金コンテンツは無いものとして扱う)
                  <SceneCautionTeaser locale={locale} />
                )}
              </section>
            );
          })()}

        {/* ===== 獲得CTA (/share 経由 + 公開タイプ別LP): ボタンのみ (2026-07-26 指示でカード/コピーは撤去) ===== */}
        {(acquisition || publicPreview) && (
          <div className="mt-16 mb-12 text-center">
            <Link
              href={isKorean ? "/ko/diagnosis" : "/diagnosis"}
              className="inline-flex items-center gap-2 rounded-full bg-[#5B5BEF] px-8 py-4 text-[15px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
            >
              {isKorean ? "무료 성격 진단 시작하기 →" : "無料で性格診断をする →"}
            </Link>
          </div>
        )}

        {/* ページ末尾のリンク類 (トップに戻る / ログイン / Visitor CTA) は撤去。
            ナビゲーションはサイト共通フッター + ボトムナビに集約。 */}
      </div>
    </main>
    {/* 自己診断＋PDFの¥199課金カード。第二部が未解放のときのみ表示する。 */}
    {/* 獲得モード/公開プレビューは課金導線なし (フェイルクローズで明示ガード) */}
    {!partTwoUnlocked && !acquisition && !publicPreview && (
      <>
        <div className="-mt-12 md:-mt-16">
          <FullAccessPromoCard
            ownerToken={token}
            imageSrc={sceneImage("work") ?? sceneImage("normal1") ?? dispImage}
            imageAlt={dispName}
            group={flag32 ? thirtyTwoGroup(t32) : "unknown"}
            locale={locale}
          />
        </div>
        {/* ロックCTAはその場で商品カードを表示する。日本語のカードは¥199の
            self_report、韓国版は従来どおりfull_accessとして決済へ進む。 */}
        <PaywallModal
          ownerToken={token}
          imageSrc={sceneImage("work") ?? sceneImage("normal1") ?? dispImage}
          imageAlt={dispName}
          group={flag32 ? thirtyTwoGroup(t32) : "unknown"}
          locale={locale}
        />
      </>
    )}
    {/* 解放後のプレミアム導線は、旧課金カードと同じモーダル内に
        プレミアムコースだけを表示する。 */}
    {showUnmeiPromo && (
      <PaywallModal
        ownerToken={token}
        imageSrc={sceneImage("work") ?? sceneImage("normal1") ?? dispImage}
        imageAlt={dispName}
        group={flag32 ? thirtyTwoGroup(t32) : "unknown"}
        locale={locale}
        products={PREMIUM_UPGRADE_PRODUCTS}
        previewMode={Boolean(previewType)}
        legacyPlanStyle
      />
    )}
    {/* データをリセット導線 (フッター直上)。SP メニュー内と同じ動線をここにも置く。
        獲得モード (/share) では訪問者に無関係なので出さない。 */}
    {!acquisition && !publicPreview && <ResetDataLink locale={locale} />}
    {/* 診断シェアバンド (診断ページ下部と同じ)。結果を読み終えた人に診断自体の
        シェアを促す (2026-08-17 指示)。獲得モードはCTA一点集中のため出さない。
        KO は方針どおり追加しない。 */}
    {!isKorean && !acquisition && (
      <DiagnosisShareBand locale="ja" source="me_share_band" />
    )}
    {/* サイト共通フッター (トップ / /types / /about と同じ)。ボトムナビの高さぶんは
        TopFooter 側ではなく余白で吸収されるため、そのまま置く */}
    {isKorean ? <KoTopFooter /> : <TopFooter />}
    </>
  );
}

// Visitor 向け CTA (アナタのトリセツも作れます / 購入済みログイン) と「トップに戻る」は
// 2026-07-06 に撤去 (ナビはサイト共通フッター + ボトムナビに集約)。
