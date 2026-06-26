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
  thirtyTwoAnimal,
  thirtyTwoEssence,
  thirtyTwoImagePath,
  thirtyTwoOneLiner,
  thirtyTwoColor,
} from "@/lib/thirty-two-types";
import { CharacterHero } from "@/components/result/CharacterHero";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
import { DeepDiveSections } from "@/components/result/DeepDiveSections";
import { OthersPerceptionSection } from "@/components/result/OthersPerceptionSection";
// 相性キャラ (CompatibleTypes) は将来の /compatibility ページで再利用するため温存し、
// 結果ページからは呼び出さない (import も外す)。
import { JobReveal } from "@/components/result/JobReveal";
import {
  computeJob,
  JOB_FRIEND_THRESHOLD,
  getJobDescription,
  formatJobIntegration,
  JOBS,
} from "@/lib/job";
import { REPORT_FRIEND_THRESHOLD } from "@/lib/report-data";
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

// シェアボタン直下の短い一言 (旧 SharePromo の長い相互理解度文を置換)。
// ⚠️ 仮・定数化。後で差し替え/削除しやすいようここに集約。
const SHARE_CTA_CAPTION = "友達に送って、どう見られてるか聞いてみよう";

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

// hex を白に alpha 分だけ混ぜた「不透明の淡色」を返す (全面背景用。半透明の重ね掛けを防ぐ)。
function paleSurface(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "#ffffff";
  const mix = (c: number) => Math.round(255 * (1 - alpha) + c * alpha);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
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

export default async function MePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

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
  // 背景のグループ色 (flag32 に関係なく t32 由来)。画面全面を不透明の淡色で染め、
  // コンテナも同色にして枠なく全面化。グリッド線は同系色の極薄。
  const groupColor = thirtyTwoColor(t32);
  // ファーストビュー(ヒーロー)だけグループ色、その下の本文エリアは白にする。
  // ヒーローを包むコンテナ(自己サイズ)の全幅背景として使う。上部=グループ色の淡色 (中央に
  // 白のやわらかい光) → コンテナ下端で白へフェードして本文エリア(白)へ自然に繋ぐ。
  // コンテナ高さに追従するので、機種/画面高さが変わっても本文は常に「色が終わって白」から始まる。
  // groupColor 由来なので 4 グループ(黄/緑/青/紫)自動対応。
  const heroBand = `radial-gradient(120% 60% at 50% 22%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, ${paleSurface(
    groupColor,
    0.42,
  )} 0%, ${paleSurface(groupColor, 0.42)} 78%, ${paleSurface(
    groupColor,
    0.16,
  )} 92%, #ffffff 100%)`;
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
  const inviteCode = user.invite_code as string;
  // Phase 1.5-α Day 11.2: QR コード用に絶対 URL を構築 (友達のスマホから直接アクセス可能に)。
  // この招待 URL を QR とシェアボタン(X/IG/LINE/リンクコピー)で共通利用する →
  // リンクで来た友達も QR を読んだ友達も同じ「あなたを評価する」フロー (/friend/[inviteCode]) に着地。
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;
  // SNS シェア保存画像用 (シェアコードは user.id から決定的に生成、表示のみ)
  const shareCode = generateShareCode(user.id as string);
  // 動物＋職業システム: 動物は 16 タイプの bare 動物名、職業は他者評価平均から決定
  // (友達 JOB_FRIEND_THRESHOLD 人未満は null = 未定)。
  // 動物名は表示キャラに合わせる: flag32 on は 32キャラの素の動物 (例 ユニコーン)、
  // off は従来 16 タイプの動物。画像/型名/essence と動物名の不一致を解消。
  const animalName = flag32 ? thirtyTwoAnimal(t32) : sixteenType.animal;
  const job = computeJob(friendAvgScores, friendEvalCount);

  // 職業表示の制御。
  // - forceReveal (デモ): ?revealDemo=1 が付いたときだけ、職業を仮(記者)で差し込む。
  //   /me/[token] は推測不可のトークン限定URLで通常ユーザーが踏むことはなく実質露出しない。
  //   職業決定ロジック (computeJob) は不変、デモは「表示用の job」を差し替えるだけ。
  const forceReveal = sp.revealDemo === "1";
  const displayJob = job ?? (forceReveal ? JOBS.reporter : null);
  // ヘッダー左のキャラ名 (静的表示。変身アニメ JobRevealName は使わない)。「のトリセツ」は付けない。
  // プレフィックス (アクセントのバッジ風) + 動物名 (縁取り) の 2 要素に分けて表示する。
  //   判明 (displayJob あり / ?revealDemo=1 含む): プレフィックス=職業 (例 記者) / 動物名
  //   未判明: プレフィックス="?" (職業が入る空欄ティーザー) / 動物名
  const headerPrefix = displayJob ? displayJob.name : "?";
  const headerAnimal = animalName;

  return (
    // 背景はファーストビュー(ヒーロー)だけグループ色、その下の本文エリアは白。
    // main 自体は白。上部だけ heroBand レイヤーでグループ色を敷き、下端で白へフェードする。
    // 最外周の枠線・カード・中央寄せ余白は撤去のまま、本文は左右ぎりぎり + PC 上限 1080px。
    <main
      className="relative min-h-screen overflow-x-clip py-6 px-4 md:py-10 md:px-8"
      style={{ background: "#ffffff" }}
    >
      {/* 枠・カード(水色ボーダー/角丸/grid-bg/カードpadding)を撤去。背景はヒーローゾーンのみ
          グループ色 (下のゾーン内の背景レイヤー)、本文エリアは main の白。本文は左右ぎりぎり
          (mobile px-4 / PC px-8) まで広げ、PC は読める上限 max-w-[1080px] で中央寄せ。
          overflow-x-clip はヒーローゾーン背景の w-screen ブリードの横はみ出し抑止用。 */}
      <div className="relative z-10 max-w-[1080px] mx-auto">
        {/* ===== ヒーローゾーン (色背景 → 下端で白) =====
            トップバー(キャラ名+アイコン) + キャラ画像 + 職業ゲージ をまとめ、その背後だけを
            全幅のグループ色で塗る。背景レイヤーはゾーンの自己サイズ (inset-y-0) に追従し、下端で
            白へフェード → 本文(章①)は常にこのゾーン直後=白エリアの頭から始まる (機種/画面高さに
            依らず色エリアに食い込まない)。full-bleed は left-1/2 -translate-x-1/2 w-screen
            (main は overflow-x-clip)。pb で職業ゲージ下に色の余白を確保しつつ下端で白へ、
            mb-8 で本文との間に白の余白。 */}
        <div className="relative pb-16 mb-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 w-screen -z-10"
            style={{ background: heroBand }}
          />
          {/* ===== トップバー =====
            左端にキャラ名 (ページ見出し h1)、右端に三本線メニューのみ (シェアアイコンは撤去)。
            キャラ名は min-w-0 + truncate、☰ は shrink-0。名前の表示幅を広く確保。
            ※ 本命のシェア導線 (QR / LINE / 保存 / リンク + 一言) はページ下部に残す。 */}
        <div className="flex items-center justify-between gap-3 mb-3">
          {/* キャラ名: プレフィックス (?=職業の空欄ティーザー / 確定後は職業) をアクセントの
              バッジ風、動物名を白フチ+黄ドロップの縁取り (ロゴのぷっくり世界観) で目立たせる。
              バッジは shrink-0、動物名は min-w-0 truncate でアイコンと重ならない/長ければ省略。 */}
          <h1 className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 inline-flex items-center rounded-xl bg-[#FE3C72] text-white font-black px-2.5 py-0.5 text-lg sm:text-2xl leading-none shadow-[0_2px_0_rgba(58,45,107,0.18)]">
              {headerPrefix}
            </span>
            <span className="header-charname min-w-0 truncate font-black text-3xl sm:text-4xl leading-tight pb-1">
              {headerAnimal}
            </span>
          </h1>
          {/* ヘッダー右はハンバーガーのみ (シェアアイコンは撤去し名前の表示幅を確保)。
              本命のシェア導線 (QR / LINE / 保存 / リンク + 一言) はページ下部に残す。 */}
          <div className="shrink-0">
            <HamburgerMenu myTrisetsuUrl={`/me/${token}`} />
          </div>
        </div>

        {/* ===== ヒーロー (引き) =====
            キャラを枠いっぱいにせず小さめ + object-contain で全身を切らずに表示。
            hideDecorations で画像下のテキスト (肩書き/一言/説明 + キャラ名 h1) は非表示にしつつ、
            「あと○人で職業が判明」ゲージは残す。キャラ名はトップバー h1 に静的表示 (変身演出なし)。
            画像〜本文の余白はヒーローゾーンの pb-16 / mb-8 が担う。 */}
        <div className="w-full md:max-w-md md:mx-auto">
          <CharacterHero
            imageSrc={dispImage}
            alt={dispName}
            essence={dispEssence}
            name={dispName}
            description={dispDesc}
            imageAspectClassName="aspect-square"
            imageFitClassName="object-contain"
            imageMaxWidthClassName="max-w-[230px] mx-auto"
            imageBlend
            hideDecorations
            jobSlot={{
              animal: animalName,
              job: displayJob,
              friendCount: friendEvalCount,
              threshold: JOB_FRIEND_THRESHOLD,
            }}
          />
          </div>
        </div>

        {/* ===== 章① 自分が見た自分 =====
            章見出し「{animal}のトリセツ」は撤去 (キャラ名はトップバー h1 へ移設)。
            キャラ画像の直後、各パートのキャッチー小見出し (heading) から本文が直接始まる。
            aria-labelledby は最初のパート見出し (id=chapter-self) を参照する。 */}
        <section aria-labelledby="chapter-self" className="mb-10">
          {/* 取説 (各パート: メイン見出し → 全段落本文)。絵文字+機能ラベルは出さない。
              heading 優先、未設定 (16タイプ等) は title にフォールバック (最低限パートが分かる)。 */}
          {sections.slice(0, 2).map((sec, idx) => {
            const paragraphs = sec.body.split("\n\n");
            // メイン見出し: タイプ固有 heading を優先、未設定は title。常に出してパートを示す。
            const mainHeading = sec.heading ?? sec.title;
            return (
              <section key={sec.title} className="mb-10">
                {/* メイン見出し。章見出しを廃したぶん、パート見出しが章①の最上位 (h2)。
                    最初のパートに id=chapter-self を付け、section の aria-labelledby を解決。 */}
                <h2
                  id={idx === 0 ? "chapter-self" : undefined}
                  className="text-[#3A2D6B] font-black text-xl leading-tight mb-3"
                >
                  {mainHeading}
                </h2>
                {/* 白い囲み(カード)を外し地の文に。左右 padding は維持。全段落表示。 */}
                <div className="px-1 pb-1">
                  {paragraphs.map((para, pIdx) => (
                    <p
                      key={`${sec.title}-${pIdx}`}
                      className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6] mb-4 last:mb-0"
                    >
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}

          {/* 深掘り (強み/弱み/恋愛/仕事/成長、タブ切替)。
              相性キャラ・自己のみ発散バーは撤去 (発散バーは章②に一本化)。 */}
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

          {/* 職業の発表 (確定で「友達から見たアナタ＝{職業}」+ 一言 / 未定はティーザー) */}
          <JobReveal
            job={job}
            animal={animalName}
            threshold={JOB_FRIEND_THRESHOLD}
            friendCount={friendEvalCount}
          />

          {/* 職業判明後 (job !== null) のみ: 職業単体の説明 → 動物×職業の統合解説 を
              本文として流れで表示。文言はすべて仮・定数 (job.ts) で後から差し替え/AI生成可。
              未判明 (友達<3) は「？{動物}」ティーザーのままで非表示。 */}
          {job && (
            <div className="mb-8">
              {/* 職業単体の説明 (NEW・仮 JOB_DESCRIPTION) */}
              <p className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6] mb-5">
                {getJobDescription(job)}
              </p>
              {/* 動物×職業の統合解説 (NEW・仮 JOB_INTEGRATION、{animal} 差し込み) */}
              <p className="body-gothic text-[#3A2D6B] font-medium text-lg leading-[1.6]">
                {formatJobIntegration(job, animalName)}
              </p>
            </div>
          )}

          {/* 発散バー (章②に一本化)。
              ロック中: 自己のみ (●) + 予告 / 解除後: 自己(●)+友達平均(◆) オーバーレイ。
              枠なしで本文と同じ全幅。解除後の「読み方」も白カードを外し地の文で続ける
              (バーだけ浮かないよう世界観に揃える)。 */}
          {friendEvalCount >= REPORT_FRIEND_THRESHOLD ? (
            <>
              <BigFiveDivergingBars
                scores={stored}
                friendScores={friendAvgScores ?? undefined}
                title="自己認知ギャップ（自分 × 友達）"
                emoji="🪞"
              />
              <aside className="mb-8">
                <h3 className="text-[#3A2D6B] font-black text-base mb-2">
                  このバーの読み方
                </h3>
                <p className="text-[#3A2D6B]/80 font-bold text-sm leading-relaxed mb-2">
                  <span className="text-[var(--primary)]">●</span> ＝ 自分の評価／
                  <span className="text-[#3A2D6B]">◆</span> ＝ 友達の平均。
                  2 つが離れている軸ほど、自分と友達で見え方がズレている軸です。
                </p>
                <p className="text-[#3A2D6B]/70 font-bold text-xs leading-relaxed">
                  軸ごとの差は下の「他者分析」で数値でも確認できます。
                </p>
              </aside>
            </>
          ) : (
            <>
              <BigFiveDivergingBars
                scores={stored}
                title="5つの軸で見るアナタ"
                emoji="✨"
              />
              <p className="text-[#3A2D6B]/60 font-bold text-xs leading-relaxed -mt-4 mb-8">
                いまは自分の評価（●）だけ。友達 {REPORT_FRIEND_THRESHOLD}{" "}
                人が評価すると、友達の平均（◆）が重なって「ズレ」が見えます。
              </p>
            </>
          )}

          {/* ロックされた他者評価 (友達3人で解除、課金なし)。
              ロック中: チラ見せ + ゲージ + QR/LINE 招待。
              解除後: 他者分析(gap) / 隠れた強み / 評価者名 / メッセージ (発散バーは上に一本化)。 */}
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


        {/* ===== 下部・本命シェア導線 (読み終えた位置) =====
            上部はアイコンのみの省スペース版。ここはアイコン+ラベルのしっかり版 + 短い一言。
            owner はこの直下に QR (FriendGapInvite) も続く二段構え。 */}
        <div className="mb-2">
          <p className="text-center text-[#3A2D6B]/80 font-bold text-sm mb-3 px-4">
            {SHARE_CTA_CAPTION}
          </p>
          <ResultActions
            typeName={dispName}
            shareUrl={inviteUrl}
            ownerName={displayName}
            essence={dispEssence}
            description={dispDesc}
            imageSrc={dispImage}
            shareCode={shareCode}
          />
        </div>

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
