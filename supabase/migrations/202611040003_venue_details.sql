-- Store durable place IDs and a host-supplied menu URL only. Ratings and photo
-- resources are fetched fresh and are never persisted in the app database.
begin;
alter table public.intents add column if not exists google_place_id text;
alter table public.intents add column if not exists venue_menu_url text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='intents_place_id_valid') then
    alter table public.intents add constraint intents_place_id_valid check(google_place_id is null or google_place_id ~ '^[A-Za-z0-9_-]{10,255}$');
  end if;
  if not exists(select 1 from pg_constraint where conname='intents_menu_url_valid') then
    alter table public.intents add constraint intents_menu_url_valid check(venue_menu_url is null or (length(venue_menu_url)<=2048 and venue_menu_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*([/:?#][^[:space:]<>"@]*)?$'));
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
    insert into public.intents(id,user_id,activity,title,note,lat,lng,venue_name,starts_at,ends_at,spots_needed,women_only,google_place_id,venue_menu_url)
    values(p_id,auth.uid(),p_plan->>'activity',trim(p_plan->>'title'),nullif(trim(p_plan->>'note'),''),
      (p_plan->>'lat')::float8,(p_plan->>'lng')::float8,trim(p_plan->>'venue_name'),
      (p_plan->>'starts_at')::timestamptz,(p_plan->>'ends_at')::timestamptz,(p_plan->>'spots_needed')::int,
      coalesce((p_plan->>'women_only')::boolean,false),nullif(trim(p_plan->>'google_place_id'),''),nullif(trim(p_plan->>'venue_menu_url'),''));
  else
    update public.intents set activity=p_plan->>'activity',title=trim(p_plan->>'title'),note=nullif(trim(p_plan->>'note'),''),
      lat=(p_plan->>'lat')::float8,lng=(p_plan->>'lng')::float8,venue_name=trim(p_plan->>'venue_name'),
      starts_at=(p_plan->>'starts_at')::timestamptz,ends_at=(p_plan->>'ends_at')::timestamptz,
      spots_needed=(p_plan->>'spots_needed')::int,women_only=coalesce((p_plan->>'women_only')::boolean,false),
      google_place_id=case when p_plan ? 'google_place_id' then nullif(trim(p_plan->>'google_place_id'),'') else google_place_id end,
      venue_menu_url=case when p_plan ? 'venue_menu_url' then nullif(trim(p_plan->>'venue_menu_url'),'') else venue_menu_url end
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

insert into public.app_migrations(version) values('202611040003') on conflict do nothing;
commit;
