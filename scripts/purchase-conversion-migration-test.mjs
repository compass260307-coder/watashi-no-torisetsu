// Local in-memory PostgreSQL only. Never loads .env files or connects to Supabase.
// Install @electric-sql/pglite under an ignored tools directory and set PGLITE_MODULE.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const modulePath = process.env.PGLITE_MODULE;
if (!modulePath)
  throw new Error(
    "Set PGLITE_MODULE to the local @electric-sql/pglite dist/index.js",
  );
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const rows = async (query) => (await db.query(query)).rows;
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.payment_history (
      stripe_session_id text, user_id uuid, metadata jsonb, payment_kind text,
      paid_at timestamptz, created_at timestamptz, status text,
      amount_jpy integer, amount_refunded_minor integer
    );
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/2026-08-24-purchase-conversion-outbox.sql",
      "utf8",
    ),
  );
  await db.exec(`
    insert into public.purchase_conversion_outbox
      (provider, stripe_session_id, product, paid_at, status, attempts, next_attempt_at, last_error)
    select provider, session, 'full_access', now() - age, status, 1, now() + interval '1 day', 'configuration incomplete'
    from (values
      ('meta','cs_recent',interval '1 day','failed'),
      ('tiktok','cs_recent',interval '1 day','failed'),
      ('meta','cs_expired',interval '8 days','failed'),
      ('tiktok','cs_expired',interval '8 days','failed'),
      ('tiktok','cs_old_sent',interval '1 day','sent'),
      ('meta','cs_old_processing',interval '1 day','processing')
    ) fixtures(provider,session,age,status);
  `);
  const migration = readFileSync(
    "supabase/migrations/20261022003000_purchase_conversion_destinations.sql",
    "utf8",
  );
  await db.exec(migration);
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_outbox where status='expired'",
      )
    )[0].n,
    2,
  );
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_delivery_outbox where stripe_session_id='cs_expired'",
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_delivery_outbox where stripe_session_id='cs_recent'",
      )
    )[0].n,
    4,
  );
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_outbox where status='expanded'",
      )
    )[0].n,
    2,
  );
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_delivery_outbox where stripe_session_id='cs_old_processing'",
      )
    )[0].n,
    0,
  );
  const oldSent = await rows(
    "select destination_id,status from public.purchase_conversion_delivery_outbox where stripe_session_id='cs_old_sent'",
  );
  assert.equal(
    oldSent.find((r) => r.destination_id === "D9V8IIBC77UFF28NGHK0").status,
    "sent",
  );
  assert.equal(oldSent.filter((r) => r.status === "pending").length, 2);
  await db.query("select public.prepare_purchase_conversion_deliveries()");
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_delivery_outbox",
      )
    )[0].n,
    7,
  );
  // Two claims cannot receive the same active lease.
  const a = await rows(
    "select * from public.claim_due_purchase_conversion_deliveries(2,'cs_recent')",
  );
  const b = await rows(
    "select * from public.claim_due_purchase_conversion_deliveries(2,'cs_recent')",
  );
  assert.equal(a.length, 2);
  assert.equal(b.length, 2);
  assert.equal(new Set([...a, ...b].map((r) => r.id)).size, 4);
  assert.equal(
    (
      await rows(
        "select * from public.claim_due_purchase_conversion_deliveries(100,'cs_recent')",
      )
    ).length,
    0,
  );
  // Abandoned old workers are transferred after the lease, without an extra retry.
  await db.exec(
    "update public.purchase_conversion_outbox set updated_at=now()-interval '16 minutes' where stripe_session_id='cs_old_processing'",
  );
  const recovered = await rows(
    "select * from public.claim_due_purchase_conversion_deliveries(100,'cs_old_processing')",
  );
  assert.equal(recovered.length, 1);
  assert.equal(
    (
      await rows(
        "select status from public.purchase_conversion_outbox where stripe_session_id='cs_old_processing'",
      )
    )[0].status,
    "expanded",
  );
  // Expiry runs over the whole backlog before limiting a claim. Sent rows stay sent.
  await db.exec(`
    update public.purchase_conversion_delivery_outbox set
      paid_at=now()-interval '8 days', status='failed'
      where stripe_session_id='cs_recent';
    insert into public.purchase_conversion_delivery_outbox
      (provider,destination_id,stripe_session_id,product,paid_at)
    values ('meta','','cs_new','full_access',now()-interval '1 hour');
  `);
  const c = await rows(
    "select * from public.claim_due_purchase_conversion_deliveries(1,'cs_new')",
  );
  assert.equal(c.length, 1);
  assert.equal(c[0].stripe_session_id, "cs_new");
  assert.equal(
    (
      await rows(
        "select count(*)::int n from public.purchase_conversion_delivery_outbox where stripe_session_id='cs_recent' and status='expired' and last_error like 'event_expired:%'",
      )
    )[0].n,
    4,
  );
  await db.exec(`
    update public.purchase_conversion_delivery_outbox set updated_at=now()-interval '16 minutes'
      where stripe_session_id='cs_new';
  `);
  assert.equal(
    (
      await rows(
        "select * from public.claim_due_purchase_conversion_deliveries(1,'cs_new')",
      )
    )[0].attempts,
    2,
  );
  await assert.rejects(
    db.exec(`
    insert into public.purchase_conversion_delivery_outbox
      (provider,destination_id,stripe_session_id,product,paid_at)
    values ('meta','','cs_new','full_access',now());
  `),
    /unique/i,
  );
  for (const role of ["anon", "authenticated"]) {
    assert.equal(
      (
        await rows(
          `select has_table_privilege('${role}','public.purchase_conversion_delivery_outbox','SELECT') allowed`,
        )
      )[0].allowed,
      false,
    );
    assert.equal(
      (
        await rows(
          `select has_function_privilege('${role}','public.claim_due_purchase_conversion_deliveries(integer,text)','EXECUTE') allowed`,
        )
      )[0].allowed,
      false,
    );
  }
  assert.equal(
    (
      await rows(
        "select relrowsecurity from pg_class where oid='public.purchase_conversion_delivery_outbox'::regclass",
      )
    )[0].relrowsecurity,
    true,
  );
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /set search_path = ''/);
  console.log(
    "PASS: real PostgreSQL migration, legacy fan-out and sent preservation, active/stale leases, terminal expiry before limits, idempotency, destination uniqueness and RLS/RPC permissions (in-memory DB only).",
  );
} finally {
  await db.close();
}
