// Read-only, authenticated dashboard aggregates. Never export chat bodies,
// names, user IDs, session IDs, owner tokens, or Stripe identifiers.
import { authorizeSheetsMetricsRequest, metricsPrivateHeaders } from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;
type Row = Record<string, unknown>;
const DAY=86400000, JST=9*3600000;
const events=['page_view','landing_view','diagnosis_started','diagnosis_completed','share_clicked','share_click','share_completed','share_success','share_link_opened','friend_answer_started','friend_answer_completed','friend_v2_started','friend_v2_completed','friend_invite_clicked','friend_share_clicked','friend_link_copied','result_viewed','result_revisited','friend_to_diagnosis_clicked','friend_v2_self_cta_clicked','friend_landing_viewed','share_landing_viewed','paywall_scroll_clicked','hoshiyomi_page_viewed','paywall_viewed','paywall_plan_viewed','purchase_cta_clicked','checkout_requested','checkout_session_created','purchase_completed','unmei_lp_view','unmei_purchase_start','unmei_purchase_complete','line_follow','line_unfollow','line_message_received','line_alice_plus_subscribed','line_alice_plus_cancelled'];
const date=(at:unknown)=>new Date(Date.parse(String(at))+JST).toISOString().slice(0,10);
function week(at:unknown){const d=new Date(date(at)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
function days(from:string,until:string){const out:string[]=[];for(let n=Date.parse(from);n<Date.parse(until);n+=DAY)out.push(date(new Date(n).toISOString()));return out;}
const ja=(u:Row|undefined)=>u?.acquisition_locale==='ja'&&!!u?.diagnosis_completed_at;
const text=(v:unknown)=>typeof v==='string'?v:'';
function meta(r:Row){return r.metadata&&typeof r.metadata==='object'?r.metadata as Row:{};}
// Seek pagination preserves PostgreSQL timestamp precision, including ties.
// Page and wall-clock caps fail the entire response rather than return partial zeros.
async function scan(table:string,select:string,column:string,from:string|null,until:string|null,filter:(q:ReturnType<typeof supabaseAdmin.from>)=>unknown,deadline:number,maxPages=220):Promise<Row[]> {
  const rows:Row[]=[];let at=from,id='';
  const base=()=>{
    // Filters are built internally, never from request SQL fragments.
    let q=supabaseAdmin.from(table).select(select);
    if(until)q=q.lt(column,until);
    return filter(q as unknown as ReturnType<typeof supabaseAdmin.from>) as unknown as typeof q;
  };
  for(let page=0;page<maxPages;page++){
    if(Date.now()>deadline)throw Error('deadline');
    const batch:Row[]=[];
    if(at&&id){const r=await base().eq(column,at).gt('id',id).order('id').limit(1000);if(r.error)throw Error('query');batch.push(...r.data as unknown as Row[]);}
    if(batch.length<1000){let q=base();if(at)q=id?q.gt(column,at):q.gte(column,at);const r=await q.order(column).order('id').limit(1000-batch.length);if(r.error)throw Error('query');batch.push(...r.data as unknown as Row[]);}
    rows.push(...batch);if(batch.length<1000)return rows;
    const last=batch.at(-1)!;if(at===last[column]&&id===last.id)throw Error('cursor');at=String(last[column]);id=String(last.id);
  }
  throw Error('page cap');
}
async function usersFor(values:unknown[],column:'id'|'owner_token',deadline:number){
  const result=new Map<string,Row>(),keys=[...new Set(values.filter((v):v is string=>typeof v==='string'&&!!v))];
  for(let i=0;i<keys.length;i+=300){
    if(Date.now()>deadline)throw Error('deadline');
    const chunks=[keys.slice(i,i+100),keys.slice(i+100,i+200),keys.slice(i+200,i+300)].filter(c=>c.length);
    const results=await Promise.all(chunks.map(chunk=>supabaseAdmin.from('users').select('id,owner_token,acquisition_locale,diagnosis_completed_at').in(column,chunk).limit(1000)));
    for(const r of results){if(r.error||r.data?.length===1000)throw Error('lookup');for(const u of r.data||[])result.set(String(u[column]),u);}
  }return result;
}
async function funnel(from:string,until:string,deadline:number){
  // Four non-overlapping time ranges bound concurrency and avoid hundreds of
  // serial cross-region round trips. Deduplication still covers the whole day.
  const windows=[];for(let a=Date.parse(from);a<Date.parse(until);a+=DAY/4)windows.push([new Date(a).toISOString(),new Date(Math.min(a+DAY/4,Date.parse(until))).toISOString()]);
  const parts=await Promise.all(windows.map(([a,b])=>scan('events','id,event_name,session_id,owner_token,locale,metadata,created_at','created_at',a,b,q=>(q as unknown as {in:(c:string,v:string[])=>unknown}).in('event_name',events),deadline,60)));
  const facts=parts.flat();if(facts.length>=220000)throw Error('page cap');
  const owners=await usersFor(facts.filter(r=>!r.locale&&!meta(r).locale).map(r=>r.owner_token),'owner_token',deadline);
  const sets=new Map<string,Set<string>>(),groups=new Map<string,{event:string,page:string,cta:string,count:number,sessions:Set<string>}>();
  for(const r of facts){
    const m=meta(r),locale=r.locale||m.locale||owners.get(text(r.owner_token))?.acquisition_locale;if(locale!=='ja')continue;
    const name=String(r.event_name),page=text(m.page||m.path||m.surface),cta=text(m.placement||m.source),key=JSON.stringify([name,page,cta]);
    if(!groups.has(key))groups.set(key,{event:name,page,cta,count:0,sessions:new Set()});
    const g=groups.get(key)!;g.count++;const raw=text(r.session_id)||text(r.owner_token);if(raw)g.sessions.add(raw);
    const session=r.session_id?'session:'+r.session_id:r.owner_token?'owner:'+r.owner_token:'';
    if(session){if(!sets.has(name))sets.set(name,new Set());sets.get(name)!.add(session);}
  }
  const set=(n:string)=>sets.get(n)||new Set<string>(),start=set('diagnosis_started'),complete=set('diagnosis_completed');
  return {daily:[date(from),start.size,complete.size,[...start].filter(k=>complete.has(k)).length,set('purchase_cta_clicked').size,set('checkout_session_created').size,set('purchase_completed').size],groups:[...groups.values()].sort((a,b)=>JSON.stringify([a.event,a.page,a.cta]).localeCompare(JSON.stringify([b.event,b.page,b.cta]))).map(g=>[date(from),g.event,g.page,g.cta,g.count,g.sessions.size]),scanned: facts.length};
}
async function membership(from:string,until:string,deadline:number){
  const identity=(q:ReturnType<typeof supabaseAdmin.from>)=>q;
  const [accounts,plus,chats]=await Promise.all([
    scan('line_accounts','id,user_id,followed_at,created_at','created_at',null,null,identity,deadline,30),
    scan('line_plus_subscriptions','id,user_id,status,purchased_at,created_at,current_period_end,cancel_at_period_end','created_at',null,null,identity,deadline,30),
    scan('line_chat_messages','id,user_id,created_at','created_at',from,until,q=>(q as unknown as {eq:(c:string,v:string)=>unknown}).eq('role','user'),deadline,100)
  ]);
  const users=await usersFor([...accounts,...plus,...chats].map(r=>r.user_id),'id',deadline),daily=new Map<string,[string,number,number]>(),weekly=new Map<string,[string,number,number,number,number|null,number]>();
  for(const d of days(from,until)){
    if(Date.now()>deadline)throw Error('deadline');
    const lo=d+'T00:00:00+09:00',hi=new Date(Math.min(Date.parse(lo)+DAY,Date.parse(until))).toISOString();
    const r=await supabaseAdmin.from('users').select('id',{count:'exact',head:true}).eq('acquisition_locale','ja').gte('diagnosis_completed_at',lo).lt('diagnosis_completed_at',hi);
    if(r.error||!Number.isInteger(r.count)||r.count!<0)throw Error('diagnosis count');daily.set(d,[d,r.count!,0]);const w=week(lo);if(!weekly.has(w))weekly.set(w,[w,0,0,0,null,0]);weekly.get(w)![1]+=r.count!;
  }
  const line=new Set<string>();for(const a of accounts)if(ja(users.get(String(a.user_id)))&&a.followed_at&&Date.parse(String(a.followed_at))<Date.parse(until))line.add(String(a.user_id));
  for(const id of line){const u=users.get(id)!,d=date(u.diagnosis_completed_at);if(daily.has(d)){daily.get(d)![2]++;weekly.get(week(u.diagnosis_completed_at))![2]++;}}
  const activeChats=new Map<string,Set<string>>();for(const c of chats)if(ja(users.get(String(c.user_id)))){const w=week(c.created_at);if(!activeChats.has(w))activeChats.set(w,new Set());activeChats.get(w)!.add(String(c.user_id));}
  let active=0,cancelScheduled=0;
  for(const p of plus){if(!ja(users.get(String(p.user_id))))continue;const purchased=p.purchased_at||p.created_at,ms=Date.parse(String(purchased));if(ms>=Date.parse(from)&&ms<Date.parse(until)){const w=week(purchased);if(!weekly.has(w))weekly.set(w,[w,0,0,0,null,0]);weekly.get(w)![3]++;}
    if(['active','trialing'].includes(String(p.status))&&(!p.current_period_end||Date.parse(String(p.current_period_end))>Date.parse(until)))active++;
    if(p.cancel_at_period_end)cancelScheduled++;
  }
  for(const [w,r] of weekly){r[5]=activeChats.get(w)?.size||0;if(w===week(until))r[4]=active;}
  return {daily:[...daily.values()],weekly:[...weekly.values()].sort((a,b)=>a[0].localeCompare(b[0])),activePlus:active,cancelScheduled,limitations:['subscription_end_history_not_connected','recurring_revenue_not_connected']};
}
export async function GET(request:NextRequest){
  const access=authorizeSheetsMetricsRequest(request);if(!access.ok)return NextResponse.json({error:access.error},{status:access.status,headers:metricsPrivateHeaders});
  const q=request.nextUrl.searchParams,kind=q.get('kind'),from=q.get('from')||'',until=q.get('until')||'',a=Date.parse(from),b=Date.parse(until);
  if(!['funnel','membership'].includes(kind||'')||!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b>Date.now()+60000||(a+JST)%DAY!==0||b-a>(kind==='funnel'?DAY:31*DAY))return NextResponse.json({error:'Invalid kind or date range'},{status:400,headers:metricsPrivateHeaders});
  try{const deadline=Date.now()+50000,data=kind==='funnel'?await funnel(from,until,deadline):await membership(from,until,deadline);return NextResponse.json({version:1,kind,from,until,observedAt:new Date().toISOString(),timezone:'Asia/Tokyo',...data},{headers:metricsPrivateHeaders});}
  catch(e){const reason=e instanceof Error&&['deadline','query','lookup','page cap','cursor','diagnosis count'].includes(e.message)?e.message:'unknown';console.warn('dashboard_aux_failed',{kind,reason});return NextResponse.json({error:'Dashboard auxiliary metrics unavailable; keep previous values'},{status:503,headers:metricsPrivateHeaders});}
}
