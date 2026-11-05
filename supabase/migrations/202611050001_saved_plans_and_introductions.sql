begin;
create table if not exists public.saved_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null references public.intents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, intent_id)
);
alter table public.saved_plans enable row level security;
revoke all on public.saved_plans from public, anon, authenticated;
grant select, insert, delete on public.saved_plans to authenticated;
drop policy if exists "Read own saved plans" on public.saved_plans;
create policy "Read own saved plans" on public.saved_plans for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "Save a visible plan" on public.saved_plans;
create policy "Save a visible plan" on public.saved_plans for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.intents i where i.id = intent_id
      and (i.user_id is null or not public.is_blocked(i.user_id))
  ));
drop policy if exists "Remove own saved plans" on public.saved_plans;
create policy "Remove own saved plans" on public.saved_plans for delete to authenticated
  using (user_id = auth.uid());
alter table public.join_requests add column if not exists introduction text;
alter table public.join_requests drop constraint if exists join_introduction_length;
alter table public.join_requests add constraint join_introduction_length
  check (introduction is null or char_length(introduction) <= 500);
insert into public.app_migrations(version) values ('202611050001_saved_plans_and_introductions') on conflict do nothing;
commit;
