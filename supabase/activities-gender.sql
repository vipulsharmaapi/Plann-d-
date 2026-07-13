-- Plann'd migration 4: expanded activity list + gender for women-only enforcement.
-- Run in the Supabase SQL editor. Safe to re-run.

-- More activity types (the app's dropdown mirrors this list)
alter table public.intents drop constraint if exists intents_activity_check;
alter table public.intents add constraint intents_activity_check check (
  activity in (
    'badminton','football','cricket','tennis','basketball','running','cycling',
    'gym','swimming','coffee','food','boardgames','movies','trekking','other'
  )
);

-- Self-declared gender on profiles; required to join women-only plans
alter table public.profiles add column if not exists gender text
  check (gender in ('female','male','other'));

-- Enforce women-only at the database level: a join request on a women-only
-- intent is accepted only from profiles with gender = 'female'.
drop policy if exists "authenticated users can request to join" on public.join_requests;
create policy "authenticated users can request to join"
  on public.join_requests for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      not exists (
        select 1 from public.intents i where i.id = intent_id and i.women_only
      )
      or exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.gender = 'female'
      )
    )
  );
