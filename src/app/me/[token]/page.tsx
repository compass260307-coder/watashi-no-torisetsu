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
} from "@/lib/thirty-two-types";
import { CharacterHero } from "@/components/result/CharacterHero";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { TrisetsuNameTag } from "@/components/result/TrisetsuNameTag";
import { SharePromo } from "@/components/result/SharePromo";
import { FloatingShareCta } from "@/components/result/FloatingShareCta";
import { generateShareCode } from "@/lib/share-code";
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

// Phase 1.5-α Day 12-Polish: 自己診断本文は 16 タイプ別実本文 (lib/self-result-content.ts)
// に置き換え。章タイトル・本文はそこを単一の source とする (旧プレースホルダー CHAPTERS は廃止)。

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

  // ===== 3. friend_perceptions (件数のみ) =====
  // オプションA: /me の「誰かの眼」カードは廃止し、相互理解度ランキング
  // (/friend-evaluation) への単一エントリに一本化。タイプ名/おまけ3問は
  // 詳細ページ (/evaluate/result) に集約したため、ここでは件数だけ見る。
  const { data: perceptionRows } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id")
    .eq("target_user_id", user.id);
  const friendEvalCount = (perceptionRows ?? []).length;

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
  // fullCode は友達招待の「キャラコード」(FriendGapInvite) で利用するため引き続き導出。
  const { fullCode } = deriveTypeLabel(user.type_id as string, stored);
  // Day 12-Polish: 自己診断結果の表示は 16 タイプ (O/C/E/A 高低) で行う。
  // 既存の診断ロジック・スキーマは触らず、user.scores から決定的に派生する。
  const sixteenTypeId = classifySixteenType(stored);
  const sixteenType = sixteenTypes[sixteenTypeId];
  // 解釈B: フラグ on で本文・型名・essence・画像を32化。off=従来16 (完全に従来表示)。
  const flag32 = isThirtyTwoEnabled();
  const t32 = classifyThirtyTwoType(stored);
  const sections = flag32 ? selfContentFor(t32) : selfResultContent[sixteenTypeId];
  const dispName = flag32 ? thirtyTwoName(t32) : sixteenType.name;
  const dispEssence = flag32 ? thirtyTwoEssence(t32) : sixteenType.essence;
  const dispImage = flag32
    ? thirtyTwoImagePath(t32)
    : characterImagePath(sixteenTypeId);
  // 説明文(oneLiner): on=32キャラ一文 / off=従来16。
  const dispDesc = flag32 ? thirtyTwoOneLiner(t32) : sixteenType.oneLiner;
  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  const diagnosedAt = formatDate(user.created_at as string);
  const inviteCode = user.invite_code as string;
  // Phase 1.5-α Day 11.2: QR コード用に絶対 URL を構築 (友達のスマホから直接アクセス可能に)。
  // この招待 URL を QR とシェアボタン(X/IG/LINE/リンクコピー)で共通利用する →
  // リンクで来た友達も QR を読んだ友達も同じ「あなたを評価する」フロー (/friend/[inviteCode]) に着地。
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;
  // SNS シェア保存画像用 (シェアコードは user.id から決定的に生成、表示のみ)
  const shareCode = generateShareCode(user.id as string);

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
          {/* ?stay=1: 診断済み本人が押しても / の自動リダイレクトで /me に
              戻されず、トップ LP を表示できるようにする。 */}
          <Link href="/?stay=1" aria-label="トップへ">
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

        {/* ===== 「{name}のトリセツ」タグ (Koi 参考: 花 + ロゴ風レタリング + ハート) ===== */}
        <TrisetsuNameTag name={displayName} className="mb-4" />

        {/* ===== ヒーロー (丸枠キャラ + essence + 型名 + 短い説明) =====
            旧「CHARACTER 準備中」プレースホルダー / アナタのタイプ eyebrow /
            animal 表示 / OCEA ピル / essence ピル を廃止し CharacterHero に統合。
            「{owner}のトリセツ」黄ピル(上のステッカー)は維持。 */}
        <CharacterHero
          imageSrc={dispImage}
          alt={dispName}
          essence={dispEssence}
          name={dispName}
          description={dispDesc}
        />

        {/* ===== Koi 配置: ヒーロー直下のシェア導線 (SNS共有 + 画像保存 + 相互理解度文言) =====
            旧・最下部にあった ResultActions をここへ移動 (下部の重複は撤去)。 */}
        <ResultActions
          typeName={dispName}
          shareUrl={inviteUrl}
          ownerName={displayName}
          essence={dispEssence}
          description={dispDesc}
          imageSrc={dispImage}
          shareCode={shareCode}
        />

        {/* 相互理解度を促す文言 (Koi 風: 花 + テキスト + 花、中央寄せ) */}
        <SharePromo className="mb-8" />

        {/* ===== Big Five 5 軸の発散バー (ヒーロー + シェア導線クラスタの直下、長文章の前) =====
            スコアは user.scores (0-10) を真実源に、コンポーネント側で 0-100% へ変換して表示。
            診断ロジック・スキーマは触らず、ここでは派生表示のみ (二重計算しない)。 */}
        <BigFiveDivergingBars scores={stored} />

        {/* ===== Day 12-Polish-E: 自己診断本文 = 3 セクション (全無料、16 タイプ別実本文)
            取扱説明書 / 取扱注意ポイント / 相性の良いお相手。各セクション = 2 段落 (\n\n 区切り)。
            Big Five バーチャートは撤去。診断日のみ「取扱説明書」セクション末尾に表示。 */}
        {sections.map((sec, idx) => (
          <section key={sec.title} className="mb-8">
            {/* セクションヘッダー (番号バッジ + タイトル) */}
            <div className="flex items-center gap-3 mb-4">
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white font-black text-lg flex items-center justify-center">
                {idx + 1}
              </span>
              <h2 className="text-[#3A2D6B] font-black text-xl leading-tight">
                {sec.title}
              </h2>
            </div>

            {/* 本文カード (2 段落) */}
            <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
              {sec.body.split("\n\n").map((para, i) => (
                <p
                  key={i}
                  className="text-[#3A2D6B] font-bold text-sm leading-relaxed mb-4 last:mb-0"
                >
                  {para}
                </p>
              ))}

              {/* 取扱説明書 (最初のセクション) の末尾に診断日 (小さく) */}
              {idx === 0 && diagnosedAt && (
                <p className="text-[#3A2D6B]/50 text-xs font-bold mt-5">
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

        {/* ===== 友達評価 導線 (Owner のみ、末尾) =====
            0 件 = 「友達に診断してもらおう」フック (既存維持)。
            1 件以上の「相互理解度 / 友達から見たアナタを見る」カードは撤去。
            その導線は常時表示フローティング CTA (相互理解度はこちら → /friend-evaluation)
            に一本化した (メニュー「相互理解度」からも到達可能、リンク切れなし)。 */}
        {isOwner && friendEvalCount === 0 && (
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
          {/* ?stay=1: 自動リダイレクト回避 (上のロゴリンクと同趣旨)。 */}
          <Link
            href="/?stay=1"
            className="text-[#3A2D6B]/60 font-bold text-sm underline hover:text-[#FE3C72] transition-colors"
          >
            トップに戻る
          </Link>
        </div>
      </div>

      {/* 常時表示フローティング CTA: シェアブロックへスムーズスクロール */}
      <FloatingShareCta />
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
