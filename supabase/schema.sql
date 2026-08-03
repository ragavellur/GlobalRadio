-- Favorites table for Global Radio Explorer
-- Run this in: Supabase Dashboard -> SQL Editor

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null,
  city text not null,
  city_key text not null,
  station_name text not null,
  station_url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, station_url)
);

alter table public.favorites enable row level security;

drop policy if exists "own select" on public.favorites;
create policy "own select" on public.favorites
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.favorites;
create policy "own insert" on public.favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "own delete" on public.favorites;
create policy "own delete" on public.favorites
  for delete using (auth.uid() = user_id);
