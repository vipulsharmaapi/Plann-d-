-- Plann'd schema v1 — run in the Supabase SQL editor.
-- Safe to re-run: uses if-not-exists / drop-if-exists where possible.

create extension if not exists postgis;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- profiles: public info about a user (auth.users stays private)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null default '',
  join_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by everyone" on public.profiles;
create policy "profiles readable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users manage own profile" on public.profiles;
create policy "users manage own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- intents: the core object — activity + time window + place
-- user_id is nullable so demo/seeded rows can exist before auth ships.
-- ---------------------------------------------------------------------------
create table if not exists public.intents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  poster_name text not null default 'Someone',
  activity text not null check (activity in ('badminton','football','cricket','running','coffee')),
  title text not null check (char_length(title) between 3 and 80),
  note text check (char_length(note) <= 280),
  lat double precision not null,
  lng double precision not null,
  location geography(point, 4326) generated always as
    (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  venue_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  spots_needed int not null check (spots_needed between 1 and 20),
  spots_filled int not null default 0,
  women_only boolean not null default false,
  whatsapp_link text,
  status text not null default 'open' check (status in ('open','full','expired','cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists intents_location_idx on public.intents using gist (location);
create index if not exists intents_open_today_idx on public.intents (status, ends_at);

alter table public.intents enable row level security;

drop policy if exists "intents readable by everyone" on public.intents;
create policy "intents readable by everyone"
  on public.intents for select using (true);

drop policy if exists "authenticated users can post intents" on public.intents;
create policy "authenticated users can post intents"
  on public.intents for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "owners can update their intents" on public.intents;
create policy "owners can update their intents"
  on public.intents for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NOTE: whatsapp_link is readable by everyone in v1. Before real launch,
-- move it out of the public select (view or column-level grant) so only
-- accepted joiners see it.

-- ---------------------------------------------------------------------------
-- join_requests
-- ---------------------------------------------------------------------------
create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  intent_id uuid not null references public.intents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (intent_id, user_id)
);

alter table public.join_requests enable row level security;

drop policy if exists "requesters and intent owners can read requests" on public.join_requests;
create policy "requesters and intent owners can read requests"
  on public.join_requests for select to authenticated
  using (
    auth.uid() = user_id
    or auth.uid() = (select user_id from public.intents where id = intent_id)
  );

drop policy if exists "authenticated users can request to join" on public.join_requests;
create policy "authenticated users can request to join"
  on public.join_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "intent owners can respond to requests" on public.join_requests;
create policy "intent owners can respond to requests"
  on public.join_requests for update to authenticated
  using (auth.uid() = (select user_id from public.intents where id = intent_id));

-- ---------------------------------------------------------------------------
-- reports: safety flagging
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users on delete set null,
  intent_id uuid references public.intents on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "authenticated users can report" on public.reports;
create policy "authenticated users can report"
  on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- Realtime: push intent inserts/updates to connected clients
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.intents;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Expiry: hourly sweep closes intents whose window has passed
-- ---------------------------------------------------------------------------
select cron.schedule(
  'expire-intents',
  '5 * * * *',
  $$update public.intents set status = 'expired' where status in ('open','full') and ends_at < now()$$
);

-- ---------------------------------------------------------------------------
-- Seed: demo intents for today evening (IST) around Jaipur, so the map has
-- live pins immediately. Delete these rows whenever you like.
-- ---------------------------------------------------------------------------
insert into public.intents
  (poster_name, activity, title, note, lat, lng, venue_name, starts_at, ends_at, spots_needed, spots_filled, women_only)
values
  ('Aarav', 'badminton', 'Badminton doubles, need 2', 'Intermediate level, court booked',
   26.8535, 75.8123, 'Rajat Path Sports Arena, Malviya Nagar',
   (current_date + time '19:00') at time zone 'Asia/Kolkata',
   (current_date + time '21:00') at time zone 'Asia/Kolkata', 3, 1, false),
  ('Kabir', 'football', '5-a-side turf game', 'Turf booked, split ₹150 each',
   26.9115, 75.7401, 'Kick Off Turf, Vaishali Nagar',
   (current_date + time '20:00') at time zone 'Asia/Kolkata',
   (current_date + time '21:00') at time zone 'Asia/Kolkata', 4, 2, false),
  ('Ishita', 'running', 'Evening 5K, easy pace', null,
   26.8994, 75.8069, 'Central Park, C-Scheme',
   (current_date + time '18:30') at time zone 'Asia/Kolkata',
   (current_date + time '19:30') at time zone 'Asia/Kolkata', 5, 0, true),
  ('Rohan', 'cricket', 'Box cricket, need 3 players', null,
   26.8467, 75.7794, 'Stumps N Runs, Durgapura',
   (current_date + time '18:00') at time zone 'Asia/Kolkata',
   (current_date + time '20:00') at time zone 'Asia/Kolkata', 3, 1, false),
  ('Vipul', 'coffee', 'Coffee + startup talk', 'Building something? Come nerd out.',
   26.9057, 75.8011, 'Curious Life Coffee, C-Scheme',
   (current_date + time '17:00') at time zone 'Asia/Kolkata',
   (current_date + time '18:30') at time zone 'Asia/Kolkata', 4, 2, false);
