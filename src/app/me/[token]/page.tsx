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
//   - 編集 / 購入導線 = session.user.id === users.id (= isOwner) のときのみ表示
//
// Day 11 でのスコープ (確定設計):
//   - 軸1 (このページ) = 自己診断 7 章レポート、全部無料、集客・バイラル用途
//   - 軸2 (別ページ、Day 12 予定) = 友達評価とのギャップで ¥500 課金
//   - そのためこのページから ¥500 訴求カードは削除 (課金処理本体は触らない)
//   - 友達評価カードは「ギャップを見よう」誘導文言に置換 (バイラル動機)

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
import { ResultActions } from "@/components/result/ResultActions";
import { FriendGapInvite } from "@/components/result/FriendGapInvite";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

export const metadata: Metadata = {
  // owner_token は推測不可だが、検索エンジン除外で誤共有時の漏洩経路を絞る。
  robots: { index: false, follow: false },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.watashi-torisetsu.com";

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

interface PageProps {
  params: Promise<{ token: string }>;
}

// Phase 1.5-α Day 11: Big Five 5 次元の日本語ラベル定義 (順序固定)
// stored.{E|A|O|C|N} は lib/diagnosis.ts により 0-10 にスケール化済み (types.ts コメント参照)
const BIG_FIVE_LABELS: { key: BigFiveDimension; label: string }[] = [
  { key: "E", label: "外向性" },
  { key: "A", label: "協調性" },
  { key: "O", label: "開放性" },
  { key: "C", label: "誠実性" },
  { key: "N", label: "神経症傾向" },
];

// Phase 1.5-α Day 11: 7 章レポートの章タイトル定義 (本文は typeData 接続まで暫定プレースホルダー)
// ① はバーチャート + 説明、②〜⑦ はタイトル + 本文のみ
const CHAPTERS: { num: number; title: string; bodyPlaceholder: string }[] = [
  {
    num: 1,
    title: "アナタの性格特性",
    bodyPlaceholder:
      "アナタの Big Five プロフィールはこんな形です。各次元のバーが「アナタらしさ」のグラデーション。 高い・低いに優劣はなく、それぞれが「アナタが世界をどう見ているか」のメガネです。",
  },
  {
    num: 2,
    title: "アナタの強み",
    bodyPlaceholder:
      "アナタが自然にできてしまうこと、それがアナタの最大の武器。 周りの人が「すごい」と感じる場面は、アナタにとって当たり前すぎて意識すらしていないかもしれません。",
  },
  {
    num: 3,
    title: "基本のトリセツ",
    bodyPlaceholder:
      "アナタと上手に付き合うには、まずノリを合わせること。 真正面から正論をぶつけられるのは苦手で、共感とテンポが先にあると安心して本音が出てきます。",
  },
  {
    num: 4,
    title: "アナタの隠れた一面",
    bodyPlaceholder:
      "外から見えるアナタと、家に帰ったあとのアナタは別人かもしれません。 みんなが思う「いつも元気」の裏で、人一倍消耗していることがあります。",
  },
  {
    num: 5,
    title: "アナタの対人スタイル",
    bodyPlaceholder:
      "初対面の距離の縮め方、長く付き合う友達への向き合い方には、 アナタ独自のペースがあります。本音を見せる相手とそうでない相手の線引きが、はっきりしているタイプ。",
  },
  {
    num: 6,
    title: "アナタの活かし方",
    bodyPlaceholder:
      "アナタが一番輝くのは、人と人をつなぐ役割や、 空気を切り替える瞬間。逆に、黙々と一人で積み上げる作業は、合う日と合わない日の波が大きめです。",
  },
  {
    num: 7,
    title: "アナタへのメッセージ",
    bodyPlaceholder:
      "アナタへ。アナタの「らしさ」は、まわりにとって本当に貴重なもの。 ときどき疲れる日があっても、それはアナタが手を抜けないからこそ。自分の取扱説明書、ちゃんと持っていてくださいね。",
  },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function deriveTypeLabel(
  typeId: string,
  stored: StoredScores,
): { typeName: string; fullCode: string; modifierLabel: string } {
  const typeMeta = torisetsuTypes[typeId as TorisetsuTypeId];
  const typeName = typeMeta?.name ?? typeId;

  let fullCode = stored.fullCode ?? "";
  let modifierLabel = stored.modifierLabel ?? "";
  if (!fullCode || !modifierLabel) {
    const dimScores: Record<BigFiveDimension, number> = {
      E: typeof stored.E === "number" ? stored.E : 5,
      A: typeof stored.A === "number" ? stored.A : 5,
      O: typeof stored.O === "number" ? stored.O : 5,
      C: typeof stored.C === "number" ? stored.C : 5,
      N: typeof stored.N === "number" ? stored.N : 5,
    };
    const { cModifier, nModifier } = classifyModifier(dimScores);
    if (!fullCode) {
      fullCode = buildFullCode(
        typeId as TorisetsuTypeId,
        cModifier,
        nModifier,
      );
    }
    if (!modifierLabel) {
      modifierLabel = getModifierLabel(cModifier, nModifier);
    }
  }
  return { typeName, fullCode, modifierLabel };
}

// Phase 1.5-α Day 11: stored.scores から % 化済みの Big Five 配列を生成
// 値域 0-10 → score * 10 で % 化、欠損時はフォールバック 5 (= 50%)
function deriveBigFivePercents(
  stored: StoredScores,
): { key: BigFiveDimension; label: string; percent: number }[] {
  return BIG_FIVE_LABELS.map(({ key, label }) => {
    const raw = typeof stored[key] === "number" ? stored[key]! : 5;
    const percent = Math.max(0, Math.min(100, Math.round(raw * 10)));
    return { key, label, percent };
  });
}

export default async function MePage({ params }: PageProps) {
  const { token } = await params;

  // ===== 1. token → users 行 =====
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select(
      "id, type_id, scores, display_name, invite_code, owner_token, created_at",
    )
    .eq("owner_token", token)
    .maybeSingle();
  if (userErr) {
    console.error("[/me/[token]] users lookup error:", userErr);
  }
  if (!user) {
    notFound();
  }

  // ===== 2. session 解決 → isOwner 判定 =====
  const session = await getSession();
  const isOwner = !!session && session.id === (user.id as string);

  // ===== 3. friend_perceptions =====
  const { data: perceptionRows } = await supabaseAdmin
    .from("friend_perceptions")
    .select(
      "id, perceiver_name, perceived_type_id, perceived_full_code, perceived_modifier_label, qualitative_data, created_at",
    )
    .eq("target_user_id", user.id)
    .order("created_at", { ascending: false });
  const perceptions = (perceptionRows ?? []).map((p) => ({
    id: p.id as string,
    perceiverName: (p.perceiver_name as string) ?? "友達",
    typeName:
      torisetsuTypes[p.perceived_type_id as TorisetsuTypeId]?.name ??
      (p.perceived_type_id as string),
    fullCode: (p.perceived_full_code as string) ?? "",
    modifierLabel: (p.perceived_modifier_label as string | null) ?? null,
    qualitative:
      (p.qualitative_data as Record<string, string> | null) ?? null,
    createdAt: p.created_at as string,
  }));

  // ===== 4. integrated_trisetsu (completed のみ、新しい順) =====
  const { data: integratedRows } = await supabaseAdmin
    .from("integrated_trisetsu")
    .select(
      "id, generated_title, generated_subtitle, generated_at, perception_ids, include_self",
    )
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("generated_at", { ascending: false });
  const integrated = (integratedRows ?? []).map((r) => ({
    id: r.id as string,
    title: (r.generated_title as string | null) ?? "真のトリセツ",
    subtitle: (r.generated_subtitle as string | null) ?? "",
    generatedAt: r.generated_at as string,
    perceptionCount: Array.isArray(r.perception_ids)
      ? (r.perception_ids as unknown[]).length
      : 0,
    includeSelf: r.include_self !== false,
  }));

  // ===== 5. ラベル + Big Five 導出 =====
  const stored = (user.scores ?? {}) as StoredScores;
  const { typeName, fullCode, modifierLabel } = deriveTypeLabel(
    user.type_id as string,
    stored,
  );
  const typeMeta =
    torisetsuTypes[user.type_id as TorisetsuTypeId] ?? undefined;
  const subtitle = (typeMeta?.subtitle as string | undefined) ?? "";
  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  const diagnosedAt = formatDate(user.created_at as string);
  const inviteCode = user.invite_code as string;
  const shareUrl = `${SITE_URL}/me/${token}`;
  // Phase 1.5-α Day 11.2: QR コード用に絶対 URL を構築 (友達のスマホから直接アクセス可能に)
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;
  const bigFive = deriveBigFivePercents(stored);

  return (
    // Phase 1.5-α Day 11.1: LP と同じ grid-bg + 統合カード枠で世界観を連続化。
    // - 外側: lavender (#E4E0F5) でカード周囲を埋める
    // - 内側: 統合カード (max-w-[480px] / rounded-[32px] / border-[3px] #0094D8 / grid-bg / p-6)
    // grid-bg の z-index 階層は globals.css (Day 8) で:
    //   ::before (z-0) < .grid-bg > * (z-1) なので各章カードは自動でグリッド線より前面。
    // /diagnosis (50 問) は集中環境のため lavender 単色のまま、grid-bg は適用しない。
    <main className="min-h-screen bg-[#E4E0F5] py-6 px-4">
      <div className="max-w-[480px] mx-auto rounded-[32px] overflow-hidden grid-bg p-6 relative border-[3px] border-[#0094D8]">
        {/* ===== ヘッダー (左ロゴ + 右ハンバーガー、LP と同じ) =====
            Day 12-A: 装飾だけだった ☰ を <HamburgerMenu> (3 項目メニュー) に置換 */}
        <div className="flex justify-between items-center mb-6">
          <Link href="/" aria-label="トップへ">
            <Image
              src="/logo.png"
              alt="ワタシのトリセツ"
              width={280}
              height={80}
              priority
              className="w-[120px] h-auto drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
            />
          </Link>
          <HamburgerMenu myTrisetsuUrl={`/me/${token}`} />
        </div>

        {/* ===== ステッカー (傾き付き) ===== */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#FFE993] text-[#3A2D6B] font-black px-5 py-2 rounded-full border-2 border-[#3A2D6B] shadow-md -rotate-2 text-base">
            {displayName}のトリセツ
          </div>
        </div>

        {/* ===== キャラ画像プレースホルダー =====
            32 タイプ分のキャラ画像を /public/types/ 配下に後で配置。
            現状は枠 + テキストプレースホルダー (絵文字なし、T3-5 方針)。 */}
        <div className="flex justify-center mb-6">
          <div className="relative w-full max-w-[280px] aspect-square rounded-3xl bg-gradient-to-b from-[#BCDEF8]/40 to-[#FFD6E0]/40 border-2 border-[#0094D8]/25 flex items-center justify-center">
            <div className="text-center text-[#3A2D6B]/40">
              <div className="font-black text-2xl tracking-[0.2em] mb-2">
                CHARACTER
              </div>
              <div className="text-xs font-bold">準備中</div>
            </div>
            {/* 装飾 (うっすら) */}
            <Image
              src="/decorations/heart-pink.png"
              alt=""
              width={48}
              height={48}
              aria-hidden="true"
              className="absolute top-3 right-3 w-12 h-12 opacity-60 -rotate-12 pointer-events-none"
            />
            <Image
              src="/decorations/flower-yellow.png"
              alt=""
              width={40}
              height={40}
              aria-hidden="true"
              className="absolute bottom-3 left-3 w-10 h-10 opacity-60 rotate-12 pointer-events-none"
            />
          </div>
        </div>

        {/* ===== タイプ名 + 上ラベル + コードバッジ ===== */}
        <div className="text-center mb-4">
          <p className="text-[#FE3C72] font-bold text-sm mb-1">
            アナタのタイプ
          </p>
          <h1 className="text-[#3A2D6B] font-black text-3xl mb-3 leading-tight drop-shadow-[0_2px_0_rgba(255,255,255,0.6)]">
            {typeName}
          </h1>
          {fullCode && (
            <span className="inline-block bg-[#3A2D6B] text-white font-black text-sm px-4 py-1 rounded-full tracking-[0.25em]">
              {fullCode}
            </span>
          )}
        </div>

        {/* ===== サブ特性 (modifierLabel) ===== */}
        {modifierLabel && (
          <div className="flex justify-center mb-8">
            <span className="bg-[#BCDEF8]/60 text-[#3A2D6B] font-bold text-sm px-4 py-1.5 rounded-full border border-[#0094D8]/30">
              {modifierLabel}
            </span>
          </div>
        )}

        {/* ===== Day 11: 7 章レポート (全無料、MBTI 級の読み応え)
            ① はバーチャート + 説明、②〜⑦ はタイトル + 本文プレースホルダー
            章本文は将来 typeData.chapters[i] のような形式で 32 タイプ分のデータを流し込む */}
        {CHAPTERS.map((ch) => (
          <section key={ch.num} className="mb-8">
            {/* 章ヘッダー (番号バッジ + タイトル) */}
            <div className="flex items-center gap-3 mb-4">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white font-black text-lg flex items-center justify-center">
                {ch.num}
              </span>
              <h2 className="text-[#3A2D6B] font-black text-xl">
                {ch.title}
              </h2>
            </div>

            {/* 章本文カード */}
            <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
              {/* ① のみ Big Five バーチャート (実データ、stored.scores より) */}
              {ch.num === 1 && (
                <div className="space-y-4 mb-5">
                  {bigFive.map((dim) => (
                    <div key={dim.key}>
                      <div className="flex justify-between text-sm font-bold text-[#3A2D6B] mb-1">
                        <span>{dim.label}</span>
                        <span>{dim.percent}%</span>
                      </div>
                      <div
                        className="h-3 rounded-full bg-[#E4E0F5] overflow-hidden"
                        role="progressbar"
                        aria-label={`${dim.label} ${dim.percent}%`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={dim.percent}
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FE3C72] to-[#0094D8]"
                          style={{ width: `${dim.percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ① 直下に既存 subtitle (タイプの短いキャッチ) を表示 */}
              {ch.num === 1 && subtitle && (
                <p className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-3">
                  {subtitle}
                </p>
              )}

              {/* 本文 (プレースホルダー、後で typeData.chapter{ch.num} から取得) */}
              <p className="text-[#3A2D6B]/85 text-sm leading-relaxed">
                {ch.bodyPlaceholder}
              </p>

              {/* ① の最後に診断日 (小さく) */}
              {ch.num === 1 && diagnosedAt && (
                <p className="text-[#3A2D6B]/50 text-xs font-bold mt-4">
                  診断日: {diagnosedAt}
                </p>
              )}
            </div>
          </section>
        ))}

        {/* ===== Day 11.3: 軸2 への誘導 (Owner: QR + キャラコード 4 要素 / Visitor: 自己診断 CTA) =====
            Day 11.2 の FriendGapInvite を 4 要素にシンプル化 (見出し画像 / QR / 説明 / キャラコード)。
            サブ文 / URL コピー / 補足 / マイ図鑑リンクは削除。
            履歴ナビは下半分の integrated 履歴セクションから辿れるため重複削除。
            ¥500 訴求カードは引き続き軸2 (Day 12) に集約のため非表示 */}
        {isOwner ? (
          <FriendGapInvite inviteUrl={inviteUrl} fullCode={fullCode} />
        ) : (
          <VisitorCtaSection />
        )}

        {/* ===== Client: SNS + 画像保存 (Day 10 / Day 11.4 で キャラコード重複削除) =====
            キャラコードは FriendGapInvite 内で表示 (Day 11.3)、ResultActions からは撤去 */}
        <ResultActions typeName={typeName} shareUrl={shareUrl} />

        {/* ===== Owner & integrated > 0: 真のトリセツ履歴 (Day 10 維持) ===== */}
        {integrated.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[#3A2D6B] font-black text-sm mb-3 flex items-baseline justify-between">
              <span>真のトリセツ</span>
              <span className="text-xs font-bold text-[#3A2D6B]/60">
                {integrated.length}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {integrated.map((it) => (
                <Link
                  key={it.id}
                  href={`/integrated/${it.id}`}
                  className="block bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5 hover:bg-[#FFF9F0] transition-colors"
                >
                  <p className="text-base font-black text-[#3A2D6B] mb-1">
                    {it.title}
                  </p>
                  {it.subtitle && (
                    <p className="text-xs text-[#3A2D6B]/70 leading-relaxed mb-2">
                      {it.subtitle}
                    </p>
                  )}
                  <p className="text-[10px] text-[#3A2D6B]/50 font-bold">
                    {formatDate(it.generatedAt)}
                    {" / "}
                    友達評価 {it.perceptionCount} 件
                    {it.includeSelf ? " (自己診断含む)" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ===== 友達からの印象 (件数 > 0 のとき、Day 10 維持) ===== */}
        {perceptions.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[#3A2D6B] font-black text-sm mb-3 flex items-baseline justify-between">
              <span>
                {displayName}を見た、誰かの眼
              </span>
              <span className="text-xs font-bold text-[#3A2D6B]/60">
                {perceptions.length}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {perceptions.map((p) => (
                <article
                  key={p.id}
                  className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-5"
                >
                  <p className="text-[11px] text-[#3A2D6B]/60 font-bold mb-1">
                    {p.perceiverName}さんから見た{displayName}
                  </p>
                  <p className="text-base font-black text-[#3A2D6B]">
                    {p.typeName}
                    {p.modifierLabel && (
                      <span className="text-xs font-normal text-[#3A2D6B]/60 ml-2">
                        ({p.modifierLabel})
                      </span>
                    )}
                  </p>
                  {p.qualitative &&
                    Object.keys(p.qualitative).length > 0 && (
                      <ul className="text-xs text-[#3A2D6B] leading-relaxed mt-3 space-y-1">
                        {p.qualitative.favorite_point && (
                          <li>
                            <span className="text-[#3A2D6B]/60 font-bold">
                              好きなところ:{" "}
                            </span>
                            {p.qualitative.favorite_point}
                          </li>
                        )}
                        {p.qualitative.animal && (
                          <li>
                            <span className="text-[#3A2D6B]/60 font-bold">
                              動物にたとえると:{" "}
                            </span>
                            {p.qualitative.animal}
                          </li>
                        )}
                        {p.qualitative.impression_scene && (
                          <li>
                            <span className="text-[#3A2D6B]/60 font-bold">
                              印象的なシーン:{" "}
                            </span>
                            {p.qualitative.impression_scene}
                          </li>
                        )}
                      </ul>
                    )}
                  {/* Day 12-C1: 詳細結果 (6 章 freemium) へのリンク */}
                  <div className="text-right mt-3">
                    <Link
                      href={`/evaluate/result/${p.id}`}
                      className="text-[#FE3C72] text-xs font-black hover:underline"
                    >
                      結果を見る →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ===== Polish-E E-4: 相互理解度フック (Owner のみ、末尾)
            自己診断は「アナタから見たアナタ」止まり。次の一歩 = 友達評価 で
            相互理解度を測る、への汎用誘導。実数は出さない (友達データの有無
            に依らず使えるテキスト)。実数は Polish-C ランキング + 評価結果
            ページに既出。 */}
        {isOwner && (
          <section className="mb-8">
            <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 text-center">
              <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-2">
                次のステップ
              </p>
              <h2 className="text-[#3A2D6B] font-black text-lg leading-snug mb-3">
                友達に診断してもらおう
              </h2>
              <p className="text-[#3A2D6B]/80 text-sm leading-relaxed mb-5">
                自己診断、完成!
                <br />
                でもこれはまだ「アナタから見たアナタ」。
                <br />
                友達に診断してもらうと
                <span className="font-bold text-[#FE3C72]">相互理解度</span>
                が分かって、
                <br />
                自分でも気づかなかったアナタが見えてくる。
              </p>
              <Link
                href="/friend-evaluation"
                className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black text-base px-8 py-4 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] transition active:translate-y-[2px] active:shadow-[0_2px_0_#3A2D6B]"
              >
                友達に診断してもらう →
              </Link>
            </div>
          </section>
        )}

        {/* ===== Footer ===== */}
        <div className="text-center pt-2 pb-2">
          <Link
            href="/"
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            トップに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

// =========================================================================
// Visitor 経路: 自分の診断を始める CTA + 購入済みログイン (Day 10 から維持)
// =========================================================================
function VisitorCtaSection() {
  return (
    <>
      <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6 mb-5">
        <h2 className="text-[#3A2D6B] font-black text-lg text-center mb-2">
          アナタのトリセツも作れます
        </h2>
        <p className="text-[#3A2D6B]/70 text-sm text-center mb-4 leading-relaxed">
          50 問・約 3 分の自己診断から始まります。
          <br />
          登録不要、無料です。
        </p>
        <div className="flex justify-center">
          <Link
            href="/diagnosis"
            className="inline-block bg-[#FFE993] text-[#3A2D6B] font-black px-8 py-3 rounded-full border-2 border-[#3A2D6B] shadow-[0_4px_0_#3A2D6B] hover:translate-y-0.5 hover:shadow-[0_2px_0_#3A2D6B] active:translate-y-1 active:shadow-[0_0_0_#3A2D6B] transition-all"
          >
            自己診断を始める →
          </Link>
        </div>
      </div>
      <div className="text-center mb-6">
        <Link
          href="/login"
          className="text-[#3A2D6B]/60 text-xs font-bold underline hover:text-[#FE3C72] transition-colors"
        >
          購入済みの方はログイン
        </Link>
      </div>
    </>
  );
}
