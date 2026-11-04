-- Join-first details are host-authored, optional, and preserved for older clients.
begin;
alter table public.intents add column if not exists venue_area text;
alter table public.intents add column if not exists expected_cost numeric(8,2);
alter table public.intents add column if not exists skill_level text;
alter table public.intents add column if not exists booking_status text;
alter table public.intents add column if not exists meeting_instructions text;
alter table public.profiles add column if not exists bio text;
grant update (bio) on public.profiles to authenticated;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='intents_join_details_valid') then
    alter table public.intents add constraint intents_join_details_valid check(
      (venue_area is null or length(venue_area) between 2 and 100) and
      (expected_cost is null or (expected_cost >= 0 and expected_cost <= 100000)) and
      (skill_level is null or skill_level in ('all','beginner','intermediate','advanced')) and
      (booking_status is null or booking_status in ('not_needed','needed','confirmed')) and
      (meeting_instructions is null or length(meeting_instructions) <= 280)
    );
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_bio_length') then
    alter table public.profiles add constraint profiles_bio_length check(bio is null or length(bio) <= 240);
  end if;
end $$;
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
    insert into public.intents(id,user_id,activity,title,note,lat,lng,venue_name,starts_at,ends_at,spots_needed,women_only,google_place_id,venue_menu_url,venue_area,expected_cost,skill_level,booking_status,meeting_instructions)
    values(p_id,auth.uid(),p_plan->>'activity',trim(p_plan->>'title'),nullif(trim(p_plan->>'note'),''),
      (p_plan->>'lat')::float8,(p_plan->>'lng')::float8,trim(p_plan->>'venue_name'),
      (p_plan->>'starts_at')::timestamptz,(p_plan->>'ends_at')::timestamptz,(p_plan->>'spots_needed')::int,
      coalesce((p_plan->>'women_only')::boolean,false),nullif(trim(p_plan->>'google_place_id'),''),nullif(trim(p_plan->>'venue_menu_url'),''),nullif(trim(p_plan->>'venue_area'),''),nullif(p_plan->>'expected_cost','')::numeric,nullif(trim(p_plan->>'skill_level'),''),nullif(trim(p_plan->>'booking_status'),''),nullif(trim(p_plan->>'meeting_instructions'),''));
  else
    update public.intents set activity=p_plan->>'activity',title=trim(p_plan->>'title'),note=nullif(trim(p_plan->>'note'),''),
      lat=(p_plan->>'lat')::float8,lng=(p_plan->>'lng')::float8,venue_name=trim(p_plan->>'venue_name'),
      starts_at=(p_plan->>'starts_at')::timestamptz,ends_at=(p_plan->>'ends_at')::timestamptz,
      spots_needed=(p_plan->>'spots_needed')::int,women_only=coalesce((p_plan->>'women_only')::boolean,false),
      google_place_id=case when p_plan ? 'google_place_id' then nullif(trim(p_plan->>'google_place_id'),'') else google_place_id end,
      venue_menu_url=case when p_plan ? 'venue_menu_url' then nullif(trim(p_plan->>'venue_menu_url'),'') else venue_menu_url end,
      venue_area=case when p_plan ? 'venue_area' then nullif(trim(p_plan->>'venue_area'),'') else venue_area end,
      expected_cost=case when p_plan ? 'expected_cost' then nullif(p_plan->>'expected_cost','')::numeric else expected_cost end,
      skill_level=case when p_plan ? 'skill_level' then nullif(trim(p_plan->>'skill_level'),'') else skill_level end,
      booking_status=case when p_plan ? 'booking_status' then nullif(trim(p_plan->>'booking_status'),'') else booking_status end,
      meeting_instructions=case when p_plan ? 'meeting_instructions' then nullif(trim(p_plan->>'meeting_instructions'),'') else meeting_instructions end
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

create or replace function public.notify_plan_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    insert into public.notifications(user_id,type,intent_id,body)
    select user_id,'plan_cancelled',new.id,'Cancelled: '||new.title from public.join_requests
    where intent_id=new.id and status in ('pending','accepted');
  elsif (new.title,new.venue_name,new.lat,new.lng,new.starts_at,new.ends_at,new.venue_area,new.expected_cost,new.skill_level,new.booking_status,new.meeting_instructions) is distinct from
        (old.title,old.venue_name,old.lat,old.lng,old.starts_at,old.ends_at,old.venue_area,old.expected_cost,old.skill_level,old.booking_status,old.meeting_instructions) then
    insert into public.notifications(user_id,type,intent_id,body)
    select user_id,'plan_updated',new.id,'Plan details changed: '||new.title||'. Check the time, venue and arrangements.' from public.join_requests
    where intent_id=new.id and status in ('pending','accepted');
  end if;
  return new;
end $$;

insert into public.app_migrations(version) values('202611040004') on conflict do nothing;
notify pgrst, 'reload schema';
commit;
