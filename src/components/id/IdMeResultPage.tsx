import Link from "next/link";
import { notFound } from "next/navigation";
import IdSiteFooter from "@/components/id/IdSiteFooter";
import IdSiteHeader from "@/components/id/IdSiteHeader";
import { PreferredLocaleSync } from "@/components/result/PreferredLocaleSync";
import { ResultViewTracker } from "@/components/result/ResultViewTracker";
import { SmoothImage } from "@/components/ui/SmoothImage";
import { ID_RESULT_AXES, ID_RESULT_COPY, ID_RESULT_TYPES } from "@/i18n/id/result";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sixteenTypes } from "@/lib/sixteen-types";
import {
  baseIdOf,
  classifyThirtyTwoType,
  nAxisOf,
  thirtyTwoImagePath,
  type ThirtyTwoTypeId,
} from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

type StoredScores = Partial<Record<BigFiveDimension, number>>;

type Props = {
  token?: string;
  previewType?: ThirtyTwoTypeId;
};

function scorePercent(score: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round((score ?? 5) * 10)));
}

function previewScores(typeId: ThirtyTwoTypeId): Record<BigFiveDimension, number> {
  const code = sixteenTypes[baseIdOf(typeId)].code;
  const value = (dimension: "O" | "C" | "E" | "A") =>
    code.includes(`${dimension}＋`) ? 8 : 2;
  return { O: value("O"), C: value("C"), E: value("E"), A: value("A"), N: nAxisOf(typeId) === "N" ? 8 : 2 };
}

function InfoCard({ title, children, tone = "white" }: { title: string; children: React.ReactNode; tone?: "white" | "lavender" | "yellow" }) {
  const background = tone === "lavender" ? "bg-[#F2F0FF]" : tone === "yellow" ? "bg-[#FFF8D8]" : "bg-white";
  return (
    <section className={`rounded-[26px] border border-[#E3E6F5] p-6 shadow-[0_12px_36px_rgba(46,46,92,0.055)] sm:p-8 ${background}`}>
      <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
      <div className="mt-4 text-[16px] leading-[1.85] text-[#4A4A66] sm:text-[17px]">{children}</div>
    </section>
  );
}

export default async function IdMeResultPage({ token, previewType }: Props) {
  const isPreview = previewType !== undefined;
  let scores: StoredScores;
  let displayName = "Anda";
  let typeId: ThirtyTwoTypeId;
  let friendCount = 0;

  if (isPreview) {
    typeId = previewType;
    scores = previewScores(typeId);
  } else {
    if (!token) notFound();
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, scores, display_name, diagnosis_completed_at")
      .eq("owner_token", token)
      .maybeSingle();
    if (error) console.error("[/id/me/[token]] users lookup error:", error);
    if (!data?.diagnosis_completed_at) notFound();
    scores = (data.scores ?? {}) as StoredScores;
    typeId = classifyThirtyTwoType(scores);
    displayName = data.display_name?.trim() || "Anda";
    const { count } = await supabaseAdmin
      .from("friend_perceptions")
      .select("id", { count: "exact", head: true })
      .eq("target_user_id", data.id);
    friendCount = count ?? 0;
  }

  const type = ID_RESULT_TYPES[typeId];
  const rankedAxes = [...ID_RESULT_AXES].sort(
    (a, b) => Math.abs((scores[b.dim] ?? 5) - 5) - Math.abs((scores[a.dim] ?? 5) - 5),
  );
  const signatureAxis = rankedAxes[0];
  const growthAxis = rankedAxes[1] ?? rankedAxes[0];
  const signatureHigh = (scores[signatureAxis.dim] ?? 5) >= 5;
  const growthHigh = (scores[growthAxis.dim] ?? 5) >= 5;

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-[#F8F8FC] text-[#2E2E5C]">
      {!isPreview && token ? (
        <>
          <PreferredLocaleSync ownerToken={token} locale="id" />
          <ResultViewTracker ownerToken={token} friendCount={friendCount} />
        </>
      ) : null}
      <IdSiteHeader />
      <main className="flex-1">
        <section className="overflow-hidden bg-white px-5 pb-14 pt-12 text-center sm:pb-20 sm:pt-16">
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#5B5BEF]">{ID_RESULT_COPY.heroLabel}</p>
          <h1 className="mt-3 text-[38px] font-black leading-tight sm:text-[56px]">{type.name}</h1>
          <p className="mt-2 text-xl font-bold text-[#727287]">{type.essence} · {type.animal}</p>
          <SmoothImage src={thirtyTwoImagePath(typeId)} alt={type.name} width={720} height={720} loading="eager" fetchPriority="high" className="mx-auto mt-4 h-auto w-full max-w-[440px]" />
          <p className="mx-auto mt-1 max-w-2xl text-[19px] font-semibold leading-relaxed text-[#51516E]">
            {isPreview ? type.oneLiner : `${displayName}, ${type.oneLiner.charAt(0).toLowerCase()}${type.oneLiner.slice(1)}`}
          </p>
        </section>

        <div className="mx-auto grid max-w-[900px] gap-6 px-5 py-14 sm:px-8 sm:py-20">
          <InfoCard title="Pola inti Anda" tone="lavender">
            <p>{type.oneLiner}</p>
            <p className="mt-4">Tipe ini menggabungkan cara Anda mencari kemungkinan, menyusun tindakan, terhubung dengan orang lain, membuat keputusan, dan merespons emosi.</p>
          </InfoCard>

          <InfoCard title={ID_RESULT_COPY.axesTitle}>
            <p className="mb-7 text-[#727287]">{ID_RESULT_COPY.axesDescription}</p>
            <div className="space-y-7">
              {ID_RESULT_AXES.map((axis) => {
                const value = scorePercent(scores[axis.dim]);
                return (
                  <div key={axis.dim}>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <h3 className="font-extrabold">{axis.title}</h3>
                      <span className="font-black tabular-nums" style={{ color: axis.color }}>{value}%</span>
                    </div>
                    <div className="relative h-4 overflow-hidden rounded-full" style={{ background: `${axis.color}2E` }}>
                      <div className="h-full rounded-full" style={{ width: `${value}%`, background: axis.color }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-xs font-bold text-[#2E2E5C]/55"><span>{axis.left}</span><span>{axis.right}</span></div>
                    <p className="mt-2 text-sm leading-relaxed text-[#727287]">{value >= 50 ? axis.highDescription : axis.lowDescription}</p>
                  </div>
                );
              })}
            </div>
          </InfoCard>

          <div className="grid gap-6 md:grid-cols-2">
            <InfoCard title="Kekuatan utama" tone="yellow">
              <p>{signatureHigh ? signatureAxis.highStrength : signatureAxis.lowStrength}</p>
            </InfoCard>
            <InfoCard title="Ruang untuk bertumbuh">
              <p>{growthHigh ? growthAxis.highGrowth : growthAxis.lowGrowth}</p>
            </InfoCard>
          </div>

          <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
            <Link href="/id/diagnosis" className="sora-cta rounded-full px-8 py-4 text-center font-bold">{ID_RESULT_COPY.restart}</Link>
            <Link href="/id/types" className="rounded-full border-2 border-[#5B5BEF] bg-white px-8 py-4 text-center font-bold text-[#5B5BEF]">{ID_RESULT_COPY.allTypes}</Link>
          </div>
        </div>
      </main>
      <IdSiteFooter />
    </div>
  );
}
