-- Plann'd migration 8: notify joiners when they're removed from a plan.
-- Replaces the accept-notification function to cover both transitions.
-- Run in the Supabase SQL editor. Safe to re-run.

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
  elsif new.status = 'declined' and old.status = 'accepted' then
    select title into v_title from intents where id = new.intent_id;
    insert into notifications (user_id, type, intent_id, body)
    values (new.user_id, 'join_request', new.intent_id,
            'The lineup changed for "' || coalesce(v_title, 'a plan') || '" — your spot was released');
  end if;
  return new;
end $$;
