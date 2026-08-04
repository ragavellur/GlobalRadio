-- ============================================================================
-- PLAY QUEUE (web -> Alexa handoff)
-- The web app enqueues a station ("Send to Alexa"); the next time the user
-- opens the skill on an Echo ("Alexa, play global radio"), the skill pops the
-- newest entry and starts streaming it.
-- ============================================================================
create table if not exists public.play_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  station_name text not null,
  station_url text not null,
  city text not null default '',
  country text not null default '',
  created_at timestamptz not null default now()
);

alter table public.play_queue enable row level security;

drop policy if exists "play_queue: users manage their own" on public.play_queue;
create policy "play_queue: users manage their own"
  on public.play_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
