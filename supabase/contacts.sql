-- Plann'd migration 3: private contact numbers + matched-only reveal.
-- Run in the Supabase SQL editor. Safe to re-run.

-- WhatsApp numbers live in their own table, NOT in profiles: profiles are
-- publicly readable, this table is readable only by its owner. Matched users
-- get numbers exclusively through the get_match_contact() function below.
create table if not exists public.private_contacts (
  user_id uuid primary key references auth.users on delete cascade,
  whatsapp_number text,
  updated_at timestamptz not null default now()
);

alter table public.private_contacts enable row level security;

drop policy if exists "owners read their contact" on public.private_contacts;
create policy "owners read their contact"
  on public.private_contacts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "owners insert their contact" on public.private_contacts;
create policy "owners insert their contact"
  on public.private_contacts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owners update their contact" on public.private_contacts;
create policy "owners update their contact"
  on public.private_contacts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reveal p_user_id's WhatsApp number to the caller ONLY when they are matched
-- on the given intent: caller is the poster and target an accepted joiner,
-- or caller is an accepted joiner and target is the poster.
create or replace function public.get_match_contact(p_intent_id uuid, p_user_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_poster uuid;
  v_number text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select user_id into v_poster from public.intents where id = p_intent_id;
  if v_poster is null then
    return null;
  end if;

  if (
    auth.uid() = v_poster
    and exists (
      select 1 from public.join_requests
      where intent_id = p_intent_id and user_id = p_user_id and status = 'accepted'
    )
  ) or (
    p_user_id = v_poster
    and exists (
      select 1 from public.join_requests
      where intent_id = p_intent_id and user_id = auth.uid() and status = 'accepted'
    )
  ) then
    select whatsapp_number into v_number from public.private_contacts where user_id = p_user_id;
    return v_number;
  end if;

  return null;
end $$;
