-- Plann'd migration 7: security hardening.
-- Requires migrations 1-6 (uses is_intent_participant from gender-lock-chat.sql).
-- IMPORTANT: deploy the matching app build BEFORE running this — it drops
-- intents.whatsapp_link, which older builds still query.

-- ---------------------------------------------------------------------------
-- 1) Group links move to their own table, readable ONLY by participants
--    (poster + accepted joiners). Links must be real WhatsApp URLs.
-- ---------------------------------------------------------------------------
create table if not exists public.intent_links (
  intent_id uuid primary key references public.intents on delete cascade,
  whatsapp_link text not null
    check (whatsapp_link ~* '^https://(chat\.whatsapp\.com|wa\.me)/.+'),
  updated_at timestamptz not null default now()
);

alter table public.intent_links enable row level security;

drop policy if exists "participants read group links" on public.intent_links;
create policy "participants read group links"
  on public.intent_links for select to authenticated
  using (public.is_intent_participant(intent_id, auth.uid()));

drop policy if exists "posters set group links" on public.intent_links;
create policy "posters set group links"
  on public.intent_links for insert to authenticated
  with check (exists (select 1 from public.intents where id = intent_id and user_id = auth.uid()));

drop policy if exists "posters update group links" on public.intent_links;
create policy "posters update group links"
  on public.intent_links for update to authenticated
  using (exists (select 1 from public.intents where id = intent_id and user_id = auth.uid()));

drop policy if exists "posters remove group links" on public.intent_links;
create policy "posters remove group links"
  on public.intent_links for delete to authenticated
  using (exists (select 1 from public.intents where id = intent_id and user_id = auth.uid()));

-- Migrate existing valid links, then drop the public column
insert into public.intent_links (intent_id, whatsapp_link)
select id, whatsapp_link from public.intents
where whatsapp_link ~* '^https://(chat\.whatsapp\.com|wa\.me)/.+'
on conflict (intent_id) do nothing;

alter table public.intents drop column if exists whatsapp_link;

-- ---------------------------------------------------------------------------
-- 2) Ban flag + anti-spam limits (all enforced in the database)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists banned boolean not null default false;

create or replace function public.check_intent_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.user_id and banned) then
    raise exception 'This account is suspended';
  end if;
  if (select count(*) from intents where user_id = new.user_id and status = 'open') >= 5 then
    raise exception 'You can have at most 5 open plans at a time';
  end if;
  if (select count(*) from intents
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily posting limit reached — try again tomorrow';
  end if;
  return new;
end $$;

drop trigger if exists intent_limits on public.intents;
create trigger intent_limits
  before insert on public.intents
  for each row execute function public.check_intent_limits();

create or replace function public.check_join_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.user_id and banned) then
    raise exception 'This account is suspended';
  end if;
  if (select count(*) from join_requests
      where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Daily join-request limit reached — try again tomorrow';
  end if;
  return new;
end $$;

drop trigger if exists join_limits on public.join_requests;
create trigger join_limits
  before insert on public.join_requests
  for each row execute function public.check_join_limits();

create or replace function public.check_message_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from profiles where id = new.user_id and banned) then
    raise exception 'This account is suspended';
  end if;
  if exists (select 1 from messages
             where user_id = new.user_id and created_at > now() - interval '2 seconds') then
    raise exception 'Slow down a little';
  end if;
  if (select count(*) from messages
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Message rate limit reached — take a breath';
  end if;
  return new;
end $$;

drop trigger if exists message_limits on public.messages;
create trigger message_limits
  before insert on public.messages
  for each row execute function public.check_message_limits();

-- ---------------------------------------------------------------------------
-- 3) Avatar bucket: server-side size + type limits
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880, -- 5 MB
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
where id = 'avatars';
