import { beforeAll, afterAll, describe, expect, test } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const db = new PGlite()
const host = '10000000-0000-4000-8000-000000000001'
const alice = '10000000-0000-4000-8000-000000000002'
const bob = '10000000-0000-4000-8000-000000000003'
const plan = '20000000-0000-4000-8000-000000000001'
const req = '30000000-0000-4000-8000-000000000001'
const second = '30000000-0000-4000-8000-000000000002'
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`)
  try {
    return await db.exec(sql)
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)")
  }
}
const values = () =>
  JSON.stringify({
    activity: 'coffee',
    title: 'A real plan',
    lat: 26.9,
    lng: 75.8,
    venue_name: 'Public café',
    starts_at: new Date(Date.now() + 3600000).toISOString(),
    ends_at: new Date(Date.now() + 7200000).toISOString(),
    spots_needed: 1,
    women_only: false,
  })

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text); alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
  `)
  let baseline = read('supabase/schema.sql').split('-- Seed:')[0]
  baseline = baseline
    .replace(/create extension if not exists (postgis|pg_cron);/g, '')
    .replace(
      /  location geography\(point, 4326\) generated always as\s*\(st_setsrid\(st_makepoint\(lng, lat\), 4326\)::geography\) stored,/,
      '',
    )
    .replace(/create index if not exists intents_location_idx[^;]+;/, '')
    .replace(/do \$\$[\s\S]*?alter publication[\s\S]*?end \$\$;/g, '')
    .replace(/select cron.schedule\([\s\S]*?\n\);/, '')
  await db.exec(baseline)
  for (const name of [
    'profile-avatars',
    'contacts',
    'activities-gender',
    'gender-lock-chat',
    'notifications',
    'security-hardening',
    'remove-joiner-notify',
    'withdraw-requests',
    'chat-upgrades',
  ]) {
    const sql = read('supabase/' + name + '.sql').replace(
      /do \$\$[\s\S]*?alter publication[\s\S]*?end \$\$;/g,
      '',
    )
    await db.exec(sql)
  }
  await db.exec(
    `insert into auth.users(id) values('${host}'),('${alice}'),('${bob}'); update public.profiles set first_name='Test',gender='female';`,
  )
  const migration = read('supabase/migrations/202611040001_integrity_and_safety.sql')
  await db.exec(migration)
  await db.exec(migration) // Must be safely re-runnable.
  await db.exec(read('supabase/migrations/202611040002_private_block_events.sql'))
  await db.exec(read('supabase/migrations/202611040003_venue_details.sql'))
  await db.exec(read('supabase/migrations/202611040003_venue_details.sql'))
}, 30000)
afterAll(() => db.close())

