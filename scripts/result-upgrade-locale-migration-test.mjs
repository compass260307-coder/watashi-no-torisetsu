import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Use an isolated PostgreSQL runtime, never application or production credentials.
// PGLITE_MODULE_PATH can point to an existing PGlite installation for local checks.
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH
  ? pathToFileURL(resolve(process.env.PGLITE_MODULE_PATH)).href
  : '@electric-sql/pglite');
const root = new URL('../', import.meta.url);
const migrationName = '20261012153300_fix_result_upgrade_locale_constraint.sql';
const migrationDir = new URL('supabase/migrations/', root);
assert.equal(readdirSync(migrationDir).filter(name => name.startsWith('20261012153300')).length, 1);
const sql = readFileSync(new URL(migrationName, migrationDir), 'utf8');
const oldSql = readFileSync(new URL('20261009222340_add_korean_result_upgrade_locale.sql', migrationDir), 'utf8');
const base = readFileSync(new URL('20260920200000_result_upgrades.sql', migrationDir), 'utf8')
  .split('insert into storage.buckets')[0];
const db = new PGlite();
const owner = '00000000-0000-0000-0000-000000000001';
const securitySql = `
  select relrowsecurity, relforcerowsecurity, relacl::text,
    (select coalesce(jsonb_agg(to_jsonb(p) order by polname), '[]'::jsonb)
      from pg_policy p where p.polrelid = c.oid) as policies
  from pg_class c where c.oid = 'public.result_upgrades'::regclass`;
const constraintsSql = `select conname, pg_get_constraintdef(oid) as definition, convalidated
  from pg_constraint where conrelid = 'public.result_upgrades'::regclass order by conname`;
const rowsSql = 'select * from public.result_upgrades order by user_id';

async function fixture(locales) {
  await db.exec('drop table if exists public.result_upgrades; drop table if exists public.users;');
  await db.exec('create table public.users (id uuid primary key);');
  await db.exec(base);
  await db.exec(`grant all on public.result_upgrades to anon, authenticated, service_role;
    create policy no_authenticated_read on public.result_upgrades for select to authenticated using (false);
    insert into public.users values ('${owner}');
    insert into public.result_upgrades (user_id, answers, source_type_id, source_character_path)
      values ('${owner}', '["既存回答"]', 'sparkle-dolphin__N', '/types/example.webp');`);
  if (locales !== null) {
    await db.exec("alter table public.result_upgrades add column locale text not null default 'ja';");
    if (locales.length) {
      await db.exec(`alter table public.result_upgrades add constraint result_upgrades_locale_check
        check (locale in (${locales.map(locale => `'${locale}'`).join(', ')}));`);
    }
  }
}

try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for (const [label, locales] of [
    ['Thai constraint', ['ja', 'th']],
    ['production Korean constraint', ['ja', 'ko']],
    ['already corrected constraint', ['ja', 'th', 'ko']],
    ['locale without constraint', []],
    ['legacy table without locale', null],
  ]) {
    await fixture(locales);
    if (locales?.includes('th')) await db.exec("update public.result_upgrades set locale = 'th';");
    if (locales?.includes('ko')) await db.exec("update public.result_upgrades set locale = 'ko';");
    if (label === 'Thai constraint') {
      await db.exec(oldSql);
      await assert.rejects(db.exec("update public.result_upgrades set locale = 'ko';"), { code: '23514' });
    }
    const beforeRows = (await db.query(rowsSql)).rows;
    const beforeSecurity = (await db.query(securitySql)).rows;
    const otherConstraints = (await db.query(constraintsSql)).rows
      .filter(row => row.conname !== 'result_upgrades_locale_check');
    await db.exec(sql);
    await db.exec(sql);
    const expectedRows = beforeRows.map(row => ({ ...row, locale: row.locale ?? 'ja' }));
    assert.deepEqual((await db.query(rowsSql)).rows, expectedRows, `${label}: saved data preserved`);
    assert.deepEqual((await db.query(securitySql)).rows, beforeSecurity, `${label}: RLS/policies/grants preserved`);
    const constraints = (await db.query(constraintsSql)).rows;
    assert.deepEqual(constraints.filter(row => row.conname !== 'result_upgrades_locale_check'
      && !(locales === null && row.conname === 'result_upgrades_locale_not_null')), otherConstraints);
    assert.equal(constraints.find(row => row.conname === 'result_upgrades_locale_check').convalidated, true);
    const column = (await db.query(`select column_default, is_nullable from information_schema.columns
      where table_schema='public' and table_name='result_upgrades' and column_name='locale'`)).rows[0];
    assert.deepEqual(column, { column_default: "'ja'::text", is_nullable: 'NO' });
    for (const locale of ['ja', 'th', 'ko']) {
      await db.query('update public.result_upgrades set locale = $1 where user_id = $2', [locale, owner]);
    }
    for (const locale of ['en', '', null]) {
      await assert.rejects(db.query('update public.result_upgrades set locale = $1 where user_id = $2', [locale, owner]),
        { code: locale === null ? '23502' : '23514' });
    }
    await db.exec('set role anon;');
    assert.equal((await db.query('select count(*)::int as n from public.result_upgrades')).rows[0].n, 0);
    await db.exec('reset role;');
    await db.exec('set role authenticated;');
    assert.equal((await db.query('select count(*)::int as n from public.result_upgrades')).rows[0].n, 0);
    await db.exec('reset role;');
    console.log(`Passed: ${label}, three locales, data/security preservation, idempotency, invalid/null rejection.`);
  }

  // A validation failure must leave both the old constraint and saved data intact.
  await fixture(['ja', 'ko', 'en']);
  await db.exec("update public.result_upgrades set locale = 'en';");
  const beforeRows = (await db.query(rowsSql)).rows;
  const beforeConstraints = (await db.query(constraintsSql)).rows;
  const beforeSecurity = (await db.query(securitySql)).rows;
  await assert.rejects(db.exec(sql), { code: '23514' });
  await db.exec('rollback;');
  assert.deepEqual((await db.query(rowsSql)).rows, beforeRows);
  assert.deepEqual((await db.query(constraintsSql)).rows, beforeConstraints);
  assert.deepEqual((await db.query(securitySql)).rows, beforeSecurity);
  console.log('Passed: incompatible existing data rolls back the entire constraint replacement.');
} finally {
  await db.close();
}
