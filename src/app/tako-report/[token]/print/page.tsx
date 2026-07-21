// PDF生成専用の「友達診断 完全版レポート」描画ページ: /tako-report/[token]/print
//
// tako_unlock 購入者向け。友達1人ごとに1章 (見えたキャラ/本文/恋愛/
// 隠れモテ/ヒント/相性/コツ/ワナ) + 巻末にメッセージ集。
// 友達が増えるたびにページが増える「育つレポート」。PDFルートが内部で開いて印刷する。
//
// 認可: token (owner_token) + hasTakoAccess。未購入は /tako へ誘導 (本文を作らない)。
// プレビュー: dev のみ ?previewType=<32タイプID> でモック描画 (認可スキップ)。

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hasTakoAccess } from "@/lib/entitlements";
import {
  loadOwnerReportData,
  type OwnerReportData,
} from "@/lib/owner-report-data";
import { mockTakoData } from "@/lib/tako-mock";
import {
  buildTakoReportSheets,
  type TakoReportSheet,
} from "@/lib/tako-report-sheets";
import {
  baseIdOf,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import { sixteenTypes } from "@/lib/sixteen-types";
import { preferCutImage } from "@/lib/character-image";
import { heroColorsForGroup } from "@/lib/hero-colors";
import type { BigFiveDimension } from "@/lib/types";

export const metadata: Metadata = {
  title: "友達診断 完全版レポート | ワタシのトリセツ",
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const NAVY = "#2E2E5C";
const INDIGO = "#5B5BEF";

const AXES: { key: BigFiveDimension; label: string; color: string }[] = [
  { key: "O", label: "開放性", color: "#E4AE3A" },
  { key: "C", label: "誠実性", color: "#88619A" },
  { key: "E", label: "外向性", color: "#4298B4" },
  { key: "A", label: "協調性", color: "#33A474" },
  { key: "N", label: "神経症傾向", color: "#F25E62" },
];

const toPct = (v: number | undefined) =>
  Math.max(0, Math.min(100, Math.round((typeof v === "number" ? v : 5) * 10)));

// 章内の小見出し (番号丸 + タイトル)
function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center gap-2.5" style={{ breakAfter: "avoid" }}>
      <span
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 text-[13px] font-black"
        style={{ borderColor: NAVY, color: NAVY }}
      >
        {n}
      </span>
      <h2 className="text-[18px] font-black leading-tight" style={{ color: NAVY }}>
        {children}
      </h2>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="mb-2 mt-5 text-[14px] font-black leading-snug"
      style={{ color: NAVY, breakAfter: "avoid" }}
    >
      {children}
    </h3>
  );
}

function Paras({ paras }: { paras: string[] }) {
  return (
    <>
      {paras.map((p, i) => (
        <p
          key={i}
          className="body-gothic mb-2.5 text-[11.5px] leading-[1.75] text-[#1A1A1A] last:mb-0"
        >
          {p}
        </p>
      ))}
    </>
  );
}

// チェックリスト (2カラム・印刷用コンパクト)
function CheckGrid({
  items,
  tone,
}: {
  items: { title: string; body: string }[];
  tone: "check" | "heart" | "warn";
}) {
  const color =
    tone === "heart" ? "#FF6B9D" : tone === "warn" ? "#F2C14E" : "#4CAF7D";
  const mark = tone === "warn" ? "!" : tone === "heart" ? "♥" : "✓";
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
      {items.map((it) => (
        <div key={it.title} style={{ breakInside: "avoid" }}>
          <p className="mb-0.5 flex items-center gap-1.5 text-[11.5px] font-black" style={{ color: NAVY }}>
            <span
              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px] font-black"
              style={{ borderColor: color, color }}
            >
              {mark}
            </span>
            {it.title}
          </p>
          <p className="body-gothic pl-5.5 text-[10.5px] leading-[1.65] text-[#3A3A48]" style={{ paddingLeft: 22 }}>
            {it.body}
          </p>
        </div>
      ))}
    </div>
  );
}

