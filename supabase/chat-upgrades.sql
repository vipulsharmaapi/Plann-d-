-- Plann'd migration 10: chat read receipts + replies.
-- Run in the Supabase SQL editor. Safe to re-run.

-- Reply threading: a message can point at the message it answers
alter table public.messages
  add column if not exists reply_to uuid references public.messages(id) on delete set null;

-- Per-participant read cursor: "I've seen this chat up to <time>"
create table if not exists public.chat_reads (
  intent_id uuid not null references public.intents on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (intent_id, user_id)
);

alter table public.chat_reads enable row level security;

drop policy if exists "participants see read cursors" on public.chat_reads;
create policy "participants see read cursors"
  on public.chat_reads for select to authenticated
  using (public.is_intent_participant(intent_id, auth.uid()));

drop policy if exists "participants set own read cursor" on public.chat_reads;
create policy "participants set own read cursor"
  on public.chat_reads for insert to authenticated
  with check (auth.uid() = user_id and public.is_intent_participant(intent_id, auth.uid()));

drop policy if exists "participants update own read cursor" on public.chat_reads;
create policy "participants update own read cursor"
  on public.chat_reads for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  alter publication supabase_realtime add table public.chat_reads;
exception when duplicate_object then null;
end $$;
