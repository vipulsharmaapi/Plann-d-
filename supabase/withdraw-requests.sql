-- Plann'd migration 9: withdraw / leave a plan.
-- Run in the Supabase SQL editor. Safe to re-run.

-- Requesters can delete their own join request (withdraw a pending one,
-- or leave a plan they were accepted into).
drop policy if exists "requesters can withdraw" on public.join_requests;
create policy "requesters can withdraw"
  on public.join_requests for delete to authenticated
  using (auth.uid() = user_id);

-- Leaving an accepted plan releases the spot and tells the poster.
create or replace function public.handle_join_request_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_title text;
  v_name text;
begin
  if old.status = 'accepted' then
    update intents
    set spots_filled = greatest(0, spots_filled - 1)
    where id = old.intent_id;

    select user_id, title into v_owner, v_title from intents where id = old.intent_id;
    if v_owner is not null and v_owner <> old.user_id then
      select coalesce(nullif(first_name, ''), 'Someone') into v_name
      from profiles where id = old.user_id;
      insert into notifications (user_id, type, intent_id, actor_id, body)
      values (v_owner, 'join_request', old.intent_id, old.user_id,
              v_name || ' left "' || coalesce(v_title, 'your plan') || '" — a spot opened up');
    end if;
  end if;
  return old;
end $$;

drop trigger if exists on_join_request_delete on public.join_requests;
create trigger on_join_request_delete
  after delete on public.join_requests
  for each row execute function public.handle_join_request_delete();