// 友達1人ぶんの章
function FriendChapter({
  sheet,
  index,
  selfScores,
}: {
  sheet: TakoReportSheet;
  index: number;
  selfScores: Partial<Record<BigFiveDimension, number>>;
}) {
  const hero = heroColorsForGroup(sheet.group);
  return (
    <section className="report-page px-10 py-9" style={{ breakBefore: "page" }}>
      {/* 章ヘッダー (キャラ + 称号) */}
      <div
        className="mb-6 flex items-center gap-5 rounded-2xl px-6 py-5"
        style={{ background: hero.heroBg }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sheet.imageSrc}
          alt=""
          className="h-24 w-24 flex-shrink-0 object-contain"
        />
        <div>
          <p className="text-[11px] font-black tracking-wide text-white/85">
            CHAPTER {index + 1} ── {sheet.viewer}から見たあなた
          </p>
          <p className="mt-1 text-[26px] font-black leading-tight text-white">
            {sheet.essence}
          </p>
          <p className="mt-0.5 text-[11px] font-bold text-white/80">
            {sheet.charName}タイプに見えています
          </p>
        </div>
      </div>

      {/* 本文 (取扱説明書 → 友達視点) */}
      <Paras paras={sheet.manualParas} />

      {/* ① 五つの性格傾向のギャップ */}
      <H2 n={1}>五つの性格傾向のギャップ</H2>
      {sheet.deep && (
        <p
          className="mb-3 rounded-xl px-4 py-3 text-[12.5px] font-black"
          style={{ background: "#F4F4FE", color: NAVY, breakInside: "avoid" }}
        >
          一番のギャップは{sheet.deep.gap.label}。自分では
          {sheet.deep.gap.selfPercent <= 10
            ? "ほぼゼロ"
            : `${sheet.deep.gap.selfPercent}%`}
          、でも{sheet.viewer}は{sheet.deep.gap.otherPercent}%感じてる。
        </p>
      )}
      <div className="mb-1 flex items-center justify-end gap-3 text-[9.5px] font-bold text-[#6A6A7C]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: INDIGO }} />
          {sheet.viewer}の目
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rotate-45" style={{ background: NAVY }} />
          自分の診断
        </span>
      </div>
      <div style={{ breakInside: "avoid" }}>
        {AXES.map((ax) => {
          const other = toPct(sheet.scores[ax.key]);
          const self = toPct(selfScores[ax.key]);
          return (
            <div key={ax.key} className="mb-2">
              <p className="mb-0.5 text-[10px] font-black" style={{ color: NAVY }}>
                {ax.label}: <span style={{ color: ax.color }}>{other}%</span>
              </p>
              <div className="relative h-2.5 w-full rounded-full" style={{ background: "#EFEFF6" }}>
                <div
                  className="absolute left-0 top-0 h-2.5 rounded-full"
                  style={{ width: `${other}%`, background: ax.color, opacity: 0.85 }}
                />
                <span
                  className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45"
                  style={{ left: `calc(${self}% - 4px)`, background: NAVY }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ② 恋愛傾向 */}
      <H2 n={2}>{sheet.viewer}から見た恋愛傾向</H2>
      <Paras paras={sheet.loveParas} />
      <H3>{sheet.viewer}から見た隠れモテポイント</H3>
      <CheckGrid items={sheet.loveChecks} tone="check" />
      <H3>モテるための{sheet.viewer}からのヒント</H3>
      <CheckGrid items={sheet.loveHints} tone="heart" />

      {/* ③ クセ */}
      <H2 n={3}>{sheet.viewer}が気になっているクセ</H2>
      <Paras paras={sheet.kuseParas} />

      {/* ④ 相性 */}
      {sheet.compat && (
        <>
          <H2 n={4}>{sheet.viewer}との相性</H2>
          <p
            className="mb-3 inline-block rounded-xl px-4 py-2 text-[13px] font-black"
            style={{ background: "#FDEEF5", color: "#D14E86", breakInside: "avoid" }}
          >
            相性ランク {sheet.compat.rank} ── 相性度 {sheet.compat.percent}%
            <span className="ml-1 text-[10px] font-bold text-[#B08396]">
              ({sheet.viewer}の回答と自己診断のギャップから推定)
            </span>
          </p>
          <Paras paras={sheet.compat.summaryParas} />
          <H3>関係を深めるヒント</H3>
          <CheckGrid items={sheet.compat.kotsu} tone="check" />
          <H3>関係を壊すワナ</H3>
          <CheckGrid items={sheet.compat.wana} tone="warn" />
        </>
      )}
    </section>
  );
}

export default async function TakoReportPrintPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  // ===== プレビュー (dev のみ): ?previewType=<32タイプID> は認可スキップでモック描画 =====
  const rawPreview = typeof sp.previewType === "string" ? sp.previewType : "";
  const isPreview =
    process.env.NODE_ENV !== "production" &&
    /^[a-z-]+__[NR]$/.test(rawPreview) &&
    Boolean(sixteenTypes[baseIdOf(rawPreview as ThirtyTwoTypeId)]);

  let data: OwnerReportData | null;
  if (isPreview) {
    data = mockTakoData(rawPreview as ThirtyTwoTypeId);
  } else {
    // ===== 認可 (フェイルクローズ: 未購入にはロック画面のPDFすら作らない) =====
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("owner_token", token)
      .maybeSingle();
    if (!user) notFound();
    if (!(await hasTakoAccess(user.id as string))) {
      redirect(`/tako/${encodeURIComponent(token)}`);
    }
    data = await loadOwnerReportData(token);
  }
  if (!data || data.friends.length === 0) notFound();

  const sheets = buildTakoReportSheets(data);
  const ownerName = (data.user.display_name ?? "").trim();
  const ownerType = data.ownerType32;
  const ownerImage = ownerType
    ? preferCutImage(thirtyTwoImagePath(ownerType))
    : null;
  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
  const withMessages = sheets.filter((s) => s.message.length > 0);

  return (
    <div className="bg-white" style={{ color: "#1A1A1A" }}>
      {/* 印刷設定: A4・余白なし (中身側で padding) */}
      <style>{`
        @page { size: A4; margin: 0; }
        @media print { .no-print { display: none !important; } }
        .report-page { break-inside: auto; }
      `}</style>

      {/* ===== 表紙 ===== */}
      <section
        className="report-page relative flex min-h-[297mm] flex-col items-center justify-center px-10 text-center"
        style={{
          background: "linear-gradient(160deg, #EEF0FF 0%, #E4E0F5 55%, #DFF0F5 100%)",
        }}
      >
        <p className="text-[13px] font-black tracking-[0.3em]" style={{ color: INDIGO }}>
          WATASHI NO TORISETSU
        </p>
        <h1
          className="mt-4 text-[38px] font-black leading-[1.35]"
          style={{ color: NAVY }}
        >
          友達診断
          <br />
          完全版レポート
        </h1>
        {ownerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ownerImage} alt="" className="mt-8 h-52 w-52 object-contain" />
        )}
        <p className="mt-8 text-[16px] font-black" style={{ color: NAVY }}>
          {ownerName ? `${ownerName} さん` : "あなた"}
        </p>
        <p className="mt-1.5 text-[12px] font-bold text-[#6A6A7C]">
          {sheets.length}人の友達から見た、あなたのすべて
        </p>
        <p className="absolute bottom-10 text-[10px] font-bold text-[#8A8AA3]">
          {generatedAt} 発行 ── 友達が増えるたびに、このレポートも育ちます
        </p>
      </section>

      {/* ===== 友達ごとの章 ===== */}
      {sheets.map((sheet, i) => (
        <FriendChapter
          key={i}
          sheet={sheet}
          index={i}
          selfScores={data.selfScores}
        />
      ))}

      {/* ===== 巻末: メッセージ集 ===== */}
      {withMessages.length > 0 && (
        <section className="report-page px-10 py-12" style={{ breakBefore: "page" }}>
          <h2
            className="mb-8 text-center text-[24px] font-black"
            style={{ color: NAVY }}
          >
            友達からのメッセージ
          </h2>
          <div className="mx-auto flex max-w-[150mm] flex-col gap-5">
            {withMessages.map((s, i) => (
              <div key={i} className="flex items-start gap-3" style={{ breakInside: "avoid" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.faceSrc}
                  alt=""
                  className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                  style={{ boxShadow: "0 0 0 2px #E3E6F5" }}
                />
                <div
                  className="rounded-2xl rounded-tl-sm px-4 py-3"
                  style={{ background: "#F4F4FE" }}
                >
                  <p className="mb-1 text-[10.5px] font-black" style={{ color: INDIGO }}>
                    {s.name}
                  </p>
                  <p className="body-gothic whitespace-pre-wrap text-[11.5px] leading-[1.75] text-[#1A1A1A]">
                    {s.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-[10px] font-bold text-[#8A8AA3]">
            ワタシのトリセツ ── https://www.watashi-torisetsu.com
          </p>
        </section>
      )}
    </div>
  );
}
