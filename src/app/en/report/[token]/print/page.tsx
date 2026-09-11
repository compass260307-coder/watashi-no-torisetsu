import { notFound } from "next/navigation";
import { enDetailedProfile, enScenarioLines } from "@/i18n/en/me";
import { EN_RESULT_AXES, EN_RESULT_TYPES } from "@/i18n/en/result";
import { hasFullAccess } from "@/lib/entitlements";
import { supabaseAdmin } from "@/lib/supabase-server";
import { classifyThirtyTwoType } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };
type Scores = Partial<Record<BigFiveDimension, number>>;

export default async function EnglishReportPrintPage({ params }: Props) {
  const { token } = await params;
  const { data } = await supabaseAdmin.from("users").select("id, display_name, scores, diagnosis_completed_at").eq("owner_token", token).maybeSingle();
  if (!data?.diagnosis_completed_at || !(await hasFullAccess(data.id))) notFound();
  const scores = (data.scores ?? {}) as Scores;
  const typeId = classifyThirtyTwoType(scores);
  const type = EN_RESULT_TYPES[typeId];
  const profile = enDetailedProfile(typeId);
  const scenarios = enScenarioLines(scores);
  const pages = [
    { title: "Your core pattern", paragraphs: [profile.core, profile.temperamentCore] },
    { title: "The strengths you bring", paragraphs: [profile.strength, profile.temperamentStrength] },
    { title: "How you tend to love", paragraphs: [profile.love, profile.connection] },
    { title: "Work and purpose", paragraphs: [profile.career] },
    { title: "Your next edge", paragraphs: [profile.growth, profile.temperamentGrowth] },
    { title: "Handle with care", paragraphs: [profile.caution, profile.temperamentCaution] },
  ];
  return (
    <main className="report">
      <section className="page cover"><p className="eyebrow">ALICE DIAGNOSIS</p><h1>{type.name}</h1><p className="subtitle">{type.essence} · {type.animal}</p><p className="lead">{type.oneLiner}</p><div className="name">Prepared for {data.display_name?.trim() || "you"}</div><p className="edition">COMPLETE EDITION</p></section>
      <section className="page"><p className="eyebrow">YOUR FIVE DIMENSIONS</p><h2>The pattern behind your type</h2><div className="axes">{EN_RESULT_AXES.map((axis) => { const value = Math.max(0, Math.min(100, Math.round((scores[axis.dim] ?? 5) * 10))); return <div className="axis" key={axis.dim}><div><strong>{axis.title}</strong><b>{value}%</b></div><span><i style={{ width: `${value}%`, background: axis.color }} /></span><small>{value >= 50 ? axis.highDescription : axis.lowDescription}</small></div>; })}</div></section>
      {pages.map((page, index) => <section className="page" key={page.title}><p className="eyebrow">CHAPTER {index + 1}</p><h2>{page.title}</h2>{page.paragraphs.map((paragraph) => <p className="body" key={paragraph}>{paragraph}</p>)}</section>)}
      <section className="page"><p className="eyebrow">EVERYDAY MOMENTS</p><h2>How your pattern shows up</h2><ol>{scenarios.map((scenario) => <li key={scenario}>{scenario}</li>)}</ol><p className="closing">Use this manual as a lens, not a limit. You are always more complex than one profile.</p></section>
      <style>{`@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#2E2E5C;font-family:Arial,sans-serif}.page{width:210mm;height:297mm;padding:28mm 24mm;page-break-after:always;overflow:hidden;background:linear-gradient(150deg,#fff 0%,#F7F6FF 100%)}.cover{display:flex;flex-direction:column;justify-content:center;text-align:center}.eyebrow{font-size:10pt;font-weight:800;letter-spacing:.2em;color:#5B5BEF}.cover h1{font-size:38pt;margin:16mm 0 4mm}.subtitle{font-size:17pt;font-weight:700;color:#717187}.lead{font-size:15pt;line-height:1.75;margin:18mm auto 0;max-width:145mm}.name{margin-top:22mm;font-size:12pt}.edition{margin-top:7mm;font-size:9pt;font-weight:800;letter-spacing:.22em}h2{font-size:27pt;line-height:1.25;margin:12mm 0 16mm}.body{font-size:15pt;line-height:1.9;margin:0 0 10mm;color:#41415F}.axes{display:grid;gap:8mm}.axis>div{display:flex;justify-content:space-between;font-size:13pt}.axis span{display:block;height:4mm;margin:3mm 0;background:#E7E6F2;border-radius:9mm;overflow:hidden}.axis i{display:block;height:100%;border-radius:9mm}.axis small{font-size:10.5pt;line-height:1.6;color:#67677C}ol{padding-left:8mm}li{font-size:12.5pt;line-height:1.65;margin-bottom:6mm}.closing{margin-top:14mm;padding:8mm;background:#EEEAFE;border-radius:5mm;font-size:12pt;line-height:1.7}.page:last-of-type{page-break-after:auto}`}</style>
    </main>
  );
}
