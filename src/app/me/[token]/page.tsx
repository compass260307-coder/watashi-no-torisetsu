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

import path from "node:path";
import { resolveSiteUrl } from "@/lib/site-url";
// 画像の存在チェックはビルド時生成のマニフェストで行う (scripts/generate-image-manifest.mjs)。
// ランタイム fs.existsSync だとトレーサーが public/ 全体を Function に同梱して
// Vercel の 250MB 上限を超えるため、fs は使わない。
import characterImages from "@/generated/character-images.json";
import { SmoothImage } from "@/components/ui/SmoothImage";
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
  thirtyTwoGroup,
  baseIdOf,
  nAxisOf,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { ResultHero } from "@/components/result/ResultHero";
import { heroColorsForGroup } from "@/lib/hero-colors";
import { preferCutImage } from "@/lib/character-image";
import { DeepDiveSections } from "@/components/result/DeepDiveSections";
import { resolveDeepDiveSections } from "@/lib/deep-dive-resolve";
import { hasFullAccess } from "@/lib/entitlements";
import {
  hasPartTwoAccess,
  STAIR_TEASE,
  STAIR_PART_TWO,
  STAIR_COMPLETE,
} from "@/lib/friend-stairs";
import { resolvePartTwo } from "@/lib/part-two-resolve";
import { PartTwoSections } from "@/components/result/PartTwoSections";
import { FriendStairs } from "@/components/result/FriendStairs";
import { BigFiveDivergingBars } from "@/components/result/BigFiveDivergingBars";
// 他己パート (他者評価/職業/みんなの目/招待QR/他己フローティングCTA) と、
// 自己×友達の「自己認知ギャップ」発散バー(①)は /tako/[token] へ移設。
// ただし自己単体の発散バー(②「5つの軸で見るアナタ」)は自己ページの要素なので /me に残す。
import { computeJob, JOB_FRIEND_THRESHOLD, JOBS } from "@/lib/job";
import { generateShareCode } from "@/lib/share-code";
import { classifyType } from "@/lib/diagnosis";
import { ResultActions } from "@/components/result/ResultActions";
import { CharacterShareButton } from "@/components/result/CharacterShareButton";
import { ResultViewTracker } from "@/components/result/ResultViewTracker";
import { FullAccessPromoCard } from "@/components/result/FullAccessPromoCard";
import { PaidUnlockWatcher } from "@/components/result/PaidUnlockWatcher";
import TopHeader from "@/components/top/TopHeader";
import TopFooter from "@/components/top/TopFooter";
import { ResetDataLink } from "@/components/ResetDataLink";
import { ScrollHideHeader } from "@/components/ScrollHideHeader";
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
  resolveSiteUrl();

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
  // ぶんだけ props で渡す。解放条件 = 課金 (¥299=full) OR 友達3人以上 (friend-stairs.ts)。
  // 未解放ならキャリア/成長は body=null で返り、クライアントバンドルにも本文が乗らない。
  const deepDivePaid = await hasFullAccess(user.id as string);
  // プレビュー (?previewType) は /tako のモック同様「解放後」の見た目で描画する (コンテンツ QA 用)。
  const partTwoUnlocked = previewType
    ? true
    : hasPartTwoAccess(deepDivePaid, friendEvalCount);
  const deepDiveSections = resolveDeepDiveSections(deepDiveTypeId, stored, {
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
  const flag32 = previewType ? true : isThirtyTwoEnabled();
  const t32 = classifyThirtyTwoType(stored);
  // 第二部本文 (強み/あれっ?/取扱い方/ギャップ予告)。未解放時は本文なし (フェイルクローズ)。
  const partTwo = resolvePartTwo(t32, sixteenTypeId, stored, {
    unlocked: partTwoUnlocked,
  });
  // 予兆 (階段1段目): 1人目の友達の perceived_scores から動物メタファーだけ小出しする。
  // 自由記述や友達名は出さない (本人を傷つけない表示ルール)。数値以外は無視。
  const teaseText: string | null = (() => {
    const first = (perceptionRows ?? [])[0];
    if (!first) return null;
    const raw = (first.perceived_scores ?? {}) as Record<string, unknown>;
    const ps: Partial<Record<BigFiveDimension, number>> = {};
    for (const d of ["E", "A", "O", "C", "N"] as BigFiveDimension[]) {
      if (typeof raw[d] === "number") ps[d] = raw[d] as number;
    }
    if (Object.keys(ps).length === 0) return null;
    const teaseAnimal = thirtyTwoAnimal(classifyThirtyTwoType(ps));
    return `友達の目には、アナタは「${teaseAnimal}」っぽく映り始めているみたい…`;
  })();

  // ※「みんなの目」(他己) は /tako/[token] へ移設。/me では算出しない。
  // /me ヒーローのバンド背景色: グループ別の濃トーン (16P の色帯参考)。
  //   キャラ画像は透過版 (characters/cut) を使うため、旧「画像の地色に一致させる」制約は撤廃。
  //   白文字の称号・ラベルが立つ濃さにする。
  // ヒーロー帯トーンは共通ヘルパで解決 (/tako と共有)。flag off(16) は unknown で解決。
  const { heroBg, codeTint } = heroColorsForGroup(
    flag32 ? thirtyTwoGroup(t32) : "unknown",
  );
  const sections = flag32 ? selfContentFor(t32) : selfResultContent[sixteenTypeId];
  const dispName = flag32 ? thirtyTwoName(t32) : sixteenType.name;
  const dispEssence = flag32 ? thirtyTwoEssence(t32) : sixteenType.essence;
  // キャラ画像: /types と同じく背景除去済みの透過版 (characters/cut) を優先。
  //   v3 原画の地色は帯色と微妙にズレて四角い縁が見えるため、透過版なら帯に完全に馴染む。
  //   透過版が無いタイプのみ v3 にフォールバック。
  const v3Image = flag32
    ? thirtyTwoImagePath(t32)
    : characterImagePath(sixteenTypeId);
  const dispImage = preferCutImage(v3Image);
  // SP ヒーローの画像引き上げ量 (下の -mt-*)。既定は -mt-8 (32px) で OCEAN 行と詰めるが、
  // 家など上端まで絵が詰まったキャラは称号/OCEAN に被るため、ビルド時に実測した
  // 「上端の透過余白の割合」(cutTopMargin) が小さいキャラほど引き上げを弱める。
  //   目安: SP の画像幅 ≈ 360px なので 割合 0.1 ≈ 36px の余白 = 32px 引き上げても安全。
  const cutTopMargin: number | undefined = (
    characterImages.cutTopMargin as Record<string, number>
  )[path.basename(dispImage)];
  const heroPullClass =
    cutTopMargin === undefined || cutTopMargin >= 0.1
      ? "-mt-8"
      : cutTopMargin >= 0.05
        ? "-mt-4"
        : "mt-0";
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
  // 説明文(oneLiner): on=32キャラ一文 / off=従来16。
  const dispDesc = flag32 ? thirtyTwoOneLiner(t32) : sixteenType.oneLiner;
  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "アナタ";
  const inviteCode = user.invite_code as string;
  // Phase 1.5-α Day 11.2: QR コード用に絶対 URL を構築 (友達のスマホから直接アクセス可能に)。
  // この招待 URL を QR とシェアボタン(X/IG/LINE/リンクコピー)で共通利用する →
  // リンクで来た友達も QR を読んだ友達も同じ「あなたを評価する」フロー (/friend/[inviteCode]) に着地。
  const inviteUrl = `${SITE_URL}/friend/${inviteCode}`;
  // キャラシェア(拡散)の共有先。/friend(評価依頼)とは別ルート。
  const characterShareUrl = `${SITE_URL}/share/${inviteCode}`;
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
  // ヒーロー見出し (16P 参考): 小ラベル「あなたの性格タイプ:」+ 称号(essence)の大見出し。
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

  return (
    // 背景は全面白。ヒーローのキャラ画像をフルブリード (モバイル全幅 / md 以上は max-w-[640px]
    // 中央寄せ) で見せ、グループ色の背景帯 (旧 heroBand) は撤去した。
    // 最外周の枠線・カード・中央寄せ余白は撤去のまま、本文は左右ぎりぎり + PC 上限 1080px。
    <>
    {/* 決済直後 (?paid=1) だが webhook 反映がまだで未課金表示のとき、「決済処理中…」を出して
        status をポーリング → full 反映で自動的にロック解除表示へ (払ったのにロック→再購入 を防ぐ)。 */}
    {!previewType && sp.paid === "1" && !deepDivePaid && (
      <PaidUnlockWatcher ownerToken={token} />
    )}
    {/* 表示計測 (result_viewed / result_revisited / three_friends_unlocked)。
        プレビュー (?previewType) はモック描画なので計測しない。 */}
    {!previewType && (
      <ResultViewTracker ownerToken={token} friendCount={friendEvalCount} />
    )}
    {/* 16P と同じスクロール連動ヘッダー (下スクロールで隠れ、上スクロールで出る) */}
    <ScrollHideHeader>
      <TopHeader />
    </ScrollHideHeader>
    <main
      className="relative min-h-screen overflow-x-clip px-4 pb-6 md:px-8 md:pb-10"
      style={{ background: "#FFFFFF" }}
    >
      {/* 枠・カード(水色ボーダー/角丸/grid-bg/カードpadding)を撤去。背景は全面 main の白。
          本文は左右ぎりぎり (mobile px-4 / PC px-8) まで広げ、PC は上限 max-w-[1080px] で中央寄せ。
          overflow-x-clip はヒーロー画像のフルブリード (w-screen) の横はみ出し抑止用。 */}
      <div className="relative z-10 max-w-[1080px] mx-auto">
        {/* ===== ヒーロー色面 (全幅 heroBg: 上部中央グロー + フェルトドット + 称号/OCEAN + 画像) =====
            self-sizing 維持 (固定 height なし)。名前は上部中央グローの上 (画像より前面=隠れない)。
            ドットは中間ティントで上半分・主に PC 側余白に展開。画像は melt-into-bg のまま中央 max-600。 */}
        {/* ヒーロー帯 (色帯+斜めクリップ+グロー+ドット+称号/OCEAN+キャラ) は ResultHero に共通化。
            /me は 2カラム・本文幅1080 (既定)。/tako でも同コンポーネントを流用し世界観統一。 */}
        <ResultHero
          label="あなたの性格タイプ:"
          essence={dispEssence}
          scores={stored}
          heroBg={heroBg}
          codeTint={codeTint}
          imageSrc={dispImage}
          alt={dispName}
          name={dispName}
          description={dispDesc}
          heroPullClass={heroPullClass}
          jobSlot={{
            animal: animalName,
            job: displayJob,
            friendCount: friendEvalCount,
            threshold: JOB_FRIEND_THRESHOLD,
          }}
        />
        {/* ===== 本文の肩: ヒーロー帯は斜めカットで白へ繋がる (16P 参考、角丸の肩は廃止)。
            スクロール誘導は ↓ (chevron) のみ。直下に取説本文がそのまま覗く (見出しは置かない)。 ===== */}
        <div className="relative mx-[calc(50%-50vw)] w-screen bg-white pt-4 md:pt-2 pb-1">
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

        {/* 自分のキャラをシェア (拡散→/share/{invite_code})。
            画面右下・ボトムナビ (fixed bottom-0 / z-40) の直上にフローティング固定。
            ナビ高さ (約60px) + iOS セーフエリアぶんを bottom で確保。owner 限定。計測 kind:character。 */}
        {isOwner && (
          <div className="fixed right-3 z-40 bottom-[calc(72px+env(safe-area-inset-bottom))]">
            <CharacterShareButton
              shareUrl={characterShareUrl}
              essence={dispEssence}
            />
          </div>
        )}

        {/* ===== 章① 自分が見た自分 =====
            章見出し「{animal}のトリセツ」は撤去 (キャラ名はトップバー h1 へ移設)。
            キャラ画像の直後、各パートのキャッチー小見出し (heading) から本文が直接始まる。
            aria-labelledby は最初のパート見出し (id=chapter-self) を参照する。 */}
        <section aria-label="自分が見た自分" className="mb-10">
          {/* 取説 (各パート: メイン見出し → 全段落本文)。絵文字+機能ラベルは出さない。
              heading 優先、未設定 (16タイプ等) は title にフォールバック (最低限パートが分かる)。
              ※最初のパート (idx 0 = キャラ直下) は見出しを出さず本文から始める (16P 同様)。 */}
          {/* コンテンツ順: 基本特性 → 5つの軸 → 取扱注意 → 深掘り */}
          {sections.slice(0, 2).map((sec, idx) => {
            const paragraphs = sec.body.split("\n\n");
            // メイン見出し: タイプ固有 heading を優先、未設定は title。
            const mainHeading = sec.heading ?? sec.title;
            return (
              <div key={sec.title}>
                {/* パート1 (基本特性) と パート2 (取扱注意) の間に 5 つの軸を挟む */}
                {idx === 1 && (
                  <div className="mb-14 mt-4">
                    <BigFiveDivergingBars
                      scores={stored}
                      title="五つの性格傾向"
                      number="1"
                    />
                  </div>
                )}
                <section className="mb-14">
                  {/* パート2 見出し: タイプ別文言 (mainHeading) は使わず、章として固定の
                      「② アナタの注意点」(① 五つの性格傾向 と同じ 16P 風スタイル) */}
                  {idx > 0 && (
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
                      >
                        2
                      </span>
                      <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
                        アナタの注意点
                      </h2>
                    </div>
                  )}
                  {/* 挿絵 normal2: 「② アナタの注意点」タイトル直下 (本文の前) に表示 */}
                  {idx === 1 && sceneImage("normal2") && (
                    <SmoothImage
                      src={sceneImage("normal2")!}
                      alt=""
                      width={960}
                      height={640}
                      className="mx-auto mb-6 h-auto w-full max-w-[560px] md:max-w-[760px]"
                    />
                  )}
                  {/* 白い囲み(カード)を外し地の文に。左右 padding は維持。全段落表示。 */}
                  <div className="px-1 pb-1">
                    {paragraphs.map((para, pIdx) => (
                      <p
                        key={`${sec.title}-${pIdx}`}
                        className="body-gothic text-[#1A1A1A] font-normal text-[17px] leading-[1.4] mb-4 last:mb-0"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                  {/* 挿絵 normal1: パート1 (基本特性) の本文の後に表示 */}
                  {idx === 0 && sceneImage("normal1") && (
                    <SmoothImage
                      src={sceneImage("normal1")!}
                      alt=""
                      width={960}
                      height={640}
                      className="mx-auto mb-4 mt-12 h-auto w-full max-w-[560px] md:max-w-[760px]"
                    />
                  )}
                </section>
              </div>
            );
          })}

        </section>



        {/* ===== ③ 友達から見たアナタ (16P 風ロックティーザー) =====
            ぼかしたダミーバーの上に「今すぐロックを解除」カードを重ね、
            解除手段 = 友達へのシェア (ResultActions) をカード内に置く。
            他己パートの本体は /tako/[token]。 */}
        <section className="mt-16">
          <div className="mb-4 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-[3px] border-[#2E2E5C] text-lg font-black text-[#2E2E5C]"
            >
              3
            </span>
            <h2 className="text-[30px] font-black leading-tight text-[#2E2E5C] md:text-[36px]">
              友達から見たアナタ
            </h2>
          </div>

          {/* 階段 (道中の報酬): 1人=予兆 / 3人=第二部 / 5人=本物(/tako)。
              完全未解放 (友達0人) では出さない (2026-07-12 指示。0人時は情報が無くただ重い)。
              1人目の回答が入ってから「進んでいる感」の装置として登場する。 */}
          {!previewType && friendEvalCount >= STAIR_TEASE && (
            <FriendStairs
              friendCount={friendEvalCount}
              stairs={{
                tease: STAIR_TEASE,
                partTwo: STAIR_PART_TWO,
                complete: STAIR_COMPLETE,
              }}
              teaseText={teaseText}
            />
          )}

          {/* 第二部本体。無料ブロック (武器/好かれやすい) は未解放でも本物を表示し、
              🔒ブロック (嫌われやすい/関係別) だけ未解放時はぼかし+解除カードになる。
              出し分けは PartTwoSections 内 (data の null 判定)。 */}
          {(() => {
            // ロック解除の2択 (未解放時に最初の🔒ブロックのぼかし中央へ浮かせる)。
            // 16P のロックカード参考: 浮き角丸バッジ + 中央タイトル + 説明2行 + 全幅ボタン。
            // カードA = 友達3人 (無料・主、QR あり) / カードB = 裏技 (価格は書かない)。
            // SP は縦積み: カードBの浮きバッジ (-18px) が上カードに詰まらないよう gap 広め
            const lockCard = partTwoUnlocked ? undefined : (
              <div className="mx-auto flex w-full max-w-[620px] flex-col items-stretch gap-12 md:flex-row md:gap-4">
                {/* ── カードA: 友達3人 (無料・主) ── */}
                {/* 16P 風: 上辺カラーライン + その中央に丸バッジ (鍵) */}
                <div className="relative flex-1 rounded-xl border-t-4 border-t-[#5B5BEF] bg-white px-4 pb-4 pt-7 text-center shadow-[0_12px_36px_rgba(46,46,92,0.20)]">
                  <span className="absolute -top-[18px] left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white shadow-[0_4px_12px_rgba(91,91,239,0.4)]">
                    <svg
                      width="15"
                      height="15"
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
                  <p className="mb-1 text-[15px] font-black text-[#2E2E5C]">
                    友達{STAIR_PART_TWO}人でロック解除
                  </p>
                  <p className="mb-3 text-[12px] font-bold leading-relaxed text-[#2E2E5C]/60">
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
                    qrSize={96}
                  />
                </div>

                {/* ── カードB: 裏技 (価格は書かない・最下部の課金カードへ) ── */}
                {/* 16P 風: 上辺カラーライン + その中央に丸バッジ (稲妻)。色はAと同じブランド紫 */}
                <div className="relative flex flex-1 flex-col items-center justify-center rounded-xl border-t-4 border-t-[#5B5BEF] bg-white px-4 pb-4 pt-7 text-center shadow-[0_12px_36px_rgba(46,46,92,0.20)]">
                  <span className="absolute -top-[18px] left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-[#5B5BEF] text-white shadow-[0_4px_12px_rgba(91,91,239,0.4)]">
                    {/* 稲妻 = 裏技 (ショートカット) の記号 */}
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
                    </svg>
                  </span>
                  <p className="mb-1 text-[15px] font-black text-[#2E2E5C]">
                    裏技でロック解除
                  </p>
                  <p className="mb-3 text-[12px] font-bold leading-relaxed text-[#2E2E5C]/60">
                    友達を待たなくても、
                    <br className="md:hidden" />
                    今すぐぜんぶ見る方法があります。
                  </p>
                  <a
                    href="#fullaccess-promo"
                    className="flex w-full items-center justify-center rounded-lg bg-[#5B5BEF] px-6 py-2.5 text-[13px] font-black text-white shadow-[0_4px_0_#3d3dc4] transition-all hover:translate-y-0.5 hover:shadow-[0_2px_0_#3d3dc4]"
                  >
                    今すぐアクセス
                  </a>
                </div>
              </div>
            );
            return <PartTwoSections data={partTwo} lockCard={lockCard} />;
          })()}

        </section>

        {/* ===== ④ アナタの深掘り (恋愛/キャリア/成長/相性、タブ切替) =====
            2026-07-12 指示で「友達から見たアナタ」(③) と順序を入れ替え。
            「みんなの目」(他己) は /tako へ移設。 */}
        <div className="mt-16">
          <DeepDiveSections
            sections={deepDiveSections}
            sceneImages={{
              love: sceneImage("love"),
              career: sceneImage("work"),
              growth: sceneImage("school"),
            }}
          />
        </div>


        {/* ページ末尾のリンク類 (トップに戻る / ログイン / Visitor CTA) は撤去。
            ナビゲーションはサイト共通フッター + ボトムナビに集約。 */}
      </div>
    </main>
    {/* PR3: 課金案内カード (トップ以外の全ページ最下部に常設)。第二部が未解放のときのみ。
        ¥299 で買えるのは第二部まで (三層モデル)。友達3人で開いた人には売るものが無いので出さない。
        画像・グループ色を渡して MBTI 風カードでフル表示。 */}
    {!partTwoUnlocked && (
      <FullAccessPromoCard
        ownerToken={token}
        imageSrc={sceneImage("work") ?? sceneImage("normal1") ?? dispImage}
        imageAlt={dispName}
        group={flag32 ? thirtyTwoGroup(t32) : "unknown"}
      />
    )}
    {/* データをリセット導線 (フッター直上)。SP メニュー内と同じ動線をここにも置く。 */}
    <ResetDataLink />
    {/* サイト共通フッター (トップ / /types / /about と同じ)。ボトムナビの高さぶんは
        TopFooter 側ではなく余白で吸収されるため、そのまま置く */}
    <TopFooter />
    </>
  );
}

// Visitor 向け CTA (アナタのトリセツも作れます / 購入済みログイン) と「トップに戻る」は
// 2026-07-06 に撤去 (ナビはサイト共通フッター + ボトムナビに集約)。
