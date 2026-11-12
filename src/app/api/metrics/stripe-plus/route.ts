// Read-only reporting: existing authentication and Stripe connection stay unchanged.
// Export only pseudonymous facts; never names, contact details or raw Stripe IDs.
import { authorizeSheetsMetricsRequest, metricsExportReference, metricsPrivateHeaders } from "@/lib/metrics-access";
import { supabaseAdmin } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === "object" ? v as Row : {};
const str = (v: unknown): string => typeof v === "string" ? v : "";
const id = (v: unknown): string => str(v) || str(row(v).id);
const iso = (v: unknown): string => typeof v === "number" && Number.isFinite(v) ? new Date(v * 1000).toISOString() : "";
const DAY = 86400000, JST = 9 * 3600000;
const product = (v: unknown) => /^alice_plus(?:_|$)/.test(str(v));
function week(ms: number) { const d = new Date(ms + JST); d.setUTCHours(0,0,0,0); d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7); return d.toISOString().slice(0,10); }
async function snapshot(from: string, until: string, secret: string) {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !/^(sk|rk)_live_/.test(key)) throw Error('stripe_key_unavailable');
  const deadline = Date.now() + 50000, end = Date.parse(until), start = Date.parse(from);
  const ref = (value: unknown) => metricsExportReference(str(value), secret);
  async function get(path: string, params: Record<string,string> = {}): Promise<Row> {
    if (Date.now() >= deadline) throw Error('deadline');
    const url = new URL('https://api.stripe.com/v1/' + path);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v));
    const r = await fetch(url, {method:'GET', cache:'no-store', headers:{Authorization:'Bearer '+key, 'Stripe-Version':'2024-06-20'}, signal:AbortSignal.timeout(Math.max(1, Math.min(15000, deadline-Date.now())))});
    if (!r.ok) throw Error('stripe_http_' + r.status);
    return row(await r.json());
  }
  async function list(path: string, params: Record<string,string> = {}, cap=60): Promise<Row[]> {
    const all: Row[] = []; let cursor = '';
    for (let n=0;n<cap;n++) {
      const p = await get(path,{...params,limit:'100',...(cursor?{starting_after:cursor}:{})});
      if (!Array.isArray(p.data) || typeof p.has_more !== 'boolean') throw Error('stripe_schema');
      const rows = p.data.map(row); all.push(...rows);
      if (!p.has_more) return all;
      const last = id(rows.at(-1)); if (!last || last===cursor) throw Error('stripe_cursor'); cursor=last;
    }
    throw Error('stripe_page_cap');
  }
  const [account, allSubscriptions, monthCharges, monthRefunds, dbPlus] = await Promise.all([
    get('account'), list('subscriptions',{status:'all'},20),
    list('charges',{'created[gte]':String(Math.floor(start/1000)),'created[lt]':String(Math.ceil(end/1000)),'expand[]':'data.invoice'}),
    list('refunds',{'created[gte]':String(Math.floor(start/1000)),'created[lt]':String(Math.ceil(end/1000))},20),
    supabaseAdmin.from('line_plus_subscriptions').select('id,user_id,stripe_subscription_id,stripe_payment_intent_id,stripe_checkout_session_id,plan_key').limit(1000)
  ]);
  if (account.id !== 'acct_1TLnf1F7XNJ6QTia') throw Error('stripe_account_mismatch');
  if (dbPlus.error || !dbPlus.data || dbPlus.data.length===1000) throw Error('plus_lookup');
  const bySub = new Map<string,Row>(), byIntent = new Map<string,Row>();
  for (const p of dbPlus.data) { if(str(p.stripe_subscription_id).startsWith('sub_'))bySub.set(p.stripe_subscription_id,p); if(p.stripe_payment_intent_id)byIntent.set(p.stripe_payment_intent_id,p); }
  const subscriptions = allSubscriptions.filter(s => s.livemode===true && (product(row(s.metadata).product)||bySub.has(id(s))));
  const subMap = new Map(subscriptions.map(s=>[id(s),s]));
  for(const sub of bySub.keys()) if(!subMap.has(sub)) throw Error('subscription_missing');
  const charges = new Map(monthCharges.map(c=>[id(c),c]));
  // A refund this month may belong to a payment before month start.
  const missing = [...new Set(monthRefunds.map(r=>id(r.charge)).filter(x=>x&&!charges.has(x)))];
  for(let i=0;i<missing.length;i+=3) for(const c of await Promise.all(missing.slice(i,i+3).map(c=>get('charges/'+encodeURIComponent(c),{'expand[]':'invoice'}))))charges.set(id(c),c);
  const candidates: {charge:Row,userId:string,kind:string}[]=[];
  for(const c of charges.values()) {
    if(c.livemode!==true||c.status!=='succeeded'||c.paid!==true||c.captured!==true)continue;
    if(c.invoice && typeof c.invoice==='string')throw Error('invoice_not_expanded');
    const inv=row(c.invoice),sub=subMap.get(id(inv.subscription)), db=byIntent.get(id(c.payment_intent));
    if(!sub&&!db&&!product(row(c.metadata).product))continue;
    const userId=str(db?.user_id)||str(row(sub?.metadata).user_id)||str(bySub.get(id(sub))?.user_id)||str(row(c.metadata).user_id);
    if(!userId)throw Error('plus_owner_missing');
    candidates.push({charge:c,userId,kind:sub?'alice_plus_subscription':'alice_plus_pass'});
  }
  const userIds=[...new Set([...subscriptions.map(s=>str(row(s.metadata).user_id)||str(bySub.get(id(s))?.user_id)),...candidates.map(c=>c.userId)])];
  if(userIds.some(x=>!x))throw Error('plus_owner_missing');
  const users = new Map<string,Row>();
  for(let i=0;i<userIds.length;i+=100){const r=await supabaseAdmin.from('users').select('id,acquisition_locale,acquisition_source,diagnosis_completed_at').in('id',userIds.slice(i,i+100)).limit(1000);if(r.error||!r.data)throw Error('owner_lookup');for(const u of r.data)users.set(u.id,u);}
  if(userIds.some(x=>!users.has(x)))throw Error('plus_owner_missing');
  const ja=(u:Row|undefined)=>u?.acquisition_locale==='ja'&&!!u.diagnosis_completed_at;
  const eligible=candidates.filter(c=>ja(users.get(c.userId)));
  const intents=[...new Set(eligible.map(c=>id(c.charge.payment_intent)).filter(Boolean))], duplicate=new Set<string>();
  for(let i=0;i<intents.length;i+=100){const r=await supabaseAdmin.from('payment_history').select('stripe_payment_intent_id').in('stripe_payment_intent_id',intents.slice(i,i+100)).in('status',['completed','refunded']).limit(1000);if(r.error||!r.data||r.data.length===1000)throw Error('duplicate_lookup');for(const p of r.data)duplicate.add(p.stripe_payment_intent_id);}
  const sales: Row[] = [], usedUsers=new Set<string>(); let excluded=0;
  for(const {charge:c,userId,kind} of eligible){
    if(c.currency!=='jpy')throw Error('plus_currency');
    if(duplicate.has(id(c.payment_intent))){excluded++;continue;}
    if(c.disputed)throw Error('plus_dispute_requires_reconciliation');
    const inv=row(c.invoice), paid=iso(row(inv.status_transitions).paid_at)||iso(c.created);
    if(!paid)throw Error('payment_time');if(Date.parse(paid)>=end)continue;
    const gross=Number(c.amount_captured);if(!Number.isSafeInteger(gross)||gross<0)throw Error('payment_amount');
    let refunds:Row[]=[];
    if(Number(c.amount_refunded)>0)refunds=await list('refunds',{charge:id(c)},20);
    const successful=refunds.filter(r=>r.status==='succeeded');
    if(successful.reduce((a,r)=>a+Number(r.amount),0)!==Number(c.amount_refunded||0))throw Error('refund_total_mismatch');
    const events=successful.filter(r=>Date.parse(iso(r.created))<end).map(r=>({amount:Number(r.amount),at:iso(r.created)}));
    if(events.some(r=>!Number.isSafeInteger(r.amount)||r.amount<0||!r.at))throw Error('refund_amount');
    const refund=events.reduce((a,r)=>a+r.amount,0);if(refund>gross)throw Error('refund_exceeds_payment');
    sales.push({payment_ref:ref('stripe-plus:'+id(c)),user_ref:ref(userId),paid_at:paid,updated_at:until,product:kind,payment_kind:'subscription',currency:'jpy',gross_jpy:gross,refunded_jpy:refund,status:refund===gross&&gross>0?'refunded':'completed',refunded_at:events.at(-1)?.at||null,refund_events:events,source:'line',locale:'ja'}); usedUsers.add(userId);
  }
  const contracts=subscriptions.filter(s=>ja(users.get(str(row(s.metadata).user_id)||str(bySub.get(id(s))?.user_id)))).filter(s=>Date.parse(iso(s.created))<end).map(s=>{
    const created=iso(s.created),ended=s.ended_at?iso(s.ended_at):null;
    if(!created||(['canceled','incomplete_expired'].includes(str(s.status))&&!ended))throw Error('subscription_end_missing');
    return {created,ended,cancelScheduled:s.cancel_at_period_end===true,status:str(s.status)};
  });
  const weeks=[];
  for(let t=Date.parse(week(start)+'T00:00:00+09:00');t<end;t+=7*DAY){const stop=Math.min(t+7*DAY,end);const alive=(at:number)=>contracts.filter(s=>Date.parse(s.created)<at&&(!s.ended||Date.parse(s.ended)>=at)).length;weeks.push([week(t),alive(t),contracts.filter(s=>s.ended&&Date.parse(s.ended)>=t&&Date.parse(s.ended)<stop).length,t+7*DAY<=end?alive(t+7*DAY):null]);}
  const diagnoses=[...usedUsers].map(k=>{const u=users.get(k)!;return {diagnosis_ref:ref(k),completed_at:u.diagnosis_completed_at,locale:'ja',acq_source:u.acquisition_source||null};});
  return {version:1,from,until,observedAt:new Date().toISOString(),timezone:'Asia/Tokyo',source:'Stripe Sora',sales,diagnoses,weeks,contracts:contracts.length,cancelScheduled:contracts.filter(s=>s.cancelScheduled&&(!s.ended||Date.parse(s.ended)>=end)).length,duplicatesExcluded:excluded,scanned:{subscriptions:allSubscriptions.length,charges:charges.size,refunds:monthRefunds.length},complete:true};
}
export async function GET(request:NextRequest){
  const access=authorizeSheetsMetricsRequest(request);if(!access.ok)return NextResponse.json({error:access.error},{status:access.status,headers:metricsPrivateHeaders});
  const from=request.nextUrl.searchParams.get('from')||'',until=request.nextUrl.searchParams.get('until')||'',a=Date.parse(from),b=Date.parse(until);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>31*DAY||b>Date.now()+60000||(a+JST)%DAY!==0)return NextResponse.json({error:'Invalid date range'},{status:400,headers:metricsPrivateHeaders});
  try{return NextResponse.json(await snapshot(from,until,access.exportSecret),{headers:metricsPrivateHeaders});}
  catch(e){const reason=e instanceof Error&&/^[a-z_0-9]+$/.test(e.message)?e.message:'unavailable';console.warn('stripe_plus_metrics_failed',{reason});return NextResponse.json({error:'Plus reporting unavailable; keep previous values',reason},{status:503,headers:metricsPrivateHeaders});}
}
