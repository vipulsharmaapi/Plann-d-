-- Plann'd migration 6: in-app notifications.
-- Run in the Supabase SQL editor. Safe to re-run.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade, -- recipient
  type text not null check (type in ('join_request', 'request_accepted', 'chat_message')),
  intent_id uuid references public.intents on delete cascade,
  actor_id uuid references auth.users on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "recipients read their notifications" on public.notifications;
create policy "recipients read their notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recipients mark notifications read" on public.notifications;
create policy "recipients mark notifications read"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rows are created only by the triggers below (security definer), never
-- directly by clients — no insert policy on purpose.

-- Someone requests to join → notify the poster
create or replace function public.notify_join_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_title text;
  v_name text;
begin
  select user_id, title into v_owner, v_title from intents where id = new.intent_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  select coalesce(nullif(first_name, ''), 'Someone') into v_name from profiles where id = new.user_id;
  insert into notifications (user_id, type, intent_id, actor_id, body)
  values (v_owner, 'join_request', new.intent_id, new.user_id,
          v_name || ' wants to join "' || v_title || '"');
  return new;
end $$;

drop trigger if exists on_join_request_notify on public.join_requests;
create trigger on_join_request_notify
  after insert on public.join_requests
  for each row execute function public.notify_join_request();

-- Request accepted → notify the requester
create or replace function public.notify_request_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if new.status = 'accepted' and old.status = 'pending' then
    select title into v_title from intents where id = new.intent_id;
    insert into notifications (user_id, type, intent_id, body)
    values (new.user_id, 'request_accepted', new.intent_id,
            'You''re in! "' || coalesce(v_title, 'A plan') || '" — open the group chat');
  end if;
  return new;
end $$;

drop trigger if exists on_request_accepted_notify on public.join_requests;
create trigger on_request_accepted_notify
  after update on public.join_requests
  for each row execute function public.notify_request_accepted();

-- New chat message → notify all other participants
create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_name text;
begin
  select title into v_title from intents where id = new.intent_id;
  select coalesce(nullif(first_name, ''), 'Someone') into v_name from profiles where id = new.user_id;
  insert into notifications (user_id, type, intent_id, actor_id, body)
  select p.uid, 'chat_message', new.intent_id, new.user_id,
         v_name || ' · "' || coalesce(v_title, 'chat') || '": ' || left(new.body, 80)
  from (
    select i.user_id as uid from intents i where i.id = new.intent_id
    union
    select jr.user_id from join_requests jr
    where jr.intent_id = new.intent_id and jr.status = 'accepted'
  ) p
  where p.uid is not null and p.uid <> new.user_id;
  return new;
end $$;

drop trigger if exists on_chat_message_notify on public.messages;
create trigger on_chat_message_notify
  after insert on public.messages
  for each row execute function public.notify_chat_message();

-- Realtime delivery
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
