-- Upgrade the existing v10 schema. Transactional, non-destructive, re-runnable.
-- Existing clients may still update counts; the server always derives them.
begin;

create table if not exists public.app_migrations (
  version text primary key, applied_at timestamptz not null default now()
);
alter table public.app_migrations enable row level security;
revoke all on public.app_migrations from public, anon, authenticated;

-- RLS does not protect TRUNCATE. Remove Supabase's broad default grants.
revoke all on public.profiles, public.intents, public.join_requests, public.reports,
  public.messages, public.notifications, public.chat_reads, public.intent_links,
  public.private_contacts from anon, authenticated;
grant select on public.profiles, public.intents to anon, authenticated;
grant update (first_name, emoji, avatar_url, gender) on public.profiles to authenticated;
grant insert, update on public.intents to authenticated;
grant select, insert, delete on public.join_requests to authenticated;
grant update (status) on public.join_requests to authenticated;
grant insert (reporter_id, intent_id, reason) on public.reports to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.chat_reads to authenticated;
grant update (last_read_at) on public.chat_reads to authenticated;
grant select, insert, update, delete on public.intent_links to authenticated;
grant select, insert, update on public.private_contacts to authenticated;

create table if not exists public.user_blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id), check (user_id <> blocked_user_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
drop policy if exists "manage own blocks" on public.user_blocks;
create policy "manage own blocks" on public.user_blocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.account_active(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = p_user and not banned)
$$;
create or replace function public.users_blocked(p_a uuid, p_b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_blocks
    where (user_id=p_a and blocked_user_id=p_b) or (user_id=p_b and blocked_user_id=p_a))
$$;
-- Callers can inspect only their own relationship, not other people's block lists.
create or replace function public.is_blocked(p_other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.users_blocked(auth.uid(), p_other)
$$;
revoke all on function public.account_active(uuid), public.users_blocked(uuid,uuid), public.is_blocked(uuid) from public, anon, authenticated;
grant execute on function public.account_active(uuid), public.is_blocked(uuid) to authenticated;

-- Row locking serializes approvals, withdrawals and capacity edits per plan.
create or replace function public.guard_join_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan public.intents; v_count integer;
begin
  if tg_op = 'DELETE' then
    perform 1 from public.intents where id=old.intent_id for update;
    return old;
  end if;
  select * into v_plan from public.intents where id=new.intent_id for update;
  if auth.uid() is not null and not public.account_active(auth.uid()) and pg_trigger_depth()=1 then raise exception 'This account is suspended'; end if;
  if not found then raise exception 'Plan not found'; end if;
  if tg_op='INSERT' then
    if new.status <> 'pending' then raise exception 'New requests must be pending'; end if;
    new.created_at := now();
  else
    if new.id<>old.id or new.intent_id<>old.intent_id or new.user_id<>old.user_id
      or new.created_at<>old.created_at then raise exception 'Request identity cannot change'; end if;
    if new.status=old.status then return new; end if;
    -- Internal block handling is allowed to decline, never to accept.
    if auth.uid() is not null and auth.uid()<>v_plan.user_id
      and not (new.status='declined' and public.users_blocked(v_plan.user_id,new.user_id)) then
      raise exception 'Only the host can respond';
    end if;
    if new.status not in ('accepted','declined') then raise exception 'Invalid request transition'; end if;
    if new.status='accepted' and old.status<>'pending' then raise exception 'Only pending requests can be accepted'; end if;
    if new.status='declined' then return new; end if;
  end if;
  if new.user_id=v_plan.user_id then raise exception 'You are already hosting this plan'; end if;
  if not public.account_active(new.user_id) or not public.account_active(v_plan.user_id) then
    raise exception 'This account is suspended'; end if;
  if public.users_blocked(new.user_id,v_plan.user_id) then raise exception 'This plan is unavailable'; end if;
  if v_plan.status not in ('open','full') or v_plan.ends_at<=now() then raise exception 'This plan has ended or was cancelled'; end if;
  if v_plan.women_only and not exists(select 1 from public.profiles where id=new.user_id and gender='female') then
    raise exception 'This plan is for women; eligibility uses self-declared profile information'; end if;
  select count(*) into v_count from public.join_requests where intent_id=new.intent_id and status='accepted';
  if v_count>=v_plan.spots_needed then raise exception 'This plan is full'; end if;
  return new;
end $$;
drop trigger if exists a_guard_join_request on public.join_requests;
create trigger a_guard_join_request before insert or update or delete on public.join_requests
  for each row execute function public.guard_join_request();

create or replace function public.guard_intent()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if tg_op='UPDATE' then
    if new.id<>old.id or new.user_id is distinct from old.user_id or new.created_at<>old.created_at then
      raise exception 'Plan identity cannot change'; end if;
    -- Internal membership updates only change derived counts/status.
    if auth.uid() is not null and pg_trigger_depth()=1 and not public.account_active(auth.uid()) then
      raise exception 'This account is suspended'; end if;
    if old.status in ('cancelled','expired') and new.status not in ('cancelled','expired') then
      raise exception 'Create a new plan to reschedule an ended plan'; end if;
  else
    new.created_at:=now();
    perform 1 from public.profiles where id=new.user_id for update;
    if new.user_id is null or not public.account_active(new.user_id) then raise exception 'An active host is required'; end if;
    if new.ends_at<=now() then raise exception 'Choose a future end time'; end if;
    new.status:='open';
  end if;
  select count(*) into v_count from public.join_requests where intent_id=new.id and status='accepted';
  if new.spots_needed<v_count then raise exception 'Capacity cannot be smaller than the accepted group'; end if;
  new.spots_filled:=v_count;
  if new.status in ('open','full') then
    new.status:=case when new.ends_at<=now() then 'expired' when v_count>=new.spots_needed then 'full' else 'open' end;
  end if;
  if new.lat not between -90 and 90 or new.lng not between -180 and 180
    or new.lat='NaN'::float8 or new.lng='NaN'::float8 then raise exception 'Choose a valid location'; end if;
  if length(trim(new.venue_name)) not between 2 and 200 then raise exception 'Add a venue name (2–200 characters)'; end if;
  if length(trim(new.title)) not between 3 and 80 then raise exception 'Use a title of 3–80 characters'; end if;
  if new.ends_at>new.starts_at+interval '7 days' then raise exception 'A plan can last at most 7 days'; end if;
  -- Never trust a client-supplied host name.
  if new.user_id is not null then
    select coalesce(nullif(first_name,''),'Someone') into new.poster_name from public.profiles where id=new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists a_guard_intent on public.intents;
create trigger a_guard_intent before insert or update on public.intents for each row execute function public.guard_intent();

create or replace function public.sync_intent_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.intents set spots_filled=0 where id=coalesce(new.intent_id,old.intent_id);
  return coalesce(new,old);
end $$;
drop trigger if exists z_sync_intent_capacity on public.join_requests;
create trigger z_sync_intent_capacity after insert or update or delete on public.join_requests
  for each row execute function public.sync_intent_capacity();

create or replace function public.respond_to_join_request(p_request_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_intent uuid; v_owner uuid;
begin
  select intent_id into v_intent from public.join_requests where id=p_request_id;
  select user_id into v_owner from public.intents where id=v_intent for update;
  if auth.uid() is null or auth.uid() is distinct from v_owner or not public.account_active(auth.uid()) then
    raise exception 'Only the active host can respond'; end if;
  if p_status not in ('accepted','declined') then raise exception 'Invalid decision'; end if;
  update public.join_requests set status=p_status where id=p_request_id;
end $$;
revoke all on function public.respond_to_join_request(uuid,text) from public, anon, authenticated;
grant execute on function public.respond_to_join_request(uuid,text) to authenticated;

-- Stable client-generated IDs make retries update the same plan. Link + plan commit together.
create or replace function public.save_plan(p_id uuid, p_plan jsonb, p_whatsapp_link text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_existing public.intents;
begin
  if auth.uid() is null or not public.account_active(auth.uid()) then raise exception 'Sign in with an active account'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into v_existing from public.intents where id=p_id for update;
  if found and v_existing.user_id is distinct from auth.uid() then raise exception 'Only the host can edit this plan'; end if;
  if found and (v_existing.status not in ('open','full') or v_existing.ends_at<=now()) then raise exception 'This plan has ended or was cancelled'; end if;
  if nullif(trim(p_whatsapp_link),'') is not null and p_whatsapp_link !~ '^https://(chat\.whatsapp\.com|wa\.me)/[A-Za-z0-9?=&+_-]+$' then
    raise exception 'Use a valid WhatsApp invite or wa.me link'; end if;
  if (p_plan->>'ends_at')::timestamptz<=now() then raise exception 'Choose a future end time'; end if;
  if v_existing.id is null then
    insert into public.intents(id,user_id,activity,title,note,lat,lng,venue_name,starts_at,ends_at,spots_needed,women_only)
    values(p_id,auth.uid(),p_plan->>'activity',trim(p_plan->>'title'),nullif(trim(p_plan->>'note'),''),
      (p_plan->>'lat')::float8,(p_plan->>'lng')::float8,trim(p_plan->>'venue_name'),
      (p_plan->>'starts_at')::timestamptz,(p_plan->>'ends_at')::timestamptz,(p_plan->>'spots_needed')::int,
      coalesce((p_plan->>'women_only')::boolean,false));
  else
    update public.intents set activity=p_plan->>'activity',title=trim(p_plan->>'title'),note=nullif(trim(p_plan->>'note'),''),
      lat=(p_plan->>'lat')::float8,lng=(p_plan->>'lng')::float8,venue_name=trim(p_plan->>'venue_name'),
      starts_at=(p_plan->>'starts_at')::timestamptz,ends_at=(p_plan->>'ends_at')::timestamptz,
      spots_needed=(p_plan->>'spots_needed')::int,women_only=coalesce((p_plan->>'women_only')::boolean,false)
    where id=p_id;
  end if;
  if nullif(trim(p_whatsapp_link),'') is null then
    delete from public.intent_links where intent_id=p_id;
  else
    insert into public.intent_links(intent_id,whatsapp_link) values(p_id,trim(p_whatsapp_link))
    on conflict(intent_id) do update set whatsapp_link=excluded.whatsapp_link,updated_at=now();
  end if;
  return p_id;
end $$;
revoke all on function public.save_plan(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_plan(uuid,jsonb,text) to authenticated;

create or replace function public.is_intent_participant(p_intent_id uuid,p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.account_active(p_user) and exists(select 1 from public.intents i where i.id=p_intent_id
    and i.status<>'cancelled' and public.account_active(i.user_id) and not public.users_blocked(i.user_id,p_user)
    and (i.user_id=p_user or exists(select 1 from public.join_requests r where r.intent_id=i.id and r.user_id=p_user and r.status='accepted')))
$$;
revoke all on function public.is_intent_participant(uuid,uuid) from public, anon, authenticated;
grant execute on function public.is_intent_participant(uuid,uuid) to authenticated;
create or replace function public.get_match_contact(p_intent_id uuid,p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if auth.uid() is null or not public.is_intent_participant(p_intent_id,auth.uid())
    or not public.is_intent_participant(p_intent_id,p_user_id) or public.users_blocked(auth.uid(),p_user_id) then return null; end if;
  select user_id into v_owner from public.intents where id=p_intent_id;
  if auth.uid()<>v_owner and p_user_id<>v_owner then return null; end if;
  return (select whatsapp_number from public.private_contacts where user_id=p_user_id);
end $$;
revoke all on function public.get_match_contact(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_match_contact(uuid,uuid) to authenticated;

drop policy if exists "hide blocked messages" on public.messages;
create policy "hide blocked messages" on public.messages as restrictive for select to authenticated using(not public.is_blocked(user_id));
drop policy if exists "participants update own read cursor" on public.chat_reads;
create policy "participants update own read cursor" on public.chat_reads for update to authenticated
  using(auth.uid()=user_id and public.is_intent_participant(intent_id,auth.uid()))
  with check(auth.uid()=user_id and public.is_intent_participant(intent_id,auth.uid()));
create or replace function public.guard_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at:=now();
  if not public.is_intent_participant(new.intent_id,new.user_id) then raise exception 'You no longer have access to this chat'; end if;
  if length(trim(new.body))=0 then raise exception 'Write a message first'; end if;
  if new.reply_to is not null and not exists(select 1 from public.messages where id=new.reply_to and intent_id=new.intent_id and not public.users_blocked(user_id,new.user_id)) then
    raise exception 'That reply is unavailable in this chat'; end if;
  return new;
end $$;
drop trigger if exists a_guard_message on public.messages;
create trigger a_guard_message before insert on public.messages for each row execute function public.guard_message();

create or replace function public.apply_user_block()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  update public.join_requests r set status='declined' from public.intents i
  where r.intent_id=i.id and r.status in ('pending','accepted') and
    ((i.user_id=new.user_id and r.user_id=new.blocked_user_id) or (i.user_id=new.blocked_user_id and r.user_id=new.user_id));
  return new;
end $$;
drop trigger if exists apply_user_block on public.user_blocks;
create trigger apply_user_block after insert on public.user_blocks for each row execute function public.apply_user_block();

-- Reports remain private; only their author can inspect the review status.
alter table public.reports add column if not exists status text not null default 'new' check(status in ('new','reviewing','resolved','dismissed'));
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists moderator_note text;
grant select(id,intent_id,reason,status,created_at,reviewed_at,reporter_id) on public.reports to authenticated;
drop policy if exists "read own report status" on public.reports;
create policy "read own report status" on public.reports for select to authenticated using(reporter_id=auth.uid());
create or replace function public.guard_report()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if length(trim(new.reason)) not between 5 and 1000 then raise exception 'Describe the issue in 5–1000 characters'; end if;
  if (select count(*) from public.reports where reporter_id=new.reporter_id and created_at>now()-interval '1 day')>=10 then
    raise exception 'Report limit reached for today'; end if;
  new.created_at:=now(); new.status:='new'; return new;
end $$;
drop trigger if exists guard_report on public.reports;
create trigger guard_report before insert on public.reports for each row execute function public.guard_report();

create table if not exists public.profile_change_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  requested_gender text not null check(requested_gender in ('female','male','other')),
  reason text not null check(length(trim(reason)) between 5 and 500),
  status text not null default 'pending' check(status in ('pending','resolved','declined')),
  created_at timestamptz not null default now()
);
create unique index if not exists one_pending_profile_correction on public.profile_change_requests(user_id) where status='pending';
alter table public.profile_change_requests enable row level security;
revoke all on public.profile_change_requests from public,anon,authenticated;
grant select on public.profile_change_requests to authenticated;
grant insert(user_id,requested_gender,reason) on public.profile_change_requests to authenticated;
drop policy if exists "own profile corrections" on public.profile_change_requests;
create policy "own profile corrections" on public.profile_change_requests for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid() and status='pending');
-- Admin corrections are possible in the dashboard; ordinary users cannot self-change it.
create or replace function public.prevent_gender_change()
returns trigger language plpgsql set search_path=public as $$
begin
  if current_user in ('anon','authenticated') and old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'Request a profile correction in Help'; end if;
  return new;
end $$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check(type in ('join_request','request_accepted','chat_message','plan_updated','plan_cancelled','reminder'));
alter table public.notifications add column if not exists dedup_key text;
create unique index if not exists notifications_dedup_key on public.notifications(dedup_key);

create or replace function public.notify_plan_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    insert into public.notifications(user_id,type,intent_id,body)
    select user_id,'plan_cancelled',new.id,'Cancelled: '||new.title from public.join_requests
    where intent_id=new.id and status in ('pending','accepted');
  elsif (new.title,new.venue_name,new.lat,new.lng,new.starts_at,new.ends_at) is distinct from
        (old.title,old.venue_name,old.lat,old.lng,old.starts_at,old.ends_at) then
    insert into public.notifications(user_id,type,intent_id,body)
    select user_id,'plan_updated',new.id,'Plan details changed: '||new.title||'. Check the time and venue.' from public.join_requests
    where intent_id=new.id and status in ('pending','accepted');
  end if;
  return new;
end $$;
drop trigger if exists notify_plan_change on public.intents;
create trigger notify_plan_change after update on public.intents for each row execute function public.notify_plan_change();

create or replace function public.notify_chat_message()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,type,intent_id,actor_id,body)
  select p.uid,'chat_message',new.intent_id,new.user_id,'New message in '||i.title
  from public.intents i cross join lateral
    (select i.user_id as uid union select user_id from public.join_requests where intent_id=i.id and status='accepted') p
  where i.id=new.intent_id and p.uid<>new.user_id and public.account_active(p.uid)
    and not public.users_blocked(p.uid,new.user_id);
  return new;
end $$;

create table if not exists public.plan_reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  intent_id uuid not null references public.intents(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,intent_id)
);
alter table public.plan_reminders enable row level security;
revoke all on public.plan_reminders from public,anon,authenticated;
grant select,insert,delete on public.plan_reminders to authenticated;
drop policy if exists "own plan reminders" on public.plan_reminders;
create policy "own plan reminders" on public.plan_reminders for all to authenticated
  using(user_id=auth.uid()) with check(user_id=auth.uid() and public.is_intent_participant(intent_id,auth.uid()));
create or replace function public.queue_plan_reminders(p_user_id uuid default null)
returns void language sql security definer set search_path=public as $$
  insert into public.notifications(user_id,type,intent_id,body,dedup_key)
  select r.user_id,'reminder',i.id,'Starts soon: '||i.title||' at '||i.venue_name,
    'reminder:'||r.user_id||':'||i.id||':'||extract(epoch from i.starts_at)::text
  from public.plan_reminders r join public.intents i on i.id=r.intent_id
  where (p_user_id is null or r.user_id=p_user_id) and i.status in ('open','full')
    and i.starts_at>now() and i.starts_at<=now()+interval '30 minutes'
    and public.is_intent_participant(i.id,r.user_id)
  on conflict(dedup_key) do nothing
$$;
create or replace function public.deliver_my_reminders()
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null then perform public.queue_plan_reminders(auth.uid()); end if;
end $$;
revoke all on function public.queue_plan_reminders(uuid), public.deliver_my_reminders() from public,anon,authenticated;
grant execute on function public.deliver_my_reminders() to authenticated;

-- Index latest-message paging and participant lookups.
create index if not exists messages_latest_idx on public.messages(intent_id,created_at desc,id desc);
create index if not exists requests_user_status_idx on public.join_requests(user_id,status);
create index if not exists requests_plan_status_idx on public.join_requests(intent_id,status);

-- Trigger functions are not API endpoints.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prorettype='trigger'::regtype
  loop execute 'revoke all on function '||f.signature||' from public, anon, authenticated'; end loop;
end $$;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.join_requests; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.user_blocks; exception when duplicate_object then null; end;
  end if;
end $$;

-- Extensions are provided by Supabase. Tests can run without pg_cron.
do $$ begin
  if exists(select 1 from pg_namespace where nspname='cron') then
    perform cron.schedule('plannd-reminders','* * * * *','select public.queue_plan_reminders()');
    perform cron.schedule('expire-intents','* * * * *',$job$update public.intents set status='expired' where status in ('open','full') and ends_at<now()$job$);
  end if;
end $$;
-- Repair derived counts on owned plans; preserve historical seeded rows.
update public.intents i set spots_filled=0 where i.user_id is not null
  and i.spots_filled<>(select count(*) from public.join_requests r where r.intent_id=i.id and r.status='accepted')
  and i.spots_needed>=(select count(*) from public.join_requests r where r.intent_id=i.id and r.status='accepted');
insert into public.app_migrations(version) values('202611040001') on conflict do nothing;
commit;
