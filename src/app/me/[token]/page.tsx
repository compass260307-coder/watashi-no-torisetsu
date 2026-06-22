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
import { DeepDiveSections } from "@/components/result/DeepDiveSections";
import { OthersPerceptionSection } from "@/components/result/OthersPerceptionSection";
import { CompatibleTypes } from "@/components/result/CompatibleTypes";
import { JobReveal } from "@/components/result/JobReveal";
import { computeJob, JOB_FRIEND_THRESHOLD } from "@/lib/job";
import { REPORT_FRIEND_THRESHOLD } from "@/lib/report-data";
import { TrisetsuNameTag } from "@/components/result/TrisetsuNameTag";
import { SharePromo } from "@/components/result/SharePromo";
import { FloatingShareCta } from "@/components/result/FloatingShareCta";
import { generateShareCode } from "@/lib/share-code";
import { buildFullCode, classifyModifier, classifyType } from "@/lib/diagnosis";
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

  // ===== 3. friend_perceptions (件数 + 平均スコア) =====
  // 件数は招待CTA / 人数ゲート (他者評価セクション) の判定に使う。
  // perceived_scores (Big Five 0-10) を取得し、自己認知ギャップ表示用に平均する。
  const { data: perceptionRows } = await supabaseAdmin
    .from("friend_perceptions")
    .select("id, perceived_scores, perceiver_name, created_at")
    .eq("target_user_id", user.id)
    .order("created_at", { ascending: true });
  const friendEvalCount = (perceptionRows ?? []).length;

  // ② 評価してくれた友達の名前 (記名表示用)。未入力は「ともだち」にフォールバック。
  const friendNames: string[] = (perceptionRows ?? []).map((r) => {
    const n = ((r.perceiver_name as string | null) ?? "").trim();
    return n.length > 0 ? n : "ともだち";
  });

  // ③ 友達からのメッセージ (記名)。owner_message カラム未適用でも壊れないよう best-effort。
  //    取得失敗 (列なし等) は空配列にフォールバック。表示は React が自動エスケープ。
  let friendMessages: { name: string; message: string }[] = [];
  try {
    const { data: msgRows, error: msgErr } = await supabaseAdmin
      .from("friend_perceptions")
      .select("perceiver_name, owner_message, created_at")
      .eq("target_user_id", user.id)
      .order("created_at", { ascending: true });
    if (!msgErr && msgRows) {
      friendMessages = msgRows
        .map((r) => ({
          name: (((r.perceiver_name as string | null) ?? "").trim() ||
            "ともだち") as string,
          message: ((r.owner_message as string | null) ?? "").trim(),
        }))
        .filter((m) => m.message.length > 0);
    }
  } catch {
    // owner_message カラム未適用などは無視 (メッセージ非表示)
  }

  // 友達評価の平均 (0-10)。各軸、数値がある行だけを母数に平均。0 件なら null。
  const friendAvgScores: Partial<Record<BigFiveDimension, number>> | null =
    (() => {
      const rows = perceptionRows ?? [];
      if (rows.length === 0) return null;
      const dims: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
      const acc: Record<BigFiveDimension, { sum: number; n: number }> = {
        E: { sum: 0, n: 0 },
        A: { sum: 0, n: 0 },
        O: { sum: 0, n: 0 },
        C: { sum: 0, n: 0 },
        N: { sum: 0, n: 0 },
      };
      for (const r of rows) {
        const ps = (r.perceived_scores ?? {}) as Record<string, unknown>;
        for (const d of dims) {
          const v = ps[d];
          if (typeof v === "number") {
            acc[d].sum += v;
            acc[d].n += 1;
          }
        }
      }
      const avg: Partial<Record<BigFiveDimension, number>> = {};
      for (const d of dims) if (acc[d].n > 0) avg[d] = acc[d].sum / acc[d].n;
      return avg;
    })();

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
  // 深掘り (TYPE_DEEP_DIVE) 用の 8 タイプ ID。user.scores から決定論的に導出
  // (classifyType は E/A/O のみ参照、欠損は中央 5.0 fallback)。
  const deepDiveTypeId = classifyType({
    E: stored.E ?? 5,
    A: stored.A ?? 5,
    O: stored.O ?? 5,
    C: stored.C ?? 5,
    N: stored.N ?? 5,
  });
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
  // 動物＋職業システム: 動物は 16 タイプの bare 動物名、職業は他者評価平均から決定
  // (友達 JOB_FRIEND_THRESHOLD 人未満は null = 未定)。
  const animalName = sixteenType.animal;
  const job = computeJob(friendAvgScores, friendEvalCount);

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
          jobSlot={{
            animal: animalName,
            job,
            friendCount: friendEvalCount,
            threshold: JOB_FRIEND_THRESHOLD,
          }}
        />

        {/* ===== シェア導線 (キャラ直下に集約: 結果画像を SNS シェア/保存 + 相互理解度文言) =====
            画像シェアボタンを含む ResultActions をキャラ(CharacterHero)の真下に配置。 */}
        <ResultActions
          typeName={dispName}
          shareUrl={inviteUrl}
          ownerName={displayName}
          essence={dispEssence}
          description={dispDesc}
          imageSrc={dispImage}
          shareCode={shareCode}
        />
        <SharePromo className="mb-8" />

        {/* ===== 章① 自分が見た自分 (緑系見出し・動物名のみ・職業は出さない) ===== */}
        <section aria-labelledby="chapter-self" className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#1FA37A] text-white text-lg flex items-center justify-center"
            >
              🪞
            </span>
            <h2
              id="chapter-self"
              className="text-[#1FA37A] font-black text-2xl leading-tight"
            >
              自分が見た自分
            </h2>
          </div>
          <p className="text-[#3A2D6B]/70 font-bold text-sm mb-5 pl-12">
            アナタは「{animalName}」
          </p>

          {/* 取説 (段落1のみ) */}
          {sections.slice(0, 2).map((sec, idx) => {
            const firstPara = sec.body.split("\n\n")[0];
            return (
              <section key={sec.title} className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <span
                    aria-hidden="true"
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-[#3A2D6B] text-white text-lg flex items-center justify-center"
                  >
                    🎀
                  </span>
                  <h3 className="text-[#3A2D6B] font-black text-xl leading-tight">
                    {sec.title}
                  </h3>
                </div>
                <div className="bg-white rounded-3xl border-2 border-[#0094D8]/25 shadow-md p-6">
                  <p className="text-[#3A2D6B] font-bold text-sm leading-relaxed">
                    {firstPara}
                  </p>
                  {idx === 0 && diagnosedAt && (
                    <p className="text-[#3A2D6B]/50 text-xs font-bold mt-5">
                      診断日: {diagnosedAt}
                    </p>
                  )}
                </div>
              </section>
            );
          })}

          {/* 相性キャラ 2 体 */}
          <CompatibleTypes typeId={deepDiveTypeId} />

          {/* Big Five 発散バー (自己のみ) */}
          <BigFiveDivergingBars scores={stored} />

          {/* 深掘り (強み/弱み/恋愛/仕事/成長、タブ切替) */}
          <DeepDiveSections typeId={deepDiveTypeId} scores={stored} />
        </section>

        {/* ===== 章② 友達が見た自分 (ピンク系見出し・①と同格・職業/統合分析) ===== */}
        <section aria-labelledby="chapter-friend" className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <span
              aria-hidden="true"
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[#FE3C72] text-white text-lg flex items-center justify-center"
            >
              👀
            </span>
            <h2
              id="chapter-friend"
              className="text-[#FE3C72] font-black text-2xl leading-tight"
            >
              友達が見た自分
            </h2>
          </div>

          {/* 職業の発表 (確定で「友達から見たアナタ＝{職業}」+ 統合考察の一言 / 未定はティーザー) */}
          <JobReveal
            job={job}
            animal={animalName}
            threshold={JOB_FRIEND_THRESHOLD}
            friendCount={friendEvalCount}
          />

          {/* ロックされた他者評価 (友達3人で解除、課金なし)。
              解除後は他者分析 / 隠れた強み / 自己認知ギャップ(自分●+友達◆ overlay) / 名前 / メッセージ
              = 自己×他者の統合分析を内包。 */}
          <OthersPerceptionSection
            friendCount={friendEvalCount}
            threshold={REPORT_FRIEND_THRESHOLD}
            isOwner={isOwner}
            selfScores={stored}
            friendAvgScores={friendAvgScores}
            friendNames={friendNames}
            friendMessages={friendMessages}
            inviteUrl={inviteUrl}
          />
        </section>


        {/* ===== Day 11.3: 軸2 への誘導 (Owner: QR + キャラコード 4 要素 / Visitor: 自己診断 CTA) =====
            Day 11.2 の FriendGapInvite を 4 要素にシンプル化 (見出し画像 / QR / 説明 / キャラコード)。
            サブ文 / URL コピー / 補足 / マイ図鑑リンクは削除。
            履歴ナビは下半分の integrated 履歴セクションから辿れるため重複削除。
            ¥500 訴求カードは引き続き軸2 (Day 12) に集約のため非表示 */}
        {isOwner ? (
          // id: 他者評価ロックの「友達に評価してもらう」CTA からのスクロール先
          <div id="friend-invite" className="scroll-mt-6">
            <FriendGapInvite inviteUrl={inviteUrl} fullCode={fullCode} />
          </div>
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
