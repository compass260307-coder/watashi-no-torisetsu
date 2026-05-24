// プレミアム化 v3 Day 9: 個人の永続アクセス点 (/me/[token])
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
// プライバシー強化:
//   - <meta name="robots" content="noindex" /> で検索除外
//   - Referrer-Policy: same-origin で token を referer で漏らさない (next.config で別途設定可、
//     当面は OGP image を token 非依存にする運用で代替)

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getSession } from "@/lib/session";
import { torisetsuTypes } from "@/lib/torisetsu-data";
import { buildFullCode, classifyModifier } from "@/lib/diagnosis";
import { getModifierLabel } from "@/lib/modifier-data";
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

type StoredScores = Partial<Record<BigFiveDimension, number>> & {
  fullCode?: string;
  cModifier?: CModifier;
  nModifier?: NModifier;
  modifierLabel?: string;
};

interface PageProps {
  params: Promise<{ token: string }>;
}

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

  // ===== 5. ラベル導出 =====
  const stored = (user.scores ?? {}) as StoredScores;
  const { typeName, fullCode, modifierLabel } = deriveTypeLabel(
    user.type_id as string,
    stored,
  );
  const ownerName = ((user.display_name as string | null) ?? "").trim();
  const displayName = ownerName || "あなた";
  const diagnosedAt = formatDate(user.created_at as string);
  const inviteCode = user.invite_code as string;

  return (
    <main className="flex flex-col flex-1 px-5 py-10 max-w-2xl mx-auto w-full pb-16">
      {/* ===== Header ===== */}
      <header className="text-center mb-10 animate-fade-in-up">
        <p className="text-[10px] font-bold tracking-wider text-muted mb-3">
          WATASHI NO TORISETSU
        </p>
        <h1 className="text-2xl font-extrabold leading-tight">
          {displayName}のトリセツ
        </h1>
        {diagnosedAt && (
          <p className="text-[11px] text-muted/80 mt-2">
            診断日: {diagnosedAt}
          </p>
        )}
      </header>

      {/* ===== 1. 自己診断結果 ===== */}
      <section className="mb-10 animate-fade-in-up stagger-2">
        <SectionHeader label="自己診断のあなた" />
        <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
          <p className="text-[11px] tracking-wider text-muted mb-2">TYPE</p>
          <h2 className="text-xl font-extrabold mb-1">{typeName}</h2>
          {modifierLabel && (
            <p className="text-sm text-muted mb-3">{modifierLabel}</p>
          )}
          {fullCode && (
            <p className="text-[11px] tracking-[0.2em] text-muted/80 font-mono">
              {fullCode}
            </p>
          )}
        </div>
      </section>

      {/* ===== 2. 真のトリセツ (integrated_trisetsu, completed のみ) ===== */}
      {integrated.length > 0 ? (
        <section className="mb-10 animate-fade-in-up stagger-2">
          <SectionHeader label="真のトリセツ" count={integrated.length} />
          <div className="flex flex-col gap-3">
            {integrated.map((it) => (
              <Link
                key={it.id}
                href={`/integrated/${it.id}`}
                className="block rounded-2xl border border-card-border bg-card-bg p-5 hover:bg-label-bg transition-all"
              >
                <p className="text-base font-bold mb-1">{it.title}</p>
                {it.subtitle && (
                  <p className="text-xs text-muted leading-relaxed mb-2">
                    {it.subtitle}
                  </p>
                )}
                <p className="text-[10px] text-muted/70">
                  {formatDate(it.generatedAt)}
                  {" / "}
                  友達評価 {it.perceptionCount} 件
                  {it.includeSelf ? " (自己診断含む)" : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : isOwner ? (
        <section className="mb-10 animate-fade-in-up stagger-2">
          <SectionHeader label="真のトリセツ" />
          <div className="rounded-2xl border border-card-border bg-label-bg p-6 text-center">
            <p className="text-sm font-bold mb-2">
              友達 3 人以上の評価で、本格レポートを作れます
            </p>
            <p className="text-xs text-muted leading-relaxed mb-4">
              7 章・5,000 字以上の AI 統合レポート。
              <br />
              PDF として永続保存できます。
            </p>
            <Link
              href="/integrated/new"
              className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md"
            >
              真のトリセツを作る →
            </Link>
          </div>
        </section>
      ) : null}

      {/* ===== 3. 友達からの印象 ===== */}
      {perceptions.length > 0 && (
        <section className="mb-10 animate-fade-in-up stagger-3">
          <SectionHeader
            label={`${displayName}を見た、誰かの眼`}
            count={perceptions.length}
          />
          <div className="flex flex-col gap-3">
            {perceptions.map((p) => (
              <article
                key={p.id}
                className="rounded-2xl border border-card-border bg-card-bg p-5"
              >
                <p className="text-[11px] text-muted mb-1">
                  {p.perceiverName}さんから見た{displayName}
                </p>
                <p className="text-base font-bold">
                  {p.typeName}
                  {p.modifierLabel && (
                    <span className="text-xs font-normal text-muted ml-2">
                      ({p.modifierLabel})
                    </span>
                  )}
                </p>
                {p.qualitative && Object.keys(p.qualitative).length > 0 && (
                  <ul className="text-xs text-foreground leading-relaxed mt-3 space-y-1">
                    {p.qualitative.favorite_point && (
                      <li>
                        <span className="text-muted">好きなところ: </span>
                        {p.qualitative.favorite_point}
                      </li>
                    )}
                    {p.qualitative.animal && (
                      <li>
                        <span className="text-muted">動物にたとえると: </span>
                        {p.qualitative.animal}
                      </li>
                    )}
                    {p.qualitative.impression_scene && (
                      <li>
                        <span className="text-muted">印象的なシーン: </span>
                        {p.qualitative.impression_scene}
                      </li>
                    )}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ===== 4. CTA (Cookie 分岐) ===== */}
      <section className="mb-6 animate-fade-in-up stagger-3">
        {isOwner ? (
          <OwnerCtaBlock
            inviteCode={inviteCode}
            hasIntegrated={integrated.length > 0}
          />
        ) : (
          <VisitorCtaBlock />
        )}
      </section>

      {/* ===== Footer ===== */}
      <footer className="text-center mt-10">
        <Link
          href="/"
          className="text-xs text-muted/70 underline hover:text-foreground"
        >
          トップに戻る
        </Link>
      </footer>
    </main>
  );
}

function SectionHeader({ label, count }: { label: string; count?: number }) {
  return (
    <h3 className="text-sm font-bold text-foreground mb-3 flex items-baseline justify-between">
      <span>{label}</span>
      {typeof count === "number" && (
        <span className="text-[11px] text-muted/80 font-normal">{count}</span>
      )}
    </h3>
  );
}

function OwnerCtaBlock({
  inviteCode,
  hasIntegrated,
}: {
  inviteCode: string;
  hasIntegrated: boolean;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
      <p className="text-sm font-bold mb-3">友達の眼を集めると、もっと立体的に</p>
      <p className="text-xs text-muted leading-relaxed mb-4">
        この招待 URL を友達に送ると、友達があなたを 30 問で評価できます。
      </p>
      <Link
        href={`/friend/${inviteCode}`}
        className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md mb-4"
      >
        招待 URL を開く
      </Link>
      <p className="text-[10px] text-muted/70 leading-relaxed">
        評価が 3 件以上集まると{hasIntegrated ? "、新しく" : ""}「真のトリセツ」を作れます。
        <br />
        <Link
          href="/zukan-mine"
          className="underline hover:text-foreground"
        >
          マイ図鑑で履歴を見る
        </Link>
      </p>
    </div>
  );
}

function VisitorCtaBlock() {
  return (
    <div className="flex flex-col gap-4 items-center">
      <div className="w-full rounded-2xl border border-card-border bg-label-bg p-6 text-center">
        <p className="text-sm font-bold mb-2">あなたのトリセツも作れます</p>
        <p className="text-xs text-muted leading-relaxed mb-4">
          15 問・約 3 分の自己診断から始まります。
          <br />
          登録不要、無料です。
        </p>
        <Link
          href="/diagnosis"
          className="inline-block rounded-full bg-primary-gradient px-6 py-3 text-sm font-bold text-white shadow-md"
        >
          自己診断を始める →
        </Link>
      </div>
      <Link
        href="/login"
        className="text-xs text-muted/80 underline hover:text-foreground"
      >
        購入済みの方はログイン
      </Link>
    </div>
  );
}

