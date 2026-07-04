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
  thirtyTwoCatchphrase,
  thirtyTwoColor,
  thirtyTwoGroup,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { ThirtyTwoGroup } from "@/lib/thirty-two-content/character-32";
import { CharacterHero } from "@/components/result/CharacterHero";
import { DeepDiveSections } from "@/components/result/DeepDiveSections";
// 他己パート (発散バー/他者評価/職業/みんなの目/招待QR/他己フローティングCTA) は
// /tako/[token] へ移設したため /me からは import しない。
import { computeJob, JOB_FRIEND_THRESHOLD, JOBS } from "@/lib/job";
import { generateShareCode } from "@/lib/share-code";
import { classifyType } from "@/lib/diagnosis";
import { ResultActions } from "@/components/result/ResultActions";
import type {
  BigFiveDimension,
  CModifier,
  NModifier,
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

// users 行のうち /me が使う最小フィールド (本番DB行 / 開発プレビュー用モック 共通の型)。
type MeUserRow = {
  id: string;
  type_id: string | null;
  scores: unknown;
  display_name: string | null;
  invite_code: string | null;
};

export default async function MePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  // ===== プレビュー (token/Supabase を介さずモックスコアで結果ページを描画) =====
  // ?previewType=<32タイプID> 指定時、そのタイプの High/Low モックで描画する。実ユーザー
  // データは一切参照しない (モックのみ)。許可条件は「開発環境」または「/preview/[typeId]
  // 経由 (fromPreview=1)」。本番の通常フロー (?previewType 無し) には影響しない。
  // 例(dev): /me/x?previewType=earnest-elephant__N ／ 本番: /preview/earnest-elephant__N
  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const previewAllowed =
    process.env.NODE_ENV !== "production" || sp.fromPreview === "1";
  const previewType: ThirtyTwoTypeId | null =
    previewAllowed &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]
      ? (rawPreview as ThirtyTwoTypeId)
      : null;
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
      display_name: "プレビュー",
      invite_code: "preview",
    };
  } else {
    const { data, error: userErr } = await supabaseAdmin
      .from("users")
      .select(
        "id, type_id, scores, display_name, invite_code, owner_token, created_at",
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

  // ===== 2. session 解決 → isOwner 判定 =====
  const session = previewType ? null : await getSession();
  const isOwner = !!session && session.id === (user.id as string);

  // ===== 3. friend_perceptions (件数 + 平均スコア) =====
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
  const { data: integratedRows } = previewType
    ? { data: null }
    : await supabaseAdmin
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
  const flag32 = previewType ? true : isThirtyTwoEnabled();
  const t32 = classifyThirtyTwoType(stored);

  // ※「みんなの目」(他己) は /tako/[token] へ移設。/me では算出しない。
  // /me ヒーローのバンド背景色: キャラ画像の無地背景 (四隅実測) に一致させ、画像の四角い縁を
  // 不可視化する。未登録キャラは #E7DCFB にフォールバック。画像差し替え時はここに実測色を追記。
  const HERO_BG_BY_TYPE: Record<string, string> = {
    "earnest-elephant__N": "#E7DCFB", // ユニコーン (unicorn_N・無地版)
    "earnest-elephant__R": "#E7DCFB", // ドラゴン (dragon_R・無地正規化版)
    "steady-turtle__R": "#E7DCFB", // フェニックス (phoenix_R・無地正規化版)
    "steady-turtle__N": "#E7DCFB", // ペガサス (pegasus_N・背景実測 #E7DCFB)
    "gentle-koala__N": "#E7DCFB", // エンジェル (angel_N・背景実測 #E7DCFB)
    "gentle-koala__R": "#E7DCFB", // ゴーレム (golem_R・背景実測 #E7DCFB)
    "solo-hedgehog__N": "#E7DCFB", // オバケ (ghost_N・無地版・背景実測 #E7DCFB)
    "solo-hedgehog__R": "#E7DCFB", // ガイコツ (skeleton_R・無地版・背景実測 #E7DCFB)
    // 空グループ (クリームイエロー無地 #FDEFB4・ばらつき0 で確認済み)
    "quiet-owl__N": "#FDEFB4", // インコ (parakeet_N)
    "quiet-owl__R": "#FDEFB4", // ワシ (eagle_R)
    "seeker-wolf__N": "#FDEFB4", // ツバメ (swallow_N)
    "seeker-wolf__R": "#FDEFB4", // タカ (hawk_R)
    "dreamer-rabbit__N": "#FDEFB4", // ペンギン (penguin_N)
    "dreamer-rabbit__R": "#FDEFB4", // ハクチョウ (swan_R)
    "fantasy-cat__N": "#FDEFB4", // カラス (crow_N)
    "fantasy-cat__R": "#FDEFB4", // ペリカン (pelican_R)
    // 海グループ (EN系・新マスコット・背景 #BEF2F9 無地・ばらつき0 で確認済み)
    "sparkle-dolphin__N": "#BEF2F9", // 画像 jellyfish_N
    "sparkle-dolphin__R": "#BEF2F9", // 画像 dolphin_R
    "ambition-lion__N": "#BEF2F9", // 画像 swordfish_N
    "ambition-lion__R": "#BEF2F9", // 画像 orca_R
    "whim-fox__N": "#BEF2F9", // 画像 octopus_N
    "whim-fox__R": "#BEF2F9", // 画像 shark_R
    "idea-monkey__N": "#BEF2F9", // 画像 clownfish_N
    "idea-monkey__R": "#BEF2F9", // 画像 seal_R
    // 陸グループ (ES系・新マスコット・背景 #D8F2C0 無地・ばらつき0 で確認済み)
    "caretaker-dog__N": "#D8F2C0", // 画像 rabbit_N
    "caretaker-dog__R": "#D8F2C0", // 画像 dog_R
    "brisk-tiger__N": "#D8F2C0", // 画像 elephant_N
    "brisk-tiger__R": "#D8F2C0", // 画像 bear_R
    "smiley-panda__N": "#D8F2C0", // 画像 fox_N
    "smiley-panda__R": "#D8F2C0", // 画像 squirrel_R
    "playful-raccoon__N": "#D8F2C0", // 画像 cheetah_N
    "playful-raccoon__R": "#D8F2C0", // 画像 tiger_R
  };
  const heroBg = HERO_BG_BY_TYPE[t32] ?? "#E7DCFB";
  // ヒーロー色面のフェルトドット色 (中間ティント = グループの彩度高め色)。off は紫フォールバック。
  const dotColor = flag32 ? thirtyTwoColor(t32) : "#C3A0E0";
  // OCEAN コード色: 各グループの帯色を濃トーン化 (帯背景に対し十分なコントラスト)。
  //   帯色→濃トーン: 紫帯→濃紫 / 青帯→深青緑 / 緑帯→濃緑 / 黄帯→濃オリーブ (名言の茶と分離)。
  //   ※内部グループ名は 空=黄・陸=緑 (帯色で対応付け)。称号(名前)はブランド固定ネイビーのまま。
  const CODE_COLOR_BY_GROUP: Record<ThirtyTwoGroup, string> = {
    unknown: "#4A2A78", // 紫帯 (#E7DCFB)
    sea: "#0E5A6B", // 青帯 (#BEF2F9)
    land: "#2C5212", // 緑帯 (#D8F2C0)
    sky: "#5E6B12", // 黄帯 (#FDEFB4) — 濃オリーブ
  };
  const codeColor = flag32
    ? CODE_COLOR_BY_GROUP[thirtyTwoGroup(t32)]
    : "#2B2A6B";
  const sections = flag32 ? selfContentFor(t32) : selfResultContent[sixteenTypeId];
  const dispName = flag32 ? thirtyTwoName(t32) : sixteenType.name;
  const dispEssence = flag32 ? thirtyTwoEssence(t32) : sixteenType.essence;
  const dispImage = flag32
    ? thirtyTwoImagePath(t32)
    : characterImagePath(sixteenTypeId);
  // 説明文(oneLiner): on=32キャラ一文 / off=従来16。
  const dispDesc = flag32 ? thirtyTwoOneLiner(t32) : sixteenType.oneLiner;
  // ヒーローのキャラ名言 (コード直下・セリフ体)。16タイプ時は oneLiner で代替。
  const dispCatch = flag32 ? thirtyTwoCatchphrase(t32) : sixteenType.oneLiner;
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
  // ヒーロー見出し: 称号(essence)のみを大見出しに表示。動物名(小キッカー)は非表示。
  // ※ name/animal データは温存 (job 表示等で参照)。表示からのみ除外。
  const heroTitle = (
    <div className="text-center">
      <div
        className="font-extrabold leading-[1.04] text-[#2B2A6B]"
        style={{ fontSize: "clamp(44px, 14vw, 60px)" }}
      >
        {dispEssence}
      </div>
    </div>
  );
  // OCEAN コード行 (大文字小文字方式): 各軸の高低 (stored スコア ≥5 = 高) を文字の大小で表す。
  //   高 = 大文字・40px・weight800・#2B2A6B / 低 = 小文字・27px・#2B2A6B 40% (baseline 揃え)。
  //   ●○ インジケータは廃止 (大小で高低が伝わる)。ラベル「BIG FIVE CODE」は維持。
  const oceanIsHigh = (k: BigFiveDimension) =>
    (typeof stored[k] === "number" ? (stored[k] as number) : 5) >= 5;
  // 拡散シェア文用のコード表記 (ヒーローの大小方式と同じ: 高=大文字 / 低=小文字)。例 "OCeAN"。
  const dispCode = (["O", "C", "E", "A", "N"] as BigFiveDimension[])
    .map((k) => (oceanIsHigh(k) ? k : k.toLowerCase()))
    .join("");
  const oceanRow = (
    <div className="mt-1.5 md:mt-1 flex items-baseline justify-center gap-1.5">
      {(["O", "C", "E", "A", "N"] as BigFiveDimension[]).map((k) => {
        const high = oceanIsHigh(k);
        return (
          <span
            key={k}
            className="font-extrabold leading-none"
            style={{
              fontSize: high ? "40px" : "27px",
              color: codeColor,
              opacity: high ? 1 : 0.4,
            }}
          >
            {high ? k : k.toLowerCase()}
          </span>
        );
      })}
    </div>
  );
  // キャラ名言: コード直下にセリフ体italicで中央表示。テキストの左右に✦を1つずつ置きブロックを
  //   センタリング (行頭/行末ではなく両脇)。先頭=金スパークル(大)/末尾=スパークル(小)。
  const catchphraseRow = dispCatch ? (
    <div className="mt-1.5 md:mt-1 flex items-center justify-center gap-2">
      <svg
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill="#B8860B"
        aria-hidden="true"
        className="flex-none"
      >
        <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
      </svg>
      <p
        className="italic text-center"
        style={{
          fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
          fontSize: "27px",
          lineHeight: 1.7,
          color: "#6E4A2A",
        }}
      >
        {dispCatch}
      </p>
      <svg
        viewBox="0 0 24 24"
        width="11"
        height="11"
        fill="#C99A2E"
        aria-hidden="true"
        className="flex-none"
      >
        <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
      </svg>
    </div>
  ) : null;

  return (
    // 背景は全面白。ヒーローのキャラ画像をフルブリード (モバイル全幅 / md 以上は max-w-[640px]
    // 中央寄せ) で見せ、グループ色の背景帯 (旧 heroBand) は撤去した。
    // 最外周の枠線・カード・中央寄せ余白は撤去のまま、本文は左右ぎりぎり + PC 上限 1080px。
    <main
      className="relative min-h-screen overflow-x-clip px-4 pb-6 md:px-8 md:pb-10"
      style={{ background: "#FFFDF4" }}
    >
      {/* 枠・カード(水色ボーダー/角丸/grid-bg/カードpadding)を撤去。背景は全面 main の白。
          本文は左右ぎりぎり (mobile px-4 / PC px-8) まで広げ、PC は上限 max-w-[1080px] で中央寄せ。
          overflow-x-clip はヒーロー画像のフルブリード (w-screen) の横はみ出し抑止用。 */}
      <div className="relative z-10 max-w-[1080px] mx-auto">
        {/* ===== ヒーロー色面 (全幅 heroBg: 上部中央グロー + フェルトドット + 称号/OCEAN + 画像) =====
            self-sizing 維持 (固定 height なし)。名前は上部中央グローの上 (画像より前面=隠れない)。
            ドットは中間ティントで上半分・主に PC 側余白に展開。画像は melt-into-bg のまま中央 max-600。 */}
        <div
          className="relative mx-[calc(50%-50vw)] w-screen overflow-hidden"
          style={{ background: heroBg }}
        >
          {/* 上部中央の放射状グロー (heroBg の明るいティント) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[320px]"
            style={{
              background:
                "radial-gradient(ellipse at top center, rgba(255,255,255,0.6) 0%, transparent 68%)",
            }}
          />
          {/* フェルトドット (中間ティント・上半分/主に PC 側余白。中央の画像には重ねない) */}
          <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 11, height: 11, top: "15%", left: "6%" }} />
          <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 8, height: 8, top: "42%", left: "9%" }} />
          <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 13, height: 13, top: "20%", right: "7%" }} />
          <span aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ background: dotColor, width: 8, height: 8, top: "50%", right: "10%" }} />
          {/* 中身 (称号 / OCEAN / 画像) — グロー・ドットより前面。
              モバイルは上部余白を詰め、本文の出だしがビュー下端に覗くようにする。
              ☰ はボトムナビ導入で撤去。 */}
          <div className="relative max-w-[1080px] mx-auto px-4 md:px-8 pt-3 md:pt-2 pb-2">
            {heroTitle}
            {oceanRow}
            {catchphraseRow}
            <div className="max-w-[600px] mx-auto mt-2 md:mt-2">
              <CharacterHero
                imageSrc={dispImage}
                alt={dispName}
                essence={dispEssence}
                name={dispName}
                description={dispDesc}
                imageAspectClassName="aspect-square max-h-[46vh] md:max-h-[400px]"
                imageFitClassName="object-contain"
                imageCardClassName=""
                imageSizes="(min-width: 768px) 600px, 100vw"
                hideDecorations
                hideJobGauge
                jobSlot={{
                  animal: animalName,
                  job: displayJob,
                  friendCount: friendEvalCount,
                  threshold: JOB_FRIEND_THRESHOLD,
                }}
              />
            </div>
          </div>
        </div>
        {/* ===== 本文の肩: クリームの角丸が色面の上にふわっと乗る (色→クリームのベタ切り解消)。
            スクロール誘導は ↓ (chevron) のみ。直下に取説本文がそのまま覗く (見出しは置かない)。
            main 背景=クリームなので、ここから下はシームレスにクリーム。 ===== */}
        <div className="relative mx-[calc(50%-50vw)] w-screen -mt-4 rounded-t-[18px] bg-[#FFFDF4] pt-6 md:pt-3 pb-1">
          <div className="mx-auto max-w-[1080px] px-4 md:px-8 flex flex-col items-center text-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2B2A6B"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="opacity-60 animate-bounce"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
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

          {/* 深掘り (恋愛/仕事/成長、タブ切替)。「みんなの目」(他己) は /tako へ移設。 */}
          <DeepDiveSections typeId={deepDiveTypeId} scores={stored} />
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
            catchphrase={dispCatch}
            code={dispCode}
            topUrl={`${SITE_URL}/`}
          />
        </div>

        {/* ===== 他己診断 (タコ診断) への導線 (Owner) / 自己診断 CTA (Visitor) =====
            他己パート (友達が見たあなた・招待QR) は /tako/[token] に集約したため、
            /me からは「他己診断ページへ」のリンクカードのみ置く。 */}
        {isOwner ? (
          <section className="mb-8">
            <Link
              href={`/tako/${token}`}
              className="block rounded-3xl border-2 border-[#2A3A5C]/25 bg-white p-6 text-center shadow-md transition-colors hover:bg-[#F3F1FB]"
            >
              <p className="text-[#FE3C72] font-black text-[10px] tracking-[0.3em] mb-2">
                他己診断
              </p>
              <h2 className="text-[#2A3A5C] font-black text-lg leading-snug mb-2">
                友達が見た「あなた」も見てみる →
              </h2>
              <p className="text-[#2A3A5C]/70 text-sm leading-relaxed">
                これは「アナタから見たアナタ」。
                <br />
                友達 3 人が診断すると、みんなの目に映るあなたが解けます。
              </p>
            </Link>
          </section>
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
