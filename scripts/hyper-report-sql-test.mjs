import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Install @electric-sql/pglite in an ignored tools folder; no app dependency.
const { PGlite } = await import(process.env.HYPER_PGLITE_MODULE ? pathToFileURL(process.env.HYPER_PGLITE_MODULE).href : '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role;
 create table users(id uuid primary key,diagnosis_completed_at timestamptz,acquisition_locale text,acquisition_source text,acquisition_medium text,acquisition_campaign text,campaign text);
 create table payment_history(id uuid primary key,user_id uuid references users(id),paid_at timestamptz,created_at timestamptz,status text,stripe_session_id text,payment_kind text,amount_jpy integer,amount_refunded_minor integer,currency text);
 create table events(id uuid primary key,event_name text,created_at timestamptz,metadata jsonb);
 create table line_accounts(id uuid primary key,line_user_id text,user_id uuid references users(id));
 create table line_plus_subscriptions(id uuid primary key,user_id uuid references users(id),created_at timestamptz,stripe_subscription_id text,status text);
 insert into users values
 ('00000000-0000-4000-8000-000000000001','2026-10-20T15:00:00Z','ja','tiktok','paid_social','jp_tik_01_test',null),
 ('00000000-0000-4000-8000-000000000002','2026-10-21T14:59:59Z','ko','x','cpc',null,'legacy'),
 ('00000000-0000-4000-8000-000000000003','2026-10-21T15:00:00Z','en','tiktok','paid_social','en_test',null),
 ('00000000-0000-4000-8000-000000000004',null,'ja',null,null,null,null),
 ('00000000-0000-4000-8000-000000000005','2026-10-21T10:00:00Z','th','x','paid_social','excluded',null);
 insert into payment_history values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','2026-10-21T01:00Z','2026-10-21T01:00Z','completed','cs_live_1','full_access',499,99,'jpy'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','2026-10-21T02:00Z','2026-10-21T02:00Z','refunded','cs_live_2','result_upgrade',1980,1980,'jpy'),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','2026-10-21T01:00Z','2026-10-21T01:00Z','completed','cs_test_1','full_access',9999,0,'jpy'),
 ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','2026-10-21T01:00Z','2026-10-21T01:00Z','completed','cs_live_4','full_access',5000,1000,'krw'),
 ('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000003','2026-10-21T16:00Z','2026-10-21T16:00Z','completed','cs_live_5','full_access',499,100,'usd');
 insert into events values ('20000000-0000-4000-8000-000000000001','line_follow','2026-10-21T00:00Z','{"line_user_id":"private-line-id"}');
 insert into line_accounts values ('30000000-0000-4000-8000-000000000001','private-line-id','00000000-0000-4000-8000-000000000001');
 insert into line_plus_subscriptions values ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','2026-10-21T03:00Z','sub_real','canceled');
`);
// Simulate the production prerequisite: a verified index already exists. The
// transaction migration must reuse its OID, without rebuilding or duplicating it.
const indexSql=readFileSync(new URL('../supabase/operations/20261022_hyper_report_line_follow_index.sql',import.meta.url),'utf8');
assert.match(indexSql,/create index concurrently if not exists/i);
await db.exec(indexSql.replace(/create index concurrently/i,'create index'));
const originalIndexOid=(await db.query(`select oid from pg_class where relname='idx_events_hyper_line_follow_user_created'`)).rows[0].oid;
await db.exec(readFileSync(new URL('../supabase/migrations/20261022050000_hyper_report_aggregates.sql',import.meta.url),'utf8'));
assert.equal((await db.query(`select oid from pg_class where relname='idx_events_hyper_line_follow_user_created'`)).rows[0].oid,originalIndexOid);
// A fresh user's INSERT must work even when related-fact tables cannot be
// resolved: any accidental search of these names fails this transaction.
await db.exec(`begin;
 alter table payment_history rename to hidden_payment_history;
 alter table line_plus_subscriptions rename to hidden_line_plus_subscriptions;
 alter table events rename to hidden_events;
 insert into users values ('00000000-0000-4000-8000-000000000099','2026-10-01T01:00Z','ja','x','paid_social','new',null);
`);
assert.equal((await db.query(`select count(*)::integer n from hyper_report_dirty_dates where date='2026-10-01'`)).rows[0].n,1);
await db.exec('rollback');
const followIndex=(await db.query(`select indexdef from pg_indexes where indexname='idx_events_hyper_line_follow_user_created'`)).rows[0].indexdef;
assert.match(followIndex,/line_user_id/);
assert.match(followIndex,/created_at/);
assert.match(followIndex,/WHERE.*line_follow/);
const day = async (date,fx={krw:0.1,usd:150}) => (await db.query('select hyper_report_day($1,$2) data',[date,fx])).rows[0].data;
let data = await day('2026-10-21');
const jp = data.daily.find(r=>r.country==='jp');
assert.deepEqual([jp.diagnoses,jp.purchases_full,jp.purchases_upsell,jp.purchases_total,jp.revenue_jpy,jp.line_follows,jp.sub_starts],[1,1,1,2,400,1,1]);
assert.equal(data.daily.find(r=>r.country==='kr').revenue_jpy,400);
assert.equal((await day('2026-10-21',{krw:0.1193156,usd:150})).daily.find(r=>r.country==='kr').revenue_jpy,477.26);
assert.equal(data.hourly.find(r=>r.country==='jp'&&r.diagnoses===1).hour,0);
assert.equal(data.hourly.find(r=>r.country==='kr'&&r.diagnoses===1).hour,23);
assert.equal((await day('2026-10-22')).daily.find(r=>r.country==='us').revenue_jpy,598.5);
await assert.rejects(()=>day('2026-10-22',{}),/missing currency rate/);
assert.equal(JSON.stringify(data).includes('private-line-id'),false);
assert.equal(JSON.stringify(data).includes('00000000-0000'),false);
await db.exec(`update payment_history set amount_refunded_minor=499 where stripe_session_id='cs_live_1'`);
assert.equal((await day('2026-10-21')).daily.find(r=>r.country==='jp').revenue_jpy,0);
await db.exec(`update users set acquisition_campaign='=literal',diagnosis_completed_at='2026-10-19T00:00Z' where id='00000000-0000-4000-8000-000000000001'`);
const dirty=(await db.query(`select date::text from hyper_report_dirty_dates order by date`)).rows.map(r=>r.date);
assert(dirty.includes('2026-10-19') && dirty.includes('2026-10-21'));
assert((await day('2026-10-21')).daily.some(r=>r.campaign==='=literal'));
await db.exec('set role anon');
await assert.rejects(()=>day('2026-10-21'),/permission denied/);
await assert.rejects(()=>db.query('select * from hyper_report_dirty_dates'),/permission denied/);
await db.exec('reset role');
assert.deepEqual((await day('2020-01-01')).daily,[]);
await db.close();
console.log('hyper-report SQL: JST, attribution, refunds, currencies, privacy, dirty dates, RLS passed');
