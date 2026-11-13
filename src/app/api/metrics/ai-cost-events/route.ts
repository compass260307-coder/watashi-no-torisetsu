// Authenticated, read-only cost reconciliation export. No prompts, generated
// content, user IDs, generation keys, arbitrary metadata or credentials leave DB.
import { authorizeSheetsMetricsRequest, metricsExportReference, metricsPrivateHeaders } from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;
const fields = ["id", "created_at", "feature", "provider", "model", "modality", "status", "provider_request_id", "input_tokens", "output_tokens", "cache_read_input_tokens", "cache_write_input_tokens", "duration_ms", "image_count", "attempt", "error_code"] as const;
type Row = Record<string, unknown>;
const PAGE=1000, CAP=30000;
export async function GET(request: NextRequest) {
  const access=authorizeSheetsMetricsRequest(request);
  if(!access.ok)return NextResponse.json({error:access.error},{status:access.status,headers:metricsPrivateHeaders});
  const from=Date.parse(request.nextUrl.searchParams.get("from")||""),until=Date.parse(request.nextUrl.searchParams.get("until")||"");
  if(!Number.isFinite(from)||!Number.isFinite(until)||until<=from||until-from>31*86400000||from<Date.parse("2026-01-01T00:00:00Z")||until>Date.now())return NextResponse.json({error:"A past range of at most 31 days is required"},{status:400,headers:metricsPrivateHeaders});
  const sinceIso=new Date(from).toISOString(),untilIso=new Date(until).toISOString(),started=Date.now();
  try {
    const base=()=>supabaseAdmin.from("ai_usage_events").select(fields.join(","),{count:"exact"}).gte("created_at",sinceIso).lt("created_at",untilIso);
    const records:Row[]=[];let expected:number|undefined;const seen=new Set<string>();
    for(let offset=0;offset<=CAP;offset+=PAGE){
      if(Date.now()-started>45000)throw Error("deadline");
      const {data,error,count}=await base().order("created_at",{ascending:true}).order("id",{ascending:true}).range(offset,offset+PAGE-1);
      if(error||!Number.isSafeInteger(count)||count===null||count>CAP)throw Error("source incomplete");
      if(expected!==undefined&&count!==expected)throw Error("source changed");expected=count;
      for(const raw of (data||[]) as unknown as Row[]){
        if(typeof raw.id!=="string"||seen.has(raw.id)||!Number.isFinite(Date.parse(String(raw.created_at)))||Date.parse(String(raw.created_at))<from||Date.parse(String(raw.created_at))>=until)throw Error("invalid row");
        seen.add(raw.id);const safe:Row={ref:metricsExportReference(raw.id,access.exportSecret)};
        for(const field of fields)if(field!=="id")safe[field]=raw[field]??null;
        records.push(safe);
      }
      if(records.length===expected)break;
      if(!data?.length)throw Error("short page");
    }
    if(expected===undefined||records.length!==expected)throw Error("pagination incomplete");
    return NextResponse.json({schemaVersion:1,from:sinceIso,until:untilIso,observedAt:new Date().toISOString(),complete:true,rowCount:records.length,records},{headers:metricsPrivateHeaders});
  } catch {
    return NextResponse.json({error:"AI cost evidence unavailable; preserve previous publication"},{status:503,headers:metricsPrivateHeaders});
  }
}
