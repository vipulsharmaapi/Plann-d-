-- Plann'd migration 5: gender immutability + in-app chat.
-- Run in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Gender can be set once, never changed (enforced in the database, so the
-- API can't be tricked into changing it either).
-- ---------------------------------------------------------------------------
create or replace function public.prevent_gender_change()
returns trigger language plpgsql as $$
begin
  if old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'Gender cannot be changed once set';
  end if;
  return new;
end $$;

drop trigger if exists gender_lock on public.profiles;
create trigger gender_lock
  before update on public.profiles
  for each row execute function public.prevent_gender_change();

-- ---------------------------------------------------------------------------
-- In-app chat: one message thread per intent, visible only to participants
-- (the poster + accepted joiners).
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists messages_intent_idx on public.messages (intent_id, created_at);

alter table public.messages enable row level security;

create or replace function public.is_intent_participant(p_intent_id uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.intents where id = p_intent_id and user_id = p_user
  ) or exists (
    select 1 from public.join_requests
    where intent_id = p_intent_id and user_id = p_user and status = 'accepted'
  )
$$;

drop policy if exists "participants read messages" on public.messages;
create policy "participants read messages"
  on public.messages for select to authenticated
  using (public.is_intent_participant(intent_id, auth.uid()));

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages"
  on public.messages for insert to authenticated
  with check (auth.uid() = user_id and public.is_intent_participant(intent_id, auth.uid()));

-- Realtime delivery of new messages
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
