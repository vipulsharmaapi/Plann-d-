-- Keep private block pairs out of Postgres Changes: DELETE payloads bypass RLS.
-- The UI refreshes its own block list after actions, on focus and periodically.
begin;
do $$ begin
  if exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='user_blocks') then
    alter publication supabase_realtime drop table public.user_blocks;
  end if;
end $$;
insert into public.app_migrations(version) values('202611040002') on conflict do nothing;
commit;