describe.sequential('database integrity and authorization', () => {
  test('suspension and server-controlled profile fields cannot be overwritten', async () => {
    await expect(asUser(alice, 'update public.profiles set banned=false')).rejects.toThrow(
      /permission denied/,
    )
    await expect(asUser(alice, 'update public.profiles set join_count=100')).rejects.toThrow(
      /permission denied/,
    )
    await expect(asUser(alice, 'truncate public.intents cascade')).rejects.toThrow(
      /permission denied/,
    )
  })
  test('atomic saves retry the same ID and reject invalid private links without leaving a plan', async () => {
    const payload = values()
    await asUser(host, `select save_plan('${plan}','${payload}',null)`)
    await asUser(
      host,
      `select save_plan('${plan}','${payload}','https://chat.whatsapp.com/TestInvite')`,
    )
    expect((await db.query('select count(*)::int as n from intents')).rows).toEqual([{ n: 1 }])
    const bad = '20000000-0000-4000-8000-000000000002'
    await expect(
      asUser(host, `select save_plan('${bad}','${payload}','https://evil.example/group')`),
    ).rejects.toThrow(/valid WhatsApp/)
    expect((await db.query(`select id from intents where id='${bad}'`)).rows).toHaveLength(0)
    await expect(asUser(alice, `select save_plan('${plan}','${payload}',null)`)).rejects.toThrow(
      /Only the host/,
    )
  })
  test('venue IDs and menu links are atomic, validated and survive older-client saves', async () => {
    const payload = JSON.stringify({
      ...JSON.parse(values()),
      google_place_id: 'ChIJTestPlaceId',
      venue_menu_url: 'https://example.com/menu.pdf',
    })
    await asUser(
      host,
      `select save_plan('${plan}','${payload}','https://chat.whatsapp.com/TestInvite')`,
    )
    await asUser(
      host,
      `select save_plan('${plan}','${values()}','https://chat.whatsapp.com/TestInvite')`,
    )
    expect(
      (await db.query(`select google_place_id,venue_menu_url from intents where id='${plan}'`))
        .rows,
    ).toEqual([
      { google_place_id: 'ChIJTestPlaceId', venue_menu_url: 'https://example.com/menu.pdf' },
    ])
    const invalid = JSON.stringify({
      ...JSON.parse(values()),
      venue_menu_url: 'javascript:alert(1)',
    })
    await expect(asUser(host, `select save_plan('${plan}','${invalid}',null)`)).rejects.toThrow(
      /intents_menu_url_valid/,
    )
    expect((await db.query(`select venue_menu_url from intents where id='${plan}'`)).rows).toEqual([
      { venue_menu_url: 'https://example.com/menu.pdf' },
    ])
  })
  test('new requests must be pending and cannot self-join', async () => {
    await expect(
      asUser(
        alice,
        `insert into join_requests(intent_id,user_id,status) values('${plan}','${alice}','accepted')`,
      ),
    ).rejects.toThrow(/must be pending/)
    await expect(
      asUser(host, `insert into join_requests(intent_id,user_id) values('${plan}','${host}')`),
    ).rejects.toThrow(/already hosting/)
    await asUser(
      alice,
      `insert into join_requests(id,intent_id,user_id) values('${req}','${plan}','${alice}')`,
    )
    await asUser(
      bob,
      `insert into join_requests(id,intent_id,user_id) values('${second}','${plan}','${bob}')`,
    )
  })
  test('only host approves, retries are idempotent, capacity cannot be exceeded', async () => {
    await expect(
      asUser(alice, `select respond_to_join_request('${req}','accepted')`),
    ).rejects.toThrow(/Only the active host/)
    await asUser(host, `select respond_to_join_request('${req}','accepted')`)
    await asUser(host, `select respond_to_join_request('${req}','accepted')`)
    await expect(
      asUser(host, `select respond_to_join_request('${second}','accepted')`),
    ).rejects.toThrow(/full/)
    await asUser(host, `update intents set spots_filled=99 where id='${plan}'`)
    expect(
      (await db.query(`select spots_filled,status from intents where id='${plan}'`)).rows,
    ).toEqual([{ spots_filled: 1, status: 'full' }])
    await expect(
      asUser(host, `update join_requests set user_id='${bob}' where id='${req}'`),
    ).rejects.toThrow(/permission denied/)
  })
  test('private links stay private; blocking removes membership and releases the spot', async () => {
    expect((await asUser(bob, 'select * from intent_links'))[0].rows).toHaveLength(0)
    expect((await asUser(alice, 'select * from intent_links'))[0].rows).toHaveLength(1)
    await asUser(
      alice,
      `insert into user_blocks(user_id,blocked_user_id) values('${alice}','${host}')`,
    )
    expect((await db.query(`select status from join_requests where id='${req}'`)).rows).toEqual([
      { status: 'declined' },
    ])
    expect(
      (await db.query(`select spots_filled,status from intents where id='${plan}'`)).rows,
    ).toEqual([{ spots_filled: 0, status: 'open' }])
    expect((await asUser(alice, 'select * from intent_links'))[0].rows).toHaveLength(0)
    await expect(
      asUser(
        alice,
        `insert into messages(intent_id,user_id,body) values('${plan}','${alice}','Hello')`,
      ),
    ).rejects.toThrow(/no longer have access/)
  })
  test('leaving an accepted plan decrements exactly once and suspended users cannot edit', async () => {
    await asUser(host, `select respond_to_join_request('${second}','accepted')`)
    await asUser(bob, `delete from join_requests where id='${second}'`)
    expect(
      (await db.query(`select spots_filled,status from intents where id='${plan}'`)).rows,
    ).toEqual([{ spots_filled: 0, status: 'open' }])
    await db.exec(`update profiles set banned=true where id='${host}'`)
    await expect(
      asUser(host, `update intents set title='Bypass attempt' where id='${plan}'`),
    ).rejects.toThrow(/suspended/)
    await expect(asUser(host, `select save_plan('${plan}','${values()}',null)`)).rejects.toThrow(
      /active account/,
    )
    await db.exec(`update profiles set banned=false where id='${host}'`)
  })
  test('reminders deduplicate, cancellation notifies and expired/cancelled plans reject joining', async () => {
    await asUser(host, `insert into plan_reminders(user_id,intent_id) values('${host}','${plan}')`)
    await db.exec(
      `update intents set starts_at=now()+interval '20 minutes' where id='${plan}'; select queue_plan_reminders(); select queue_plan_reminders();`,
    )
    expect(
      (await db.query("select count(*)::int as n from notifications where type='reminder'")).rows,
    ).toEqual([{ n: 1 }])
    await asUser(bob, `insert into join_requests(intent_id,user_id) values('${plan}','${bob}')`)
    await asUser(host, `update intents set status='cancelled' where id='${plan}'`)
    expect(
      (await db.query("select count(*)::int as n from notifications where type='plan_cancelled'"))
        .rows,
    ).toEqual([{ n: 1 }])
    await asUser(bob, `delete from join_requests where intent_id='${plan}'`)
    await expect(
      asUser(bob, `insert into join_requests(intent_id,user_id) values('${plan}','${bob}')`),
    ).rejects.toThrow(/ended or was cancelled/)
    await expect(
      asUser(host, `update intents set status='open' where id='${plan}'`),
    ).rejects.toThrow(/ended plan/)
  })
})
